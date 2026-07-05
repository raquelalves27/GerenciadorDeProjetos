from typing import Optional, Tuple, List
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.models.models import Task


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_with_filters(self, filters: dict, page: int, size: int) -> Tuple[List, int]:
        query = select(Task)

        if filters.get("org_id"):
            query = query.where(Task.org_id == filters["org_id"])
        if filters.get("client_id"):
            query = query.where(Task.client_id == filters["client_id"])
        if filters.get("project_id"):
            query = query.where(Task.project_id == filters["project_id"])
        if filters.get("status"):
            query = query.where(Task.status == filters["status"])
        if filters.get("impact"):
            query = query.where(Task.impact == filters["impact"])
        if filters.get("is_blocker") is not None:
            query = query.where(Task.is_blocker == filters["is_blocker"])
        if filters.get("escalate_to_manager") is not None:
            query = query.where(Task.escalate_to_manager == filters["escalate_to_manager"])
        if filters.get("responsible"):
            query = query.where(Task.responsible.ilike(f"%{filters['responsible']}%"))
        if filters.get("search"):
            term = f"%{filters['search']}%"
            query = query.where(or_(
                Task.title.ilike(term),
                Task.description.ilike(term),
                Task.responsible.ilike(term),
                Task.waiting_on.ilike(term),
            ))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        query = query.order_by(Task.created_at.desc())
        query = query.offset((page - 1) * size).limit(size)

        result = await self.session.execute(query)
        items = result.scalars().all()

        return items, total

    async def get_by_id(self, task_id: str) -> Optional[Task]:
        result = await self.session.execute(select(Task).where(Task.id == task_id))
        return result.scalars().first()

    async def get_full(self, task_id: str, org_id: str) -> Optional[Task]:
        result = await self.session.execute(
            select(Task).where(Task.id == task_id, Task.org_id == org_id)
        )
        return result.scalars().first()

    async def create(self, data: dict) -> Task:
        task = Task(**data)
        self.session.add(task)
        await self.session.flush()
        return task

    async def update(self, task_id: str, data: dict) -> Optional[Task]:
        task = await self.get_by_id(task_id)
        if task:
            for k, v in data.items():
                setattr(task, k, v)
            await self.session.flush()
        return task

    async def delete(self, task_id: str, org_id: str):
        task = await self.get_full(task_id, org_id)
        if task:
            await self.session.delete(task)

    async def get_open_summary(self, org_id: str) -> dict:
        """Contagens usadas pelos KPIs / painel de decisão."""
        result = await self.session.execute(
            select(Task).where(Task.org_id == org_id, Task.status != "concluido")
        )
        open_tasks = result.scalars().all()
        return {
            "total_open": len(open_tasks),
            "blockers": sum(1 for t in open_tasks if t.is_blocker),
            "escalations": sum(1 for t in open_tasks if t.escalate_to_manager),
            "overdue": sum(1 for t in open_tasks if t.status == "atrasado"),
        }
