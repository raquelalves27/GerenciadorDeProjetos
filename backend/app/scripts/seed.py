import asyncio, sys, os
sys.path.insert(0, '/app')

async def seed():
    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.models import Organization, User, UserRole
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(Organization).limit(1))
        if existing.scalars().first():
            print("Banco ja possui dados. Seed ignorado.")
            return
        org = Organization(name="Minha Empresa", slug="minha-empresa", plan="enterprise", is_active=True)
        session.add(org)
        await session.flush()
        admin = User(org_id=org.id, name="Administrador", email="admin@empresa.com",
                     password_hash=hash_password("admin123"), role=UserRole.ADMIN, weekly_capacity_hours=40)
        session.add(admin)
        await session.commit()
        print(f"Organizacao: {org.name} | id: {org.id}")
        print("Login: admin@empresa.com | Senha: admin123")

asyncio.run(seed())
