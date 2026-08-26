"""Deterministic operational actions for voice/chat."""
from __future__ import annotations

import json
import os
import re
from datetime import date
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Product
from services.inventory import (
    apply_stock_change,
    find_product_by_name,
    list_inventory_snapshot,
    list_stock_transactions,
    upsert_sales_entry_and_adjust_stock,
)

CONFIRM_WORDS = {"confirm", "yes", "ok", "okay", "done", "proceed"}
CANCEL_WORDS = {"cancel", "stop", "no", "discard"}
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def _is_confirmation(query: str) -> bool:
    normalized = query.strip().lower()
    return normalized in CONFIRM_WORDS


def _is_cancellation(query: str) -> bool:
    normalized = query.strip().lower()
    return normalized in CANCEL_WORDS


def _reply(
    *,
    text: str,
    why: str = "",
    what: str = "",
    rupees_impact: float = 0,
    action: dict | None = None,
    pending_action: dict | None = None,
) -> dict:
    return {
        "handled": True,
        "response_text": text,
        "why_text": why,
        "what_text": what,
        "rupees_impact": rupees_impact,
        "action": action,
        "pending_action": pending_action,
    }


def _extract_json_object(content: str) -> dict[str, Any] | None:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


async def _product_payload(product: Product) -> dict:
    return {
        "product_id": product.id,
        "product_name": product.name,
        "unit": product.unit,
        "selling_price": float(product.selling_price or 0),
    }


async def _parse_stock_update(query: str, shop_id: int, db: AsyncSession) -> dict | None:
    pattern = re.search(
        r"(restock|add|increase|update stock(?: for)?|reduce|remove|decrease)\s+(\d+(?:\.\d+)?)\s*(?:kg|kgs|pcs|pieces|units|packets)?\s+(?:of\s+)?(.+)",
        query,
        re.IGNORECASE,
    )
    if not pattern:
        return None

    verb = pattern.group(1).lower()
    qty = float(pattern.group(2))
    product_name = pattern.group(3).strip(" .")
    product = await find_product_by_name(db, shop_id, product_name)
    if not product:
        return _reply(text=f"I could not find a product matching '{product_name}'.")

    quantity_delta = qty if verb in {"restock", "add", "increase", "update stock", "update stock for"} else -qty
    transaction_type = "restock" if quantity_delta > 0 else "manual_adjustment"
    payload = {
        **await _product_payload(product),
        "quantity_delta": quantity_delta,
        "transaction_type": transaction_type,
        "notes": f"Voice stock update: {verb}",
    }
    summary = f"{'Add' if quantity_delta > 0 else 'Reduce'} {abs(quantity_delta):g} {product.unit} for {product.name}"
    return _reply(
        text=f"Ready to update stock for {product.name}.",
        why=f"This will change the current stock by {quantity_delta:g} {product.unit}.",
        what="Say confirm to commit this stock update, or cancel to discard it.",
        action={
            "kind": "stock_update",
            "status": "draft",
            "requires_confirmation": True,
            "summary": summary,
            "payload": payload,
        },
        pending_action={"kind": "stock_update", "payload": payload},
    )


