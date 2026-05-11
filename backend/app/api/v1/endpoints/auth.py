from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.database import get_session
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user
)
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService

router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    repo = UserRepository(session)
    user = await repo.get_by_email(form_data.username)

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta desativada")

    extra = {"role": user.role.value, "org_id": user.org_id}
    access = create_access_token(user.id, extra)
    refresh = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "org_id": user.org_id,
            "avatar_url": user.avatar_url,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresh inválido")

    repo = UserRepository(session)
    user = await repo.get_by_id(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    extra = {"role": user.role.value, "org_id": user.org_id}
    return TokenResponse(
        access_token=create_access_token(user.id, extra),
        refresh_token=create_refresh_token(user.id),
        user={"id": user.id, "name": user.name, "email": user.email, "role": user.role.value},
    )


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.value,
        "org_id": current_user.org_id,
        "avatar_url": current_user.avatar_url,
        "weekly_capacity_hours": current_user.weekly_capacity_hours,
    }


@router.post("/password-reset/request")
async def request_password_reset(
    body: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    repo = UserRepository(session)
    user = await repo.get_by_email(body.email)
    if user:
        # Em produção: gerar token seguro, armazenar no Redis, enviar email
        reset_token = create_access_token(user.id, {"type": "reset", "purpose": "pwd_reset"})
        # background_tasks.add_task(send_reset_email, user.email, reset_token)
    # Sempre retornar 200 para não expor se email existe
    return {"message": "Se o email existir, você receberá as instruções de recuperação"}
