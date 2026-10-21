from __future__ import annotations

import logging
import os
import platform
import socket
import subprocess
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

import psutil
from sqlalchemy.orm import Session

from app.models.network import Certificate, NetworkInterface, SystemConfig

logger = logging.getLogger(__name__)

DEV_MODE = platform.system() != "Linux" or os.getenv("STORAWEB_DEV", "0") == "1"


class NetworkService:

    @staticmethod
    def _run_command(cmd: list[str]) -> tuple[str, str, int]:
        if DEV_MODE:
            logger.info("[DEV] Would run: %s", " ".join(cmd))
            return "", "", 0
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return result.stdout, result.stderr, result.returncode
        except Exception as exc:
            logger.exception("Command execution failed: %s", " ".join(cmd))
            return "", str(exc), 1

    @staticmethod
    def list_interfaces(db: Session) -> list[NetworkInterface]:
        return db.query(NetworkInterface).order_by(NetworkInterface.name).all()

    @staticmethod
    def get_interface(db: Session, iface_id: int) -> NetworkInterface:
        iface = db.query(NetworkInterface).filter(NetworkInterface.id == iface_id).first()
        if not iface:
            raise ValueError(f"Network interface {iface_id} not found")
        return iface

    @classmethod
    def scan_interfaces(cls, db: Session) -> list[NetworkInterface]:
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()

        results: list[NetworkInterface] = []
        for name, addr_list in addrs.items():
            ipv4 = None
            netmask = None
            ipv6 = None
            mac = None

            for addr in addr_list:
                if addr.family == socket.AF_INET:
                    ipv4 = addr.address
                    netmask = addr.netmask
                elif hasattr(socket, "AF_INET6") and addr.family == socket.AF_INET6:
                    ipv6 = addr.address
                elif hasattr(psutil, "AF_LINK") and addr.family == psutil.AF_LINK:
                    mac = addr.address

            iface_stat = stats.get(name)
            state = "up" if (iface_stat and iface_stat.isup) else "down"
            speed = f"{iface_stat.speed}Mbps" if (iface_stat and iface_stat.speed > 0) else None
            mtu = iface_stat.mtu if iface_stat else 1500

            if name.startswith(("wl", "wlan")):
                iface_type = "wireless"
            elif name.startswith("lo"):
                iface_type = "loopback"
            elif name.startswith(("br", "bridge")):
                iface_type = "bridge"
            elif name.startswith(("bond", "team")):
                iface_type = "bond"
            elif name.startswith(("vlan", ".")) or "." in name:
                iface_type = "vlan"
            else:
                iface_type = "physical"

            existing = db.query(NetworkInterface).filter(NetworkInterface.name == name).first()
            if existing:
                existing.state = state
                existing.speed = speed
                existing.mtu = mtu
                existing.mac_address = mac or existing.mac_address
                existing.ipv4_address = ipv4 or existing.ipv4_address
                existing.ipv4_netmask = netmask or existing.ipv4_netmask
                existing.ipv6_address = ipv6 or existing.ipv6_address
                results.append(existing)
            else:
                new_iface = NetworkInterface(
                    name=name,
                    interface_type=iface_type,
                    ipv4_address=ipv4,
                    ipv4_netmask=netmask,
                    ipv6_address=ipv6,
                    mtu=mtu,
                    dhcp=True,
                    state=state,
                    speed=speed,
                    mac_address=mac,
                )
                db.add(new_iface)
                results.append(new_iface)

        db.commit()
        for r in results:
            db.refresh(r)
        return results

    @classmethod
    def update_interface(
        cls, db: Session, iface_id: int, data: dict[str, Any], rollback_delay: int = 60
    ) -> NetworkInterface:
        iface = db.query(NetworkInterface).filter(NetworkInterface.id == iface_id).first()
        if not iface:
            raise ValueError(f"Network interface {iface_id} not found")

        old_state = {
            "ipv4_address": iface.ipv4_address,
            "ipv4_netmask": iface.ipv4_netmask,
            "gateway": iface.gateway,
            "dhcp": iface.dhcp,
            "mtu": iface.mtu,
        }

        for key, value in data.items():
            if hasattr(iface, key) and value is not None:
                setattr(iface, key, value)

        db.commit()
        db.refresh(iface)

        if not iface.dhcp and iface.ipv4_address:
            cmd = ["ip", "addr", "add", f"{iface.ipv4_address}/{iface.ipv4_netmask or '24'}", "dev", iface.name]
            cls._run_command(cmd)
            if iface.gateway:
                cls._run_command(["ip", "route", "add", "default", "via", iface.gateway, "dev", iface.name])

        if rollback_delay > 0 and not DEV_MODE:
            def rollback() -> None:
                logger.warning("Rolling back network config for %s", iface.name)
                for k, v in old_state.items():
                    setattr(iface, k, v)
                db.commit()

            timer = threading.Timer(rollback_delay, rollback)
            timer.daemon = True
            timer.start()

        return iface

    @staticmethod
    def get_dns_config(db: Session | None = None) -> dict[str, Any]:
        servers: list[str] = []
        domain: str = ""

        if not DEV_MODE and os.path.exists("/etc/resolv.conf"):
            try:
                with open("/etc/resolv.conf", "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("nameserver"):
                            parts = line.split()
                            if len(parts) >= 2:
                                servers.append(parts[1])
                        elif line.startswith("domain") or line.startswith("search"):
                            parts = line.split()
                            if len(parts) >= 2:
                                domain = parts[1]
            except Exception:
                logger.exception("Failed to read /etc/resolv.conf")

        if not servers and db:
            cfg = db.query(SystemConfig).filter(SystemConfig.key == "dns").first()
            if cfg and cfg.value:
                servers = cfg.value.get("servers", [])
                domain = cfg.value.get("domain", "")

        return {"servers": servers, "domain": domain}

    @classmethod
    def set_dns_config(
        cls, servers: list[str], domain: str = "", db: Session | None = None
    ) -> None:
        if db:
            cfg = db.query(SystemConfig).filter(SystemConfig.key == "dns").first()
            if not cfg:
                cfg = SystemConfig(key="dns", value={"servers": servers, "domain": domain})
                db.add(cfg)
            else:
                cfg.value = {"servers": servers, "domain": domain}
            db.commit()

        if not DEV_MODE:
            try:
                lines = []
                if domain:
                    lines.append(f"search {domain}")
                for s in servers:
                    lines.append(f"nameserver {s}")
                with open("/etc/resolv.conf", "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
            except Exception:
                logger.exception("Failed to write /etc/resolv.conf")

    @staticmethod
    def get_hostname() -> str:
        return socket.gethostname()

    @classmethod
    def set_hostname(cls, hostname: str, db: Session | None = None) -> None:
        if db:
            cfg = db.query(SystemConfig).filter(SystemConfig.key == "hostname").first()
            if not cfg:
                cfg = SystemConfig(key="hostname", value={"hostname": hostname})
                db.add(cfg)
            else:
                cfg.value = {"hostname": hostname}
            db.commit()

        cls._run_command(["hostnamectl", "set-hostname", hostname])

    @staticmethod
    def list_certificates(db: Session) -> list[Certificate]:
        return db.query(Certificate).order_by(Certificate.created_at.desc()).all()

    @classmethod
    def create_certificate(cls, db: Session, data: dict[str, Any]) -> Certificate:
        cert_type = data.get("cert_type", "self_signed")
        name = data.get("name", "cert")
        san = data.get("san", {})

        cert_text: str | None = data.get("certificate")
        key_text: str | None = data.get("private_key")
        now = datetime.now(timezone.utc)
        valid_until = now + timedelta(days=data.get("valid_days", 365))

        if not cert_text and cert_type == "self_signed":
            cert_text = f"-----BEGIN CERTIFICATE-----\nMOCK_CERT_{name}\n-----END CERTIFICATE-----"
            key_text = f"-----BEGIN PRIVATE KEY-----\nMOCK_KEY_{name}\n-----END PRIVATE KEY-----"

        cert = Certificate(
            name=name,
            cert_type=cert_type,
            certificate=cert_text,
            private_key=key_text,
            csr=data.get("csr"),
            issuer=data.get("issuer", "StoraWeb CA"),
            valid_from=now,
            valid_until=valid_until,
            san=san,
            is_default=data.get("is_default", False),
            acme_config=data.get("acme_config"),
        )

        if cert.is_default:
            db.query(Certificate).update({Certificate.is_default: False})

        db.add(cert)
        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def delete_certificate(db: Session, cert_id: int) -> None:
        cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if not cert:
            raise ValueError(f"Certificate {cert_id} not found")
        db.delete(cert)
        db.commit()
