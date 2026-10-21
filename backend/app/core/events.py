import asyncio
import logging
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timezone
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    DISK_CHANGE = "disk_change"
    POOL_STATUS = "pool_status"
    ALERT = "alert"
    JOB_PROGRESS = "job_progress"
    JOB_COMPLETE = "job_complete"
    SNAPSHOT_CREATED = "snapshot_created"
    SHARE_UPDATED = "share_updated"
    SYSTEM_METRIC = "system_metric"


class Event:
    def __init__(self, event_type: EventType, data: dict[str, Any], source: str = "") -> None:
        self.event_type = event_type
        self.data = data
        self.source = source
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "data": self.data,
            "source": self.source,
            "timestamp": self.timestamp.isoformat(),
        }


class EventBus:
    _instance: "EventBus | None" = None
    _subscribers: dict[EventType, list[Callable[..., Any]]]
    _wildcard_subscribers: list[Callable[..., Any]]
    _event_history: list[Event]
    _max_history: int

    def __new__(cls) -> "EventBus":
        if cls._instance is None:
            instance = super().__new__(cls)
            instance._subscribers = defaultdict(list)
            instance._wildcard_subscribers = []
            instance._event_history = []
            instance._max_history = 1000
            cls._instance = instance
        return cls._instance

    def subscribe(
        self, event_type: EventType | None, callback: Callable[..., Any]
    ) -> Callable[[], None]:
        if event_type is None:
            self._wildcard_subscribers.append(callback)

            def unsub_wildcard() -> None:
                self._wildcard_subscribers.remove(callback)

            return unsub_wildcard

        self._subscribers[event_type].append(callback)

        def unsubscribe() -> None:
            if callback in self._subscribers[event_type]:
                self._subscribers[event_type].remove(callback)

        return unsubscribe

    def unsubscribe(self, event_type: EventType, callback: Callable[..., Any]) -> None:
        if callback in self._subscribers[event_type]:
            self._subscribers[event_type].remove(callback)

    def publish(self, event_type: EventType, data: dict[str, Any], source: str = "") -> Event:
        event = Event(event_type=event_type, data=data, source=source)

        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]

        for callback in self._subscribers.get(event_type, []):
            try:
                result = callback(event)
                if asyncio.iscoroutine(result):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(result)
                    except RuntimeError:
                        asyncio.run(result)
            except Exception:
                logger.exception("Error in event subscriber for %s", event_type.value)

        for callback in self._wildcard_subscribers:
            try:
                result = callback(event)
                if asyncio.iscoroutine(result):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(result)
                    except RuntimeError:
                        asyncio.run(result)
            except Exception:
                logger.exception("Error in wildcard event subscriber for %s", event_type.value)

        logger.debug("Published event: %s from %s", event_type.value, source)
        return event

    def get_history(
        self, event_type: EventType | None = None, limit: int = 50
    ) -> list[dict[str, Any]]:
        if event_type is None:
            events = self._event_history[-limit:]
        else:
            events = [e for e in self._event_history if e.event_type == event_type][-limit:]
        return [e.to_dict() for e in events]

    def clear_history(self) -> None:
        self._event_history.clear()

    def subscriber_count(self, event_type: EventType | None = None) -> int:
        if event_type is None:
            total = len(self._wildcard_subscribers)
            for subs in self._subscribers.values():
                total += len(subs)
            return total
        return len(self._subscribers.get(event_type, []))


event_bus = EventBus()
