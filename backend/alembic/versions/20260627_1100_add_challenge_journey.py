"""Add challenge journey columns + hadith + reward tables

Revision ID: 20260627_1100
Revises: 20260627_1000
Create Date: 2026-06-27 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260627_1100'
down_revision: Union[str, Sequence[str], None] = '20260627_1000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add challenge_type metadata + hadith + reward tables."""
    # ── Extend challenges ───────────────────────────────────────────────
    op.add_column(
        'challenges',
        sa.Column('challenge_type', sa.String(length=32), nullable=False, server_default='streak'),
    )
    op.add_column(
        'challenges',
        sa.Column('position', sa.Integer(), nullable=False, server_default='1'),
    )
    op.add_column(
        'challenges',
        sa.Column('streak_target', sa.Integer(), nullable=True),
    )
    op.add_column(
        'challenges',
        sa.Column('reward_tier', sa.String(length=32), nullable=True),
    )
    op.add_column(
        'challenges',
        sa.Column('dua_reminder', sa.Text(), nullable=True),
    )

    # ── Hadith library ──────────────────────────────────────────────────
    op.create_table(
        'hadiths',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('text_en', sa.Text(), nullable=False),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('context', sa.String(), nullable=True),
        sa.Column('level', sa.Integer(), nullable=True, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Reward catalog ──────────────────────────────────────────────────
    op.create_table(
        'rewards',
        sa.Column('id', sa.String(), primary_key=True, index=True),
        sa.Column('name_en', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(), nullable=True),
        sa.Column('tier', sa.String(length=32), nullable=False, index=True),
        sa.Column('reward_kind', sa.String(length=32), nullable=False),
        sa.Column('challenge_id', sa.String(), sa.ForeignKey('challenges.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('level', sa.Integer(), nullable=True, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── User-unlocked rewards ───────────────────────────────────────────
    op.create_table(
        'user_rewards',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('reward_id', sa.String(), sa.ForeignKey('rewards.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('unlocked_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'reward_id', name='uq_user_reward'),
    )


def downgrade() -> None:
    op.drop_table('user_rewards')
    op.drop_table('rewards')
    op.drop_table('hadiths')
    op.drop_column('challenges', 'dua_reminder')
    op.drop_column('challenges', 'reward_tier')
    op.drop_column('challenges', 'streak_target')
    op.drop_column('challenges', 'position')
    op.drop_column('challenges', 'challenge_type')
