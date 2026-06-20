"""Update User model: hashed_password to password_hash and add last_login

Revision ID: update_user_model_20240101
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'update_user_model_20240101'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename hashed_password to password_hash
    op.alter_column('users', 'hashed_password', new_column_name='password_hash')
    
    # Add last_login column
    op.add_column('users', sa.Column('last_login', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove last_login column
    op.drop_column('users', 'last_login')
    
    # Rename password_hash back to hashed_password
    op.alter_column('users', 'password_hash', new_column_name='hashed_password')
