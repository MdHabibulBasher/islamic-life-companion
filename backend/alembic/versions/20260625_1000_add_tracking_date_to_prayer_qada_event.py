"""add tracking_date to prayer_qada_event

Revision ID: 20260625_1000
Revises: 20260622_1000
Create Date: 2026-06-25 10:00:00

Decouples "the date the qada adjustment is for" (``tracking_date``)
from "the date the user tapped the button" (``created_at``). Until
now these were always the same, which broke the Stats view's range
filter for users who back-fill: someone tapping "Mark complete" on
Jul 2 for a Fajr they missed on Jun 24 would have that makeup
counted under Jul 2 instead of Jun 24.

Adds a nullable ``tracking_date`` column with an index. Backfills
existing rows with ``created_at::date`` so legacy events still
appear under sensible ranges (the Stats endpoint falls back to
``created_at::date`` for null ``tracking_date`` rows at query time,
but pre-filling means even an offline audit dump still groups
correctly).

This migration also strips the now-unused ``track_uncheck_compensation``
``reason`` value semantics: with the qada tile decoupled from the
daily row, compensation events are no longer written. Existing
compensation rows from older builds stay in the audit log but are
treated as ordinary +1 events by the new logic (which is fine — the
underlying qada counters are already correct because the
compensation was applied at write time).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260625_1000"
down_revision: Union[str, None] = "20260622_1000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the column. Nullable so legacy rows pre-migration still
    #    load (and so the backfill step below can be a single UPDATE
    #    that targets only the rows we want to set).
    op.add_column(
        "prayer_qada_event",
        sa.Column("tracking_date", sa.Date(), nullable=True),
    )
    op.create_index(
        "ix_prayer_qada_event_tracking_date",
        "prayer_qada_event",
        ["tracking_date"],
    )

    # 2. Backfill: copy created_at's date portion into tracking_date
    #    for every row that doesn't have one yet. ``created_at`` is
    #    stored as a timezone-aware DateTime in the model; on most
    #    backends (SQLite + Postgres + MySQL) CAST(... AS DATE) gives
    #    us the calendar day in the server's timezone. For the
    #    purposes of the Stats view this is the right default — any
    #    pre-migration makeup is counted on the day the user tapped
    #    the button, which is what the old code did too.
    op.execute(
        "UPDATE prayer_qada_event "
        "SET tracking_date = DATE(created_at) "
        "WHERE tracking_date IS NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_prayer_qada_event_tracking_date", table_name="prayer_qada_event")
    op.drop_column("prayer_qada_event", "tracking_date")
