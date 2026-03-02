"""Add username column to users

Revision ID: b9424262aaa2
Revises: 001
Create Date: 2026-03-01 12:34:56.000000
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic.
revision = 'b9424262aaa2'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    """Add the username column to the users table."""
    op.add_column(
        'users',
        sa.Column('username', sa.String(length=50), nullable=False, unique=True, index=True)
    )

def downgrade():
    """Remove the username column from the users table."""
    op.drop_column('users', 'username')