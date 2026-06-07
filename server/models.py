"""
models.py – SQLAlchemy-powered data layer.
"""

from __future__ import annotations

import calendar
from datetime import datetime, date, timedelta
from typing import Optional

import bcrypt
from dateutil.relativedelta import relativedelta

from extensions import db


# ══════════════════════════════════════════════════════════════════════════════
# Models
# ══════════════════════════════════════════════════════════════════════════════

class User(db.Model):
    __tablename__ = "users"

    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    role     = db.Column(db.String(50),  nullable=False)

    def to_dict(self):
        return {"id": self.id, "username": self.username, "role": self.role}


class Course(db.Model):
    __tablename__ = "courses"

    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), unique=True, nullable=False)
    default_fee = db.Column(db.Float, nullable=False)


class Invoice(db.Model):
    __tablename__ = "invoices"

    id           = db.Column(db.Integer, primary_key=True)
    invoice_no   = db.Column(db.String(50), unique=True, nullable=True)
    student_id   = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    course       = db.Column(db.String(100), nullable=False)
    course_fee   = db.Column(db.Float, nullable=False)
    discount     = db.Column(db.Float, default=0)
    total_amount = db.Column(db.Float, nullable=False)
    balance      = db.Column(db.Float, nullable=False)
    status       = db.Column(db.String(20), default="unpaid")
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)


class Student(db.Model):
    __tablename__ = "students"

    id                 = db.Column(db.Integer, primary_key=True)
    admission_number   = db.Column(db.String(100), unique=True)
    name               = db.Column(db.String(255), nullable=False)
    phone              = db.Column(db.String(50))
    email              = db.Column(db.String(120))
    gender             = db.Column(db.String(20))
    course             = db.Column(db.String(100))
    mode               = db.Column(db.String(50))
    level              = db.Column(db.String(50))
    membership         = db.Column(db.Boolean, default=False)
    membership_no      = db.Column(db.String(100))
    membership_benefit = db.Column(db.String(50))
    course_id          = db.Column(db.Integer, db.ForeignKey("courses.id"))
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)

    payments = db.relationship("Payment", backref="student", lazy=True, cascade="all, delete-orphan")
    invoices = db.relationship("Invoice", backref="student", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        latest_payment = (
            Payment.query
            .filter_by(student_id=self.id)
            .order_by(Payment.id.desc())
            .first()
        )
        balance_data = get_student_balance(self.id)
        status       = _student_status(latest_payment.due_date if latest_payment else None)

        return {
            "id":                 self.id,
            "admission_number":   self.admission_number,
            "name":               self.name,
            "phone":              self.phone,
            "email":              self.email,
            "gender":             self.gender,
            "course":             self.course,
            "course_id":          self.course_id,
            "mode":               self.mode,
            "level":              self.level,
            "membership":         self.membership,
            "membership_no":      self.membership_no,
            "membership_benefit": self.membership_benefit,
            "status":             status,
            "balance":            balance_data.get("balance", 0),
            "created_at":         self.created_at.isoformat(),
            "payment":            latest_payment.to_dict() if latest_payment else None,
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id          = db.Column(db.Integer, primary_key=True)
    student_id  = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    invoice_id  = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=True)
    invoice     = db.relationship("Invoice", backref="payments")
    amount_paid = db.Column(db.Float, nullable=False)
    date_paid   = db.Column(db.Date, nullable=False, index=True)
    duration    = db.Column(db.Integer, nullable=False)
    due_date    = db.Column(db.Date, nullable=False)
    method      = db.Column(db.String(50), default="cash")
    reference   = db.Column(db.String(100), nullable=True)
    renewal_no  = db.Column(db.String(50),  nullable=True)

    def __init__(self, **kwargs):
        super(Payment, self).__init__(**kwargs)
        if self.date_paid and self.duration:
            self.due_date = _compute_due_date(self.date_paid, self.duration)

    def to_dict(self):
        return {
            "id":          self.id,
            "student_id":  self.student_id,
            "invoice_id":  self.invoice_id,
            "amount_paid": self.amount_paid,
            "date_paid":   self.date_paid.isoformat(),
            "duration":    self.duration,
            "due_date":    self.due_date.isoformat() if self.due_date else None,
            "method":      self.method,
            "reference":   self.reference,
            "renewal_no":  self.renewal_no,
        }


def normalize_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value), "%Y-%m-%d").date()


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _compute_due_date(date_paid, duration: int):
    if isinstance(date_paid, str):
        base = datetime.strptime(date_paid, "%Y-%m-%d").date()
    elif isinstance(date_paid, datetime):
        base = date_paid.date()
    elif isinstance(date_paid, date):
        base = date_paid
    else:
        raise TypeError(f"Unsupported date type: {type(date_paid)}")
    return base + relativedelta(months=duration)


