"""change prayer enums to varchar for cross-db portability

Revision ID: 20260620_2100
Revises: 20260620_2000
Create Date: 2026-06-20 21:00:00

The previous migration created Postgres ``ENUM`` columns for
``prayer_name``, ``calculation_method``, and ``juristic_method``. SQLAlchemy
serialises Python ``Enum`` members by ``.name`` (uppercase) while the
migration registered them with ``.value`` (lowercase) in the Postgres
type. Any write with the actual Python enum (``PrayerName.FAJR``) raised
``InvalidTextRepresentation: invalid input value for enum prayername:
"FAJR"``.

The simplest correct fix is to drop the Postgres ENUM types entirely and
treat the columns as plain ``VARCHAR(16)``. The Python enum on the model
side + Pydantic validation already enforce legal values, so we lose
nothing by giving up SQL-level enforcement.

The corresponding model changes are in ``app/models/prayer.py``: the
``Enum(...)`` columns are now ``String(16)``.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '20260620_2100'
down_revision: Union[str, Sequence[str], None] = '20260620_2000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop the Postgres ENUM types and convert columns to VARCHAR(16)."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == 'postgresql'

    # The columns we created in the prior migration have ``server_default``
    # values that reference the Postgres ENUM types (e.g.
    # ``server_default='isna'`` for ``calculation_method``). Postgres won't
    # let us drop the type while a DEFAULT depends on it, so we must clear
    # the defaults first, then run the alter, then drop the types.
    if is_postgres:
        op.execute('ALTER TABLE prayer_settings ALTER COLUMN calculation_method DROP DEFAULT')
        op.execute('ALTER TABLE prayer_settings ALTER COLUMN juristic_method DROP DEFAULT')

    # --- prayer_tracking.prayer_name -----------------------------------
    op.alter_column(
        'prayer_tracking',
        'prayer_name',
        existing_type=sa.String(length=16),  # Postgres ENUM is exposed as VARCHAR by SQLAlchemy
        type_=sa.String(length=16),
        existing_nullable=False,
        postgresql_using='prayer_name::varchar',
    )

    # --- prayer_qada.prayer_name ---------------------------------------
    op.alter_column(
        'prayer_qada',
        'prayer_name',
        existing_type=sa.String(length=16),
        type_=sa.String(length=16),
        existing_nullable=False,
        postgresql_using='prayer_name::varchar',
    )

    # --- prayer_settings.calculation_method ----------------------------
    op.alter_column(
        'prayer_settings',
        'calculation_method',
        existing_type=sa.String(length=16),
        type_=sa.String(length=16),
        existing_nullable=False,
        postgresql_using='calculation_method::varchar',
    )

    # --- prayer_settings.juristic_method -------------------------------
    op.alter_column(
        'prayer_settings',
        'juristic_method',
        existing_type=sa.String(length=16),
        type_=sa.String(length=16),
        existing_nullable=False,
        postgresql_using='juristic_method::varchar',
    )

    # --- Drop the now-unused ENUM types on Postgres --------------------
    if is_postgres:
        # IF EXISTS makes this idempotent in case a previous run already
        # removed them. CASCADE is required because some clients (notably
        # older Alembic versions) leave behind implicit dependencies even
        # after the column DEFAULT has been dropped.
        op.execute('DROP TYPE IF EXISTS prayername CASCADE')
        op.execute('DROP TYPE IF EXISTS calculationmethod CASCADE')
        op.execute('DROP TYPE IF EXISTS juristicmethod CASCADE')


def downgrade() -> None:
    """Recreate the Postgres ENUM types and switch columns back.

    Best-effort — if any rows contain values outside the enum members
    (e.g. uppercase), this will fail. The downgrade is here so tests can
    roll back the migration; production should not need it.
    """
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    op.execute(
        "CREATE TYPE prayername AS ENUM ('fajr','dhuhr','asr','maghrib','isha')"
    )
    op.execute(
        "CREATE TYPE calculationmethod AS ENUM "
        "('isna','mwl','egypt','karachi','makkah','custom')"
    )
    op.execute("CREATE TYPE juristicmethod AS ENUM ('shafi','hanafi')")

    op.alter_column(
        'prayer_tracking',
        'prayer_name',
        existing_type=sa.String(length=16),
        type_=sa.Enum(
            'fajr', 'dhuhr', 'asr', 'maghrib', 'isha',
            name='prayername',
        ),
        existing_nullable=False,
        postgresql_using='prayer_name::prayername',
    )
    op.alter_column(
        'prayer_qada',
        'prayer_name',
        existing_type=sa.String(length=16),
        type_=sa.Enum(
            'fajr', 'dhuhr', 'asr', 'maghrib', 'isha',
            name='prayername',
        ),
        existing_nullable=False,
        postgresql_using='prayer_name::prayername',
    )
    op.alter_column(
        'prayer_settings',
        'calculation_method',
        existing_type=sa.String(length=16),
        type_=sa.Enum(
            'isna', 'mwl', 'egypt', 'karachi', 'makkah', 'custom',
            name='calculationmethod',
        ),
        existing_nullable=False,
        postgresql_using='calculation_method::calculationmethod',
    )
    op.alter_column(
        'prayer_settings',
        'juristic_method',
        existing_type=sa.String(length=16),
        type_=sa.Enum('shafi', 'hanafi', name='juristicmethod'),
        existing_nullable=False,
        postgresql_using='juristic_method::juristicmethod',
    )