async def _parse_sales_entry(query: str, shop_id: int, db: AsyncSession) -> dict | None:
    pattern = re.search(
        r"(?:sold|record sale(?: of)?|sale of)\s+(\d+(?:\.\d+)?)\s*(?:kg|kgs|pcs|pieces|units|packets)?\s+(?:of\s+)?(.+?)(?:\s+for\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?))?$",
        query,
        re.IGNORECASE,
    )
    if not pattern:
        return None

    qty = float(pattern.group(1))
    product_name = pattern.group(2).strip(" .")
    revenue_text = pattern.group(3)
    product = await find_product_by_name(db, shop_id, product_name)
    if not product:
        return _reply(text=f"I could not find a product matching '{product_name}'.")

    revenue = float(revenue_text) if revenue_text else round(qty * float(product.selling_price or 0), 2)
    payload = {
        **await _product_payload(product),
        "quantity_sold": qty,
        "revenue": revenue,
        "entry_date": date.today().isoformat(),
        "source": "voice",
    }
    return _reply(
        text=f"Ready to record today's sale for {product.name}.",
        why=f"This will set today's sold quantity to {qty:g} {product.unit} with revenue Rs.{revenue:,.2f}.",
        what="Say confirm to save this sales entry and adjust stock by the delta.",
        rupees_impact=revenue,
        action={
            "kind": "sales_entry",
            "status": "draft",
            "requires_confirmation": True,
            "summary": f"Record sale: {qty:g} {product.unit} {product.name} for Rs.{revenue:,.2f}",
            "payload": payload,
        },
        pending_action={"kind": "sales_entry", "payload": payload},
    )


async def _extract_invoice_draft_with_llm(query: str, shop_id: int, db: AsyncSession) -> dict[str, Any] | None:
    if not GROQ_API_KEY:
        return None

    product_result = await db.execute(select(Product).where(Product.shop_id == shop_id).order_by(Product.name.asc()))
    products = product_result.scalars().all()
    product_catalog = [
        {
            "product_id": product.id,
            "name": product.name,
            "unit": product.unit,
            "selling_price": float(product.selling_price or 0),
            "stock_qty": float(product.stock_qty or 0),
        }
        for product in products
    ]

    system_prompt = """You extract invoice drafts for a kirana store assistant.
Return valid JSON only. Do not add markdown.

Schema:
{
  "customer_name": string | null,
  "customer_gstin": string | null,
  "items": [
    {
      "product": string,
      "product_id": number | null,
      "qty": number,
      "unit_price": number | null
    }
  ],
  "missing_fields": string[],
  "needs_clarification": boolean,
  "clarification_question": string | null
}

Rules:
- Extract customer name and line items from natural language.
- Handle compact quantity forms like 100kg, 2pcs, 5ltr.
- If a product likely matches the catalog, use that product_id.
- If unit_price is not stated but product exists in catalog, use the catalog selling price.
- Customer name is optional. If missing, set customer_name to "Walk-in Customer".
- Date is optional. Never ask for invoice date.
- The minimum required information is at least one invoice item with product and quantity.
- If price is missing but the product exists in catalog, use the catalog selling price automatically.
- Only set needs_clarification true when no usable line item can be extracted.
- Do not ask follow-up questions for customer details, invoice date, or other non-essential metadata.
"""

    user_prompt = json.dumps(
        {
            "user_query": query,
            "product_catalog": product_catalog,
        },
        ensure_ascii=True,
    )

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": os.getenv("GROQ_MODEL", "groq/compound"),
                    "temperature": 0,
                    "max_tokens": 500,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            if response.status_code != 200:
                return None

            content = response.json()["choices"][0]["message"]["content"]
            return _extract_json_object(content)
    except Exception:
        return None


