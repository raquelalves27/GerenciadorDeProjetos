from fastapi import APIRouter
from .endpoints import auth, projects, schedule, users, kpis, alerts, audit, clients, products

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router,     prefix="/auth",     tags=["auth"])
api_router.include_router(users.router,    prefix="/users",    tags=["users"])
api_router.include_router(clients.router,  prefix="/clients",  tags=["clients"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(schedule.router, prefix="/schedule", tags=["schedule"])
api_router.include_router(kpis.router,     prefix="/kpis",     tags=["kpis"])
api_router.include_router(alerts.router,   prefix="/alerts",   tags=["alerts"])
api_router.include_router(audit.router,    prefix="/audit",    tags=["audit"])
