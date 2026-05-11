from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.core.database import get_session
from app.core.security import get_current_user, require_roles, hash_password
from app.models.models import User, UserRole

router = APIRouter()

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.IMPLANTADOR
    weekly_capacity_hours: int = 40

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    weekly_capacity_hours: Optional[int] = None
    is_active: Optional[bool] = None

@router.get("/")
async def list_users(current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(User).where(User.org_id == current_user.org_id, User.is_active == True).order_by(User.name)
    )
    users = result.scalars().all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "weekly_capacity_hours": u.weekly_capacity_hours, "is_active": u.is_active} for u in users]

@router.post("/", status_code=201)
async def create_user(body: UserCreate, current_user=Depends(require_roles(UserRole.ADMIN)), session: AsyncSession = Depends(get_session)):
    # Verifica se email já existe
    existing = await session.execute(select(User).where(User.email == body.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = User(
        org_id=current_user.org_id,
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        weekly_capacity_hours=body.weekly_capacity_hours,
    )
    session.add(user)
    await session.flush()
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}

@router.patch("/{user_id}")
async def update_user(user_id: str, body: UserUpdate, current_user=Depends(require_roles(UserRole.ADMIN)), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.id == user_id, User.org_id == current_user.org_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    for k, v in body.dict(exclude_none=True).items():
        setattr(user, k, v)
    user.updated_at = datetime.utcnow()
    await session.flush()
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}

@router.delete("/{user_id}", status_code=204)
async def deactivate_user(user_id: str, current_user=Depends(require_roles(UserRole.ADMIN)), session: AsyncSession = Depends(get_session)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode desativar sua própria conta")
    result = await session.execute(select(User).where(User.id == user_id, User.org_id == current_user.org_id))
    user = result.scalars().first()
    if user:
        user.is_active = False
        await session.flush()
