"""Replace pay cycle rollover_amount with previous_cycle link

Revision ID: 2b6f7a9e4c11
Revises: f6e7b9c2d4a1
Create Date: 2026-03-07 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic.
revision = "2b6f7a9e4c11"
down_revision = "f6e7b9c2d4a1"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("pay_cycles") as batch_op:
        batch_op.add_column(sa.Column("previous_cycle", sa.String(length=36), nullable=True))
        batch_op.create_index(op.f("ix_pay_cycles_previous_cycle"), ["previous_cycle"], unique=False)
        batch_op.create_foreign_key(
            "fk_pay_cycles_previous_cycle",
            "pay_cycles",
            ["previous_cycle"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.drop_column("rollover_amount")

    # Backfill a best-effort chain by start date per user.
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT id, user_id
            FROM pay_cycles
            ORDER BY user_id ASC, start_date ASC, end_date ASC, created_at ASC
            """
        )
    ).mappings()

    previous_by_user: dict[str, str] = {}
    for row in rows:
        pay_cycle_id = row["id"]
        user_id = row["user_id"]
        previous_id = previous_by_user.get(user_id)
        if previous_id:
            connection.execute(
                sa.text(
                    """
                    UPDATE pay_cycles
                    SET previous_cycle = :previous_cycle
                    WHERE id = :pay_cycle_id
                    """
                ),
                {"previous_cycle": previous_id, "pay_cycle_id": pay_cycle_id},
            )
        previous_by_user[user_id] = pay_cycle_id


def downgrade():
    with op.batch_alter_table("pay_cycles") as batch_op:
        batch_op.add_column(sa.Column("rollover_amount", sa.Numeric(12, 2), nullable=True, server_default="0.00"))
        batch_op.drop_constraint("fk_pay_cycles_previous_cycle", type_="foreignkey")
        batch_op.drop_index(op.f("ix_pay_cycles_previous_cycle"))
        batch_op.drop_column("previous_cycle")