def _renewal_no(payment_id: int) -> str:
    return f"REC-{str(payment_id).zfill(4)}"


def _admission_number(student_id: int) -> str:
    return f"RTC-{str(student_id).zfill(3)}"


def _student_status(due_date) -> str:
    """
    Active       = due_date is today or in the future  (subscription valid)
    Expired      = due_date passed < 30 days ago        (grace window)
    Unsubscribed = due_date passed 30+ days ago
    No Payment   = no payment on record
    """
    if not due_date:
        return "No Payment"
    try:
        if isinstance(due_date, datetime):
            d = due_date.date()
        elif isinstance(due_date, date):
            d = due_date
        else:
            d = datetime.strptime(str(due_date), "%Y-%m-%d").date()

        today     = date.today()
        diff_days = (today - d).days   # positive = past, negative = future

        if diff_days < 0:
            return "Active"
        if diff_days < 30:
            return "Expired"
        return "Unsubscribed"          # previously "Left"
    except ValueError:
        return "No Payment"


# ══════════════════════════════════════════════════════════════════════════════
# Auth / Users
# ══════════════════════════════════════════════════════════════════════════════

def create_user(username: str, password: str, role: str):
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user   = User(username=username, password=hashed, role=role)
    db.session.add(user)
    db.session.commit()
    return user.to_dict()


def get_user_by_username(username: str):
    return User.query.filter_by(username=username).first()


def get_user_by_id(user_id: int):
    return User.query.get(user_id)


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def update_user_password(user_id: int, new_password: str):
    user = User.query.get(user_id)
    if not user:
        return False
    user.password = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    db.session.commit()
    return True


def get_course_fee(course_name):
    course = Course.query.filter_by(name=course_name).first()
    return course.default_fee if course else 0


# ══════════════════════════════════════════════════════════════════════════════
# Students
# ══════════════════════════════════════════════════════════════════════════════

def create_student(data: dict):
    student = Student(
        name=data["name"],
        phone=data.get("phone", ""),
        email=data.get("email", ""),
        gender=data.get("gender"),
        mode=data.get("mode"),
        level=data.get("level"),
        course=data.get("course", ""),
        membership=data.get("membership", False),
        membership_no=data.get("membership_no", ""),
        membership_benefit=data.get("membership_benefit", ""),
    )
    db.session.add(student)
    db.session.commit()

    student.admission_number = _admission_number(student.id)
    db.session.commit()

    raw_fee    = data.get("course_fee") or get_course_fee(student.course)
    course_fee = float(raw_fee) if raw_fee else 0.0

    benefits = (data.get("membership_benefit") or "").lower()
    if "50" in benefits:
        discount = 0.5
    elif "free" in benefits:
        discount = 1.0
    else:
        discount = 0.0

    final_fee = course_fee * (1 - discount)

    invoice = Invoice(
        student_id=student.id,
        course=student.course,
        course_fee=course_fee,
        discount=discount * course_fee,
        total_amount=final_fee,
        balance=final_fee,
        status="unpaid",
    )
    db.session.add(invoice)
    db.session.commit()

    return student.to_dict()