async def _build_invoice_reply_from_payload(payload: dict[str, Any], shop_id: int, db: AsyncSession) -> dict:
    customer_name = str(payload.get("customer_name") or "Walk-in Customer").strip() or "Walk-in Customer"
    customer_gstin = payload.get("customer_gstin")
    raw_items = payload.get("items") or []

    items: list[dict[str, Any]] = []
    skipped_items: list[str] = []
    partial_items: list[dict[str, Any]] = []
    subtotal = 0.0
    for raw_item in raw_items:
        product = None
        product_id = raw_item.get("product_id")
        if isinstance(product_id, int):
            product_result = await db.execute(
                select(Product).where(Product.id == product_id, Product.shop_id == shop_id)
            )
            product = product_result.scalar_one_or_none()
        if not product and raw_item.get("product"):
            product = await find_product_by_name(db, shop_id, str(raw_item["product"]))

        qty = float(raw_item.get("qty") or 0)
        if qty <= 0:
            continue

        unit_price_value = raw_item.get("unit_price")
        if unit_price_value is None and product:
            unit_price_value = float(product.selling_price or 0)
        if unit_price_value is None:
            continue

        # Stock check: Handle partial fulfillment or skip if out of stock
        actual_qty = qty
        if product:
            stock_available = float(product.stock_qty or 0)
            if stock_available <= 0:
                skipped_items.append(product.name)
                continue
            elif stock_available < qty:
                partial_items.append({
                    "name": product.name,
                    "requested": qty,
                    "available": stock_available,
                    "remaining": round(qty - stock_available, 2)
                })
                actual_qty = stock_available
        else:
            skipped_items.append(str(raw_item.get("product", "Unknown item")))
            continue

        unit_price = float(unit_price_value)
        amount = round(actual_qty * unit_price, 2)
        subtotal += amount
        items.append(
            {
                "product_id": product.id if product else None,
                "product": product.name if product else str(raw_item.get("product", "")).strip(),
                "qty": actual_qty,
                "unit_price": unit_price,
                "gst_rate": 5,
                "amount": amount,
                "stock_available": float(product.stock_qty or 0) if product else None,
            }
        )

    if not items:
        error_text = "I need at least one valid invoice item before I can draft the invoice."
        if skipped_items:
            error_text = f"I cannot draft the invoice because {', '.join(skipped_items)} is not available or out of stock."
        
        return _reply(
            text=error_text,
            what="Try adding items that are in stock or adjust the quantities.",
            action={"kind": "invoice_draft", "status": "needs_input", "requires_confirmation": False},
        )

    total_gst = round(sum(item["amount"] * 0.05 for item in items), 2)
    total = round(subtotal + total_gst, 2)
    invoice_payload = {
        "customer_name": customer_name,
        "customer_gstin": customer_gstin,
        "items": items,
        "skipped_items": skipped_items,
        "partial_items": partial_items,
        "subtotal": round(subtotal, 2),
        "cgst": round(total_gst / 2, 2),
        "sgst": round(total_gst / 2, 2),
        "total": total,
    }

    reply_text = f"Invoice draft ready for {customer_name}."
    
    notes = []
    if skipped_items:
        notes.append(f"{', '.join(skipped_items)} was not included as it is not available")
    if partial_items:
        for p in partial_items:
            notes.append(f"only {p['available']:g} {product.unit} of {p['name']} is available (requested {p['requested']:g}, {p['remaining']:g} out of stock)")
    
    if notes:
        reply_text += " Note: " + "; ".join(notes) + "."

    return _reply(
        text=reply_text,
        why=f"I extracted {len(items)} line item(s) with an estimated total of Rs.{total:,.2f}.",
        what="Say confirm to generate the invoice and deduct stock for matched products.",
        rupees_impact=total,
        action={
            "kind": "invoice_draft",
            "status": "draft",
            "requires_confirmation": True,
            "summary": f"Invoice for {customer_name} totalling Rs.{total:,.2f}",
            "payload": invoice_payload,
        },
        pending_action={"kind": "invoice_draft", "payload": invoice_payload},
    )


