"""add_hijri_basis_and_offset_to_user_preferences

Revision ID: 142e85d08452
Revises: a27b67a0eb12
Create Date: 2026-06-20 13:29:10.194817+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '142e85d08452'
down_revision: Union[str, Sequence[str], None] = 'a27b67a0eb12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add `hijri_basis` and `hijri_offset` to `user_preferences`.

    Both columns have DB-level defaults so existing rows pick up the
    global/0 defaults automatically. We then back-fill any existing NULL
    rows (none expected, but safe) and add NOT NULL constraints.
    """
    op.add_column(
        "user_preferences",
        sa.Column(
            "hijri_basis",
            sa.String(),
            nullable=True,  # add as nullable first so back-fill is safe
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "hijri_offset",
            sa.Integer(),
            nullable=True,
        ),
    )
    # Back-fill any pre-existing rows with the defaults the model uses.
    op.execute("UPDATE user_preferences SET hijri_basis = 'global' WHERE hijri_basis IS NULL")
    op.execute("UPDATE user_preferences SET hijri_offset = 0 WHERE hijri_offset IS NULL")
    # Now enforce NOT NULL + DB-level defaults for future inserts.
    op.alter_column("user_preferences", "hijri_basis", nullable=False, server_default="global")
    op.alter_column("user_preferences", "hijri_offset", nullable=False, server_default="0")


def downgrade() -> None:
    """Drop `hijri_offset` and `hijri_basis` from `user_preferences`."""
    op.drop_column("user_preferences", "hijri_offset")
    op.drop_column("user_preferences", "hijri_basis")