def get_all_students(search=None):
    query = Student.query
    if search:
        term = f"%{search}%"
        query = query.filter(db.or_(
            Student.name.ilike(term),
            Student.phone.ilike(term),
            Student.course.ilike(term),
            Student.admission_number.ilike(term),
        ))
    students = query.order_by(Student.id.desc()).all()
    if not students:
        return []

    ids = [s.id for s in students]

    # One query for all latest payments
    latest_payments = (
        db.session.query(Payment)
        .filter(Payment.student_id.in_(ids))
        .order_by(Payment.student_id, Payment.id.desc())
        .all()
    )
    payment_map = {}
    for p in latest_payments:
        if p.student_id not in payment_map:
            payment_map[p.student_id] = p

    # One query for all invoices
    invoices = Invoice.query.filter(Invoice.student_id.in_(ids)).all()
    invoice_map = {inv.student_id: inv for inv in invoices}

    results = []
    for s in students:
        lp = payment_map.get(s.id)
        inv = invoice_map.get(s.id)
        balance_data = {
            "course_fee":   inv.course_fee   if inv else 0,
            "expected_fee": inv.total_amount if inv else 0,
            "paid":         (inv.total_amount - inv.balance) if inv else 0,
            "balance":      inv.balance      if inv else 0,
            "status":       inv.status       if inv else "unpaid",
        } if inv else {"balance": 0, "course_fee": 0}

        results.append({
            "id":                 s.id,
            "admission_number":   s.admission_number,
            "name":               s.name,
            "phone":              s.phone,
            "email":              s.email,
            "gender":             s.gender,
            "course":             s.course,
            "course_id":          s.course_id,
            "mode":               s.mode,
            "level":              s.level,
            "membership":         s.membership,
            "membership_no":      s.membership_no,
            "membership_benefit": s.membership_benefit,
            "status":             _student_status(lp.due_date if lp else None),
            "balance":            balance_data.get("balance", 0),
            "created_at":         s.created_at.isoformat(),
            "payment":            lp.to_dict() if lp else None,
        })
    return results


def get_student_by_id(student_id: int):
    student = db.session.get(Student, student_id)
    return student.to_dict() if student else None


def get_student_by_admission_number(admission_number: str):
    student = Student.query.filter_by(admission_number=admission_number).first()
    return student.to_dict() if student else None


def update_student(student_id: int, data: dict):
    student = Student.query.get(student_id)
    if not student:
        return None

    student.name               = data.get("name",               student.name)
    student.phone              = data.get("phone",              student.phone)
    student.email              = data.get("email",              student.email)
    student.gender             = data.get("gender",             student.gender)
    student.mode               = data.get("mode",               student.mode)
    student.level              = data.get("level",              student.level)
    student.course             = data.get("course",             student.course)
    student.membership         = data.get("membership",         student.membership)
    student.membership_no      = data.get("membership_no",      student.membership_no)
    student.membership_benefit = data.get("membership_benefit", student.membership_benefit)

    invoice = Invoice.query.filter_by(student_id=student.id).first()
    if invoice:
        raw_fee         = data.get("course_fee", invoice.course_fee)
        course_fee      = float(raw_fee)
        benefits        = (student.membership_benefit or "").lower()
        discount        = 0.5 if "50" in benefits else (1.0 if "free" in benefits else 0.0)
        discount_amount = course_fee * discount
        total_amount    = course_fee - discount_amount
        paid            = invoice.total_amount - invoice.balance
        new_balance     = max(total_amount - paid, 0)

        invoice.course       = student.course
        invoice.course_fee   = course_fee
        invoice.discount     = discount_amount
        invoice.total_amount = total_amount
        invoice.balance      = new_balance
        invoice.status       = "paid" if new_balance <= 0 else ("partial" if paid > 0 else "unpaid")

    db.session.commit()
    return student.to_dict()


def delete_student(student_id: int):
    student = db.session.get(Student, student_id)
    if not student:
        return False
    db.session.delete(student)
    db.session.commit()
    return True


