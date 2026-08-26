import asyncio
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from ml.risk_detector import check_anomaly, detect_risk
from ml.profit_simulator import simulate_profit


def run_pure():
    r = simulate_profit(45, 42, 30, 7)
    print(f"SIMULATE: Rs45->Rs42 | delta Rs{r['delta']} ({r['pct_change']}%)")

    for actual, forecast in [(18, 30), (24, 30), (29, 30)]:
        is_a, dev = check_anomaly(actual, forecast)
        risk = detect_risk(actual, forecast)
        print(f"ANOMALY: actual={actual} forecast={forecast} => {is_a} {dev:.1f}% {risk['level']}")


async def run_xgb():
    from db.database import async_session, init_db
    from ml.forecaster import train_model, predict_7d
    await init_db()
    async with async_session() as db:
        ok = await train_model(1, 1, db)
        print(f"TRAIN shop=1 product=1: {ok}")
        if ok:
            fc = await predict_7d(1, 1, db)
            for f in fc:
                p = f["predicted_qty"]
                lo = f["lower_bound"]
                hi = f["upper_bound"]
                print(f"  FORECAST {f['date']}: {p} kg [{lo}-{hi}]")


run_pure()
asyncio.run(run_xgb())
print("DONE")
