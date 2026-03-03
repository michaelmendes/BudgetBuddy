"""Add setup_goal_amounts table

Revision ID: c3d91aa4a8e2
Revises: 9f3c2d7d1a10
Create Date: 2026-03-02 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic.
revision = "c3d91aa4a8e2"
down_revision = "9f3c2d7d1a10"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "setup_goal_amounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "category_id", name="uq_user_category_setup_goal_amount"),
    )
    op.create_index(op.f("ix_setup_goal_amounts_user_id"), "setup_goal_amounts", ["user_id"], unique=False)
    op.create_index(op.f("ix_setup_goal_amounts_category_id"), "setup_goal_amounts", ["category_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_setup_goal_amounts_category_id"), table_name="setup_goal_amounts")
    op.drop_index(op.f("ix_setup_goal_amounts_user_id"), table_name="setup_goal_amounts")
    op.drop_table("setup_goal_amounts")
