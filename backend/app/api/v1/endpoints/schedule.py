from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import date, timedelta

from app.core.database import get_session
from app.core.security import get_current_user, require_roles
from app.models.models import ShiftType, ActivityType, UserRole, Allocation, Project, User
from app.services.conflict_service import ConflictService
from app.services.audit_service import AuditService

router = APIRouter()


class AllocationCreate(BaseModel):
    user_id: str
    project_id: str
    week_start: date
    # Optional exact day inside the week (yyyy-mm-dd). If omitted, allocation applies to the whole shift/week.
    day: Optional[date] = None
    shift: str
    activity_type: str = "implantacao"
    notes: Optional[str] = None
    repeat_weekly: bool = False


class BulkCloneRequest(BaseModel):
    source_week: date
    target_week: date
    user_ids: Optional[List[str]] = None


@router.get("/week")
async def get_week_schedule(
    week_start: date = Query(...),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Busca alocações da semana
    result = await session.execute(
        select(Allocation).where(Allocation.week_start == week_start)
    )
    allocations = result.scalars().all()

    # Busca todos os usuários da org
    users_result = await session.execute(
        select(User).where(User.org_id == current_user.org_id, User.is_active == True)
    )
    users = users_result.scalars().all()

    # Monta estrutura { user_id: { manha: [...], tarde: [...] } }
    schedule = {}
    for user in users:
        schedule[user.id] = {"manha": [], "tarde": []}

    for a in allocations:
        if a.user_id not in schedule:
            continue
        # Normaliza shift para minúsculo
        shift_key = a.shift.value.lower() if hasattr(a.shift, 'value') else str(a.shift).lower()
        if shift_key not in schedule[a.user_id]:
            continue

        # Busca projeto
        proj_result = await session.execute(select(Project).where(Project.id == a.project_id))
        proj = proj_result.scalars().first()

        schedule[a.user_id][shift_key].append({
            "id": a.id,
            "user_id": a.user_id,
            "project_id": a.project_id,
            "week_start": str(a.week_start),
            "day": str(a.day) if getattr(a, 'day', None) else None,
            "shift": shift_key,
            "activity_type": a.activity_type.value.lower() if hasattr(a.activity_type, 'value') else str(a.activity_type).lower(),
            "notes": a.notes,
            "project": {
                "id": proj.id if proj else None,
                "name": proj.name if proj else None,
                "client_id": proj.client_id if proj else None,
            } if proj else None,
        })

    return schedule


@router.post("/", status_code=201)
async def create_allocation(
    body: AllocationCreate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Normaliza valores
    shift_val = body.shift.upper()
    activity_val = body.activity_type.upper()

    allocation = Allocation(
        user_id=body.user_id,
        project_id=body.project_id,
        week_start=body.week_start,
        day=body.day,
        shift=shift_val,
        activity_type=activity_val,
        notes=body.notes,
        repeat_weekly=body.repeat_weekly,
        created_by=current_user.id,
    )
    session.add(allocation)
    await session.flush()
    await session.commit()
    return {"id": allocation.id, "message": "Alocação criada com sucesso"}


@router.delete("/{allocation_id}", status_code=204)
async def delete_allocation(
    allocation_id: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Allocation).where(Allocation.id == allocation_id))
    allocation = result.scalars().first()
    if allocation:
        await session.delete(allocation)
        await session.commit()


@router.post("/clone-week")
async def clone_week(
    body: BulkCloneRequest,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Allocation).where(Allocation.week_start == body.source_week)
    )
    source = result.scalars().all()

    if body.user_ids:
        source = [a for a in source if a.user_id in body.user_ids]

    # Deslocamento (em dias) entre a semana de origem e a semana de destino,
    # usado para recalcular o campo `day` de cada alocação clonada.
    week_offset = (body.target_week - body.source_week).days

    cloned = 0
    for a in source:
        # Preserva o dia exato da semana (segunda, terça, ...) deslocando-o
        # para a nova semana, em vez de descartar a informação do dia.
        new_day = (a.day + timedelta(days=week_offset)) if getattr(a, "day", None) else None
        new_a = Allocation(
            user_id=a.user_id,
            project_id=a.project_id,
            week_start=body.target_week,
            day=new_day,
            shift=a.shift,
            activity_type=a.activity_type,
            notes=a.notes,
            repeat_weekly=a.repeat_weekly,
            created_by=current_user.id,
        )
        session.add(new_a)
        cloned += 1

    await session.commit()
    return {"cloned": cloned, "message": f"{cloned} alocações clonadas com sucesso"}