# ══════════════════════════════════════════════════════════════════════════════
# Payments
# ══════════════════════════════════════════════════════════════════════════════

def create_payment(data: dict):
    student_id = int(data["student_id"])
    raw_amount = data.get("amount_paid") or data.get("amount")

    if raw_amount is None or str(raw_amount).strip() == "":
        return {"error": "amount_paid is required"}
    try:
        amount = float(raw_amount)
    except ValueError:
        return {"error": "amount_paid must be a number"}

    date_paid = normalize_date(data["date_paid"])
    duration  = int(data["duration"])
    method    = data.get("method", "cash")
    reference = data.get("reference", "")
    due_date  = _compute_due_date(date_paid, duration)
    invoice   = Invoice.query.filter_by(student_id=student_id).first()

    payment = Payment(
        student_id=student_id,
        invoice_id=invoice.id if invoice else None,
        amount_paid=amount,
        date_paid=date_paid,
        duration=duration,
        due_date=due_date,
        method=method,
        reference=reference,
    )
    db.session.add(payment)
    db.session.commit()

    payment.renewal_no = _renewal_no(payment.id)
    db.session.commit()

    if invoice:
        apply_payment(invoice.id, amount, date_paid, method, reference)

    student = db.session.get(Student, student_id)

    return {
        "id":               payment.id,
        "renewal_no":       payment.renewal_no,
        "student_id":       student_id,
        "student_name":     student.name if student else "",
        "admission_number": student.admission_number if student else "",
        "course":           student.course if student else "",
        "amount_paid":      payment.amount_paid,
        "date_paid":        payment.date_paid.isoformat(),
        "duration":         payment.duration,
        "due_date":         payment.due_date.isoformat() if payment.due_date else None,
    }

def get_payments_by_student(student_id: int):
    payments = (
        Payment.query
        .filter_by(student_id=student_id)
        .order_by(Payment.id.desc())
        .all()
    )
    # All payments belong to the same student — fetch once instead of once per row
    student = db.session.get(Student, student_id)
    return [{
        "id":               p.id,
        "student_id":       p.student_id,
        "student_name":     student.name if student else "",
        "course":           student.course if student else "",
        "admission_number": student.admission_number if student else "",
        "amount":           p.amount_paid,
        "amount_paid":      p.amount_paid,
        "date_paid":        p.date_paid.isoformat() if p.date_paid else None,
        "duration":         p.duration,
        "due_date":         p.due_date.isoformat() if p.due_date else None,
        "renewal_no":       p.renewal_no,
    } for p in payments]

def delete_payment(payment_id: int):
    payment = Payment.query.get(payment_id)
    if not payment:
        return False

    invoice = Invoice.query.filter_by(student_id=payment.student_id).first()
    if invoice:
        # Recalculate how much has been paid excluding this payment
        remaining_payments = Payment.query.filter(
            Payment.student_id == payment.student_id,
            Payment.id != payment_id
        ).all()

        total_paid      = sum(p.amount_paid for p in remaining_payments)
        new_balance     = max(invoice.total_amount - total_paid, 0)

        invoice.balance = new_balance
        invoice.status  = (
            "paid"    if new_balance <= 0 else
            "partial" if total_paid  >  0 else
            "unpaid"
        )

    db.session.delete(payment)
    db.session.commit()
    return True


def get_recent_payments(days=7):
    query = Payment.query.order_by(Payment.id.desc())
    if days is not None:
        cutoff = date.today() - timedelta(days=days)
        query = query.filter(Payment.date_paid >= cutoff)
    payments = query.limit(50).all()   # cap at 50 rows

    student_ids = list({p.student_id for p in payments})
    students = {s.id: s for s in Student.query.filter(Student.id.in_(student_ids)).all()}

    return [{
        "id":           p.id,
        "student_id":   p.student_id,
        "student_name": students[p.student_id].name if p.student_id in students else "",
        "course":       students[p.student_id].course if p.student_id in students else "",
        "amount":       p.amount_paid,
        "date_paid":    p.date_paid.isoformat() if p.date_paid else None,
        "duration":     p.duration,
        "due_date":     p.due_date.isoformat() if p.due_date else None,
        "renewal_no":   p.renewal_no,
    } for p in payments]


