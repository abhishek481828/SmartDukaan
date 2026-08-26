"""
ML System end-to-end test.
Run: .\venv\Scripts\Activate.ps1; python test_ml.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from ml.risk_detector import check_anomaly, detect_risk
from ml.profit_simulator import simulate_profit


def test_pure_functions():
    print("\n=== 1. PROFIT SIMULATOR (price elasticity) ===")
    scenarios = [
        ("Price cut  Rs45->Rs42 (30kg/day)", 45, 42, 30),
        ("Price hike Rs80->Rs85 (15kg/day)", 80, 85, 15),
        ("Price cut  Rs37->Rs34 (25kg/day)", 37, 34, 25),
    ]
    for label, cp, sp, qty in scenarios:
        r = simulate_profit(cp, sp, qty, days=7)
        arrow = "+" if r["delta"] >= 0 else ""
        print(f"  {label}")
        print(f"    Rs{r['current_profit']} -> Rs{r['projected_profit']}  (delta {arrow}Rs{r['delta']}, {r['pct_change']}%)")

    print("\n=== 2. RISK DETECTOR (anomaly detection) ===")
    cases = [
        ("Sales crash: actual=18, forecast=30", 18, 30),
        ("Normal:      actual=29, forecast=30", 29, 30),
        ("Mild drop:   actual=24, forecast=30", 24, 30),
    ]
    for label, actual, forecast in cases:
        is_anom, dev = check_anomaly(actual, forecast)
        risk = detect_risk(actual, forecast)
        flag = "[ANOMALY]" if is_anom else "[normal] "
        print(f"  {flag} {label}  -> {dev:.1f}%  Risk={risk['level']} ({risk['reason']})")


async def test_xgboost_pipeline():
    print("\n=== 3. XGBOOST FORECASTER (train + predict) ===")
    try:
        from xgboost import XGBRegressor
        print("  XGBoost import: OK")
    except ImportError:
        print("  XGBoost import: MISSING — install: pip install xgboost")
        return

    from db.database import async_session, init_db
    from ml.forecaster import train_model, predict_7d

    try:
        await init_db()
        async with async_session() as db:
            print("  Training model for shop=1, product=1 (Rice, 30 days data)...")
            success = await train_model(shop_id=1, product_id=1, db=db)
            if success:
                print("  Training: OK — model saved to ml/models/shop_1_product_1.pkl")
                forecasts = await predict_7d(shop_id=1, product_id=1, db=db)
                print(f"  7-day forecast:")
                for f in forecasts:
                    print(f"    {f['date']}  {f['predicted_qty']:6.1f} kg  [{f['lower_bound']} - {f['upper_bound']}]")
            else:
                print("  Training: FAILED — check if demo data is seeded (run db.demo_preload first)")
    except Exception as e:
        print(f"  ERROR: {e}")


async def test_ml_via_api():
    print("\n=== 4. FORECAST API endpoint test ===")
    try:
        import httpx
        async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=10) as client:
            r = await client.post("/api/auth/login", json={"phone": "9876543210", "password": "pass123"})
            if r.status_code != 200:
                print("  Server not running — skipping API test")
                return
            token = r.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            r2 = await client.get("/api/forecast/1", headers=headers)
            if r2.status_code == 200:
                d = r2.json()
                print(f"  /api/forecast/1 -> {r2.status_code}")
                print(f"  Product      : {d.get('product_name')}")
                print(f"  Forecast days: {len(d.get('forecast_7d', []))}")
                print(f"  Is anomaly   : {d.get('is_anomaly')}")
                first = d['forecast_7d'][0] if d.get('forecast_7d') else {}
                print(f"  Day 1        : {first}")
            else:
                print(f"  /api/forecast/1 -> {r2.status_code}: {r2.text[:200]}")
    except Exception as e:
        print(f"  [SKIP] Server not running — {e}")


async def main():
    print("=" * 50)
    print("  SmartDukaan ML System Verification")
    print("=" * 50)

    test_pure_functions()
    await test_xgboost_pipeline()
    await test_ml_via_api()

    print("\n" + "=" * 50)
    print("  Done.")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
