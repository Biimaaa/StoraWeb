from __future__ import annotations

import json
import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any
from urllib import request as urllib_request

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert, NotificationChannel
from app.models.storage import Disk, Pool

logger = logging.getLogger(__name__)


class AlertService:

    @staticmethod
    def create_alert(
        db: Session,
        level: str,
        source: str,
        title: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> Alert:
        alert = Alert(
            level=level,
            source=source,
            title=title,
            message=message,
            data=data,
            is_active=True,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        channels = (
            db.query(NotificationChannel)
            .filter(NotificationChannel.enabled.is_(True))
            .all()
        )
        AlertService.send_notification(alert, channels)

        return alert

    @staticmethod
    def list_alerts(
        db: Session,
        active_only: bool = True,
        level: str | None = None,
    ) -> list[Alert]:
        query = db.query(Alert)
        if active_only:
            query = query.filter(Alert.is_active.is_(True))
        if level:
            query = query.filter(Alert.level == level)
        return query.order_by(Alert.created_at.desc()).all()

    @staticmethod
    def dismiss_alert(db: Session, alert_id: int, dismissed_by: str) -> Alert:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise ValueError(f"Alert {alert_id} not found")

        alert.is_active = False
        alert.dismissed_by = dismissed_by
        alert.dismissed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(alert)
        return alert

    @staticmethod
    def dismiss_all(db: Session, dismissed_by: str) -> int:
        now = datetime.now(timezone.utc)
        count = (
            db.query(Alert)
            .filter(Alert.is_active.is_(True))
            .update(
                {
                    Alert.is_active: False,
                    Alert.dismissed_by: dismissed_by,
                    Alert.dismissed_at: now,
                },
                synchronize_session="fetch",
            )
        )
        db.commit()
        return count

    @classmethod
    def check_pool_health(cls, db: Session) -> None:
        pools = db.query(Pool).all()
        for pool in pools:
            if pool.health in ("DEGRADED", "FAULTED"):
                existing = (
                    db.query(Alert)
                    .filter(
                        Alert.is_active.is_(True),
                        Alert.source == f"pool:{pool.name}",
                        Alert.level == ("critical" if pool.health == "FAULTED" else "warning"),
                    )
                    .first()
                )
                if not existing:
                    level = "critical" if pool.health == "FAULTED" else "warning"
                    cls.create_alert(
                        db=db,
                        level=level,
                        source=f"pool:{pool.name}",
                        title=f"Pool {pool.name} is {pool.health}",
                        message=f"Storage pool '{pool.name}' health status is {pool.health}. "
                                f"Errors detected: {pool.scrub_errors}",
                        data={"pool_id": pool.id, "health": pool.health},
                    )

    @classmethod
    def check_disk_health(cls, db: Session) -> None:
        disks = db.query(Disk).all()
        for disk in disks:
            if disk.smart_status in ("FAILING", "FAILED"):
                existing = (
                    db.query(Alert)
                    .filter(
                        Alert.is_active.is_(True),
                        Alert.source == f"disk:{disk.serial}",
                        Alert.level == "critical",
                    )
                    .first()
                )
                if not existing:
                    cls.create_alert(
                        db=db,
                        level="critical",
                        source=f"disk:{disk.serial}",
                        title=f"Disk {disk.device_name} SMART failure",
                        message=f"Disk {disk.device_name} (serial: {disk.serial}) reported "
                                f"SMART status: {disk.smart_status}",
                        data={"disk_id": disk.id, "serial": disk.serial},
                    )

    @classmethod
    def check_capacity(cls, db: Session) -> None:
        pools = db.query(Pool).all()
        for pool in pools:
            if pool.total_bytes <= 0:
                continue
            used_pct = (pool.used_bytes / pool.total_bytes) * 100
            if used_pct >= 90:
                existing = (
                    db.query(Alert)
                    .filter(
                        Alert.is_active.is_(True),
                        Alert.source == f"capacity:{pool.name}",
                        Alert.level == "critical",
                    )
                    .first()
                )
                if not existing:
                    cls.create_alert(
                        db=db,
                        level="critical",
                        source=f"capacity:{pool.name}",
                        title=f"Pool {pool.name} critical capacity ({used_pct:.1f}%)",
                        message=f"Storage pool '{pool.name}' usage has exceeded 90%. "
                                f"Used: {pool.used_bytes}/{pool.total_bytes} bytes.",
                        data={"pool_id": pool.id, "used_percent": used_pct},
                    )
            elif used_pct >= 80:
                existing = (
                    db.query(Alert)
                    .filter(
                        Alert.is_active.is_(True),
                        Alert.source == f"capacity:{pool.name}",
                    )
                    .first()
                )
                if not existing:
                    cls.create_alert(
                        db=db,
                        level="warning",
                        source=f"capacity:{pool.name}",
                        title=f"Pool {pool.name} high capacity ({used_pct:.1f}%)",
                        message=f"Storage pool '{pool.name}' usage has exceeded 80%. "
                                f"Used: {pool.used_bytes}/{pool.total_bytes} bytes.",
                        data={"pool_id": pool.id, "used_percent": used_pct},
                    )

    @classmethod
    def send_notification(
        cls, alert: Alert, channels: list[NotificationChannel]
    ) -> None:
        level_ranks = {"info": 1, "warning": 2, "critical": 3}
        alert_rank = level_ranks.get(alert.level, 0)

        for ch in channels:
            if not ch.enabled:
                continue
            ch_min_rank = level_ranks.get(ch.min_level, 0)
            if alert_rank < ch_min_rank:
                continue

            cfg = ch.config or {}
            try:
                if ch.channel_type == "email":
                    cls.send_email(cfg, alert)
                elif ch.channel_type == "webhook":
                    url = cfg.get("url") or settings.WEBHOOK_URL
                    if url:
                        cls.send_webhook(url, alert)
                elif ch.channel_type == "telegram":
                    token = cfg.get("token") or settings.TELEGRAM_BOT_TOKEN
                    chat_id = cfg.get("chat_id") or settings.TELEGRAM_CHAT_ID
                    if token and chat_id:
                        cls.send_telegram(token, chat_id, alert)
            except Exception:
                logger.exception(
                    "Failed to send notification via channel %s (%s)", ch.name, ch.channel_type
                )

    @staticmethod
    def send_email(config: dict[str, Any], alert: Alert) -> None:
        smtp_host = config.get("host") or settings.SMTP_HOST
        smtp_port = config.get("port") or settings.SMTP_PORT
        smtp_user = config.get("user") or settings.SMTP_USER
        smtp_password = config.get("password") or settings.SMTP_PASSWORD
        from_addr = config.get("from_address") or settings.SMTP_FROM or "storaweb@localhost"
        to_addr = config.get("to_address")

        if not smtp_host or not to_addr:
            logger.warning("SMTP not configured, skipping email notification")
            return

        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg["Subject"] = f"[{alert.level.upper()}] {alert.title}"
        body = f"Level: {alert.level}\nSource: {alert.source}\nTime: {alert.created_at}\n\n{alert.message}"
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            if config.get("tls", settings.SMTP_TLS):
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)

    @staticmethod
    def send_webhook(url: str, alert: Alert) -> None:
        payload = json.dumps({
            "id": alert.id,
            "level": alert.level,
            "source": alert.source,
            "title": alert.title,
            "message": alert.message,
            "data": alert.data,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
        }).encode("utf-8")

        req = urllib_request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib_request.urlopen(req, timeout=10) as resp:
            if resp.status >= 400:
                logger.warning("Webhook returned status %d", resp.status)

    @staticmethod
    def send_telegram(token: str, chat_id: str, alert: Alert) -> None:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        text = f"*{alert.level.upper()}*: {alert.title}\n\n{alert.message}\n_Source: {alert.source}_"
        payload = json.dumps({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }).encode("utf-8")

        req = urllib_request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib_request.urlopen(req, timeout=10) as resp:
            if resp.status >= 400:
                logger.warning("Telegram returned status %d", resp.status)