def upsert_payment(data: dict):
    payment_id = data.get("id")
    if payment_id:
        return update_payment(int(payment_id), data) or {}
    return create_payment(data)


def update_payment(payment_id: int, data: dict):
    payment = Payment.query.get(payment_id)
    if not payment:
        return None
    if "amount_paid" in data:
        payment.amount_paid = float(data["amount_paid"])
    if "date_paid" in data:
        payment.date_paid = normalize_date(data["date_paid"])
    if "duration" in data:
        payment.duration = int(data["duration"])
    if "method" in data:
        payment.method = data["method"]
    if "reference" in data:
        payment.reference = data["reference"]
    payment.due_date = _compute_due_date(payment.date_paid, payment.duration)
    db.session.commit()
    return payment.to_dict()


def apply_payment(invoice_id, amount, date_paid, method="cash", reference=None):
    invoice = Invoice.query.get(invoice_id)
    if not invoice:
        return {"error": "Invoice not found"}
    if amount <= 0:
        return {"error": "Invalid amount"}
    payment_amount  = min(amount, invoice.balance)
    invoice.balance -= payment_amount
    invoice.status   = "paid" if invoice.balance <= 0 else "partial"
    db.session.commit()
    return {"message": "Payment recorded successfully"}


def get_student_balance(student_id):
    invoice = Invoice.query.filter_by(student_id=student_id).first()
    if not invoice:
        return {"balance": 0, "course_fee": 0}
    return {
        "course_fee":   invoice.course_fee,
        "expected_fee": invoice.total_amount,
        "paid":         invoice.total_amount - invoice.balance,
        "balance":      invoice.balance,
        "status":       invoice.status,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ══════════════════════════════════════════════════════════════════════════════

def get_dashboard_stats(month: Optional[int] = None, year: Optional[int] = None):
    """
    Return dashboard statistics.

    Scoping rules
    ─────────────
    • year only  → all payments in that calendar year
    • year+month → only payments in that specific month of that year
    • neither    → all-time (legacy fallback)

    Status definitions
    ──────────────────
    Active       = due_date is today or in the future  (subscription valid)
    Expired      = due_date passed < 30 days ago        (grace window)
    Unsubscribed = due_date passed 30+ days ago

    Status counts are SCOPED — only students with a payment in the requested
    window are counted. If no payments exist for the period, all return 0.
    """
    MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]

    target_year  = int(year)  if year  else None
    target_month = int(month) if month else None
    today        = date.today()

    all_students     = Student.query.all()
    all_students_map = {s.id: s for s in all_students}
    all_payments     = Payment.query.all()

    # ── Scope payments to the requested window ────────────────────────────────
    def _in_scope(p):
        if target_year  and p.date_paid.year  != target_year:  return False
        if target_month and p.date_paid.month != target_month: return False
        return True

    scoped_payments = [p for p in all_payments if _in_scope(p)]
    scoped_ids      = set(p.student_id for p in scoped_payments)
    scoped_students = [all_students_map[sid] for sid in scoped_ids if sid in all_students_map]

    # Scoped totals
    total_students = len(scoped_ids)
    total_income   = sum(p.amount_paid for p in scoped_payments)

    # ── Status buckets — SCOPED to the selected period ───────────────────────
    #
    # Only students who have a payment inside the requested window are counted.
    # For each such student we look at their latest payment WITHIN that window
    # (not all-time) and classify its due_date against today:
    #
    #   Active       = due_date >= today        (subscription still valid)
    #   Expired      = 0 <= days_since < 30     (lapsed < 30 days ago)
    #   Unsubscribed = days_since >= 30         (lapsed 30+ days ago)
    #
    # If no payments exist in the window → all three return 0.
    #
    active_students       = 0
    expired_students      = 0
    unsubscribed_students = 0

    # Latest scoped payment per student (within the requested window only)
    latest_scoped: dict[int, Payment] = {}
    for p in scoped_payments:
        existing = latest_scoped.get(p.student_id)
        if not existing or p.id > existing.id:
            latest_scoped[p.student_id] = p

    for sid, lp in latest_scoped.items():
        if lp.due_date is None:
            unsubscribed_students += 1
            continue

        days_since = (today - lp.due_date).days  # negative = still in future

        if days_since < 0:
            active_students += 1          # subscription valid
        elif days_since < 30:
            expired_students += 1         # lapsed < 30 days ago
        else:
            unsubscribed_students += 1    # lapsed 30+ days ago

    # ── Gender — scoped ───────────────────────────────────────────────────────
    male_students   = sum(1 for s in scoped_students if s.gender == "Male")
    female_students = sum(1 for s in scoped_students if s.gender == "Female")

    # ── Income bars — full 12 months of the selected year ────────────────────
    monthly_income = {m: 0 for m in range(1, 13)}
    for payment in all_payments:
        if target_year and payment.date_paid.year != target_year:
            continue
        monthly_income[payment.date_paid.month] += payment.amount_paid
    classes = [
        {"name": MONTH_NAMES[m - 1], "income": monthly_income[m]}
        for m in range(1, 13)
    ]

    # ── Mode of study — scoped ────────────────────────────────────────────────
    mode_counts = {}
    for student in scoped_students:
        if student.mode:
            mode_counts[student.mode] = mode_counts.get(student.mode, 0) + 1
    mode_gender = [{"name": k, "value": v} for k, v in mode_counts.items()]

    # ── Student levels — scoped ───────────────────────────────────────────────
    level_counts = {}
    for student in scoped_students:
        if student.level:
            level_counts[student.level] = level_counts.get(student.level, 0) + 1
    level_gender = [{"name": k, "value": v} for k, v in level_counts.items()]

    return {
        "total_students":        total_students,
        "total_income":          total_income,
        "active_students":       active_students,
        "expired_students":      expired_students,
        "unsubscribed_students": unsubscribed_students,
        "male_students":         male_students,
        "female_students":       female_students,
        "classes":               classes,
        "mode_gender":           mode_gender,
        "level_gender":          level_gender,
    }


