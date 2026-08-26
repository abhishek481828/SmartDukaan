"""WebSocket handler for dashboard live updates.

WS /ws/dashboard/{shop_id}
Server→Client:
  { "type": "alert", "payload": { product_name, severity, message } }
  { "type": "forecast_update", "payload": { product_id, predicted_qty } }
  { "type": "sale_logged", "payload": { product_name, qty, revenue } }
"""
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Connection manager for broadcasting to multiple dashboard clients
_connections: dict[int, list[WebSocket]] = {}


@router.websocket("/ws/dashboard/{shop_id}")
async def dashboard_websocket(websocket: WebSocket, shop_id: int):
    """Maintain connection for live dashboard pushes."""
    await websocket.accept()

    # Register connection
    if shop_id not in _connections:
        _connections[shop_id] = []
    _connections[shop_id].append(websocket)

    try:
        while True:
            # Keep alive — listen for client pings
            data = await websocket.receive_text()
            msg = json.loads(data) if data else {}

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        # Remove connection
        if shop_id in _connections:
            _connections[shop_id] = [
                ws for ws in _connections[shop_id] if ws != websocket
            ]
        print(f"[DashboardWS] Client for shop {shop_id} disconnected")


async def broadcast_to_shop(shop_id: int, message: dict):
    """Broadcast a message to all connected dashboard clients for a shop."""
    if shop_id not in _connections:
        return

    dead = []
    for ws in _connections[shop_id]:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)

    # Cleanup dead connections
    for ws in dead:
        _connections[shop_id].remove(ws)
