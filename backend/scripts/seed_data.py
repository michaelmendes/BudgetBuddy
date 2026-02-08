"""
Sample data seeder for development and testing.
"""
import asyncio
from datetime import date, timedelta
from decimal import Decimal
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine, Base
from app.models import *
from app.core.security import get_password_hash


async def seed_database():
    """Seed the database with sample data."""
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as db:
        # Check if data already exists
        from sqlalchemy import select
        result = await db.execute(select(User))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return
        
        print("Seeding database with sample data...")
        
        # Create users
        user1 = User(
            id=str(uuid.uuid4()),
            email="alice@example.com",
            password_hash=get_password_hash("Password123"),
            display_name="Alice Johnson",
            default_pay_amount=Decimal("3500.00"),
            pay_frequency="biweekly",
            next_pay_date=date.today() + timedelta(days=7),
        )
        
        user2 = User(
            id=str(uuid.uuid4()),
            email="bob@example.com",
            password_hash=get_password_hash("Password123"),
            display_name="Bob Smith",
            default_pay_amount=Decimal("2800.00"),
            pay_frequency="biweekly",
        )
        
        db.add_all([user1, user2])
        await db.flush()
        
        # Create friendship
        friendship = Friendship(
            id=str(uuid.uuid4()),
            requester_id=user1.id,
            addressee_id=user2.id,
            status="accepted",
        )
        db.add(friendship)
        
        # Create categories for user1
        categories = [
            Category(
                id=str(uuid.uuid4()),
                user_id=user1.id,
                name="Rent",
                icon="🏠",
                color="#4A90D9",
                is_shared=False,
                sort_order=0,
            ),
            Category(
                id=str(uuid.uuid4()),
                user_id=user1.id,
                name="Groceries",
                icon="🛒",
                color="#50C878",
                is_shared=True,
                sort_order=1,
            ),
            Category(
                id=str(uuid.uuid4()),
                user_id=user1.id,
                name="Transportation",
                icon="🚗",
                color="#FFB347",
                is_shared=True,
                sort_order=2,
            ),
            Category(
                id=str(uuid.uuid4()),
                user_id=user1.id,
                name="Entertainment",
                icon="🎬",
                color="#9B59B6",
                is_shared=True,
                sort_order=3,
            ),
            Category(
                id=str(uuid.uuid4()),
                user_id=user1.id,
                name="Utilities",
                icon="💡",
                color="#3498DB",
                is_shared=False,
                sort_order=4,
            ),
        ]
        db.add_all(categories)
        await db.flush()
        
        # Create pay cycle
        today = date.today()
        cycle_start = today - timedelta(days=today.weekday())  # Monday this week
        cycle_end = cycle_start + timedelta(days=13)  # 2 weeks
        
        pay_cycle = PayCycle(
            id=str(uuid.uuid4()),
            user_id=user1.id,
            start_date=cycle_start,
            end_date=cycle_end,
            income_amount=Decimal("3500.00"),
            status="active",
        )
        db.add(pay_cycle)
        await db.flush()
        
        # Create category goals
        goals_data = [
            (categories[0].id, "fixed", Decimal("1200.00")),  # Rent
            (categories[1].id, "percentage", Decimal("15.00")),  # Groceries 15%
            (categories[2].id, "fixed", Decimal("200.00")),  # Transportation
            (categories[3].id, "percentage", Decimal("10.00")),  # Entertainment 10%
            (categories[4].id, "fixed", Decimal("150.00")),  # Utilities
        ]
        
        for cat_id, goal_type, goal_value in goals_data:
            goal = CategoryGoal(
                id=str(uuid.uuid4()),
                category_id=cat_id,
                pay_cycle_id=pay_cycle.id,
                goal_type=goal_type,
                goal_value=goal_value,
            )
            db.add(goal)
        
        # Create some transactions
        transactions_data = [
            (categories[0].id, Decimal("1200.00"), "Monthly rent", cycle_start + timedelta(days=1)),
            (categories[1].id, Decimal("85.50"), "Weekly groceries", cycle_start + timedelta(days=2)),
            (categories[1].id, Decimal("45.20"), "Farmers market", cycle_start + timedelta(days=5)),
            (categories[2].id, Decimal("40.00"), "Gas", cycle_start + timedelta(days=3)),
            (categories[3].id, Decimal("25.00"), "Movie tickets", cycle_start + timedelta(days=4)),
            (categories[4].id, Decimal("120.00"), "Electric bill", cycle_start + timedelta(days=1)),
        ]
        
        for cat_id, amount, desc, trans_date in transactions_data:
            transaction = Transaction(
                id=str(uuid.uuid4()),
                user_id=user1.id,
                pay_cycle_id=pay_cycle.id,
                category_id=cat_id,
                amount=amount,
                description=desc,
                transaction_date=trans_date,
                type="expense",
            )
            db.add(transaction)
        
        # Create recurring transaction
        recurring = RecurringTransaction(
            id=str(uuid.uuid4()),
            user_id=user1.id,
            category_id=categories[0].id,
            amount=Decimal("1200.00"),
            description="Monthly rent",
            frequency="monthly",
            start_date=cycle_start,
            day_of_month=1,
            type="expense",
        )
        db.add(recurring)
        
        # Create long-term goal
        long_term = LongTermGoal(
            id=str(uuid.uuid4()),
            user_id=user1.id,
            name="Emergency Fund",
            description="6 months of expenses",
            target_amount=Decimal("15000.00"),
            current_amount=Decimal("3500.00"),
            target_date=date.today() + timedelta(days=365),
        )
        db.add(long_term)
        
        await db.commit()
        
        print("✅ Database seeded successfully!")
        print(f"   User 1: alice@example.com / Password123")
        print(f"   User 2: bob@example.com / Password123")


if __name__ == "__main__":
    asyncio.run(seed_database())
