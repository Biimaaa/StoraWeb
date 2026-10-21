from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

from app.core.events import Event, EventType, event_bus

logger = logging.getLogger(__name__)

VALID_TOPICS = {"alerts", "metrics", "jobs", "storage"}


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[WebSocket, set[str]] = {}
        self._setup_event_listeners()

    def _setup_event_listeners(self) -> None:
        event_bus.subscribe(None, self._handle_event_bus_event)

    def _handle_event_bus_event(self, event: Event) -> None:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._dispatch_event(event))
        except RuntimeError:
            pass

    async def _dispatch_event(self, event: Event) -> None:
        event_payload = event.to_dict()
        event_type = event.event_type

        if event_type == EventType.ALERT:
            await self.broadcast_alert(event_payload)
        elif event_type == EventType.SYSTEM_METRIC:
            await self.broadcast_metric(event_payload)
        elif event_type in (EventType.JOB_PROGRESS, EventType.JOB_COMPLETE):
            await self.broadcast_job(event_payload)
        elif event_type in (
            EventType.DISK_CHANGE,
            EventType.POOL_STATUS,
            EventType.SNAPSHOT_CREATED,
            EventType.SHARE_UPDATED,
        ):
            await self.broadcast_storage(event_payload)

    async def connect(self, websocket: WebSocket, topics: set[str] | None = None) -> None:
        await websocket.accept()
        self.active_connections[websocket] = set(topics) if topics is not None else set(VALID_TOPICS)
        logger.info("WebSocket connected. Total connections: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            logger.info("WebSocket disconnected. Total connections: %d", len(self.active_connections))

    def subscribe(self, websocket: WebSocket, topic: str) -> bool:
        if websocket in self.active_connections:
            if topic in VALID_TOPICS or topic == "*":
                if topic == "*":
                    self.active_connections[websocket].update(VALID_TOPICS)
                else:
                    self.active_connections[websocket].add(topic)
                return True
        return False

    def unsubscribe(self, websocket: WebSocket, topic: str) -> bool:
        if websocket in self.active_connections:
            if topic == "*":
                self.active_connections[websocket].clear()
                return True
            self.active_connections[websocket].discard(topic)
            return True
        return False

    async def send_personal_message(self, message: dict[str, Any], websocket: WebSocket) -> None:
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception:
            logger.exception("Failed to send message to websocket client")
            self.disconnect(websocket)

    async def broadcast(self, message: dict[str, Any], topic: str | None = None) -> None:
        disconnected: list[WebSocket] = []
        payload_str = json.dumps(message, default=str)

        for ws, topics in list(self.active_connections.items()):
            if topic is None or topic in topics:
                try:
                    await ws.send_text(payload_str)
                except Exception:
                    logger.exception("Error broadcasting to websocket client")
                    disconnected.append(ws)

        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast_alert(self, data: dict[str, Any]) -> None:
        message = {"topic": "alerts", "event": "alert", "data": data}
        await self.broadcast(message, topic="alerts")

    async def broadcast_job(self, data: dict[str, Any]) -> None:
        message = {"topic": "jobs", "event": "job", "data": data}
        await self.broadcast(message, topic="jobs")

    async def broadcast_metric(self, data: dict[str, Any]) -> None:
        message = {"topic": "metrics", "event": "metric", "data": data}
        await self.broadcast(message, topic="metrics")

    async def broadcast_storage(self, data: dict[str, Any]) -> None:
        message = {"topic": "storage", "event": "storage", "data": data}
        await self.broadcast(message, topic="storage")


manager = ConnectionManager()
