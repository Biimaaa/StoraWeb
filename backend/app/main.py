import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.scheduler import scheduler_manager
from app.websocket import websocket_router

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting %s v%s", settings.APP_NAME, settings.VERSION)
    init_db()
    logger.info("Database initialized")
    scheduler_manager.start()
    logger.info("Scheduler started")
    yield
    scheduler_manager.stop()
    logger.info("Scheduler stopped")
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="StoraWeb API",
        version=settings.VERSION,
        openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
        docs_url="/api/v1/docs" if settings.DEBUG else None,
        redoc_url="/api/v1/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    app.include_router(websocket_router)

    static_path = Path(__file__).parent.parent / "static"
    if static_path.is_dir():
        app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

    register_exception_handlers(app)
    register_health_check(app)

    return app


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors: list[dict[str, Any]] = []
        for error in exc.errors():
            errors.append({
                "field": " -> ".join(str(loc) for loc in error.get("loc", [])),
                "message": error.get("msg", ""),
                "type": error.get("type", ""),
            })
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Validation error", "errors": errors},
        )

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc: Any) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Resource not found"},
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc: Any) -> JSONResponse:
        logger.exception("Internal server error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )


def register_health_check(app: FastAPI) -> None:
    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.VERSION,
        }


app = create_app()
