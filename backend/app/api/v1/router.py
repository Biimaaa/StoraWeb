from fastapi import APIRouter

from app.api.v1.endpoints import (
    alerts,
    audit,
    auth,
    dashboard,
    datasets,
    disks,
    jobs,
    network,
    pools,
    shares,
    snapshots,
    system,
    tasks,
    users,
)

api_router = APIRouter(prefix="/api/v1")

# Authentication & authorization endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
# Also support root /token for standard OAuth2 clients pointing to /api/v1/token
api_router.add_api_route(
    "/token",
    auth.login_for_access_token,
    methods=["POST"],
    response_model=auth.Token,
    tags=["auth"],
    include_in_schema=False,
)

# Core resource endpoints
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(disks.router, prefix="/disks", tags=["disks"])
api_router.include_router(pools.router, prefix="/pools", tags=["pools"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(snapshots.router, prefix="/snapshots", tags=["snapshots"])
api_router.include_router(shares.router, prefix="/shares", tags=["shares"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(network.router, prefix="/network", tags=["network"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
