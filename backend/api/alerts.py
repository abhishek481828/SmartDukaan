"""Alerts API for current risk state and manual refresh."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_utils import TokenData, get_current_user
from db.database import get_db
from services.alerts import compute_shop_alerts
from services.whatsapp_alerts import dispatch_whatsapp_alerts
from ws.dashboard_handler import broadcast_to_shop

router = APIRouter()


@router.get("/alerts")
async def get_alerts(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await compute_shop_alerts(db, current_user.shop_id)


@router.post("/alerts/run")
async def run_alert_job(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alerts = await compute_shop_alerts(db, current_user.shop_id, refresh_news=True)
    for alert in alerts:
        await broadcast_to_shop(
            current_user.shop_id,
            {
                "type": "alert",
                "payload": alert,
            },
        )
    delivery = await dispatch_whatsapp_alerts(
        db,
        shop_id=current_user.shop_id,
        alerts=alerts,
        force_send=True,
    )
    return {"status": "ok", "alerts": alerts, "whatsapp": delivery}
