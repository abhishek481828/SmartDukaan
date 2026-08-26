"""Invoice routes with preview, confirmation, stock deduction, sales history, and PDF generation."""
import io
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_utils import TokenData, get_current_user
from db.database import get_db
from db.models import Invoice, Product, Shop
from services.inventory import add_sales_entry_without_stock_adjustment, apply_stock_change, find_product_by_name

router = APIRouter()


class InvoiceItem(BaseModel):
    product_id: int | None = None
    product: str
    qty: float
    unit_price: float
    gst_rate: float = 5


class GenerateInvoiceRequest(BaseModel):
    shop_id: int
    customer_name: str | None = None
    customer_gstin: str | None = None
    items: list[InvoiceItem]


async def _generate_invoice_number(db: AsyncSession, shop_id: int) -> str:
    year = datetime.now(timezone.utc).year

    count_result = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.shop_id == shop_id)
    )
    sequence = (count_result.scalar() or 0) + 1

    while True:
        candidate = f"BV-{year}-S{shop_id:03d}-{sequence:03d}"
        existing_result = await db.execute(
            select(Invoice.id).where(Invoice.invoice_number == candidate)
        )
        if existing_result.scalar_one_or_none() is None:
            return candidate
        sequence += 1


async def _build_invoice_payload(db: AsyncSession, shop_id: int, req: GenerateInvoiceRequest) -> dict:
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()

    subtotal = 0.0
    items_data: list[dict] = []
    skipped_items: list[str] = []
    for item in req.items:
        matched_product = None
        if item.product_id:
            product_result = await db.execute(
                select(Product).where(Product.id == item.product_id, Product.shop_id == shop_id)
            )
            matched_product = product_result.scalar_one_or_none()
        if not matched_product:
            matched_product = await find_product_by_name(db, shop_id, item.product)

        # Stock check: Skip items that are out of stock or have insufficient quantity
        if matched_product:
            stock_available = float(matched_product.stock_qty or 0)
            if stock_available < item.qty:
                skipped_items.append(matched_product.name)
                continue

        amount = item.qty * item.unit_price
        gst_amount = amount * (item.gst_rate / 100)
        subtotal += amount
        items_data.append(
            {
                "product_id": matched_product.id if matched_product else item.product_id,
                "product": item.product,
                "qty": item.qty,
                "unit_price": item.unit_price,
                "gst_rate": item.gst_rate,
                "amount": round(amount, 2),
                "gst_amount": round(gst_amount, 2),
                "stock_available": float(matched_product.stock_qty or 0) if matched_product else None,
            }
        )

    total_gst = sum(item["gst_amount"] for item in items_data)
    cgst = round(total_gst / 2, 2)
    sgst = round(total_gst / 2, 2)
    total = round(subtotal + total_gst, 2)

    return {
        "shop": {
            "id": shop.id if shop else shop_id,
            "shop_name": shop.shop_name if shop else "SmartDukaan Store",
            "gstin": shop.gstin if shop else None,
        },
        "customer_name": req.customer_name or "Walk-in Customer",
        "customer_gstin": req.customer_gstin,
        "items": items_data,
        "skipped_items": skipped_items,
        "subtotal": round(subtotal, 2),
        "cgst": cgst,
        "sgst": sgst,
        "total": total,
    }


