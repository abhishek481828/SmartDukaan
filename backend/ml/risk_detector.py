"""Risk / anomaly detection."""
# See: SmartDukaan_Developer_Reference.md (Section 7 — Risk Detection Rules)


def check_anomaly(actual: float, forecast: float) -> tuple[bool, float]:
    """Check if actual sales deviate >20% below forecast."""
    if forecast == 0:
        return False, 0.0
    deviation = (actual - forecast) / forecast
    is_anomaly = deviation < -0.20
    return is_anomaly, deviation * 100


def detect_risk(predicted_qty: float, avg_30d: float) -> dict:
    """Classify risk level based on forecast vs 30-day average."""
    if avg_30d == 0:
        return {"level": "LOW", "reason": "Insufficient data"}

    drop_pct = ((avg_30d - predicted_qty) / avg_30d) * 100

    if predicted_qty < avg_30d * 0.75:
        return {"level": "HIGH", "reason": f"Predicted {drop_pct:.0f}% drop"}
    if predicted_qty < avg_30d * 0.90:
        return {"level": "MEDIUM", "reason": "Slight decline detected"}
    return {"level": "LOW", "reason": "Sales trending normal"}
