import json
from datetime import datetime
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        user_id: str,
        entity_type: str,
        entity_id: str,
        action: str,
        before_data: Optional[Any] = None,
        after_data: Optional[Any] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        log = AuditLog(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before_data=json.dumps(before_data, default=str) if before_data else None,
            after_data=json.dumps(after_data, default=str) if after_data else None,
            ip_address=ip_address,
        )
        self.session.add(log)
        await self.session.flush()
        return log
