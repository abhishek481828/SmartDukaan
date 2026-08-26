"""Seed benchmark data for new shops.

Cold Start Strategy: When a new shop registers with 'benchmark' path,
we seed products with industry-average selling prices and 30 days of
synthetic sales history so the dashboard and ML pipeline have data
from Day 0.

Ref: BACKEND_STRUCTURE.md Section 9 (Cold Start Benchmark)
"""
import random
from datetime import date, timedelta

# Industry average benchmarks per category
CATEGORY_PRODUCTS: dict[str, list[dict]] = {
    "grains": [
        {"name": "Rice", "name_hindi": "चावल", "unit": "kg", "selling_price": 45, "cost_price": 39, "agmarknet_commodity": "Rice"},
        {"name": "Dal", "name_hindi": "दाल", "unit": "kg", "selling_price": 80, "cost_price": 72, "agmarknet_commodity": "Arhar Dal"},
        {"name": "Atta", "name_hindi": "आटा", "unit": "kg", "selling_price": 37, "cost_price": 32, "agmarknet_commodity": "Wheat"},
    ],
    "fmcg": [
        {"name": "Sugar", "name_hindi": "चीनी", "unit": "kg", "selling_price": 43, "cost_price": 38, "agmarknet_commodity": "Sugar"},
        {"name": "Cooking Oil", "name_hindi": "तेल", "unit": "litre", "selling_price": 150, "cost_price": 135, "agmarknet_commodity": "Groundnut Oil"},
    ],
    "dairy": [
        {"name": "Milk", "name_hindi": "दूध", "unit": "litre", "selling_price": 55, "cost_price": 48, "agmarknet_commodity": None},
        {"name": "Ghee", "name_hindi": "घी", "unit": "kg", "selling_price": 550, "cost_price": 480, "agmarknet_commodity": "Ghee"},
    ],
    "vegetables": [
        {"name": "Onion", "name_hindi": "प्याज़", "unit": "kg", "selling_price": 35, "cost_price": 28, "agmarknet_commodity": "Onion"},
        {"name": "Potato", "name_hindi": "आलू", "unit": "kg", "selling_price": 30, "cost_price": 22, "agmarknet_commodity": "Potato"},
        {"name": "Tomato", "name_hindi": "टमाटर", "unit": "kg", "selling_price": 40, "cost_price": 30, "agmarknet_commodity": "Tomato"},
    ],
    "general": [
        {"name": "Rice", "name_hindi": "चावल", "unit": "kg", "selling_price": 45, "cost_price": 39, "agmarknet_commodity": "Rice"},
        {"name": "Sugar", "name_hindi": "चीनी", "unit": "kg", "selling_price": 43, "cost_price": 38, "agmarknet_commodity": "Sugar"},
    ],
}

# Daily quantity benchmarks (how much a typical kirana shop sells per day)
DAILY_QTY_BENCHMARKS = {
    "Rice": 30, "Dal": 15, "Atta": 25, "Sugar": 20, "Cooking Oil": 10,
    "Milk": 30, "Ghee": 2, "Onion": 25, "Potato": 20, "Tomato": 15,
}


def seed_benchmark_products(shop_id: int, categories: list[str]) -> list[dict]:
    """Return a list of Product dicts (not ORM objects) ready for bulk insert."""
    products = []
    seen_names = set()

    for cat in categories:
        for p in CATEGORY_PRODUCTS.get(cat, CATEGORY_PRODUCTS["general"]):
            if p["name"] in seen_names:
                continue
            seen_names.add(p["name"])
            products.append({
                "shop_id": shop_id,
                "name": p["name"],
                "name_hindi": p.get("name_hindi"),
                "category": cat,
                "unit": p["unit"],
                "selling_price": p["selling_price"],
                "cost_price": p.get("cost_price"),
                "stock_qty": random.randint(50, 200),
                "agmarknet_commodity": p.get("agmarknet_commodity"),
            })
    return products


def generate_benchmark_sales(
    shop_id: int,
    product_rows: list[dict],
    days: int = 30,
) -> list[dict]:
    """Generate synthetic 30-day sales history.

    Returns a list of SalesEntry dicts ready for bulk insert.
    Uses realistic noise: weekday/weekend variance, random ±20% jitter.
    """
    entries = []
    today = date.today()

    for product in product_rows:
        product_name = product["name"]
        base_qty = DAILY_QTY_BENCHMARKS.get(product_name, 15)
        price = product["selling_price"]

        for day_offset in range(days, 0, -1):
            entry_date = today - timedelta(days=day_offset)
            weekday = entry_date.weekday()

            # Weekend boost (Sat/Sun = 20% more)
            multiplier = 1.2 if weekday >= 5 else 1.0
            # Random jitter ±20%
            jitter = random.uniform(0.80, 1.20)
            qty = max(1, round(base_qty * multiplier * jitter))
            revenue = round(qty * price, 2)

            entries.append({
                "shop_id": shop_id,
                "product_id": None,  # Will be set after product insert
                "product_name": product_name,
                "entry_date": entry_date,
                "quantity_sold": qty,
                "revenue": revenue,
                "entry_source": "benchmark",
            })

    return entries


def generate_benchmark_forecasts(
    shop_id: int,
    product_id: int,
    product_name: str,
    days: int = 7,
) -> list[dict]:
    """Generate 7-day forecast based on benchmark averages."""
    forecasts = []
    today = date.today()
    base_qty = DAILY_QTY_BENCHMARKS.get(product_name, 15)

    for i in range(1, days + 1):
        forecast_date = today + timedelta(days=i)
        jitter = random.uniform(0.85, 1.15)
        predicted = round(base_qty * jitter, 1)
        lower = round(predicted * 0.8, 1)
        upper = round(predicted * 1.2, 1)

        forecasts.append({
            "shop_id": shop_id,
            "product_id": product_id,
            "forecast_date": forecast_date,
            "predicted_qty": predicted,
            "lower_bound": lower,
            "upper_bound": upper,
            "is_anomaly": False,
            "anomaly_pct": 0,
            "model_version": "benchmark-v0",
        })

    return forecasts


def seed_market_prices(district: str, categories: list[str]) -> list[dict]:
    """Seed initial market prices for the shop's district."""
    prices = []
    today = date.today()
    seen = set()

    for cat in categories:
        for p in CATEGORY_PRODUCTS.get(cat, []):
            commodity = p.get("agmarknet_commodity")
            if not commodity or commodity in seen:
                continue
            seen.add(commodity)

            base = p["cost_price"] if p.get("cost_price") else p["selling_price"] * 0.85
            prices.append({
                "commodity": commodity,
                "district": district,
                "state": "",
                "modal_price": round(base, 2),
                "min_price": round(base * 0.92, 2),
                "max_price": round(base * 1.08, 2),
                "price_date": today,
                "source": "benchmark",
                "confidence": 0.7,
            })
    return prices
