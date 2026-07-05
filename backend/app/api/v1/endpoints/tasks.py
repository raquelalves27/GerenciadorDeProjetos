from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, field_validator
from datetime import date, datetime

from app.core.database import get_session
from app.core.security import get_current_user, require_roles
from app.models.models import TaskStatus, TaskImpact, UserRole
from app.repositories.task_repository import TaskRepository
from app.services.audit_service import AuditService

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    client_id: str
    project_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.A_FAZER
    impact: TaskImpact = TaskImpact.MEDIO
    is_blocker: bool = False
    responsible: Optional[str] = None
    waiting_on: Optional[str] = None
    due_date: Optional[date] = None
    due_note: Optional[str] = None
    escalate_to_manager: bool = False
    escalation_reason: Optional[str] = None
    notes: Optional[str] = None

    # Inputs HTML type="date" enviam '' quando vazios; sem isso o Pydantic
    # tenta converter '' em date e quebra a criação com erro 422.
    @field_validator("due_date", mode="before")
    @classmethod
    def _empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class TaskUpdate(BaseModel):
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    impact: Optional[TaskImpact] = None
    is_blocker: Optional[bool] = None
    responsible: Optional[str] = None
    waiting_on: Optional[str] = None
    due_date: Optional[date] = None
    due_note: Optional[str] = None
    escalate_to_manager: Optional[bool] = None
    escalation_reason: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("due_date", mode="before")
    @classmethod
    def _empty_date_to_none(cls, v):
        if v == "":
            return None
        return v


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
async def list_tasks(
    client_id: Optional[str] = None,
    project_id: Optional[str] = None,
    status: Optional[TaskStatus] = None,
    impact: Optional[TaskImpact] = None,
    is_blocker: Optional[bool] = None,
    escalate_to_manager: Optional[bool] = None,
    responsible: Optional[str] = None,
    search: Optional[str] = Query(None, description="Busca por título, descrição, responsável ou aguardando_de"),
    page: int = Query(1, ge=1),
    size: int = Query(200, ge=1, le=500),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = TaskRepository(session)
    filters = {
        "org_id": current_user.org_id,
        "client_id": client_id,
        "project_id": project_id,
        "status": status,
        "impact": impact,
        "is_blocker": is_blocker,
        "escalate_to_manager": escalate_to_manager,
        "responsible": responsible,
        "search": search,
    }
    tasks, total = await repo.list_with_filters(filters, page, size)
    return {
        "items": tasks,
        "total": total,
        "page": page,
        "size": size,
        "pages": -(-total // size),
    }


@router.post("/", status_code=201)
async def create_task(
    body: TaskCreate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = TaskRepository(session)
    task = await repo.create({
        **body.dict(),
        "org_id": current_user.org_id,
        "created_by": current_user.id,
    })
    await AuditService(session).log(
        user_id=current_user.id,
        entity_type="task",
        entity_id=task.id,
        action="create",
        after_data=body.dict(),
    )
    return task


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = TaskRepository(session)
    task = await repo.get_full(task_id, current_user.org_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return task


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = TaskRepository(session)
    before = await repo.get_full(task_id, current_user.org_id)
    if not before:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    update_data = body.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    task = await repo.update(task_id, update_data)
    await AuditService(session).log(
        user_id=current_user.id,
        entity_type="task",
        entity_id=task_id,
        action="update",
        before_data={"status": before.status, "is_blocker": before.is_blocker},
        after_data=update_data,
    )
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)),
    session: AsyncSession = Depends(get_session),
):
    repo = TaskRepository(session)
    await repo.delete(task_id, current_user.org_id)


@router.get("/summary/open")
async def open_summary(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Usado pelo painel de decisão para os números rápidos de abertura."""
    repo = TaskRepository(session)
    return await repo.get_open_summary(current_user.org_id)
