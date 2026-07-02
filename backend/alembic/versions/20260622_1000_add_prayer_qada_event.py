"""add prayer qada event audit log

Revision ID: 20260622_1000
Revises: 20260620_2100
Create Date: 2026-06-22 10:00:00

Adds the ``prayer_qada_event`` table — an append-only audit log of every
qada adjustment, so the Stats view can answer "how many qada did the user
make up between date X and date Y?" without losing fidelity to the
lifetime ``prayer_qada.made_up_count`` counter.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260622_1000"
down_revision: Union[str, None] = "20260620_2100"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prayer_qada_event",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prayer_name", sa.String(length=16), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_prayer_qada_event_user_id", "prayer_qada_event", ["user_id"])
    op.create_index("ix_prayer_qada_event_prayer_name", "prayer_qada_event", ["prayer_name"])
    op.create_index("ix_prayer_qada_event_created_at", "prayer_qada_event", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_prayer_qada_event_created_at", table_name="prayer_qada_event")
    op.drop_index("ix_prayer_qada_event_prayer_name", table_name="prayer_qada_event")
    op.drop_index("ix_prayer_qada_event_user_id", table_name="prayer_qada_event")
    op.drop_table("prayer_qada_event")
