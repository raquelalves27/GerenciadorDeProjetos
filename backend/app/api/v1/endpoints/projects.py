from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import date, datetime

from app.core.database import get_session
from app.core.security import get_current_user, require_roles
from app.models.models import ProjectStatus, ProjectPriority, UserRole
from app.repositories.project_repository import ProjectRepository
from app.services.audit_service import AuditService

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    client_id: str
    product_id: str
    master_id: str
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.NAO_INICIADO
    priority: ProjectPriority = ProjectPriority.MEDIA
    start_date: Optional[date] = None
    expected_end_date: date
    internal_notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    completion_pct: Optional[int] = None
    master_id: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    internal_notes: Optional[str] = None


class ProjectUpdateCreate(BaseModel):
    content: str
    completion_pct: int


class StageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner_id: Optional[str] = None
    due_date: Optional[date] = None
    order_idx: int = 0


class RiskCreate(BaseModel):
    description: str
    severity: str = "medio"
    mitigation: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
async def list_projects(
    status: Optional[ProjectStatus] = None,
    priority: Optional[ProjectPriority] = None,
    master_id: Optional[str] = None,
    product_id: Optional[str] = None,
    client_id: Optional[str] = None,
    search: Optional[str] = Query(None, description="Busca por nome ou cliente"),
    start_from: Optional[date] = None,
    start_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    filters = {
        "org_id": current_user.org_id,
        "status": status,
        "priority": priority,
        "master_id": master_id,
        "product_id": product_id,
        "client_id": client_id,
        "search": search,
        "start_from": start_from,
        "start_to": start_to,
    }
    projects, total = await repo.list_with_filters(filters, page, size)
    return {
        "items": projects,
        "total": total,
        "page": page,
        "size": size,
        "pages": -(-total // size),
    }


@router.post("/", status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    project = await repo.create({**body.dict(), "org_id": current_user.org_id})
    await AuditService(session).log(
        user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        action="create",
        after_data=body.dict(),
    )
    return project


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    project = await repo.get_full(project_id, current_user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    before = await repo.get_by_id(project_id)
    if not before:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    update_data = body.dict(exclude_none=True)
    if "completion_pct" in update_data:
        update_data["last_progress_update"] = datetime.utcnow()
    update_data["updated_at"] = datetime.utcnow()

    project = await repo.update(project_id, update_data)
    await AuditService(session).log(
        user_id=current_user.id,
        entity_type="project",
        entity_id=project_id,
        action="update",
        before_data={"status": before.status, "completion_pct": before.completion_pct},
        after_data=update_data,
    )
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user=Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    await repo.delete(project_id, current_user.org_id)


# ─── Updates / histórico ──────────────────────────────────────────────────────

@router.post("/{project_id}/updates", status_code=201)
async def add_project_update(
    project_id: str,
    body: ProjectUpdateCreate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    update = await repo.add_update(
        project_id=project_id,
        author_id=current_user.id,
        content=body.content,
        completion_pct=body.completion_pct,
        status=project.status,
    )
    # Atualiza completion_pct do projeto
    await repo.update(project_id, {
        "completion_pct": body.completion_pct,
        "last_progress_update": datetime.utcnow(),
    })
    return update


@router.get("/{project_id}/updates")
async def get_project_updates(
    project_id: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    return await repo.get_updates(project_id)


# ─── Etapas ───────────────────────────────────────────────────────────────────

@router.post("/{project_id}/stages", status_code=201)
async def add_stage(
    project_id: str,
    body: StageCreate,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    return await repo.add_stage(project_id, body.dict())


@router.get("/{project_id}/stages")
async def get_stages(
    project_id: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    return await repo.get_stages(project_id)


# ─── Riscos ───────────────────────────────────────────────────────────────────

@router.post("/{project_id}/risks", status_code=201)
async def add_risk(
    project_id: str,
    body: RiskCreate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    return await repo.add_risk(project_id, current_user.id, body.dict())


@router.get("/{project_id}/risks")
async def get_risks(
    project_id: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ProjectRepository(session)
    return await repo.get_risks(project_id)
