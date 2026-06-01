# ── Paste these into your existing routes file ──────────────────────────────
# Replace your current /dashboard, /dashboard/courses routes with these.

from flask import request, jsonify
from models import get_dashboard_stats, get_course_stats, get_renewals_due, get_recent_payments

@app.route("/dashboard")
@jwt_required()
def dashboard():
    month = request.args.get("month", type=int)   # optional, 1-12
    year  = request.args.get("year",  type=int)   # optional, e.g. 2025
    return jsonify(get_dashboard_stats(month=month, year=year))


@app.route("/dashboard/courses")
@jwt_required()
def dashboard_courses():
    month = request.args.get("month", type=int)
    year  = request.args.get("year",  type=int)
    return jsonify(get_course_stats(month=month, year=year))


@app.route("/dashboard/renewals-due")
@jwt_required()
def dashboard_renewals():
    return jsonify(get_renewals_due())


@app.route("/dashboard/recent-payments")
@jwt_required()
def dashboard_recent_payments():
    days_raw = request.args.get("days", "7")
    days     = None if days_raw == "all" else int(days_raw)
    return jsonify(get_recent_payments(days=days))