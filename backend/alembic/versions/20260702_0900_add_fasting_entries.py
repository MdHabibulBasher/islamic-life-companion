"""add fasting_entries table

Revision ID: 20260702_0900
Revises: 20260627_1100
Create Date: 2026-07-02 09:00:00

Adds the ``fasting_entries`` table backing the new Fasting page:

* one row per (user, gregorian date) with a unique constraint
* denormalised Hijri parts (year / month / day / month name) for cheap
  month-level filtering on the calendar view
* auto-derived flags: is_ramadan, is_monday_thursday, is_white_day
* optional sadaqah / fitrah donation fields
* optional good-deed text + done-checkbox
* free-form notes
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260702_0900"
down_revision: Union[str, Sequence[str], None] = "20260627_1100"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fasting_entries",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("date", sa.Date(), nullable=False, index=True),
        sa.Column("hijri_date", sa.String(length=32), nullable=True),
        sa.Column("hijri_day", sa.Integer(), nullable=True),
        sa.Column("hijri_month", sa.Integer(), nullable=True),
        sa.Column("hijri_year", sa.Integer(), nullable=True),
        sa.Column("hijri_month_name", sa.String(length=32), nullable=True),
        sa.Column("fasted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_ramadan", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "is_monday_thursday",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("is_white_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("donation_amount", sa.Float(), nullable=True),
        sa.Column("donation_currency", sa.String(length=8), nullable=True),
        sa.Column("donation_note", sa.Text(), nullable=True),
        sa.Column("good_deed", sa.Text(), nullable=True),
        sa.Column("good_deed_done", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "date", name="uq_fasting_entries_user_date"),
    )
    op.create_index(
        "ix_fasting_entries_user_hijri",
        "fasting_entries",
        ["user_id", "hijri_year", "hijri_month"],
    )


def downgrade() -> None:
    op.drop_index("ix_fasting_entries_user_hijri", table_name="fasting_entries")
    op.drop_table("fasting_entries")
