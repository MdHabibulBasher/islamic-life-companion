"""Add level + prerequisite to challenges for progression system

Revision ID: 20260627_1000
Revises: f92b9cbb836d
Create Date: 2026-06-27 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260627_1000'
down_revision: Union[str, Sequence[str], None] = 'f92b9cbb836d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add level + prerequisite_challenge_id columns to challenges."""
    op.add_column(
        'challenges',
        sa.Column('level', sa.Integer(), nullable=False, server_default='1'),
    )
    op.add_column(
        'challenges',
        sa.Column(
            'prerequisite_challenge_id',
            sa.String(),
            sa.ForeignKey('challenges.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_challenges_level', 'challenges', ['level'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_challenges_level', table_name='challenges')
    op.drop_column('challenges', 'prerequisite_challenge_id')
    op.drop_column('challenges', 'level')
