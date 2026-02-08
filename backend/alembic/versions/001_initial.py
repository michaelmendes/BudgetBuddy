"""Initial migration - create all tables

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('default_pay_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('pay_frequency', sa.String(20), server_default='biweekly'),
        sa.Column('next_pay_date', sa.Date, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Pay cycles table
    op.create_table(
        'pay_cycles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=False),
        sa.Column('income_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('status', sa.String(20), server_default='upcoming', index=True),
        sa.Column('rollover_amount', sa.Numeric(12, 2), server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    )
    
    # Categories table
    op.create_table(
        'categories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('is_shared', sa.Boolean, server_default='0'),
        sa.Column('is_archived', sa.Boolean, server_default='0'),
        sa.Column('sort_order', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Category goals table
    op.create_table(
        'category_goals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('category_id', sa.String(36), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('pay_cycle_id', sa.String(36), sa.ForeignKey('pay_cycles.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('goal_type', sa.String(20), server_default='fixed'),
        sa.Column('goal_value', sa.Numeric(12, 2), nullable=False),
        sa.Column('rollover_balance', sa.Numeric(12, 2), server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('category_id', 'pay_cycle_id', name='uq_category_pay_cycle'),
    )
    
    # Recurring transactions table
    op.create_table(
        'recurring_transactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('category_id', sa.String(36), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=True),
        sa.Column('day_of_week', sa.Integer, nullable=True),
        sa.Column('day_of_month', sa.Integer, nullable=True),
        sa.Column('type', sa.String(20), server_default='expense'),
        sa.Column('is_active', sa.Boolean, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Transactions table
    op.create_table(
        'transactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('pay_cycle_id', sa.String(36), sa.ForeignKey('pay_cycles.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('category_id', sa.String(36), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('recurring_transaction_id', sa.String(36), sa.ForeignKey('recurring_transactions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('transaction_date', sa.Date, nullable=False, index=True),
        sa.Column('type', sa.String(20), server_default='expense'),
        sa.Column('is_recurring_instance', sa.Boolean, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Long-term goals table
    op.create_table(
        'long_term_goals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('target_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('current_amount', sa.Numeric(12, 2), server_default='0.00'),
        sa.Column('target_date', sa.Date, nullable=True),
        sa.Column('status', sa.String(20), server_default='active', index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Friendships table
    op.create_table(
        'friendships',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('requester_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('addressee_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('status', sa.String(20), server_default='pending', index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('requester_id', 'addressee_id', name='uq_friendship'),
        sa.CheckConstraint('requester_id != addressee_id', name='ck_no_self_friendship'),
    )
    
    # Pay cycle summaries table
    op.create_table(
        'pay_cycle_summaries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('pay_cycle_id', sa.String(36), sa.ForeignKey('pay_cycles.id', ondelete='CASCADE'), nullable=False, unique=True, index=True),
        sa.Column('total_income', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_expenses', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_savings', sa.Numeric(12, 2), nullable=False),
        sa.Column('net_balance', sa.Numeric(12, 2), nullable=False),
        sa.Column('category_breakdown', sa.JSON, server_default='{}'),
        sa.Column('goal_completion', sa.JSON, server_default='{}'),
        sa.Column('variances', sa.JSON, server_default='{}'),
        sa.Column('rollover_generated', sa.Numeric(12, 2), server_default='0.00'),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('pay_cycle_summaries')
    op.drop_table('friendships')
    op.drop_table('long_term_goals')
    op.drop_table('transactions')
    op.drop_table('recurring_transactions')
    op.drop_table('category_goals')
    op.drop_table('categories')
    op.drop_table('pay_cycles')
    op.drop_table('users')
