from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from typing import Optional

from app.core.database import get_session
from app.core.security import get_current_user
from app.repositories.kpi_repository import KpiRepository

router = APIRouter()


@router.get("/executive")
async def executive_dashboard(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    KPIs gerenciais completos:
    - Contagens por status
    - Taxa média de conclusão
    - Projetos em risco/atrasados
    - Distribuição por produto
    - Capacidade e ocupação do time
    """
    repo = KpiRepository(session)
    return await repo.get_executive_kpis(
        org_id=current_user.org_id,
        month=month,
        year=year,
    )


@router.get("/team-capacity")
async def team_capacity(
    week_start: date = Query(...),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Capacidade e ocupação do time na semana."""
    repo = KpiRepository(session)
    return await repo.get_team_capacity(current_user.org_id, week_start)


@router.get("/implantadores/ranking")
async def implantadores_ranking(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Implantadores mais demandados (últimos 30 dias)."""
    repo = KpiRepository(session)
    return await repo.get_implantadores_ranking(current_user.org_id)


@router.get("/products/distribution")
async def product_distribution(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Distribuição de projetos por produto."""
    repo = KpiRepository(session)
    return await repo.get_product_distribution(current_user.org_id)


@router.get("/timeline")
async def projects_timeline(
    start: date = Query(...),
    end: date = Query(...),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Dados para gráfico Gantt/timeline dos projetos."""
    repo = KpiRepository(session)
    return await repo.get_timeline(current_user.org_id, start, end)
