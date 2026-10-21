import logging
from collections.abc import Callable
from enum import Enum
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)


class JobType(str, Enum):
    SNAPSHOT = "snapshot"
    SCRUB = "scrub"
    SMART_TEST = "smart_test"
    REPLICATION = "replication"
    CLOUD_SYNC = "cloud_sync"


class SchedulerManager:
    _instance: "SchedulerManager | None" = None
    _scheduler: BackgroundScheduler | None = None

    def __new__(cls) -> "SchedulerManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._scheduler = BackgroundScheduler(
                job_defaults={"coalesce": True, "max_instances": 3}
            )
        return cls._instance

    @property
    def scheduler(self) -> BackgroundScheduler:
        if self._scheduler is None:
            self._scheduler = BackgroundScheduler(
                job_defaults={"coalesce": True, "max_instances": 3}
            )
        return self._scheduler

    def start(self) -> None:
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Scheduler started")

    def stop(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Scheduler stopped")

    def add_job(
        self,
        job_id: str,
        job_type: JobType,
        func: Callable[..., Any],
        trigger: str = "cron",
        **trigger_args: Any,
    ) -> dict[str, Any]:
        existing = self.scheduler.get_job(job_id)
        if existing:
            self.scheduler.remove_job(job_id)

        job = self.scheduler.add_job(
            func,
            trigger=trigger,
            id=job_id,
            name=f"{job_type.value}:{job_id}",
            replace_existing=True,
            **trigger_args,
        )
        logger.info("Added job %s (type=%s)", job_id, job_type.value)
        return {
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time) if job.next_run_time else None,
        }

    def add_interval_job(
        self,
        job_id: str,
        job_type: JobType,
        func: Callable[..., Any],
        seconds: int | None = None,
        minutes: int | None = None,
        hours: int | None = None,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {}
        if seconds is not None:
            kwargs["seconds"] = seconds
        if minutes is not None:
            kwargs["minutes"] = minutes
        if hours is not None:
            kwargs["hours"] = hours

        return self.add_job(job_id, job_type, func, trigger="interval", **kwargs)

    def remove_job(self, job_id: str) -> bool:
        try:
            self.scheduler.remove_job(job_id)
            logger.info("Removed job %s", job_id)
            return True
        except Exception:
            logger.warning("Job %s not found for removal", job_id)
            return False

    def list_jobs(self) -> list[dict[str, Any]]:
        jobs = self.scheduler.get_jobs()
        return [
            {
                "id": job.id,
                "name": job.name,
                "next_run_time": str(job.next_run_time) if job.next_run_time else None,
                "trigger": str(job.trigger),
            }
            for job in jobs
        ]

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        job = self.scheduler.get_job(job_id)
        if job is None:
            return None
        return {
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger),
        }

    def pause_job(self, job_id: str) -> bool:
        try:
            self.scheduler.pause_job(job_id)
            return True
        except Exception:
            return False

    def resume_job(self, job_id: str) -> bool:
        try:
            self.scheduler.resume_job(job_id)
            return True
        except Exception:
            return False


scheduler_manager = SchedulerManager()
