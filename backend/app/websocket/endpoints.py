from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.core.security import decode_access_token
from app.websocket.manager import VALID_TOPICS, manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
@router.websocket("/api/v1/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    if token:
        payload = decode_access_token(token)
        if not payload:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect(websocket)

    try:
        await manager.send_personal_message(
            {
                "type": "connection_established",
                "message": "Connected to StoraWeb WebSocket service",
                "available_topics": list(VALID_TOPICS),
                "subscribed_topics": list(manager.active_connections.get(websocket, set())),
            },
            websocket,
        )

        while True:
            raw_text = await websocket.receive_text()
            try:
                data: dict[str, Any] = json.loads(raw_text)
            except json.JSONDecodeError:
                await manager.send_personal_message(
                    {"type": "error", "message": "Invalid JSON format"},
                    websocket,
                )
                continue

            action = data.get("action")

            if action == "ping":
                await manager.send_personal_message({"action": "pong"}, websocket)

            elif action == "subscribe":
                topic = data.get("topic")
                topics = data.get("topics")
                subscribed = []

                if topic:
                    if manager.subscribe(websocket, topic):
                        subscribed.append(topic)
                if topics and isinstance(topics, list):
                    for t in topics:
                        if manager.subscribe(websocket, t):
                            subscribed.append(t)

                await manager.send_personal_message(
                    {
                        "type": "subscription_success",
                        "subscribed": subscribed,
                        "current_topics": list(manager.active_connections.get(websocket, set())),
                    },
                    websocket,
                )

            elif action == "unsubscribe":
                topic = data.get("topic")
                topics = data.get("topics")
                unsubscribed = []

                if topic:
                    if manager.unsubscribe(websocket, topic):
                        unsubscribed.append(topic)
                if topics and isinstance(topics, list):
                    for t in topics:
                        if manager.unsubscribe(websocket, t):
                            unsubscribed.append(t)

                await manager.send_personal_message(
                    {
                        "type": "unsubscription_success",
                        "unsubscribed": unsubscribed,
                        "current_topics": list(manager.active_connections.get(websocket, set())),
                    },
                    websocket,
                )

            elif action == "get_subscriptions":
                await manager.send_personal_message(
                    {
                        "type": "subscriptions",
                        "topics": list(manager.active_connections.get(websocket, set())),
                    },
                    websocket,
                )

            else:
                await manager.send_personal_message(
                    {"type": "error", "message": f"Unknown action '{action}'"},
                    websocket,
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        logger.exception("Unexpected error in websocket connection")
        manager.disconnect(websocket)
