from datetime import date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.models import Allocation, Project
from app.core.config import settings


class ConflictService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def check_shift_conflict(
        self,
        user_id: str,
        week_start: date,
        shift: str,
        exclude_id: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Retorna a alocação conflitante se o implantador já estiver
        alocado no mesmo turno/semana.
        """
        query = (
            select(Allocation)
            .where(
                and_(
                    Allocation.user_id == user_id,
                    Allocation.week_start == week_start,
                    Allocation.shift == shift,
                )
            )
        )
        if exclude_id:
            query = query.where(Allocation.id != exclude_id)

        result = await self.session.execute(query)
        conflict = result.scalars().first()

        if conflict:
            return {
                "id": conflict.id,
                "project_id": conflict.project_id,
                "week_start": str(conflict.week_start),
                "shift": conflict.shift,
            }
        return None

    async def check_weekly_overload(
        self,
        user_id: str,
        week_start: date,
    ) -> bool:
        """Retorna True se o implantador estiver próximo da capacidade semanal."""
        query = (
            select(func.count(Allocation.id))
            .where(
                and_(
                    Allocation.user_id == user_id,
                    Allocation.week_start == week_start,
                )
            )
        )
        result = await self.session.execute(query)
        count = result.scalar_one_or_none() or 0
        # Limite padrão: 12 turnos por semana (4 dias × 3 turnos)
        return count >= 12
