"""Pydantic schemas for /tasks/* endpoints."""
from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# Valid kanban statuses. Kept in sync with the frontend
# ``frontend/src/pages/todo/columns.ts`` COLUMNS array.
TaskStatus = Literal["ideas", "todo", "doing", "done"]
TaskPriority = Literal["high", "medium", "low"]


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    priority: TaskPriority = "medium"
    due_date: Optional[date] = None


class TaskCreate(TaskBase):
    # New tasks default to the "ideas" (wall of ideas) column so they
    # appear as a backlog until the user promotes them. The frontend
    # create form leaves this default in place.
    status: TaskStatus = "ideas"


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    is_completed: Optional[bool] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[date] = None


class TaskResponse(TaskBase):
    id: int
    user_id: int
    is_completed: bool
    status: TaskStatus
    position: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskReorderItem(BaseModel):
    id: int
    status: TaskStatus
    position: int


class TaskReorderRequest(BaseModel):
    """Bulk-update payload sent by the Kanban UI after a drag ends.

    The endpoint rewrites every (id, status, position) tuple in a single
    transaction so the user only ever sees one network round trip per
    drag, even when several siblings need to be shifted to make room.
    """

    updates: List[TaskReorderItem]


class TaskReorderResponse(BaseModel):
    """The refreshed task list, returned so the client can drop it
    straight into its cache without a follow-up GET."""

    tasks: List[TaskResponse]