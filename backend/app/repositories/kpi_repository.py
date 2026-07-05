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

    async def get_allocation_insights(
        self, org_id: str,
        start: Optional[date] = None, end: Optional[date] = None,
    ):
        """
        Cruza Allocation x Project x Client x User para responder:
        - qual profissional mais atende cada cliente (e no total)
        - qual cliente recebe mais/menos alocações no período
        Unidade = turnos alocados (mesma unidade já usada em get_team_capacity),
        já que start_time/end_time nem sempre são preenchidos.
        """
        from app.models.models import Client

        query = (
            select(
                User.id.label("user_id"), User.name.label("user_name"),
                Client.id.label("client_id"), Client.name.label("client_name"),
                func.count(Allocation.id).label("shifts"),
            )
            .select_from(Allocation)
            .join(Project, Allocation.project_id == Project.id)
            .join(Client, Project.client_id == Client.id)
            .join(User, Allocation.user_id == User.id)
            .where(Project.org_id == org_id)
        )
        if start:
            query = query.where(Allocation.week_start >= start)
        if end:
            query = query.where(Allocation.week_start <= end)
        query = query.group_by(User.id, User.name, Client.id, Client.name)

        rows = (await self.session.execute(query)).all()
        by_professional_client = sorted(
            [
                {
                    "user_id": r.user_id, "user_name": r.user_name,
                    "client_id": r.client_id, "client_name": r.client_name,
                    "shifts": r.shifts,
                }
                for r in rows
            ],
            key=lambda x: x["shifts"], reverse=True,
        )

        # Todos os clientes ativos da org, para capturar quem tem ZERO alocações
        # (uma junção interna nunca mostraria esses casos).
        clients_result = await self.session.execute(
            select(Client.id, Client.name).where(Client.org_id == org_id, Client.is_active == True)
        )
        all_clients = {r[0]: r[1] for r in clients_result.fetchall()}

        client_totals: dict = {cid: 0 for cid in all_clients}
        for row in by_professional_client:
            client_totals[row["client_id"]] = client_totals.get(row["client_id"], 0) + row["shifts"]

        by_client_total = sorted(
            [{"client_id": cid, "client_name": name, "shifts": client_totals.get(cid, 0)}
             for cid, name in all_clients.items()],
            key=lambda x: x["shifts"],
        )

        prof_totals: dict = {}
        for row in by_professional_client:
            key = (row["user_id"], row["user_name"])
            prof_totals[key] = prof_totals.get(key, 0) + row["shifts"]
        by_professional_total = sorted(
            [{"user_id": k[0], "user_name": k[1], "shifts": v} for k, v in prof_totals.items()],
            key=lambda x: x["shifts"], reverse=True,
        )

        return {
            "period": {"start": str(start) if start else None, "end": str(end) if end else None},
            "by_professional_client": by_professional_client[:30],
            "by_client_total": by_client_total,
            "by_professional_total": by_professional_total,
            "top_pair": by_professional_client[0] if by_professional_client else None,
            "least_allocated_client": by_client_total[0] if by_client_total else None,
            "most_allocated_client": by_client_total[-1] if by_client_total else None,
        }
