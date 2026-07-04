"""add prayer_qada_entry table

Revision ID: 20260705_1000
Revises: 20260702_0900
Create Date: 2026-07-05 10:00:00

Adds the ``prayer_qada_entry`` table — one row per qada makeup action
the user actually performed (via the Qada tile's "Mark complete" button).
Distinct from ``prayer_qada`` (lifetime aggregate counters) and
``prayer_qada_event`` (append-only audit log); this table is the
queryable, per-action record so the app can list a user's makeup
history and answer "what qada did I do on date X?".
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260705_1000"
down_revision: Union[str, None] = "20260702_0900"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prayer_qada_entry",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("prayer_name", sa.String(length=16), nullable=False),
        sa.Column("made_up_date", sa.Date(), nullable=False),
        sa.Column("missed_date", sa.Date(), nullable=True),
        sa.Column("is_jamaaah", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "user_id",
            "prayer_name",
            "made_up_date",
            name="uq_prayer_qada_entry_user_name_date",
        ),
    )
    op.create_index(
        "ix_prayer_qada_entry_user_id",
        "prayer_qada_entry",
        ["user_id"],
    )
    op.create_index(
        "ix_prayer_qada_entry_prayer_name",
        "prayer_qada_entry",
        ["prayer_name"],
    )
    op.create_index(
        "ix_prayer_qada_entry_made_up_date",
        "prayer_qada_entry",
        ["made_up_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_prayer_qada_entry_made_up_date", table_name="prayer_qada_entry")
    op.drop_index("ix_prayer_qada_entry_prayer_name", table_name="prayer_qada_entry")
    op.drop_index("ix_prayer_qada_entry_user_id", table_name="prayer_qada_entry")
    op.drop_table("prayer_qada_entry")