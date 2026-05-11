from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_session
from app.core.security import get_current_user, require_roles
from app.models.models import Product, UserRole

router = APIRouter()

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None

@router.get("/")
async def list_products(current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Product).where(Product.org_id == current_user.org_id, Product.is_active == True).order_by(Product.name))
    return result.scalars().all()

@router.post("/", status_code=201)
async def create_product(body: ProductCreate, current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)), session: AsyncSession = Depends(get_session)):
    product = Product(org_id=current_user.org_id, **body.dict())
    session.add(product)
    await session.flush()
    return product

@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, current_user=Depends(require_roles(UserRole.ADMIN, UserRole.GESTOR)), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Product).where(Product.id == product_id, Product.org_id == current_user.org_id))
    p = result.scalars().first()
    if p:
        p.is_active = False
        await session.flush()
