"""Rename category_rollovers to category_balances and expand fields

Revision ID: 7d1a2c4b9e77
Revises: 2b6f7a9e4c11
Create Date: 2026-03-08 10:20:00.000000
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic.
revision = "7d1a2c4b9e77"
down_revision = "2b6f7a9e4c11"
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table("category_rollovers", "category_balances")

    with op.batch_alter_table("category_balances") as batch_op:
        batch_op.drop_constraint("uq_category_pay_cycle_rollover", type_="unique")
        batch_op.create_unique_constraint("uq_category_pay_cycle_balance", ["category_id", "pay_cycle_id"])
        batch_op.alter_column("rollover_balance", new_column_name="starting_balance")
        batch_op.add_column(sa.Column("spent", sa.Numeric(12, 2), nullable=False, server_default="0.00"))
        batch_op.add_column(sa.Column("paycheck_allocated", sa.Numeric(12, 2), nullable=False, server_default="0.00"))
        batch_op.add_column(sa.Column("closing_balance", sa.Numeric(12, 2), nullable=False, server_default="0.00"))

    op.drop_index("ix_category_rollovers_category_id", table_name="category_balances")
    op.drop_index("ix_category_rollovers_pay_cycle_id", table_name="category_balances")
    op.create_index(op.f("ix_category_balances_category_id"), "category_balances", ["category_id"], unique=False)
    op.create_index(op.f("ix_category_balances_pay_cycle_id"), "category_balances", ["pay_cycle_id"], unique=False)

    op.execute(
        """
        UPDATE category_balances
        SET
            spent = 0.00,
            paycheck_allocated = 0.00,
            closing_balance = COALESCE(starting_balance, 0.00)
        """
    )


def downgrade():
    op.drop_index(op.f("ix_category_balances_pay_cycle_id"), table_name="category_balances")
    op.drop_index(op.f("ix_category_balances_category_id"), table_name="category_balances")
    op.create_index("ix_category_rollovers_category_id", "category_balances", ["category_id"], unique=False)
    op.create_index("ix_category_rollovers_pay_cycle_id", "category_balances", ["pay_cycle_id"], unique=False)

    with op.batch_alter_table("category_balances") as batch_op:
        batch_op.drop_constraint("uq_category_pay_cycle_balance", type_="unique")
        batch_op.create_unique_constraint("uq_category_pay_cycle_rollover", ["category_id", "pay_cycle_id"])
        batch_op.drop_column("closing_balance")
        batch_op.drop_column("paycheck_allocated")
        batch_op.drop_column("spent")
        batch_op.alter_column("starting_balance", new_column_name="rollover_balance")

    op.rename_table("category_balances", "category_rollovers")