def get_course_stats(month: Optional[int] = None, year: Optional[int] = None):
    """Return enrolment counts per course, scoped to year and/or month."""
    all_students = Student.query.all()
    all_payments = Payment.query.all()

    target_year  = int(year)  if year  else None
    target_month = int(month) if month else None

    def _in_scope(p):
        if target_year  and p.date_paid.year  != target_year:  return False
        if target_month and p.date_paid.month != target_month: return False
        return True

    valid_ids = {p.student_id for p in all_payments if _in_scope(p)}
    scoped    = [s for s in all_students if s.id in valid_ids]

    counts = {}
    for student in scoped:
        if student.course:
            counts[student.course] = counts.get(student.course, 0) + 1

    return [{"name": course, "count": count} for course, count in counts.items()]


def get_renewals_due():
    today  = date.today()
    cutoff = today + timedelta(days=7)

    due_payments = (
        Payment.query
        .filter(Payment.due_date >= today, Payment.due_date <= cutoff)
        .order_by(Payment.due_date)
        .all()
    )
    if not due_payments:
        return []

    student_ids = list({p.student_id for p in due_payments})
    students = {s.id: s for s in Student.query.filter(Student.id.in_(student_ids)).all()}

    return [{
        "student_id":       p.student_id,
        "student_name":     students[p.student_id].name if p.student_id in students else "",
        "admission_number": students[p.student_id].admission_number if p.student_id in students else "",
        "course":           students[p.student_id].course if p.student_id in students else "",
        "due_date":         p.due_date.isoformat(),
        "amount":           p.amount_paid,
        "renewal_no":       p.renewal_no,
    } for p in due_payments]