@router.post("/preview")
async def preview_invoice(
    req: GenerateInvoiceRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _build_invoice_payload(db, current_user.shop_id, req)


@router.post("/generate", status_code=201)
async def generate_invoice(
    req: GenerateInvoiceRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = current_user.shop_id
    payload = await _build_invoice_payload(db, shop_id, req)
    invoice_number = await _generate_invoice_number(db, shop_id)

    invoice = Invoice(
        shop_id=shop_id,
        invoice_number=invoice_number,
        customer_name=payload["customer_name"],
        customer_gstin=req.customer_gstin,
        items=payload["items"],
        subtotal=payload["subtotal"],
        cgst=payload["cgst"],
        sgst=payload["sgst"],
        total=payload["total"],
    )
    db.add(invoice)
    await db.flush()

    for item in payload["items"]:
        product_id = item.get("product_id")
        if not product_id:
            continue
        await apply_stock_change(
            db,
            shop_id=shop_id,
            product_id=product_id,
            quantity_delta=-float(item["qty"]),
            transaction_type="invoice_sale",
            unit_price=float(item["unit_price"]),
            reference_type="invoice",
            reference_id=invoice.id,
            notes=f"Invoice {invoice_number} for {payload['customer_name']}",
        )
        await add_sales_entry_without_stock_adjustment(
            db,
            shop_id=shop_id,
            product_id=product_id,
            entry_date=date.today(),
            quantity_delta=float(item["qty"]),
            revenue_delta=float(item["amount"]),
            source="invoice",
        )

    await db.commit()
    await db.refresh(invoice)

    return {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "pdf_url": f"/api/invoice/{invoice.id}/pdf",
        "detail_url": f"/api/invoice/{invoice.id}",
        "total": payload["total"],
        "gst_breakup": {"cgst": payload["cgst"], "sgst": payload["sgst"]},
    }


@router.get("/{invoice_id}")
async def get_invoice_detail(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
):
    invoice_result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = invoice_result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    shop_result = await db.execute(select(Shop).where(Shop.id == invoice.shop_id))
    shop = shop_result.scalar_one_or_none()

    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "date": invoice.created_at.date().isoformat() if invoice.created_at else None,
        "customer_name": invoice.customer_name,
        "customer_gstin": invoice.customer_gstin,
        "shop_name": shop.shop_name if shop else "SmartDukaan Store",
        "shop_gstin": shop.gstin if shop else None,
        "items": invoice.items,
        "subtotal": invoice.subtotal,
        "cgst": invoice.cgst,
        "sgst": invoice.sgst,
        "total": invoice.total,
        "pdf_url": f"/api/invoice/{invoice.id}/pdf",
    }


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Generate and stream a PDF invoice. No auth needed (public shareable link)."""
    invoice_result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = invoice_result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    shop_result = await db.execute(select(Shop).where(Shop.id == invoice.shop_id))
    shop = shop_result.scalar_one_or_none()
    shop_name = shop.shop_name if shop else "SmartDukaan Store"

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        w, h = A4

        c.setFont("Helvetica-Bold", 18)
        c.drawString(30, h - 40, shop_name)
        c.setFont("Helvetica", 10)
        c.drawString(30, h - 58, "GST Invoice")
        c.drawRightString(w - 30, h - 40, f"Invoice: {invoice.invoice_number}")
        c.drawRightString(w - 30, h - 55, f"Date: {invoice.created_at.strftime('%Y-%m-%d')}")

        c.line(30, h - 65, w - 30, h - 65)

        y = h - 85
        c.setFont("Helvetica", 10)
        c.drawString(30, y, f"Bill To: {invoice.customer_name}")
        if invoice.customer_gstin:
            y -= 15
            c.drawString(30, y, f"GSTIN: {invoice.customer_gstin}")

        y -= 30
        c.setFont("Helvetica-Bold", 10)
        c.drawString(30, y, "Item")
        c.drawString(200, y, "Qty")
        c.drawString(270, y, "Rate")
        c.drawString(340, y, "GST%")
        c.drawString(410, y, "Amount")
        c.line(30, y - 5, w - 30, y - 5)

        c.setFont("Helvetica", 10)
        items = invoice.items if isinstance(invoice.items, list) else []
        for item in items:
            y -= 18
            c.drawString(30, y, str(item.get("product", "")))
            c.drawString(200, y, str(item.get("qty", "")))
            c.drawString(270, y, f"Rs.{item.get('unit_price', 0)}")
            c.drawString(340, y, f"{item.get('gst_rate', 5)}%")
            c.drawString(410, y, f"Rs.{item.get('amount', 0)}")

        y -= 25
        c.line(30, y + 10, w - 30, y + 10)
        c.drawRightString(400, y, "Subtotal:")
        c.drawRightString(w - 30, y, f"Rs.{invoice.subtotal}")
        y -= 15
        c.drawRightString(400, y, "CGST:")
        c.drawRightString(w - 30, y, f"Rs.{invoice.cgst}")
        y -= 15
        c.drawRightString(400, y, "SGST:")
        c.drawRightString(w - 30, y, f"Rs.{invoice.sgst}")
        y -= 20
        c.setFont("Helvetica-Bold", 12)
        c.drawRightString(400, y, "Total:")
        c.drawRightString(w - 30, y, f"Rs.{invoice.total}")

        c.save()
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'},
        )
    except ImportError:
        return {
            "invoice_number": invoice.invoice_number,
            "message": "PDF generation requires reportlab. Install with: pip install reportlab",
            "data": {
                "shop_name": shop_name,
                "customer_name": invoice.customer_name,
                "items": invoice.items,
                "subtotal": invoice.subtotal,
                "cgst": invoice.cgst,
                "sgst": invoice.sgst,
                "total": invoice.total,
            },
        }
