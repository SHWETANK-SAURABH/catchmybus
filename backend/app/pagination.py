"""Shared pagination helper for list endpoints (?page=1&size=20)."""
from fastapi import Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session


class PageParams:
    def __init__(self, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=200)):
        self.page = page
        self.size = size


def paginate(db: Session, stmt, params: PageParams) -> dict:
    """Run `stmt` with LIMIT/OFFSET and return {items, total, page, size}."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.scalars(stmt.offset((params.page - 1) * params.size).limit(params.size)).all()
    return {"items": items, "total": total or 0, "page": params.page, "size": params.size}
