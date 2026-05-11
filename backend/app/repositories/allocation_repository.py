from typing import Optional, List
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from app.models.models import Allocation


class AllocationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_week(self, org_id: str, week_start: date, user_id: Optional[str] = None):
        from app.models.models import Project
        query = (
            select(Allocation)
            .join(Project, Allocation.project_id == Project.id)
            .where(Project.org_id == org_id, Allocation.week_start == week_start)
        )
        if user_id:
            query = query.where(Allocation.user_id == user_id)
        result = await self.session.execute(query)
        allocations = result.scalars().all()

        # Group by user → shift
        grouped: dict = {}
        for a in allocations:
            if a.user_id not in grouped:
                grouped[a.user_id] = {"user_id": a.user_id, "shifts": {"manha": [], "tarde": [], "noite": []}}
            grouped[a.user_id]["shifts"][a.shift].append(a)
        return grouped

    async def get_by_id(self, allocation_id: str) -> Optional[Allocation]:
        result = await self.session.execute(select(Allocation).where(Allocation.id == allocation_id))
        return result.scalars().first()

    async def create(self, data: dict) -> Allocation:
        a = Allocation(**data)
        self.session.add(a)
        await self.session.flush()
        return a

    async def update(self, allocation_id: str, data: dict) -> Optional[Allocation]:
        a = await self.get_by_id(allocation_id)
        if a:
            for k, v in data.items():
                setattr(a, k, v)
            await self.session.flush()
        return a

    async def delete(self, allocation_id: str):
        a = await self.get_by_id(allocation_id)
        if a:
            await self.session.delete(a)

    async def clone_week(self, org_id: str, source_week: date, target_week: date, user_ids, created_by: str):
        from app.models.models import Project
        from app.services.conflict_service import ConflictService
        query = (
            select(Allocation)
            .join(Project, Allocation.project_id == Project.id)
            .where(Project.org_id == org_id, Allocation.week_start == source_week)
        )
        if user_ids:
            query = query.where(Allocation.user_id.in_(user_ids))
        result = await self.session.execute(query)
        source = result.scalars().all()

        cloned, skipped = 0, 0
        conflict_svc = ConflictService(self.session)
        for a in source:
            conflict = await conflict_svc.check_shift_conflict(a.user_id, target_week, a.shift)
            if conflict:
                skipped += 1
                continue
            new_a = Allocation(
                user_id=a.user_id, project_id=a.project_id,
                week_start=target_week, shift=a.shift,
                activity_type=a.activity_type, notes=a.notes,
                created_by=created_by,
            )
            self.session.add(new_a)
            cloned += 1
        await self.session.flush()
        return {"cloned": cloned, "skipped": skipped}

    async def get_user_load(self, user_id: str, week_start: date):
        from sqlalchemy import func
        result = await self.session.execute(
            select(func.count(Allocation.id))
            .where(Allocation.user_id == user_id, Allocation.week_start == week_start)
        )
        count = result.scalar_one_or_none() or 0
        return {"user_id": user_id, "week_start": str(week_start), "allocated_shifts": count, "max_shifts": 15}
