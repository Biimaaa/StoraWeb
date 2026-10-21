from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


class AuditService:

    @staticmethod
    def log(
        db: Session,
        actor: str,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        detail: dict[str, Any] | None = None,
        ip_address: str = "127.0.0.1",
        result: str = "success",
    ) -> AuditLog:
        audit_entry = AuditLog(
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            detail=detail,
            ip_address=ip_address,
            result=result,
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry

    @staticmethod
    def list_logs(
        db: Session,
        filters: dict[str, Any] | None = None,
        page: int = 1,
        per_page: int = 50,
    ) -> tuple[list[AuditLog], int]:
        query = db.query(AuditLog)

        if filters:
            if "actor" in filters and filters["actor"]:
                query = query.filter(AuditLog.actor == filters["actor"])
            if "action" in filters and filters["action"]:
                query = query.filter(AuditLog.action == filters["action"])
            if "resource_type" in filters and filters["resource_type"]:
                query = query.filter(AuditLog.resource_type == filters["resource_type"])
            if "resource_id" in filters and filters["resource_id"]:
                query = query.filter(AuditLog.resource_id == str(filters["resource_id"]))
            if "result" in filters and filters["result"]:
                query = query.filter(AuditLog.result == filters["result"])
            if "start_time" in filters and filters["start_time"]:
                start = filters["start_time"]
                if isinstance(start, str):
                    start = datetime.fromisoformat(start)
                query = query.filter(AuditLog.created_at >= start)
            if "end_time" in filters and filters["end_time"]:
                end = filters["end_time"]
                if isinstance(end, str):
                    end = datetime.fromisoformat(end)
                query = query.filter(AuditLog.created_at <= end)

        total = query.count()
        offset = (max(page, 1) - 1) * per_page
        logs = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(per_page).all()

        return logs, total

    @classmethod
    def export_logs(
        cls,
        db: Session,
        filters: dict[str, Any] | None = None,
        export_format: str = "json",
    ) -> bytes:
        query = db.query(AuditLog)

        if filters:
            if "actor" in filters and filters["actor"]:
                query = query.filter(AuditLog.actor == filters["actor"])
            if "action" in filters and filters["action"]:
                query = query.filter(AuditLog.action == filters["action"])
            if "resource_type" in filters and filters["resource_type"]:
                query = query.filter(AuditLog.resource_type == filters["resource_type"])
            if "resource_id" in filters and filters["resource_id"]:
                query = query.filter(AuditLog.resource_id == str(filters["resource_id"]))
            if "result" in filters and filters["result"]:
                query = query.filter(AuditLog.result == filters["result"])
            if "start_time" in filters and filters["start_time"]:
                start = filters["start_time"]
                if isinstance(start, str):
                    start = datetime.fromisoformat(start)
                query = query.filter(AuditLog.created_at >= start)
            if "end_time" in filters and filters["end_time"]:
                end = filters["end_time"]
                if isinstance(end, str):
                    end = datetime.fromisoformat(end)
                query = query.filter(AuditLog.created_at <= end)

        logs = query.order_by(desc(AuditLog.created_at)).all()

        if export_format.lower() == "csv":
            output = io.StringIO()
            fieldnames = [
                "id",
                "actor",
                "action",
                "resource_type",
                "resource_id",
                "ip_address",
                "result",
                "created_at",
                "detail",
            ]
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            for log in logs:
                writer.writerow({
                    "id": log.id,
                    "actor": log.actor,
                    "action": log.action,
                    "resource_type": log.resource_type,
                    "resource_id": log.resource_id or "",
                    "ip_address": log.ip_address,
                    "result": log.result,
                    "created_at": log.created_at.isoformat() if log.created_at else "",
                    "detail": json.dumps(log.detail) if log.detail else "",
                })
            return output.getvalue().encode("utf-8")

        data = [
            {
                "id": log.id,
                "actor": log.actor,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "result": log.result,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "detail": log.detail,
            }
            for log in logs
        ]
        return json.dumps(data, indent=2, default=str).encode("utf-8")
