"""LangGraph Agent — ShopState TypedDict.

Ref: BACKEND_STRUCTURE.md Section 3 (LangGraph Agent — ShopState)
"""
from typing import TypedDict, Optional, List


class ShopState(TypedDict):
    # Input
    user_id: int
    shop_id: int
    query: str
    language: str  # 'hi', 'te', or 'en'
    conversation_history: Optional[List[dict]]  # [{"role": "user"|"assistant", "text": str}]

    # Fetched context (parallel nodes)
    sales_data: Optional[dict]
    market_data: Optional[dict]
    forecast_data: Optional[dict]
    web_context: Optional[list[dict]]

    # Output
    intent: Optional[str]
    why_text: Optional[str]
    what_text: Optional[str]
    rupees_impact: Optional[float]
    response_text: Optional[str]
    alert_triggered: Optional[bool]
