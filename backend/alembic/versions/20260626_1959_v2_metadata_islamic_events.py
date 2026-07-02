"""v2 metadata islamic_events

Revision ID: f92b9cbb836d
Revises: 20260626_1000
Create Date: 2026-06-26 19:59:11.077707+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f92b9cbb836d"
down_revision: Union[str, Sequence[str], None] = "20260626_1000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add v2 metadata fields to islamic_events."""
    # Create enum types first (Postgres requires CREATE TYPE before use).
    dateprecision = sa.Enum(
        "EXACT", "MONTH_YEAR", "YEAR_ONLY", "APPROXIMATE",
        name="dateprecision",
    )
    dateprecision.create(op.get_bind(), checkfirst=True)

    authenticity = sa.Enum(
        "STRONG", "MODERATE", "DISPUTED", "WEAK",
        name="authenticity",
    )
    authenticity.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "islamic_events",
        sa.Column("hijri_year", sa.Integer(), nullable=True),
    )
    op.add_column(
        "islamic_events",
        sa.Column("location", sa.String(), nullable=True),
    )
    op.add_column(
        "islamic_events",
        sa.Column("date_gregorian", sa.String(), nullable=True),
    )
    op.add_column(
        "islamic_events",
        sa.Column(
            "date_precision",
            dateprecision,
            nullable=False,
            server_default="EXACT",
        ),
    )
    op.add_column(
        "islamic_events",
        sa.Column("primary_sources", sa.JSON(), nullable=True),
    )
    op.add_column(
        "islamic_events",
        sa.Column("historical_sources", sa.JSON(), nullable=True),
    )
    op.add_column(
        "islamic_events",
        sa.Column(
            "scholarly_consensus",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "islamic_events",
        sa.Column(
            "authenticity",
            authenticity,
            nullable=False,
            server_default="MODERATE",
        ),
    )
    op.add_column(
        "islamic_events",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("islamic_events", "notes")
    op.drop_column("islamic_events", "authenticity")
    op.drop_column("islamic_events", "scholarly_consensus")
    op.drop_column("islamic_events", "historical_sources")
    op.drop_column("islamic_events", "primary_sources")
    op.drop_column("islamic_events", "date_precision")
    op.drop_column("islamic_events", "date_gregorian")
    op.drop_column("islamic_events", "location")
    op.drop_column("islamic_events", "hijri_year")
    sa.Enum(name="authenticity").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="dateprecision").drop(op.get_bind(), checkfirst=True)
