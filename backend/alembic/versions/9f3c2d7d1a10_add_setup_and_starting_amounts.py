"""Add setup_completed flag and starting_amounts table

Revision ID: 9f3c2d7d1a10
Revises: b9424262aaa2
Create Date: 2026-03-01 15:10:00.000000
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic.
revision = "9f3c2d7d1a10"
down_revision = "b9424262aaa2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("setup_completed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    # Existing users should not be forced through onboarding.
    op.execute("UPDATE users SET setup_completed = 1")

    op.create_table(
        "starting_amounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "category_id", name="uq_user_category_starting_amount"),
    )
    op.create_index(op.f("ix_starting_amounts_user_id"), "starting_amounts", ["user_id"], unique=False)
    op.create_index(op.f("ix_starting_amounts_category_id"), "starting_amounts", ["category_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_starting_amounts_category_id"), table_name="starting_amounts")
    op.drop_index(op.f("ix_starting_amounts_user_id"), table_name="starting_amounts")
    op.drop_table("starting_amounts")
    op.drop_column("users", "setup_completed")
