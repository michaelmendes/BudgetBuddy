"""Rework category goals and rollovers

Revision ID: f6e7b9c2d4a1
Revises: c3d91aa4a8e2
Create Date: 2026-03-02 14:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic.
revision = "f6e7b9c2d4a1"
down_revision = "c3d91aa4a8e2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "category_rollovers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("pay_cycle_id", sa.String(length=36), nullable=False),
        sa.Column("rollover_balance", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pay_cycle_id"], ["pay_cycles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id", "pay_cycle_id", name="uq_category_pay_cycle_rollover"),
    )
    op.create_index(op.f("ix_category_rollovers_category_id"), "category_rollovers", ["category_id"], unique=False)
    op.create_index(op.f("ix_category_rollovers_pay_cycle_id"), "category_rollovers", ["pay_cycle_id"], unique=False)

    op.execute(
        """
        INSERT INTO category_rollovers (id, category_id, pay_cycle_id, rollover_balance, created_at)
        SELECT id, category_id, pay_cycle_id, COALESCE(rollover_balance, 0.00), created_at
        FROM category_goals
        WHERE COALESCE(rollover_balance, 0.00) != 0.00
        """
    )

    op.create_table(
        "category_goals_new",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("goal_type", sa.String(length=20), nullable=True, server_default="fixed"),
        sa.Column("goal_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id", name="uq_category_goal_category"),
    )

    op.execute(
        """
        INSERT INTO category_goals_new (id, category_id, goal_type, goal_value, created_at)
        SELECT id, category_id, goal_type, goal_value, created_at
        FROM (
            SELECT
                cg.id,
                cg.category_id,
                cg.goal_type,
                cg.goal_value,
                cg.created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY cg.category_id
                    ORDER BY pc.start_date DESC, cg.created_at DESC, cg.id DESC
                ) AS row_num
            FROM category_goals cg
            LEFT JOIN pay_cycles pc ON pc.id = cg.pay_cycle_id
        ) ranked
        WHERE row_num = 1
        """
    )

    op.execute(
        """
        INSERT INTO category_goals_new (id, category_id, goal_type, goal_value, created_at)
        SELECT sga.id, sga.category_id, 'fixed', sga.amount, sga.created_at
        FROM setup_goal_amounts sga
        LEFT JOIN category_goals_new cgn ON cgn.category_id = sga.category_id
        WHERE cgn.category_id IS NULL
        """
    )

    op.drop_table("category_goals")
    op.rename_table("category_goals_new", "category_goals")
    op.create_index(op.f("ix_category_goals_category_id"), "category_goals", ["category_id"], unique=False)

    op.drop_index(op.f("ix_setup_goal_amounts_category_id"), table_name="setup_goal_amounts")
    op.drop_index(op.f("ix_setup_goal_amounts_user_id"), table_name="setup_goal_amounts")
    op.drop_table("setup_goal_amounts")


def downgrade():
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

    op.execute(
        """
        INSERT INTO setup_goal_amounts (id, user_id, category_id, amount, created_at, updated_at)
        SELECT cg.id, c.user_id, cg.category_id,
               CASE WHEN cg.goal_type = 'fixed' THEN cg.goal_value ELSE 0.00 END,
               cg.created_at, cg.created_at
        FROM category_goals cg
        JOIN categories c ON c.id = cg.category_id
        """
    )

    op.create_table(
        "category_goals_legacy",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("pay_cycle_id", sa.String(length=36), nullable=False),
        sa.Column("goal_type", sa.String(length=20), nullable=True, server_default="fixed"),
        sa.Column("goal_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("rollover_balance", sa.Numeric(12, 2), nullable=True, server_default="0.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pay_cycle_id"], ["pay_cycles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id", "pay_cycle_id", name="uq_category_pay_cycle"),
    )

    op.execute(
        """
        INSERT INTO category_goals_legacy (id, category_id, pay_cycle_id, goal_type, goal_value, rollover_balance, created_at)
        SELECT
            lower(hex(randomblob(16))),
            cg.category_id,
            pc.id,
            cg.goal_type,
            cg.goal_value,
            COALESCE(cr.rollover_balance, 0.00),
            cg.created_at
        FROM category_goals cg
        JOIN categories c ON c.id = cg.category_id
        JOIN pay_cycles pc ON pc.user_id = c.user_id
        LEFT JOIN category_rollovers cr
            ON cr.category_id = cg.category_id
           AND cr.pay_cycle_id = pc.id
        """
    )

    op.drop_index(op.f("ix_category_goals_category_id"), table_name="category_goals")
    op.drop_table("category_goals")
    op.rename_table("category_goals_legacy", "category_goals")

    op.drop_index(op.f("ix_category_rollovers_pay_cycle_id"), table_name="category_rollovers")
    op.drop_index(op.f("ix_category_rollovers_category_id"), table_name="category_rollovers")
    op.drop_table("category_rollovers")
