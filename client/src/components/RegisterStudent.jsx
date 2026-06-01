import { useState } from "react";
import API from "../api";

const INITIAL_STUDENT = {
  name: "",
  phone: "",
  email: "",
  gender: "",
  mode: "",
  level: "",
  course: "",
};

const INITIAL_PAYMENT = {
  course_fee: "",
  amount_paid: "",
  date_paid: "",
  duration: "",
  method: "cash",
  reference: "",
};

function RegisterStudent({ onStudentAdded }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [student, setStudent] = useState(INITIAL_STUDENT);
  const [payment, setPayment] = useState(INITIAL_PAYMENT);

  const [error, setError] = useState("");

  // ─────────────────────────────
  // HELPERS
  // ─────────────────────────────

  const setStudentField = (field, value) => {
    setStudent((prev) => ({ ...prev, [field]: value }));
  };

  const updatePaymentField = (field, value) => {
    setPayment((prev) => ({ ...prev, [field]: value }));
  };

  // Derived balance — recalculated on every render
  const courseFee = Number(payment.course_fee) || 0;
  const amountPaid = Number(payment.amount_paid) || 0;
  const balance = courseFee - amountPaid;

  // ─────────────────────────────
  // STEP VALIDATION
  // ─────────────────────────────

  const handleNext = () => {
    if (
      !student.name ||
      !student.phone ||
      !student.gender ||
      !student.mode ||
      !student.level ||
      !student.course
    ) {
      setError("Please fill in all required student fields.");
      return;
    }
    setError("");
    setStep(2);
  };

  // ─────────────────────────────
  // REGISTER
  // ─────────────────────────────

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !payment.course_fee ||
      Number(payment.course_fee) <= 0
    ) {
      setError("Please enter a valid course fee.");
      return;
    }

    if (
      payment.amount_paid === "" ||
      !payment.date_paid ||
      !payment.duration ||
      Number(payment.amount_paid) < 0 ||
      Number(payment.duration) <= 0
    ) {
      setError("Please fill in all payment fields correctly.");
      return;
    }

    if (amountPaid > courseFee) {
      setError("Amount paid cannot exceed the course fee.");
      return;
    }

    try {
      setSaving(true);

      // CREATE STUDENT — include balance directly on the student record
      const res = await API.post("/students", {
        ...student,
        course_fee: courseFee,        // ← stored on the students table
      });
      const studentId = res.data.id;

      if (!studentId) {
        setError("Student created but no ID returned.");
        return;
      }

      // CREATE PAYMENT (includes course_fee and balance)
      await API.post("/payments", {
        student_id: studentId,
        course_fee: courseFee,
        amount_paid: amountPaid,
        balance: balance,          // stored balance
        date_paid: payment.date_paid,
        duration: Number(payment.duration),
        method: payment.method,
        reference: payment.reference,
      });

      // RESET FORM
      setStudent(INITIAL_STUDENT);
      setPayment(INITIAL_PAYMENT);
      setStep(1);

      if (onStudentAdded) onStudentAdded(studentId, { ...student, admission_number: res.data.admission_number });

    } catch (err) {
      console.error("Registration Error:", err);
      setError(
        err.response?.data?.error || "Registration failed. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────
  // UI
  // ─────────────────────────────

  return (
    <div>
      <h2>Register Student</h2>

      {error && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 12,
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleRegister}>

        {/* ───────── STEP 1 ───────── */}
        {step === 1 && (
          <div className="form-box">
            <h3>Step 1 — Student Details</h3>

            <input
              type="text"
              placeholder="Full Name *"
              value={student.name}
              onChange={(e) => setStudentField("name", e.target.value)}
            />

            <input
              type="text"
              placeholder="Phone Number *"
              value={student.phone}
              onChange={(e) => setStudentField("phone", e.target.value)}
            />

            <input
              type="email"
              placeholder="Email Address"
              value={student.email}
              onChange={(e) => setStudentField("email", e.target.value)}
            />

            <select
              value={student.gender}
              onChange={(e) => setStudentField("gender", e.target.value)}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>

            <select
              value={student.mode}
              onChange={(e) => setStudentField("mode", e.target.value)}
            >
              <option value="">Mode of Learning</option>
              <option value="online">Online</option>
              <option value="physical">Physical</option>
            </select>

            <select
              value={student.level}
              onChange={(e) => setStudentField("level", e.target.value)}
            >
              <option value="">Select Level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <input
              type="text"
              placeholder="Course *"
              value={student.course}
              onChange={(e) => setStudentField("course", e.target.value)}
            />

            <div className="form-footer">
              <button type="button" onClick={handleNext}>
                Next → Payment
              </button>
            </div>
          </div>
        )}

        {/* ───────── STEP 2 ───────── */}
        {step === 2 && (
          <div className="form-box">
            <h3>Step 2 — Payment Details</h3>

            {/* Course Fee */}
            <input
              type="number"
              placeholder="Course Fee (KSh) *"
              value={payment.course_fee}
              min="0"
              onChange={(e) => updatePaymentField("course_fee", e.target.value)}
            />

            {/* Amount Paid */}
            <input
              type="number"
              placeholder="Amount Paid (KSh) *"
              value={payment.amount_paid}
              min="0"
              onChange={(e) => updatePaymentField("amount_paid", e.target.value)}
            />

            {/* Live Balance Summary */}
            {courseFee > 0 && (
              <div style={{
                background: balance > 0 ? "#fffbeb" : "#f0fdf4",
                border: `1px solid ${balance > 0 ? "#fde68a" : "#bbf7d0"}`,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Course Fee</span>
                  <span style={{ fontWeight: 600 }}>KSh {courseFee.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Amount Paid</span>
                  <span style={{ fontWeight: 600, color: "#16a34a" }}>KSh {amountPaid.toLocaleString()}</span>
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: 6,
                  marginTop: 2,
                }}>
                  <span style={{ fontWeight: 700, color: balance > 0 ? "#b45309" : "#15803d" }}>
                    {balance > 0 ? "Balance Due" : "Fully Paid ✓"}
                  </span>
                  <span style={{ fontWeight: 700, color: balance > 0 ? "#b45309" : "#15803d" }}>
                    {balance > 0 ? `KSh ${balance.toLocaleString()}` : "KSh 0"}
                  </span>
                </div>
              </div>
            )}

            <input
              type="date"
              value={payment.date_paid}
              onChange={(e) => updatePaymentField("date_paid", e.target.value)}
            />

            <input
              type="number"
              placeholder="Duration (Months) *"
              value={payment.duration}
              min="1"
              onChange={(e) => updatePaymentField("duration", e.target.value)}
            />

            <select
              value={payment.method}
              onChange={(e) => updatePaymentField("method", e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank</option>
            </select>

            <input
              type="text"
              placeholder="Reference Code (Optional)"
              value={payment.reference}
              onChange={(e) => updatePaymentField("reference", e.target.value)}
            />

            <div className="form-footer">
              <button type="button" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Registering..." : "Register Student"}
              </button>
            </div>
          </div>
        )}

      </form>
    </div>
  );
}

export default RegisterStudent;
