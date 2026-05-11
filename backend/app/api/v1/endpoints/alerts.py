from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.models import Alert

router = APIRouter()


@router.get("/")
async def list_alerts(
    unread_only: bool = Query(False),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    query = select(Alert).where(Alert.org_id == current_user.org_id)
    if unread_only:
        query = query.where(Alert.is_read == False)
    query = query.order_by(Alert.created_at.desc()).limit(50)
    result = await session.execute(query)
    return result.scalars().all()


@router.patch("/{alert_id}/read")
async def mark_read(
    alert_id: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        update(Alert).where(Alert.id == alert_id).values(is_read=True)
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        update(Alert).where(Alert.org_id == current_user.org_id).values(is_read=True)
    )
    return {"ok": True}
