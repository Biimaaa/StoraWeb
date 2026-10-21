from __future__ import annotations

import json
import logging
import os
import platform
import subprocess
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.storage import Dataset, Disk, Pool, Snapshot
from app.schemas.storage import (
    DatasetCreate,
    DatasetUpdate,
    PoolCreate,
    SnapshotCreate,
    VdevType,
)

logger = logging.getLogger(__name__)

DEV_MODE = platform.system() != "Linux" or os.getenv("STORAWEB_DEV", "0") == "1"


class StorageService:

    @staticmethod
    def _run_command(cmd: list[str]) -> tuple[str, str, int]:
        """Execute a system command. In dev mode, log and return mock success."""
        if DEV_MODE:
            logger.info("[DEV] Would run: %s", " ".join(cmd))
            return "", "", 0
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            )
            return result.stdout, result.stderr, result.returncode
        except FileNotFoundError:
            logger.error("Command not found: %s", cmd[0])
            return "", f"Command not found: {cmd[0]}", 127
        except subprocess.TimeoutExpired:
            logger.error("Command timed out: %s", " ".join(cmd))
            return "", "Command timed out", 124
        except Exception as exc:
            logger.exception("Command execution failed: %s", " ".join(cmd))
            return "", str(exc), 1

    @staticmethod
    def list_disks(db: Session) -> list[Disk]:
        return db.query(Disk).order_by(Disk.device_name).all()

    @staticmethod
    def get_disk(db: Session, disk_id: int) -> Disk:
        disk = db.query(Disk).filter(Disk.id == disk_id).first()
        if not disk:
            raise ValueError(f"Disk {disk_id} not found")
        return disk

    @classmethod
    def scan_disks(cls, db: Session) -> list[Disk]:
        stdout, stderr, rc = cls._run_command(
            ["lsblk", "--json", "--bytes", "--output",
             "NAME,SERIAL,MODEL,SIZE,TYPE,TRAN,ROTA"]
        )
        discovered: list[dict[str, Any]] = []
        if rc == 0 and stdout.strip():
            try:
                data = json.loads(stdout)
                for blkdev in data.get("blockdevices", []):
                    if blkdev.get("type") != "disk":
                        continue
                    discovered.append({
                        "device_name": f"/dev/{blkdev['name']}",
                        "serial": blkdev.get("serial") or blkdev["name"],
                        "model": blkdev.get("model") or "Unknown",
                        "capacity_bytes": int(blkdev.get("size", 0)),
                        "disk_type": "HDD" if blkdev.get("rota") else "SSD",
                    })
            except (json.JSONDecodeError, KeyError):
                logger.exception("Failed to parse lsblk output")

        if not discovered:
            discovered = [
                {
                    "device_name": f"/dev/sd{chr(97 + i)}",
                    "serial": f"MOCK-SERIAL-{i:04d}",
                    "model": "Virtual Disk",
                    "capacity_bytes": (i + 1) * 1_000_000_000_000,
                    "disk_type": "HDD" if i < 4 else "SSD",
                }
                for i in range(6)
            ]

        results: list[Disk] = []
        for d in discovered:
            existing = db.query(Disk).filter(Disk.serial == d["serial"]).first()
            if existing:
                existing.device_name = d["device_name"]
                existing.model = d["model"]
                existing.capacity_bytes = d["capacity_bytes"]
                existing.disk_type = d["disk_type"]
                results.append(existing)
            else:
                disk = Disk(
                    device_name=d["device_name"],
                    serial=d["serial"],
                    model=d["model"],
                    capacity_bytes=d["capacity_bytes"],
                    disk_type=d["disk_type"],
                    smart_status="UNKNOWN",
                    status="ONLINE",
                )
                db.add(disk)
                results.append(disk)
        db.commit()
        for r in results:
            db.refresh(r)
        return results

    @classmethod
    def create_pool(cls, db: Session, pool_data: PoolCreate) -> Pool:
        existing = db.query(Pool).filter(Pool.name == pool_data.name).first()
        if existing:
            raise ValueError(f"Pool '{pool_data.name}' already exists")

        all_disk_ids: list[int] = []
        topology_dict: dict[str, Any] = {}
        cmd_parts: list[str] = ["zpool", "create"]

        if pool_data.encryption:
            cmd_parts.extend(["-O", "encryption=aes-256-gcm", "-O", "keyformat=passphrase"])

        cmd_parts.append(pool_data.name)

        for purpose in ("data", "cache", "log", "spare", "special"):
            vdevs = getattr(pool_data.topology, purpose, None)
            if not vdevs:
                continue
            serialized_vdevs: list[dict[str, Any]] = []
            for vdev in vdevs:
                disks = db.query(Disk).filter(Disk.id.in_(vdev.disk_ids)).all()
                if len(disks) != len(vdev.disk_ids):
                    raise ValueError("One or more disks not found")
                for disk in disks:
                    if disk.pool_id is not None:
                        raise ValueError(
                            f"Disk {disk.device_name} is already assigned to a pool"
                        )
                all_disk_ids.extend(vdev.disk_ids)
                device_names = [d.device_name for d in disks]

                if purpose != "data":
                    cmd_parts.append(purpose)

                if vdev.vdev_type != VdevType.stripe:
                    cmd_parts.append(vdev.vdev_type.value)

                cmd_parts.extend(device_names)
                serialized_vdevs.append({
                    "vdev_type": vdev.vdev_type.value,
                    "disk_ids": vdev.disk_ids,
                    "devices": device_names,
                    "purpose": purpose,
                })
            topology_dict[purpose] = serialized_vdevs

        stdout, stderr, rc = cls._run_command(cmd_parts)
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zpool create failed: {stderr}")

        total = sum(
            d.capacity_bytes
            for d in db.query(Disk).filter(Disk.id.in_(all_disk_ids)).all()
        )
        pool = Pool(
            name=pool_data.name,
            topology=topology_dict,
            status="ONLINE",
            health="ONLINE",
            total_bytes=total,
            used_bytes=0,
            free_bytes=total,
            fragmentation=0,
            autotrim=True,
        )
        db.add(pool)
        db.flush()

        db.query(Disk).filter(Disk.id.in_(all_disk_ids)).update(
            {Disk.pool_id: pool.id, Disk.role: "data", Disk.status: "ONLINE"},
            synchronize_session="fetch",
        )
        db.commit()
        db.refresh(pool)
        return pool

    @staticmethod
    def get_pool(db: Session, pool_id: int) -> Pool:
        pool = db.query(Pool).filter(Pool.id == pool_id).first()
        if not pool:
            raise ValueError(f"Pool {pool_id} not found")
        return pool

    @staticmethod
    def list_pools(db: Session) -> list[Pool]:
        return db.query(Pool).order_by(Pool.name).all()

    @staticmethod
    def update_pool(db: Session, pool_id: int, data: dict[str, Any]) -> Pool:
        pool = db.query(Pool).filter(Pool.id == pool_id).first()
        if not pool:
            raise ValueError(f"Pool {pool_id} not found")
        for key, value in data.items():
            if hasattr(pool, key) and value is not None:
                setattr(pool, key, value)
        db.commit()
        db.refresh(pool)
        return pool

    @classmethod
    def delete_pool(cls, db: Session, pool_id: int, confirm_name: str) -> None:
        pool = db.query(Pool).filter(Pool.id == pool_id).first()
        if not pool:
            raise ValueError(f"Pool {pool_id} not found")
        if pool.name != confirm_name:
            raise ValueError("Confirmation name does not match pool name")

        stdout, stderr, rc = cls._run_command(["zpool", "destroy", "-f", pool.name])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zpool destroy failed: {stderr}")

        db.query(Disk).filter(Disk.pool_id == pool_id).update(
            {Disk.pool_id: None, Disk.role: None}, synchronize_session="fetch"
        )
        db.delete(pool)
        db.commit()

    @classmethod
    def export_pool(cls, db: Session, pool_id: int) -> None:
        pool = cls.get_pool(db, pool_id)
        stdout, stderr, rc = cls._run_command(["zpool", "export", pool.name])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zpool export failed: {stderr}")
        pool.status = "EXPORTED"
        db.commit()

    @classmethod
    def import_pool(cls, db: Session, pool_name: str) -> Pool:
        stdout, stderr, rc = cls._run_command(["zpool", "import", pool_name])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zpool import failed: {stderr}")

        pool = db.query(Pool).filter(Pool.name == pool_name).first()
        if pool:
            pool.status = "ONLINE"
            pool.health = "ONLINE"
        else:
            pool = Pool(
                name=pool_name,
                status="ONLINE",
                health="ONLINE",
                total_bytes=0,
                used_bytes=0,
                free_bytes=0,
                fragmentation=0,
                autotrim=True,
            )
            db.add(pool)
        db.commit()
        db.refresh(pool)
        return pool

    @classmethod
    def get_pool_status(cls, db: Session, pool_id: int) -> dict[str, Any]:
        pool = cls.get_pool(db, pool_id)
        stdout, stderr, rc = cls._run_command(["zpool", "status", pool.name])

        status: dict[str, Any] = {
            "name": pool.name,
            "state": pool.health,
            "status": pool.status,
            "scan": None,
            "errors": pool.scrub_errors,
            "raw_output": stdout if rc == 0 else None,
        }

        if rc == 0 and stdout:
            for line in stdout.splitlines():
                stripped = line.strip()
                if stripped.startswith("state:"):
                    status["state"] = stripped.split(":", 1)[1].strip()
                elif stripped.startswith("scan:"):
                    status["scan"] = stripped.split(":", 1)[1].strip()
                elif stripped.startswith("errors:"):
                    status["errors"] = stripped.split(":", 1)[1].strip()

        return status

    @classmethod
    def start_scrub(cls, db: Session, pool_id: int) -> Job:
        pool = cls.get_pool(db, pool_id)
        stdout, stderr, rc = cls._run_command(["zpool", "scrub", pool.name])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zpool scrub failed: {stderr}")

        job = Job(
            job_type="scrub",
            description=f"Scrub pool {pool.name}",
            status="running",
            progress=0,
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @classmethod
    def expand_pool(cls, db: Session, pool_id: int, vdev_config: dict[str, Any]) -> Pool:
        pool = cls.get_pool(db, pool_id)
        vdev_type = vdev_config.get("vdev_type", "stripe")
        disk_ids: list[int] = vdev_config.get("disk_ids", [])

        disks = db.query(Disk).filter(Disk.id.in_(disk_ids)).all()
        if len(disks) != len(disk_ids):
            raise ValueError("One or more disks not found")
        for disk in disks:
            if disk.pool_id is not None:
                raise ValueError(f"Disk {disk.device_name} is already assigned to a pool")

        device_names = [d.device_name for d in disks]
        cmd = ["zpool", "add", pool.name]
        if vdev_type != "stripe":
            cmd.append(vdev_type)
        cmd.extend(device_names)

        stdout, stderr, rc = cls._run_command(cmd)
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zpool add failed: {stderr}")

        db.query(Disk).filter(Disk.id.in_(disk_ids)).update(
            {Disk.pool_id: pool.id, Disk.role: "data", Disk.status: "ONLINE"},
            synchronize_session="fetch",
        )

        added_capacity = sum(d.capacity_bytes for d in disks)
        pool.total_bytes += added_capacity
        pool.free_bytes += added_capacity

        topology = pool.topology or {}
        data_vdevs = topology.get("data", [])
        data_vdevs.append({
            "vdev_type": vdev_type,
            "disk_ids": disk_ids,
            "devices": device_names,
            "purpose": "data",
        })
        topology["data"] = data_vdevs
        pool.topology = topology

        db.commit()
        db.refresh(pool)
        return pool

    @classmethod
    def replace_disk(
        cls, db: Session, pool_id: int, old_disk_id: int, new_disk_id: int
    ) -> Job:
        pool = cls.get_pool(db, pool_id)
        old_disk = cls.get_disk(db, old_disk_id)
        new_disk = cls.get_disk(db, new_disk_id)

        if old_disk.pool_id != pool_id:
            raise ValueError(f"Disk {old_disk.device_name} is not part of pool {pool.name}")
        if new_disk.pool_id is not None:
            raise ValueError(f"Disk {new_disk.device_name} is already assigned to a pool")

        stdout, stderr, rc = cls._run_command(
            ["zpool", "replace", pool.name, old_disk.device_name, new_disk.device_name]
        )
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zpool replace failed: {stderr}")

        new_disk.pool_id = pool_id
        new_disk.role = old_disk.role
        new_disk.status = "RESILVERING"
        old_disk.pool_id = None
        old_disk.role = None
        old_disk.status = "REMOVED"

        job = Job(
            job_type="resilver",
            description=f"Replace {old_disk.device_name} with {new_disk.device_name} in {pool.name}",
            status="running",
            progress=0,
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @classmethod
    def create_dataset(cls, db: Session, data: DatasetCreate) -> Dataset:
        pool = cls.get_pool(db, data.pool_id)

        if data.parent_id:
            parent = db.query(Dataset).filter(Dataset.id == data.parent_id).first()
            if not parent:
                raise ValueError(f"Parent dataset {data.parent_id} not found")
            path = f"{parent.path}/{data.name}"
        else:
            path = f"{pool.name}/{data.name}"

        existing = db.query(Dataset).filter(Dataset.path == path).first()
        if existing:
            raise ValueError(f"Dataset '{path}' already exists")

        record_size_str = data.record_size
        if isinstance(data.record_size, int):
            if data.record_size >= 1048576:
                record_size_str = f"{data.record_size // 1048576}M"
            elif data.record_size >= 1024:
                record_size_str = f"{data.record_size // 1024}K"
            else:
                record_size_str = str(data.record_size)

        cmd = ["zfs", "create"]
        cmd.extend(["-o", f"compression={data.compression}"])
        cmd.extend(["-o", f"dedup={'on' if data.dedup else 'off'}"])
        cmd.extend(["-o", f"sync={data.sync_mode}"])
        cmd.extend(["-o", f"recordsize={record_size_str}"])
        if data.quota_bytes:
            cmd.extend(["-o", f"quota={data.quota_bytes}"])
        if data.reservation_bytes:
            cmd.extend(["-o", f"reservation={data.reservation_bytes}"])
        if data.encryption:
            cmd.extend(["-o", "encryption=aes-256-gcm", "-o", "keyformat=passphrase"])
        cmd.append(path)

        stdout, stderr, rc = cls._run_command(cmd)
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zfs create failed: {stderr}")

        mountpoint = f"/{path}"
        dataset = Dataset(
            name=data.name,
            path=path,
            pool_id=data.pool_id,
            parent_id=data.parent_id,
            dataset_type=data.dataset_type,
            preset=data.preset,
            compression=data.compression,
            dedup=data.dedup,
            sync_mode=data.sync_mode,
            record_size=str(record_size_str),
            atime=False,
            quota_bytes=data.quota_bytes,
            reservation_bytes=data.reservation_bytes,
            used_bytes=0,
            available_bytes=pool.free_bytes,
            encryption=data.encryption,
            encryption_algorithm="aes-256-gcm" if data.encryption else None,
            mountpoint=mountpoint,
            readonly=False,
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        return dataset

    @staticmethod
    def get_dataset(db: Session, dataset_id: int) -> Dataset:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        return dataset

    @staticmethod
    def list_datasets(db: Session, pool_id: int | None = None) -> list[Dataset]:
        query = db.query(Dataset)
        if pool_id is not None:
            query = query.filter(Dataset.pool_id == pool_id)
        return query.order_by(Dataset.path).all()

    @staticmethod
    def update_dataset(db: Session, dataset_id: int, data: dict[str, Any]) -> Dataset:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        for key, value in data.items():
            if hasattr(dataset, key) and value is not None:
                setattr(dataset, key, value)
        db.commit()
        db.refresh(dataset)
        return dataset

    @classmethod
    def delete_dataset(cls, db: Session, dataset_id: int, confirm_name: str) -> None:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        if dataset.name != confirm_name:
            raise ValueError("Confirmation name does not match dataset name")

        stdout, stderr, rc = cls._run_command(["zfs", "destroy", "-r", dataset.path])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zfs destroy failed: {stderr}")

        db.delete(dataset)
        db.commit()

    @classmethod
    def create_snapshot(cls, db: Session, data: SnapshotCreate) -> Snapshot:
        dataset = db.query(Dataset).filter(Dataset.id == data.dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {data.dataset_id} not found")

        snap_name = data.name or datetime.now(timezone.utc).strftime("auto-%Y%m%d-%H%M%S")
        full_name = f"{dataset.path}@{snap_name}"

        existing = db.query(Snapshot).filter(Snapshot.full_name == full_name).first()
        if existing:
            raise ValueError(f"Snapshot '{full_name}' already exists")

        stdout, stderr, rc = cls._run_command(["zfs", "snapshot", full_name])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zfs snapshot failed: {stderr}")

        snapshot = Snapshot(
            name=snap_name,
            dataset_id=data.dataset_id,
            full_name=full_name,
            size_bytes=0,
            referenced_bytes=dataset.used_bytes,
            source="manual",
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot

    @staticmethod
    def list_snapshots(db: Session, dataset_id: int | None = None) -> list[Snapshot]:
        query = db.query(Snapshot)
        if dataset_id is not None:
            query = query.filter(Snapshot.dataset_id == dataset_id)
        return query.order_by(Snapshot.created_at.desc()).all()

    @classmethod
    def delete_snapshot(cls, db: Session, snapshot_id: int) -> None:
        snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).first()
        if not snapshot:
            raise ValueError(f"Snapshot {snapshot_id} not found")

        stdout, stderr, rc = cls._run_command(["zfs", "destroy", snapshot.full_name])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zfs destroy snapshot failed: {stderr}")

        db.delete(snapshot)
        db.commit()

    @classmethod
    def rollback_snapshot(cls, db: Session, snapshot_id: int, confirm_name: str) -> None:
        snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).first()
        if not snapshot:
            raise ValueError(f"Snapshot {snapshot_id} not found")
        if confirm_name not in (snapshot.name, snapshot.full_name):
            raise ValueError(f"Confirmation name '{confirm_name}' does not match snapshot name '{snapshot.name}'")

        stdout, stderr, rc = cls._run_command(["zfs", "rollback", "-r", snapshot.full_name])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"zfs rollback failed: {stderr}")

        later_snapshots = (
            db.query(Snapshot)
            .filter(
                Snapshot.dataset_id == snapshot.dataset_id,
                Snapshot.created_at > snapshot.created_at,
            )
            .all()
        )
        for s in later_snapshots:
            db.delete(s)
        db.commit()
