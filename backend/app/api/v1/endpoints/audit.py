from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.database import get_session
from app.core.security import get_current_user, require_roles
from app.models.models import AuditLog, UserRole

router = APIRouter()


@router.get("/")
async def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)),
    session: AsyncSession = Depends(get_session),
):
    query = select(AuditLog).where(AuditLog.user_id != None)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await session.execute(query)
    return result.scalars().all()
