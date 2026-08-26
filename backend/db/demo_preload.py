"""Demo preload — creates the 'Ramesh Kirana Store' demo shop.

Run: cd backend && python -m db.demo_preload
Seeds user, shop, products, 30 days of sales, forecasts, and market prices.
"""
import asyncio
import os
import sys

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import engine, async_session, init_db
from db.models import User, Shop, Product, SalesEntry, MLForecast, MarketPrice
from db.seed import (
    seed_benchmark_products,
    generate_benchmark_sales,
    generate_benchmark_forecasts,
    seed_market_prices,
)
from core.auth_utils import hash_password


async def preload_demo():
    """Full demo shop creation for hackathon presentation."""
    await init_db()

    async with async_session() as db:
        from sqlalchemy import select
        existing_user = (await db.execute(select(User).where(User.phone == "9876543210"))).scalar_one_or_none()
        if existing_user:
            print(f"[Demo] User already exists: {existing_user.name} (id={existing_user.id})")
            user = existing_user
        else:
            user = User(
                phone="9876543210",
                name="Ramesh Kumar",
                password_hash=hash_password("pass123"),
                city="Nagpur",
                state="Maharashtra",
                language="en",
                is_onboarded=True,
            )
            db.add(user)
            await db.flush()
            print(f"[Demo] Created user: {user.name} (id={user.id})")

        existing_shop = (await db.execute(select(Shop).where(Shop.user_id == user.id))).scalar_one_or_none()
        if existing_shop:
            print(f"[Demo] Shop already exists: {existing_shop.shop_name} (id={existing_shop.id})")
            shop = existing_shop
        else:
            categories = ["grains", "fmcg"]
            shop = Shop(
                user_id=user.id,
                shop_name="Ramesh Kirana Store",
                categories=categories,
                district="Nagpur",
                cold_start_path="benchmark",
                data_maturity_days=30,
            )
            db.add(shop)
            await db.flush()
            print(f"[Demo] Created shop: {shop.shop_name} (id={shop.id})")
        categories = shop.categories or ["grains", "fmcg"]


        # 3. Seed products
        product_dicts = seed_benchmark_products(shop.id, categories)
        product_objs = []
        for pd in product_dicts:
            p = Product(**pd)
            db.add(p)
            product_objs.append(p)
        await db.flush()

        product_map = {p.name: p.id for p in product_objs}
        print(f"[Demo] Seeded {len(product_objs)} products: {list(product_map.keys())}")

        # 4. Generate 30 days of sales history
        sales_dicts = generate_benchmark_sales(shop.id, product_dicts, days=30)
        sales_count = 0
        for sd in sales_dicts:
            product_name = sd.pop("product_name")  # Remove from dict, get name
            sd["product_id"] = product_map[product_name]
            db.add(SalesEntry(**sd))
            sales_count += 1
        print(f"[Demo] Seeded {sales_count} sales entries (30 days)")

        # 5. Generate 7-day forecasts for each product
        forecast_count = 0
        for p in product_objs:
            forecasts = generate_benchmark_forecasts(shop.id, p.id, p.name, days=7)
            for f in forecasts:
                db.add(MLForecast(**f))
                forecast_count += 1
        print(f"[Demo] Generated {forecast_count} forecast entries (7 days × {len(product_objs)} products)")

        # 6. Seed market prices
        market_dicts = seed_market_prices("Nagpur", categories)
        for mp in market_dicts:
            db.add(MarketPrice(**mp))
        print(f"[Demo] Seeded {len(market_dicts)} market prices")

        await db.commit()
        print("\n✅ Demo shop preloaded successfully!")
        print(f"   Login: phone=9876543210, password=pass123")
        print(f"   Shop: Ramesh Kirana Store, Nagpur")


if __name__ == "__main__":
    asyncio.run(preload_demo())
