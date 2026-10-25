"""Audit logging (NFR14): every admin write adds an audit_log row in the same transaction."""
from datetime import date, datetime, time

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from ..models import AuditLog, User


def row_to_dict(obj) -> dict:
    """Column values of an ORM object as JSON-friendly values (for audit details)."""
    out = {}
    for col in inspect(obj).mapper.column_attrs:
        v = getattr(obj, col.key)
        out[col.key] = v.isoformat() if isinstance(v, (datetime, date, time)) else v
    return out


def record(db: Session, admin: User, action: str, entity: str, entity_id, details: dict | None = None):
    """Add (not commit) an audit row; the caller's commit makes it atomic with the change."""
    db.add(AuditLog(admin_id=admin.id, action=action, entity=entity,
                    entity_id=None if entity_id is None else str(entity_id), details_json=details))