async def _parse_invoice_request(query: str, shop_id: int, db: AsyncSession) -> dict | None:
    if not re.search(r"\b(invoice|receipt|bill)\b", query, re.IGNORECASE):
        return None

    llm_payload = await _extract_invoice_draft_with_llm(query, shop_id, db)
    if llm_payload:
        if llm_payload.get("needs_clarification"):
            missing_fields = [field for field in (llm_payload.get("missing_fields") or []) if field != "customer_name"]
            if not missing_fields:
                llm_payload["needs_clarification"] = False
                llm_payload["customer_name"] = llm_payload.get("customer_name") or "Walk-in Customer"
                return await _build_invoice_reply_from_payload(llm_payload, shop_id, db)
            return _reply(
                text="I could not extract a usable invoice item from that request.",
                why=", ".join(missing_fields) or "",
                what=str(llm_payload.get("clarification_question") or "Tell me the item name, quantity, and price if it is not already in your catalog."),
                action={"kind": "invoice_draft", "status": "needs_input", "requires_confirmation": False},
            )
        return await _build_invoice_reply_from_payload(llm_payload, shop_id, db)

    customer_match = re.search(
        r"(?:invoice|receipt|bill)\s+(?:for\s+)?([a-zA-Z][a-zA-Z\s]+?)\s+(?:for|with)\s+(.+)$",
        query,
        re.IGNORECASE,
    )
    if not customer_match:
        return _reply(
            text="I can generate the invoice as soon as you give the item quantity and price.",
            what="Try: create invoice with 2 rice at 50 and 1 sugar at 40",
            action={"kind": "invoice_draft", "status": "needs_input", "requires_confirmation": False},
        )

    customer_name = customer_match.group(1).strip()
    items_text = customer_match.group(2).strip()
    item_matches = re.findall(
        r"(\d+(?:\.\d+)?)\s*(?:kg|kgs|pcs|pieces|units|packets|litres?|ltr|gm|g|ml)?\s+(?:of\s+)?([a-zA-Z][a-zA-Z0-9\s-]+?)(?:\s+(?:at|for|@)\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:rupees|rs\.?|₹|/-)?)?(?=,| and |$)",
        items_text,
        re.IGNORECASE,
    )
    if not item_matches:
        return _reply(
            text="I could not parse any invoice items from that request.",
            what="Try: create invoice for Ramesh with 2 rice at 50 and 1 sugar at 40",
        )

    fallback_payload = {
        "customer_name": customer_name,
        "customer_gstin": None,
        "items": [
            {
                "product": name_text.strip(),
                "product_id": None,
                "qty": float(qty_text),
                "unit_price": float(price_text) if price_text else None,
            }
            for qty_text, name_text, price_text in item_matches
        ],
    }
    return await _build_invoice_reply_from_payload(fallback_payload, shop_id, db)


async def _handle_inventory_query(query: str, shop_id: int, db: AsyncSession) -> dict | None:
    lowered = query.lower()
    if not any(keyword in lowered for keyword in ["inventory", "stock", "transaction history", "recent transactions"]):
        return None

    if "history" in lowered or "transactions" in lowered:
        transactions = await list_stock_transactions(db, shop_id=shop_id, limit=8)
        summary = [
            f"{tx['transaction_type']} {tx['product_name']} {tx['quantity_delta']:g} -> {tx['balance_after']:g}"
            for tx in transactions[:5]
        ]
        return _reply(
            text="Here is your recent stock transaction history.",
            why="This view shows the latest inventory movements across sales, restocks, and manual adjustments.",
            what="\n".join(summary) if summary else "No transactions recorded yet.",
            action={
                "kind": "inventory_query",
                "status": "info",
                "requires_confirmation": False,
                "transactions": transactions,
            },
        )

    inventory = await list_inventory_snapshot(db, shop_id)
    critical = [item for item in inventory if item["status"] == "CRITICAL"][:5]
    low = [item for item in inventory if item["status"] == "LOW_STOCK"][:5]
    lines = [f"{item['name']}: {item['in_stock']:g} {item['unit']} ({item['status']})" for item in (critical + low)]
    return _reply(
        text="Here is the live inventory snapshot.",
        why="Stock levels are calculated from current product balances with recent sales-based thresholds.",
        what="\n".join(lines) if lines else "All tracked products are currently above the low-stock threshold.",
        action={
            "kind": "inventory_query",
            "status": "info",
            "requires_confirmation": False,
            "inventory": inventory[:12],
        },
    )


