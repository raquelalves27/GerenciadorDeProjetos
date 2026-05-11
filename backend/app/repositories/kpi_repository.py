from datetime import date, datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.models import Project, ProjectStatus, User, Allocation, Product


class KpiRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_executive_kpis(self, org_id: str, month: Optional[int] = None, year: Optional[int] = None):
        now = datetime.utcnow()
        m = month or now.month
        y = year or now.year

        base = select(func.count(Project.id)).where(Project.org_id == org_id)

        total = (await self.session.execute(base)).scalar_one()
        em_andamento = (await self.session.execute(
            base.where(Project.status == ProjectStatus.EM_ANDAMENTO)
        )).scalar_one()
        atrasados = (await self.session.execute(
            base.where(Project.status == ProjectStatus.EM_RISCO)
        )).scalar_one()
        em_risco = atrasados
        concluidos = (await self.session.execute(
            base.where(Project.status == ProjectStatus.CONCLUIDO)
        )).scalar_one()

        avg_result = await self.session.execute(
            select(func.avg(Project.completion_pct)).where(Project.org_id == org_id)
        )
        taxa_media = float(avg_result.scalar_one_or_none() or 0)

        # Distribution by status
        status_dist_result = await self.session.execute(
            select(Project.status, func.count(Project.id))
            .where(Project.org_id == org_id)
            .group_by(Project.status)
        )
        status_dist = [{"status": r[0], "count": r[1]} for r in status_dist_result.fetchall()]

        # Distribution by product
        prod_dist_result = await self.session.execute(
            select(Product.name, func.count(Project.id))
            .join(Project, Project.product_id == Product.id)
            .where(Project.org_id == org_id)
            .group_by(Product.name)
            .order_by(func.count(Project.id).desc())
        )
        prod_dist = [{"product": r[0], "count": r[1]} for r in prod_dist_result.fetchall()]

        # At risk projects
        at_risk_result = await self.session.execute(
            select(Project)
            .where(Project.org_id == org_id, Project.status == ProjectStatus.EM_RISCO)
            .order_by(Project.expected_end_date)
            .limit(10)
        )
        at_risk = at_risk_result.scalars().all()

        return {
            "total_projects": total,
            "em_andamento": em_andamento,
            "concluidos_mes": concluidos,
            "atrasados": atrasados,
            "em_risco": em_risco,
            "taxa_media_conclusao": round(taxa_media, 1),
            "status_distribution": status_dist,
            "product_distribution": prod_dist,
            "at_risk_projects": [
                {
                    "id": p.id, "name": p.name, "status": p.status,
                    "completion_pct": p.completion_pct,
                    "expected_end_date": str(p.expected_end_date),
                }
                for p in at_risk
            ],
        }

    async def get_team_capacity(self, org_id: str, week_start: date):
        users_result = await self.session.execute(
            select(User).where(User.org_id == org_id, User.is_active == True)
        )
        users = users_result.scalars().all()

        implantadores = []
        for u in users:
            count_result = await self.session.execute(
                select(func.count(Allocation.id))
                .where(Allocation.user_id == u.id, Allocation.week_start == week_start)
            )
            allocated = count_result.scalar_one_or_none() or 0
            cap = 15
            implantadores.append({
                "user": {"id": u.id, "name": u.name, "email": u.email},
                "allocated_shifts": allocated,
                "capacity_shifts": cap,
                "occupancy_pct": round((allocated / cap) * 100, 1) if cap else 0,
            })

        return {
            "total_implantadores": len(users),
            "implantadores": implantadores,
            "week_start": str(week_start),
        }

    async def get_implantadores_ranking(self, org_id: str):
        from datetime import timedelta
        cutoff = date.today() - timedelta(days=30)
        result = await self.session.execute(
            select(User.id, User.name, func.count(Allocation.id).label("total"))
            .join(Allocation, Allocation.user_id == User.id)
            .where(User.org_id == org_id, Allocation.week_start >= cutoff)
            .group_by(User.id, User.name)
            .order_by(func.count(Allocation.id).desc())
            .limit(10)
        )
        return [{"id": r[0], "name": r[1], "total_allocations": r[2]} for r in result.fetchall()]

    async def get_product_distribution(self, org_id: str):
        result = await self.session.execute(
            select(Product.name, func.count(Project.id))
            .join(Project, Project.product_id == Product.id)
            .where(Project.org_id == org_id)
            .group_by(Product.name)
        )
        return [{"product": r[0], "count": r[1]} for r in result.fetchall()]

    async def get_timeline(self, org_id: str, start: date, end: date):
        result = await self.session.execute(
            select(Project).where(
                Project.org_id == org_id,
                Project.expected_end_date >= start,
                Project.expected_end_date <= end,
            ).order_by(Project.expected_end_date)
        )
        projects = result.scalars().all()
        return [
            {
                "id": p.id, "name": p.name, "status": p.status,
                "start_date": str(p.start_date) if p.start_date else None,
                "expected_end_date": str(p.expected_end_date),
                "completion_pct": p.completion_pct,
            }
            for p in projects
        ]
