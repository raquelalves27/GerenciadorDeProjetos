from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.database import get_session
from app.core.security import get_current_user, require_roles
from app.models.models import Client, UserRole

router = APIRouter()

class ClientCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

@router.get("/")
async def list_clients(current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Client).where(Client.org_id == current_user.org_id, Client.is_active == True).order_by(Client.name))
    return result.scalars().all()

@router.post("/", status_code=201)
async def create_client(body: ClientCreate, current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)), session: AsyncSession = Depends(get_session)):
    client = Client(org_id=current_user.org_id, **body.dict())
    session.add(client)
    await session.flush()
    return client

@router.patch("/{client_id}")
async def update_client(client_id: str, body: ClientUpdate, current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Client).where(Client.id == client_id, Client.org_id == current_user.org_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    for k, v in body.dict(exclude_none=True).items():
        setattr(client, k, v)
    await session.flush()
    return client

@router.delete("/{client_id}", status_code=204)
async def delete_client(client_id: str, current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Client).where(Client.id == client_id, Client.org_id == current_user.org_id))
    client = result.scalars().first()
    if client:
        client.is_active = False
        await session.flush()