async def execute_pending_action(
    pending_action: dict,
    *,
    shop_id: int,
    db: AsyncSession,
) -> dict:
    kind = pending_action.get("kind")
    payload = pending_action.get("payload", {})

    if kind == "stock_update":
        transaction = await apply_stock_change(
            db,
            shop_id=shop_id,
            product_id=payload["product_id"],
            quantity_delta=float(payload["quantity_delta"]),
            transaction_type=payload["transaction_type"],
            notes=payload.get("notes"),
        )
        await db.commit()
        return _reply(
            text=f"Stock updated for {payload['product_name']}.",
            why=f"The new balance is {transaction.balance_after:g} {payload['unit']}.",
            what="You can ask for recent stock transactions or another inventory update.",
            action={
                "kind": "stock_update",
                "status": "committed",
                "requires_confirmation": False,
                "payload": {
                    **payload,
                    "balance_after": float(transaction.balance_after),
                    "transaction_id": transaction.id,
                },
            },
        )

    if kind == "sales_entry":
        _, quantity_diff = await upsert_sales_entry_and_adjust_stock(
            db,
            shop_id=shop_id,
            product_id=payload["product_id"],
            entry_date=date.fromisoformat(payload["entry_date"]),
            quantity_sold=float(payload["quantity_sold"]),
            revenue=float(payload["revenue"]),
            source=payload["source"],
        )
        await db.commit()
        return _reply(
            text=f"Sales entry saved for {payload['product_name']}.",
            why=f"Today's sales now reflect {payload['quantity_sold']:g} {payload['unit']}, and stock was adjusted by {-quantity_diff:g}.",
            what="You can add another sale or ask for stock history.",
            rupees_impact=float(payload["revenue"]),
            action={
                "kind": "sales_entry",
                "status": "committed",
                "requires_confirmation": False,
                "payload": payload,
            },
        )

    if kind == "invoice_draft":
        from api.invoice import GenerateInvoiceRequest, InvoiceItem, generate_invoice

        invoice_req = GenerateInvoiceRequest(
            shop_id=shop_id,
            customer_name=payload["customer_name"],
            items=[
                InvoiceItem(
                    product_id=item.get("product_id"),
                    product=item["product"],
                    qty=item["qty"],
                    unit_price=item["unit_price"],
                    gst_rate=item.get("gst_rate", 5),
                )
                for item in payload["items"]
            ],
        )
        # Reuse API route logic to keep invoice creation and stock deduction consistent.
        result = await generate_invoice(invoice_req, current_user=type("T", (), {"shop_id": shop_id})(), db=db)
        
        reply_text = f"Invoice generated for {payload['customer_name']}."
        if payload.get("skipped_items"):
            reply_text += f" Note: {', '.join(payload['skipped_items'])} was not included as it is out of stock."

        return _reply(
            text=reply_text,
            why=f"Invoice total is Rs.{payload['total']:,.2f}.",
            what="Use the invoice link to view or download the receipt PDF.",
            rupees_impact=float(payload["total"]),
            action={
                "kind": "invoice_draft",
                "status": "committed",
                "requires_confirmation": False,
                "payload": {
                    **payload,
                    "invoice_id": result["invoice_id"],
                    "invoice_number": result["invoice_number"],
                    "detail_url": result["detail_url"],
                    "pdf_url": result["pdf_url"],
                },
            },
        )

    raise HTTPException(status_code=400, detail="Unsupported pending action")


async def handle_operational_query(
    query: str,
    *,
    shop_id: int,
    db: AsyncSession,
    pending_action: dict | None,
) -> dict | None:
    if pending_action and _is_confirmation(query):
        return await execute_pending_action(pending_action, shop_id=shop_id, db=db)

    if pending_action and _is_cancellation(query):
        return _reply(
            text="Pending action cancelled.",
            what="You can ask for a new stock update, sales entry, or invoice draft.",
            action={
                "kind": pending_action.get("kind", "action"),
                "status": "cancelled",
                "requires_confirmation": False,
            },
            pending_action=None,
        )

    for parser in (_parse_stock_update, _parse_sales_entry, _parse_invoice_request):
        result = await parser(query, shop_id, db)
        if result:
            return result

    return await _handle_inventory_query(query, shop_id, db)
