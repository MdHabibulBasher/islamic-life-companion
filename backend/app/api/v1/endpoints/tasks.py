"""Task / Todo endpoints backed by the `tasks` table."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskReorderRequest,
    TaskReorderResponse,
    TaskResponse,
    TaskStatus,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

#: Whitelisted statuses, lifted out so the OpenAPI schema picks them up.
VALID_STATUSES: tuple[TaskStatus, ...] = ("ideas", "todo", "doing", "done")


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    completed: Optional[bool] = None,
    status_filter: Optional[TaskStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's tasks.

    Query params
    ------------
    completed : optional bool — legacy filter; kept for backward
                compatibility. New callers should use ``status=done``
                instead.
    status    : optional str — ``ideas`` / ``todo`` / ``doing`` / ``done``.

    Results are ordered by ``position`` ascending inside the column,
    then ``created_at`` descending as a tie-breaker.
    """
    query = db.query(Task).filter(Task.user_id == current_user.id)

    if status_filter is not None:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
            )
        query = query.filter(Task.status == status_filter)
    elif completed is not None:
        # Backward compatibility — translate the old flag into the new
        # ``status`` column. ``completed=true`` means ``status='done'``.
        if completed:
            query = query.filter(Task.status == "done")
        else:
            query = query.filter(Task.status != "done")

    return query.order_by(Task.position.asc(), Task.created_at.desc()).all()


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ``position`` is set to (max + 1) within the requested column so new
    # cards always land at the bottom without requiring the client to
    # compute it.
    max_position = (
        db.query(Task)
        .filter(Task.user_id == current_user.id, Task.status == payload.status)
        .order_by(Task.position.desc())
        .first()
    )
    next_position = (max_position.position + 1) if max_position else 0

    task = Task(
        user_id=current_user.id,
        position=next_position,
        **payload.model_dump(),
    )
    # Keep the legacy ``is_completed`` flag in sync so older clients
    # reading the boolean don't drift from the new ``status`` column.
    task.is_completed = task.status == "done"
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    updates = payload.model_dump(exclude_unset=True)

    # If the caller moved the card to a different column without
    # supplying a new ``position``, append it to the bottom of the new
    # column so we don't create overlapping positions.
    new_status = updates.get("status")
    if new_status and new_status != task.status and "position" not in updates:
        max_position = (
            db.query(Task)
            .filter(
                Task.user_id == current_user.id,
                Task.status == new_status,
                Task.id != task.id,
            )
            .order_by(Task.position.desc())
            .first()
        )
        updates["position"] = (max_position.position + 1) if max_position else 0

    for field, value in updates.items():
        setattr(task, field, value)

    # Keep the legacy boolean in sync whenever ``status`` was part of the
    # update.
    if "status" in updates:
        task.is_completed = task.status == "done"

    db.commit()
    db.refresh(task)
    return task


@router.post("/reorder", response_model=TaskReorderResponse)
def reorder_tasks(
    payload: TaskReorderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persist a drag-and-drop reorder in one round trip.

    The body is ``{"updates": [{"id": ..., "status": ..., "position": ...}, ...]}``.
    Each tuple overwrites ``status`` and ``position`` for that task.
    All updates happen inside a single transaction — partial application
    is not possible, so either every card lands in its new home or none
    of them do.

    Validation:

      * Every ``id`` must belong to the current user; cross-user ids
        are rejected with 404 (we don't disclose existence).
      * Every ``status`` must be one of ``ideas`` / ``todo`` / ``doing``
        / ``done``.
      * The list may not be empty — sending an empty reorder is almost
        always a client bug worth surfacing.

    The response is the refreshed task list for the user, ordered by
    ``(status, position)``, so the client can drop it straight into its
    React Query cache.
    """
    if not payload.updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updates supplied",
        )

    ids = [u.id for u in payload.updates]
    if len(set(ids)) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate task ids in updates",
        )

    # Validate every status first so we don't half-apply the reorder if
    # the payload is malformed.
    for u in payload.updates:
        if u.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{u.status}'. Must be one of: {', '.join(VALID_STATUSES)}",
            )

    # Fetch all targeted tasks in one query and confirm ownership.
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id, Task.id.in_(ids))
        .all()
    )
    found_ids = {t.id for t in tasks}
    missing = [i for i in ids if i not in found_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task(s) not found: {missing}",
        )

    by_id = {t.id: t for t in tasks}
    for u in payload.updates:
        task = by_id[u.id]
        moved_to_done = task.status != "done" and u.status == "done"
        moved_from_done = task.status == "done" and u.status != "done"
        task.status = u.status
        task.position = u.position
        # Mirror the legacy boolean so older clients stay consistent.
        if moved_to_done:
            task.is_completed = True
        elif moved_from_done:
            task.is_completed = False

    db.commit()

    # Return the refreshed list so the client can avoid a follow-up GET.
    refreshed = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.status.asc(), Task.position.asc(), Task.created_at.desc())
        .all()
    )
    return TaskReorderResponse(tasks=refreshed)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    db.delete(task)
    db.commit()
    return None