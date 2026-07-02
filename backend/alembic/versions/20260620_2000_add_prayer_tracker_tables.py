"""add prayer tracker tables

Revision ID: 20260620_2000
Revises: 142e85d08452
Create Date: 2026-06-20 20:00:00

Adds the six tables that back Module 3 of the PRD (Prayer Tracker):

* prayer_tracking      — daily check-off state per (user, date, prayer)
* prayer_streaks       — current / longest streak per (user, prayer) + an
                         "all" row tracking the 5/5 daily streak
* prayer_qada          — outstanding makeup-prayer counters
* prayer_settings      — user preferences (calculation / juristic methods,
                         notifications, jamaa'ah + qada tracking)
* prayer_statistics    — cached dashboard aggregates

The pre-existing ``prayers`` table is kept untouched.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '20260620_2000'
down_revision: Union[str, Sequence[str], None] = '142e85d08452'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Aligned with app.models.prayer — keep in sync.
_PRAYER_NAMES = ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')
_CALC_METHODS = ('isna', 'mwl', 'egypt', 'karachi', 'makkah', 'custom')
_JURISTIC_METHODS = ('shafi', 'hanafi')


def upgrade() -> None:
    # --- prayer_tracking --------------------------------------------------
    op.create_table(
        'prayer_tracking',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tracking_date', sa.Date(), nullable=False),
        sa.Column('prayer_name', sa.Enum(*_PRAYER_NAMES, name='prayername'), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_jamaaah', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.UniqueConstraint(
            'user_id', 'tracking_date', 'prayer_name',
            name='uq_prayer_tracking_user_date_name',
        ),
    )
    op.create_index('ix_prayer_tracking_user_id', 'prayer_tracking', ['user_id'])
    op.create_index('ix_prayer_tracking_tracking_date', 'prayer_tracking', ['tracking_date'])

    # --- prayer_streaks ---------------------------------------------------
    # `prayer_name` stores one of the 5 prayers OR the literal "all" for the
    # 5/5 daily streak — kept as String (not Enum) for that reason.
    op.create_table(
        'prayer_streaks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('prayer_name', sa.String(length=16), nullable=False),
        sa.Column('current_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('longest_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_completed_date', sa.Date(), nullable=True),
        sa.Column('badges', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.UniqueConstraint('user_id', 'prayer_name', name='uq_prayer_streaks_user_name'),
    )
    op.create_index('ix_prayer_streaks_user_id', 'prayer_streaks', ['user_id'])

    # --- prayer_qada ------------------------------------------------------
    op.create_table(
        'prayer_qada',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('prayer_name', sa.Enum(*_PRAYER_NAMES, name='prayername'), nullable=False),
        sa.Column('owed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('made_up_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.UniqueConstraint('user_id', 'prayer_name', name='uq_prayer_qada_user_name'),
    )
    op.create_index('ix_prayer_qada_user_id', 'prayer_qada', ['user_id'])

    # --- prayer_settings --------------------------------------------------
    op.create_table(
        'prayer_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'user_id', sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            unique=True, nullable=False,
        ),
        sa.Column(
            'calculation_method',
            sa.Enum(*_CALC_METHODS, name='calculationmethod'),
            nullable=False, server_default='isna',
        ),
        sa.Column(
            'juristic_method',
            sa.Enum(*_JURISTIC_METHODS, name='juristicmethod'),
            nullable=False, server_default='shafi',
        ),
        sa.Column('notifications_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('reminder_minutes_before', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('track_jamaaah', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('track_qada', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index('ix_prayer_settings_user_id', 'prayer_settings', ['user_id'])

    # --- prayer_statistics ------------------------------------------------
    op.create_table(
        'prayer_statistics',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'user_id', sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            unique=True, nullable=False,
        ),
        sa.Column('total_tracked', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_completed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('overall_completion_rate', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('best_prayer_name', sa.String(length=16), nullable=True),
        sa.Column('worst_prayer_name', sa.String(length=16), nullable=True),
        sa.Column('last_30_days_rate', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index('ix_prayer_statistics_user_id', 'prayer_statistics', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_prayer_statistics_user_id', table_name='prayer_statistics')
    op.drop_table('prayer_statistics')

    op.drop_index('ix_prayer_settings_user_id', table_name='prayer_settings')
    op.drop_table('prayer_settings')

    op.drop_index('ix_prayer_qada_user_id', table_name='prayer_qada')
    op.drop_table('prayer_qada')

    op.drop_index('ix_prayer_streaks_user_id', table_name='prayer_streaks')
    op.drop_table('prayer_streaks')

    op.drop_index('ix_prayer_tracking_tracking_date', table_name='prayer_tracking')
    op.drop_index('ix_prayer_tracking_user_id', table_name='prayer_tracking')
    op.drop_table('prayer_tracking')

    # Drop the Postgres ENUM types we created (no-op on SQLite).
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        sa.Enum(name='calculationmethod').drop(bind, checkfirst=True)
        sa.Enum(name='juristicmethod').drop(bind, checkfirst=True)
        sa.Enum(name='prayername').drop(bind, checkfirst=True)
