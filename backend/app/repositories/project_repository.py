from typing import Optional, Tuple, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.models.models import Project, ProjectStage, ProjectUpdate, Risk


class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_with_filters(self, filters: dict, page: int, size: int) -> Tuple[List, int]:
        query = select(Project)

        if filters.get("org_id"):
            query = query.where(Project.org_id == filters["org_id"])
        if filters.get("status"):
            query = query.where(Project.status == filters["status"])
        if filters.get("priority"):
            query = query.where(Project.priority == filters["priority"])
        if filters.get("master_id"):
            query = query.where(Project.master_id == filters["master_id"])
        if filters.get("product_id"):
            query = query.where(Project.product_id == filters["product_id"])
        if filters.get("client_id"):
            query = query.where(Project.client_id == filters["client_id"])
        if filters.get("search"):
            query = query.where(Project.name.ilike(f"%{filters['search']}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        query = query.order_by(Project.created_at.desc())
        query = query.offset((page - 1) * size).limit(size)

        result = await self.session.execute(query)
        items = result.scalars().all()

        return items, total

    async def get_by_id(self, project_id: str) -> Optional[Project]:
        result = await self.session.execute(
            select(Project).where(Project.id == project_id)
        )
        return result.scalars().first()

    async def get_full(self, project_id: str, org_id: str) -> Optional[Project]:
        result = await self.session.execute(
            select(Project).where(Project.id == project_id, Project.org_id == org_id)
        )
        return result.scalars().first()

    async def create(self, data: dict) -> Project:
        project = Project(**data)
        self.session.add(project)
        await self.session.flush()
        return project

    async def update(self, project_id: str, data: dict) -> Optional[Project]:
        project = await self.get_by_id(project_id)
        if project:
            for k, v in data.items():
                setattr(project, k, v)
            await self.session.flush()
        return project

    async def delete(self, project_id: str, org_id: str):
        project = await self.get_full(project_id, org_id)
        if project:
            await self.session.delete(project)

    async def add_update(self, project_id, author_id, content, completion_pct, status) -> ProjectUpdate:
        u = ProjectUpdate(
            project_id=project_id,
            author_id=author_id,
            content=content,
            completion_pct_snapshot=completion_pct,
            status_snapshot=status,
        )
        self.session.add(u)
        await self.session.flush()
        return u

    async def get_updates(self, project_id: str):
        result = await self.session.execute(
            select(ProjectUpdate)
            .where(ProjectUpdate.project_id == project_id)
            .order_by(ProjectUpdate.created_at.desc())
        )
        return result.scalars().all()

    async def add_stage(self, project_id: str, data: dict) -> ProjectStage:
        stage = ProjectStage(project_id=project_id, **data)
        self.session.add(stage)
        await self.session.flush()
        return stage

    async def get_stages(self, project_id: str):
        result = await self.session.execute(
            select(ProjectStage)
            .where(ProjectStage.project_id == project_id)
            .order_by(ProjectStage.order_idx)
        )
        return result.scalars().all()

    async def add_risk(self, project_id: str, reported_by: str, data: dict) -> Risk:
        risk = Risk(project_id=project_id, reported_by=reported_by, **data)
        self.session.add(risk)
        await self.session.flush()
        return risk

    async def get_risks(self, project_id: str):
        result = await self.session.execute(
            select(Risk).where(Risk.project_id == project_id)
            .order_by(Risk.created_at.desc())
        )
        return result.scalars().all()
