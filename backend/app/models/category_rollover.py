"""Backward-compatibility shim for legacy imports."""
from app.models.category_balance import CategoryBalance

# Legacy alias retained so older imports continue to work.
CategoryRollover = CategoryBalance
