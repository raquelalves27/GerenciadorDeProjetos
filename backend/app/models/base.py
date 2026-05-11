import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


def gen_uuid() -> str:
    return str(uuid.uuid4())


class BaseModel(SQLModel):
    id: str = Field(default_factory=gen_uuid, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)

    class Config:
        arbitrary_types_allowed = True
