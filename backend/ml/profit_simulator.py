"""Profit simulation engine."""
# See: SmartDukaan_Developer_Reference.md (Section 7 — Profit Simulation Formula)

PRICE_ELASTICITY = 1.3


def simulate_profit(current_price: float, suggested_price: float, avg_daily_qty: float, days: int = 7) -> dict:
    """Calculate projected profit impact of a price change."""
    price_change_pct = (suggested_price - current_price) / current_price
    qty_change_pct = -price_change_pct * PRICE_ELASTICITY
    new_qty = avg_daily_qty * (1 + qty_change_pct)

    current_profit = avg_daily_qty * current_price * days
    projected_profit = new_qty * suggested_price * days
    delta = projected_profit - current_profit

    return {
        "current_profit": round(current_profit),
        "projected_profit": round(projected_profit),
        "delta": round(delta),
        "pct_change": round((delta / current_profit) * 100, 1) if current_profit else 0,
        "payback_days": max(1, round(abs(delta) / (projected_profit / days))) if projected_profit else 0,
        "summary": f"Adjust price by ₹{abs(current_price - suggested_price):.0f}. Expected ₹{abs(delta):.0f} {'extra' if delta > 0 else 'less'} profit in {days} days.",
    }
