"""
Starting amount schemas.
"""
from decimal import Decimal
from typing import List
from pydantic import BaseModel, Field


class StartingAmountItem(BaseModel):
    category_id: str
    amount: Decimal = Field(..., decimal_places=2)


class StartingAmountSaveRequest(BaseModel):
    items: List[StartingAmountItem]
