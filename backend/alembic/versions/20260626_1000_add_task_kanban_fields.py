"""add kanban fields to tasks

Revision ID: 20260626_1000
Revises: 20260625_1000
Create Date: 2026-06-26 10:00:00

Extends the ``tasks`` table for the drag-and-drop Kanban board:

  * ``status``    — varchar(16), one of ``ideas`` / ``todo`` / ``doing`` /
                    ``done``. The UI derives completion from
                    ``status == 'done'``; the legacy ``is_completed``
                    boolean is kept for backward compatibility and is
                    kept in sync by the application layer.
  * ``position``  — int, stable ordering within a column. The
                    ``POST /tasks/reorder`` endpoint rewrites this in
                    one transaction after each drag-and-drop.
  * ``priority``  — varchar(8), one of ``high`` / ``medium`` / ``low``.
  * ``due_date``  — nullable Date, optional deadline.

Backfill:

  * Any row with ``is_completed = true`` is migrated to ``status = 'done'``;
    every other row becomes ``status = 'ideas'``.
  * ``position`` is assigned per user via ``ROW_NUMBER()`` ordered by
    ``created_at`` so the user's existing list ordering is preserved
    (they'll all land in their new column, in the order they were
    created). On SQLite (tests) the window-function variant below is
    unavailable, so we fall back to a per-user Python-side rewrite
    driven from ``op.execute`` via a correlated subquery — see the
    ``is_sqlite`` branch.

A composite index on ``(user_id, status, position)`` keeps the column
queries fast once the user's task list grows.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260626_1000"
down_revision: Union[str, None] = "20260625_1000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # 1. Add the new columns. ``status`` and ``priority`` get server-side
    #    defaults so any concurrent INSERTs that don't specify them
    #    still land in a valid state.
    op.add_column(
        "tasks",
        sa.Column("status", sa.String(length=16), nullable=False, server_default="ideas"),
    )
    op.add_column(
        "tasks",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tasks",
        sa.Column("priority", sa.String(length=8), nullable=False, server_default="medium"),
    )
    op.add_column(
        "tasks",
        sa.Column("due_date", sa.Date(), nullable=True),
    )

    # 2. Backfill ``status`` from the legacy ``is_completed`` boolean.
    #    Use ``TRUE`` (not ``1``) so this is portable across Postgres /
    #    SQLite / MySQL — Postgres rejects ``boolean = integer``.
    op.execute("UPDATE tasks SET status = 'done' WHERE is_completed IS TRUE")

    # 3. Backfill ``position`` per user with stable ordering.
    if is_sqlite:
        # SQLite supports window functions from 3.25+, and Python's
        # bundled sqlite3 is always new enough. Mirror the Postgres
        # expression below.
        op.execute(
            """
            UPDATE tasks
               SET position = (
                   SELECT COUNT(*)
                     FROM tasks AS t2
                    WHERE t2.user_id = tasks.user_id
                      AND t2.created_at < tasks.created_at
               )
            """
        )
    else:
        op.execute(
            """
            UPDATE tasks
               SET position = sub.rn
              FROM (
                  SELECT id,
                         ROW_NUMBER() OVER (
                             PARTITION BY user_id
                             ORDER BY created_at
                         ) - 1 AS rn
                    FROM tasks
              ) AS sub
             WHERE tasks.id = sub.id
            """
        )

    # 4. Composite index for column queries (one user, one status,
    #    ordered by position).
    op.create_index(
        "ix_tasks_user_status_position",
        "tasks",
        ["user_id", "status", "position"],
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_user_status_position", table_name="tasks")
    op.drop_column("tasks", "due_date")
    op.drop_column("tasks", "priority")
    op.drop_column("tasks", "position")
    op.drop_column("tasks", "status")