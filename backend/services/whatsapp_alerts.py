"""WhatsApp alert delivery via Twilio content templates."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AlertNotificationState, Shop, ShopNotificationSettings, User

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_CONTENT_SID = os.getenv("TWILIO_CONTENT_SID", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_twilio_configured() -> bool:
    return all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CONTENT_SID, TWILIO_WHATSAPP_FROM])


def _normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return None
    if len(digits) == 10:
        digits = f"91{digits}"
    return f"+{digits}"


def _to_whatsapp_address(phone: str | None) -> str | None:
    normalized = _normalize_phone(phone)
    return f"whatsapp:{normalized}" if normalized else None


def _message_hash(alert: dict[str, Any]) -> str:
    digest = hashlib.sha256()
    digest.update(str(alert.get("message", "")).encode("utf-8"))
    digest.update(b"|")
    digest.update(str(alert.get("action_hint", "")).encode("utf-8"))
    return digest.hexdigest()


def _notification_key(alert: dict[str, Any]) -> str:
    product_id = alert.get("product_id") or "none"
    geo_scope = alert.get("geo_scope") or "district"
    signal_source = alert.get("signal_source") or "unknown"
    alert_kind = alert.get("kind") or "risk"
    if signal_source == "inventory":
        bucket = "low_stock" if alert.get("severity") == "MEDIUM" else "critical_stock"
        return f"inventory:{product_id}:{bucket}"
    return f"{signal_source}:{product_id}:{alert_kind}:{geo_scope}"


def _is_high_risk_alert(alert: dict[str, Any]) -> bool:
    return alert.get("kind") == "risk" and alert.get("severity") == "HIGH"


def _is_low_stock_digest_alert(alert: dict[str, Any]) -> bool:
    return (
        alert.get("kind") == "risk"
        and alert.get("signal_source") == "inventory"
        and alert.get("severity") == "MEDIUM"
    )


def _clean_product_name(name: str | None) -> str:
    return " ".join((name or "Product").split())


def _alert_line(alert: dict[str, Any]) -> str:
    product_name = _clean_product_name(str(alert.get("product_name") or "Product"))
    message = " ".join(str(alert.get("message") or "").split())
    lowered_message = message.lower()
    if lowered_message.startswith(product_name.lower() + ":"):
        return message
    return f"{product_name}: {message}"


def _combined_variables(
    shop_name: str,
    urgent_alerts: list[dict[str, Any]],
    low_stock_alerts: list[dict[str, Any]],
) -> dict[str, str]:
    title = f"{shop_name}: alert summary"

    unique_lines: list[str] = []
    seen_lines: set[str] = set()
    for alert in urgent_alerts:
        line = _alert_line(alert)
        if line.lower() in seen_lines:
            continue
        seen_lines.add(line.lower())
        unique_lines.append(line)

    if low_stock_alerts:
        low_names: list[str] = []
        seen_low: set[str] = set()
        for alert in low_stock_alerts:
            product_name = _clean_product_name(str(alert.get("product_name") or "Item"))
            if product_name.lower() in seen_low:
                continue
            seen_low.add(product_name.lower())
            low_names.append(product_name)
        if low_names:
            unique_lines.append(f"Low stock: {', '.join(low_names[:5])}")

    summary_prefix = []
    if urgent_alerts:
        summary_prefix.append(f"{len(urgent_alerts)} high risk")
    if low_stock_alerts:
        summary_prefix.append(f"{len(low_stock_alerts)} low stock")
    prefix = ", ".join(summary_prefix) if summary_prefix else "Store update"
    body = f"{prefix}. {' | '.join(unique_lines[:4])}".strip()

    if urgent_alerts:
        action = "Review urgent items first, then secure stock cover for the next buying cycle."
    else:
        action = "Refill the fastest-moving low-stock items in the next buying cycle."

    return {"1": title[:80], "2": body[:280], "3": action[:160]}


async def _send_template_message(to_phone: str, variables: dict[str, str]) -> dict[str, Any]:
    if not _is_twilio_configured():
        raise RuntimeError("Twilio WhatsApp configuration is incomplete.")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    payload = {
        "From": TWILIO_WHATSAPP_FROM,
        "To": to_phone,
        "ContentSid": TWILIO_CONTENT_SID,
        "ContentVariables": json.dumps(variables),
    }
    print(
        "[WhatsApp] Sending template message",
        {
            "from": TWILIO_WHATSAPP_FROM,
            "to": to_phone,
            "content_sid": TWILIO_CONTENT_SID,
            "content_variables": variables,
        },
    )

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, data=payload, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN))
        data = response.json() if response.content else {}
        if response.status_code >= 400:
            message = data.get("message") if isinstance(data, dict) else None
            message_text = str(message or f"Twilio returned {response.status_code}")
            print(
                "[WhatsApp] Twilio error",
                {
                    "status_code": response.status_code,
                    "response": data,
                },
            )
            lowered = message_text.lower()
            if TWILIO_WHATSAPP_FROM == "whatsapp:+14155238886" and any(
                phrase in lowered for phrase in ["sandbox", "join", "authenticate", "not a valid whatsapp-enabled number"]
            ):
                raise RuntimeError(
                    "This number has not joined the Twilio WhatsApp sandbox yet. "
                    "Open the Twilio WhatsApp sandbox page, send the join code from that recipient number to +1 415 523 8886 on WhatsApp, "
                    "then try the test again. For production, set TWILIO_WHATSAPP_FROM to your approved WhatsApp sender."
                )
            raise RuntimeError(message_text)
        print(
            "[WhatsApp] Twilio success",
            {
                "status_code": response.status_code,
                "response": data,
            },
        )
        return data if isinstance(data, dict) else {}


async def _get_shop_notification_context(db: AsyncSession, shop_id: int) -> tuple[Shop | None, User | None, ShopNotificationSettings | None]:
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        return None, None, None

    user_result = await db.execute(select(User).where(User.id == shop.user_id))
    user = user_result.scalar_one_or_none()

    settings_result = await db.execute(select(ShopNotificationSettings).where(ShopNotificationSettings.shop_id == shop_id))
    settings = settings_result.scalar_one_or_none()
    return shop, user, settings


async def dispatch_whatsapp_alerts(
    db: AsyncSession,
    *,
    shop_id: int,
    alerts: list[dict[str, Any]],
    force_send: bool = False,
) -> dict[str, int]:
    shop, user, settings = await _get_shop_notification_context(db, shop_id)
    if not shop or not user:
        return {"sent": 0, "digests": 0, "skipped": 0}
    if not settings or not settings.whatsapp_alerts_enabled:
        return {"sent": 0, "digests": 0, "skipped": len(alerts)}

    to_phone = _to_whatsapp_address(settings.whatsapp_phone_override or user.phone)
    if not to_phone:
        return {"sent": 0, "digests": 0, "skipped": len(alerts)}

    existing_result = await db.execute(
        select(AlertNotificationState).where(
            AlertNotificationState.shop_id == shop_id,
            AlertNotificationState.channel == "whatsapp",
        )
    )
    existing_map = {row.notification_key: row for row in existing_result.scalars().all()}
    now = _now()
    seen_keys: set[str] = set()
    high_alerts_to_send: list[tuple[AlertNotificationState, dict[str, Any]]] = []
    low_alerts_to_digest: list[tuple[AlertNotificationState, dict[str, Any]]] = []

    for alert in alerts:
        if alert.get("kind") != "risk":
            continue

        key = _notification_key(alert)
        seen_keys.add(key)
        row = existing_map.get(key)
        alert_hash = _message_hash(alert)
        severity = str(alert.get("severity") or "LOW")
        signal_source = str(alert.get("signal_source") or "unknown")
        geo_scope = str(alert.get("geo_scope") or "district")

        if not row:
            row = AlertNotificationState(
                shop_id=shop_id,
                product_id=alert.get("product_id"),
                channel="whatsapp",
                notification_key=key,
                alert_kind=str(alert.get("kind") or "risk"),
                signal_source=signal_source,
                geo_scope=geo_scope,
                severity=severity,
                message_hash=alert_hash,
                latest_message=str(alert.get("message") or ""),
                latest_action_hint=str(alert.get("action_hint") or ""),
                active=True,
                first_seen_at=now,
                last_seen_at=now,
            )
            db.add(row)
            existing_map[key] = row
            changed = True
            reappeared = True
        else:
            previous_severity = row.severity
            previous_hash = row.message_hash
            reappeared = not row.active
            changed = previous_hash != alert_hash or SEVERITY_ORDER.get(severity, 0) > SEVERITY_ORDER.get(previous_severity, 0) or reappeared
            row.product_id = alert.get("product_id")
            row.alert_kind = str(alert.get("kind") or row.alert_kind)
            row.signal_source = signal_source
            row.geo_scope = geo_scope
            row.severity = severity
            row.message_hash = alert_hash
            row.latest_message = str(alert.get("message") or "")
            row.latest_action_hint = str(alert.get("action_hint") or "")
            row.active = True
            row.last_seen_at = now
            row.cleared_at = None

        if _is_high_risk_alert(alert):
            if force_send or row.last_whatsapp_sent_at is None or changed:
                high_alerts_to_send.append((row, alert))
        elif _is_low_stock_digest_alert(alert):
            if force_send or row.last_whatsapp_sent_at is None or changed:
                low_alerts_to_digest.append((row, alert))

    for key, row in existing_map.items():
        if key in seen_keys or not row.active:
            continue
        row.active = False
        row.cleared_at = now
        row.last_seen_at = now

    sent_count = 0
    digest_count = 0
    pending_rows = high_alerts_to_send + low_alerts_to_digest

    if pending_rows:
        try:
            response = await _send_template_message(
                to_phone,
                _combined_variables(
                    shop.shop_name,
                    [alert for _, alert in high_alerts_to_send],
                    [alert for _, alert in low_alerts_to_digest],
                ),
            )
            for row, _ in pending_rows:
                row.last_whatsapp_sent_at = now
                row.last_delivery_status = str(response.get("status") or "queued")
                row.last_message_sid = str(response.get("sid") or "")
            sent_count = 1 if high_alerts_to_send else 0
            digest_count = 1 if low_alerts_to_digest else 0
        except Exception as exc:
            for row, _ in pending_rows:
                row.last_delivery_status = f"failed:{exc}"

    await db.commit()
    return {"sent": sent_count, "digests": digest_count, "skipped": 0}


async def send_test_whatsapp_alert(
    db: AsyncSession,
    *,
    shop_id: int,
    alerts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    shop, user, settings = await _get_shop_notification_context(db, shop_id)
    if not shop or not user:
        raise RuntimeError("Shop profile not found.")
    if not settings or not settings.whatsapp_alerts_enabled:
        raise RuntimeError("WhatsApp alerts are disabled for this shop.")

    to_phone = _to_whatsapp_address(settings.whatsapp_phone_override or user.phone)
    if not to_phone:
        raise RuntimeError("Owner phone number is not valid for WhatsApp delivery.")

    urgent_alerts = [alert for alert in (alerts or []) if _is_high_risk_alert(alert)]
    low_stock_alerts = [alert for alert in (alerts or []) if _is_low_stock_digest_alert(alert)]
    if not urgent_alerts and not low_stock_alerts:
        low_stock_alerts = [
            {
                "product_name": "Rice",
                "message": "Stock is low and should be checked before the next buying cycle.",
                "action_hint": "Review current stock and refill fast-moving items first.",
            }
        ]

    response = await _send_template_message(
        to_phone,
        _combined_variables(shop.shop_name, urgent_alerts, low_stock_alerts),
    )
    return {
        "status": str(response.get("status") or "queued"),
        "sid": str(response.get("sid") or ""),
        "to": to_phone,
    }
