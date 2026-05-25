from datetime import datetime, date, time
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
import uuid


def gen_uuid() -> str:
    return str(uuid.uuid4())


class UserRole(str, Enum):
    ADMIN = "admin"
    GESTOR = "gestor"
    IMPLANTADOR = "implantador"


class ProjectStatus(str, Enum):
    NAO_INICIADO = "nao_iniciado"
    EM_ANDAMENTO = "em_andamento"
    EM_RISCO = "em_risco"
    CONCLUIDO = "concluido"
    PAUSADO = "pausado"


class ProjectPriority(str, Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"
    CRITICA = "critica"


class StageStatus(str, Enum):
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    CONCLUIDO = "concluido"
    BLOQUEADO = "bloqueado"


class ShiftType(str, Enum):
    MANHA = "manha"
    TARDE = "tarde"
    NOITE = "noite"


class ActivityType(str, Enum):
    IMPLANTACAO = "implantacao"
    TREINAMENTO = "treinamento"
    SUPORTE = "suporte"
    REUNIAO = "reuniao"
    CONFIGURACAO = "configuracao"


class RiskSeverity(str, Enum):
    BAIXO = "baixo"
    MEDIO = "medio"
    ALTO = "alto"
    CRITICO = "critico"


class AlertType(str, Enum):
    CONFLITO_HORARIO = "conflito_horario"
    SOBRECARGA = "sobrecarga"
    PROJETO_ATRASADO = "projeto_atrasado"
    SEM_EVOLUCAO = "sem_evolucao"
    PRAZO_PROXIMO = "prazo_proximo"


class Organization(SQLModel, table=True):
    __tablename__ = "organizations"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    plan: str = Field(default="starter")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    org_id: str = Field(foreign_key="organizations.id", index=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: UserRole = Field(default=UserRole.IMPLANTADOR)
    is_active: bool = Field(default=True)
    avatar_url: Optional[str] = None
    weekly_capacity_hours: int = Field(default=40)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class Product(SQLModel, table=True):
    __tablename__ = "products"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    org_id: str = Field(foreign_key="organizations.id", index=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Client(SQLModel, table=True):
    __tablename__ = "clients"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    org_id: str = Field(foreign_key="organizations.id", index=True)
    name: str = Field(index=True)
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    org_id: str = Field(foreign_key="organizations.id", index=True)
    client_id: str = Field(foreign_key="clients.id", index=True)
    product_id: str = Field(foreign_key="products.id", index=True)
    master_id: str = Field(foreign_key="users.id", index=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    status: ProjectStatus = Field(default=ProjectStatus.NAO_INICIADO, index=True)
    priority: ProjectPriority = Field(default=ProjectPriority.MEDIA, index=True)
    completion_pct: int = Field(default=0, ge=0, le=100)
    start_date: Optional[date] = None
    expected_end_date: date
    actual_end_date: Optional[date] = None
    internal_notes: Optional[str] = None
    last_progress_update: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class ProjectStage(SQLModel, table=True):
    __tablename__ = "project_stages"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    owner_id: Optional[str] = Field(default=None, foreign_key="users.id")
    name: str
    description: Optional[str] = None
    status: StageStatus = Field(default=StageStatus.PENDENTE)
    order_idx: int = Field(default=0)
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProjectUpdate(SQLModel, table=True):
    __tablename__ = "project_updates"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    author_id: str = Field(foreign_key="users.id")
    content: str
    completion_pct_snapshot: int
    status_snapshot: ProjectStatus
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Allocation(SQLModel, table=True):
    __tablename__ = "allocations"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    week_start: date = Field(index=True)
    day: Optional[date] = None
    shift: ShiftType
    activity_type: ActivityType = Field(default=ActivityType.IMPLANTACAO)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    repeat_weekly: bool = Field(default=False)
    notes: Optional[str] = None
    created_by: str = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class Risk(SQLModel, table=True):
    __tablename__ = "risks"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    reported_by: str = Field(foreign_key="users.id")
    description: str
    severity: RiskSeverity = Field(default=RiskSeverity.MEDIO)
    status: str = Field(default="aberto")
    mitigation: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    entity_type: str = Field(index=True)
    entity_id: str = Field(index=True)
    action: str
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Alert(SQLModel, table=True):
    __tablename__ = "alerts"
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    org_id: str = Field(foreign_key="organizations.id", index=True)
    alert_type: AlertType
    entity_type: str
    entity_id: str
    message: str
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
