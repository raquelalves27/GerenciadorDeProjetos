"""
Motor de alertas inteligentes da plataforma.
Executado via Celery/APScheduler a cada 30 minutos.
"""
from datetime import datetime, timedelta, date
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.models import (
    Project, Allocation, Alert, AlertType,
    ProjectStatus
)
from app.core.config import settings


class AlertEngine:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def run_all(self, org_id: str) -> List[dict]:
        """Executa todas as verificações e persiste os alertas."""
        alerts = []
        alerts += await self.check_shift_conflicts(org_id)
        alerts += await self.check_weekly_overloads(org_id)
        alerts += await self.check_delayed_projects(org_id)
        alerts += await self.check_stagnant_projects(org_id)
        alerts += await self.check_approaching_deadlines(org_id)
        return alerts

    async def check_shift_conflicts(self, org_id: str) -> List[dict]:
        """Detecta implantadores alocados em múltiplos projetos no mesmo turno/semana."""
        query = (
            select(
                Allocation.user_id,
                Allocation.week_start,
                Allocation.shift,
                func.count(Allocation.id).label("count"),
            )
            .join(Project, Allocation.project_id == Project.id)
            .where(Project.org_id == org_id)
            .group_by(Allocation.user_id, Allocation.week_start, Allocation.shift)
            .having(func.count(Allocation.id) > 1)
        )
        result = await self.session.execute(query)
        rows = result.fetchall()

        new_alerts = []
        for row in rows:
            alert = Alert(
                org_id=org_id,
                alert_type=AlertType.CONFLITO_HORARIO,
                entity_type="allocation",
                entity_id=f"{row.user_id}_{row.week_start}_{row.shift}",
                message=(
                    f"Conflito de turno: implantador com {row.count} alocações "
                    f"no turno {row.shift} da semana {row.week_start}"
                ),
            )
            self.session.add(alert)
            new_alerts.append({"type": "conflict", "user_id": row.user_id})

        await self.session.flush()
        return new_alerts

    async def check_weekly_overloads(self, org_id: str) -> List[dict]:
        """Detecta implantadores com mais de 3 turnos/dia na semana."""
        query = (
            select(
                Allocation.user_id,
                Allocation.week_start,
                func.count(Allocation.id).label("total_shifts"),
            )
            .join(Project, Allocation.project_id == Project.id)
            .where(Project.org_id == org_id)
            .group_by(Allocation.user_id, Allocation.week_start)
            .having(func.count(Allocation.id) > 15)  # >15 turnos na semana
        )
        result = await self.session.execute(query)
        rows = result.fetchall()

        new_alerts = []
        for row in rows:
            alert = Alert(
                org_id=org_id,
                alert_type=AlertType.SOBRECARGA,
                entity_type="user",
                entity_id=row.user_id,
                message=f"Sobrecarga: implantador com {row.total_shifts} turnos na semana {row.week_start}",
            )
            self.session.add(alert)
            new_alerts.append({"type": "overload", "user_id": row.user_id})

        await self.session.flush()
        return new_alerts

    async def check_delayed_projects(self, org_id: str) -> List[dict]:
        """Projetos com expected_end_date no passado e não concluídos."""
        today = date.today()
        query = select(Project).where(
            and_(
                Project.org_id == org_id,
                Project.expected_end_date < today,
                Project.status.notin_([ProjectStatus.CONCLUIDO, ProjectStatus.PAUSADO]),
            )
        )
        result = await self.session.execute(query)
        projects = result.scalars().all()

        new_alerts = []
        for p in projects:
            if p.status != ProjectStatus.EM_RISCO:
                p.status = ProjectStatus.EM_RISCO

            alert = Alert(
                org_id=org_id,
                alert_type=AlertType.PROJETO_ATRASADO,
                entity_type="project",
                entity_id=p.id,
                message=f"Projeto '{p.name}' está atrasado. Prazo era {p.expected_end_date}",
            )
            self.session.add(alert)
            new_alerts.append({"type": "delayed", "project_id": p.id})

        await self.session.flush()
        return new_alerts

    async def check_stagnant_projects(self, org_id: str) -> List[dict]:
        """Projetos sem atualização de progresso por X dias."""
        cutoff = datetime.utcnow() - timedelta(days=settings.ALERT_STAGNATION_DAYS)
        query = select(Project).where(
            and_(
                Project.org_id == org_id,
                Project.status == ProjectStatus.EM_ANDAMENTO,
                Project.last_progress_update < cutoff,
                Project.completion_pct < 100,
            )
        )
        result = await self.session.execute(query)
        projects = result.scalars().all()

        new_alerts = []
        for p in projects:
            alert = Alert(
                org_id=org_id,
                alert_type=AlertType.SEM_EVOLUCAO,
                entity_type="project",
                entity_id=p.id,
                message=(
                    f"Projeto '{p.name}' sem atualização de progresso há "
                    f"{settings.ALERT_STAGNATION_DAYS}+ dias"
                ),
            )
            self.session.add(alert)
            new_alerts.append({"type": "stagnant", "project_id": p.id})

        await self.session.flush()
        return new_alerts

    async def check_approaching_deadlines(self, org_id: str) -> List[dict]:
        """Projetos com prazo nos próximos X dias."""
        today = date.today()
        warning_date = today + timedelta(days=settings.ALERT_DEADLINE_WARNING_DAYS)

        query = select(Project).where(
            and_(
                Project.org_id == org_id,
                Project.expected_end_date <= warning_date,
                Project.expected_end_date >= today,
                Project.status.notin_([ProjectStatus.CONCLUIDO, ProjectStatus.PAUSADO]),
                Project.completion_pct < 80,
            )
        )
        result = await self.session.execute(query)
        projects = result.scalars().all()

        new_alerts = []
        for p in projects:
            days_left = (p.expected_end_date - today).days
            alert = Alert(
                org_id=org_id,
                alert_type=AlertType.PRAZO_PROXIMO,
                entity_type="project",
                entity_id=p.id,
                message=(
                    f"Projeto '{p.name}' vence em {days_left} dias "
                    f"com apenas {p.completion_pct}% concluído"
                ),
            )
            self.session.add(alert)
            new_alerts.append({"type": "deadline", "project_id": p.id})

        await self.session.flush()
        return new_alerts
