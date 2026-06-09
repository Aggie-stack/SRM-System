import { useState } from "react";
import API from "../api";

const INITIAL_PAYMENT = {
  amount_paid: "",
  balance: "",
  date_paid: "",
  duration: "",
  method: "cash",
  reference: "",
};

const INITIAL_MEMBERSHIP = {
  membership: false,
  membership_no: "",
  membership_benefit: "",
};

function RenewalPayment({ onRenewalAdded }) {
  const [step, setStep] = useState(1);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [student, setStudent] = useState(null);
  const [payment, setPayment] = useState(INITIAL_PAYMENT);
  const [membership, setMembership] = useState(INITIAL_MEMBERSHIP);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [balance, setBalance] = useState(null);
  const [courseFee, setCourseFee] = useState(0);

  const updatePaymentField = (field, value) =>
    setPayment((prev) => ({ ...prev, [field]: value }));

  const updateMembershipField = (field, value) =>
    setMembership((prev) => ({ ...prev, [field]: value }));

  const fetchBalance = async (studentId) => {
    try {
      const res = await API.get(`/students/${studentId}/balance`);
      setBalance(res.data.balance);
      setCourseFee(res.data.course_fee || 0);
    } catch (err) {
      console.error("Balance error", err);
      setBalance(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter an admission number or name.");
      return;
    }

    setError("");
    setStudent(null);
    setBalance(null);

    try {
      setSearching(true);

      const res = await API.get(
        `/students?search=${encodeURIComponent(searchQuery.trim())}`
      );

      const data = Array.isArray(res.data) ? res.data[0] : res.data;

      if (!data) {
        setError("No student found.");
        return;
      }

      setStudent(data);

      setMembership({
        membership: data.membership || false,
        membership_no: data.membership_no || "",
        membership_benefit: data.membership_benefit || "",
      });

      setStep(2);

      await fetchBalance(data.id);
    } catch (err) {
      console.error("Search error:", err.response?.data);
      setError(err.response?.data?.error || "Student not found.");
    } finally {
      setSearching(false);
    }
  };

  const discountedAmount =
    membership.membership_benefit === "free"
      ? 0
      : membership.membership_benefit === "50% discount"
      ? courseFee / 2
      : courseFee;

  const handleBenefitChange = (value) => {
    updateMembershipField("membership_benefit", value);

    if (value === "free") {
      updatePaymentField("amount_paid", "0");
    } else if (value === "50% discount") {
      updatePaymentField("amount_paid", "");
    } else {
      updatePaymentField("amount_paid", "");
    }
  };

  const handleRenew = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!student) {
      setError("No student selected");
      return;
    }

    // ✅ Force amount_paid to "0" for free benefit before any validation
    const isFree = membership.membership && membership.membership_benefit === "free";
    const finalPayment = isFree
      ? { ...payment, amount_paid: "0" }
      : payment;

    const amountPaid = Number(finalPayment.amount_paid);

    if (
      membership.membership_benefit === "50% discount" &&
      amountPaid < courseFee / 2
    ) {
      setError(
        `This member should pay at least KSh ${(courseFee / 2).toLocaleString()}`
      );
      return;
    }

    if (
      finalPayment.amount_paid === "" ||
      (!isFree && amountPaid <= 0) ||
      !finalPayment.date_paid ||
      !finalPayment.duration
    ) {
      setError("Please fill in all payment fields.");
      return;
    }

    try {
      setSaving(true);

      if (
        membership.membership !== student.membership ||
        membership.membership_no !== student.membership_no ||
        membership.membership_benefit !== student.membership_benefit
      ) {
        await API.put(`/students/${student.id}`, {
          ...student,
          membership: membership.membership ? 1 : 0,
          membership_no: membership.membership_no,
          membership_benefit: membership.membership_benefit,
        });
      }

      await API.post("/payments", {
        student_id: student.id,
        amount_paid: amountPaid,                      // ✅ uses finalPayment's value (0 for free)
        balance: Number(finalPayment.balance || 0),
        date_paid: finalPayment.date_paid,
        duration: Number(finalPayment.duration),
        method: finalPayment.method,
        reference: finalPayment.reference,
      });

      setSuccess(
        `Renewal recorded for ${student.name} (ID: ${student.id}).`
      );

      setPayment(INITIAL_PAYMENT);
      setMembership(INITIAL_MEMBERSHIP);
      setSearchQuery("");
      setStudent(null);
      setStep(1);
      setBalance(null);
      setCourseFee(0);

      if (onRenewalAdded) onRenewalAdded(student.id);
    } catch (err) {
      console.error("Renewal error:", err.response?.data);
      setError(err.response?.data?.error || "Renewal failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setStudent(null);
    setSearchQuery("");
    setPayment(INITIAL_PAYMENT);
    setMembership(INITIAL_MEMBERSHIP);
    setError("");
    setSuccess("");
    setBalance(null);
    setCourseFee(0);
  };

  return (
    <div>
      <h2>Renewal Payment</h2>

      {success && (
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          color: "#15803d",
          padding: "10px 14px",
          borderRadius: 8,
          marginBottom: 12
        }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          padding: "10px 14px",
          borderRadius: 8,
          marginBottom: 12
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleRenew}>

        {step === 1 && (
          <div className="form-box">
            <h3>Step 1 — Find Student</h3>

            <input
              placeholder="Admission Number or Full Name *"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />

            <div className="form-footer">
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
              >
                {searching ? "Searching..." : "Search →"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && student && (
          <div className="form-box">
            <h3>Step 2 — Renewal Payment</h3>

            <div style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              padding: 12,
              borderRadius: 8,
              marginBottom: 12
            }}>
              <div style={{ fontWeight: 700 }}>{student.name}</div>
              <div>ID: {student.id} · {student.course} · {student.level}</div>
              <div>{student.phone} {student.email && `· ${student.email}`}</div>
              <div>Admission No: {student.admission_number}</div>
            </div>

            {balance !== null && (
              <div style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                background: balance > 0 ? "#fef2f2" : "#ecfdf5",
                color: balance > 0 ? "#b91c1c" : "#16a34a",
                fontWeight: 600
              }}>
                Balance: KSh {balance}
              </div>
            )}

            <label style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              marginBottom: 12,
              fontSize: 14,
              fontWeight: 500,
              color: "#374151"
            }}>
              <input
                type="checkbox"
                checked={membership.membership}
                onChange={(e) =>
                  updateMembershipField("membership", e.target.checked)
                }
                style={{
                  width: 16,
                  height: 16,
                  cursor: "pointer",
                  flexShrink: 0,
                  margin: 0
                }}
              />
              Has Membership Card
            </label>

            {membership.membership && (
              <input
                type="text"
                placeholder="Membership Card Number"
                value={membership.membership_no}
                onChange={(e) =>
                  updateMembershipField("membership_no", e.target.value)
                }
              />
            )}

            {membership.membership && (
              <div className="form-group">
                <label>Membership Benefit</label>
                <select
                  value={membership.membership_benefit}
                  onChange={(e) => handleBenefitChange(e.target.value)}
                >
                  <option value="">Select Benefit</option>
                  <option value="free">Free 1 Month</option>
                  <option value="50% discount">50% Discount</option>
                </select>

                {membership.membership_benefit && (
                  <div style={{
                    background: "#f8fafc",
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 10
                  }}>
                    Required Payment: KSh {discountedAmount.toLocaleString()}
                    {membership.membership_benefit === "50% discount" && (
                      <span style={{ color: "#64748b", fontSize: 13, marginLeft: 6 }}>
                        (Course fee KSh {courseFee.toLocaleString()} ÷ 2)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <input
              type="number"
              placeholder={
                membership.membership_benefit === "50% discount"
                  ? `Min. KSh ${(courseFee / 2).toLocaleString()}`
                  : "Amount Paid (KSh) *"
              }
              value={payment.amount_paid}
              readOnly={membership.membership_benefit === "free"}
              onChange={(e) => updatePaymentField("amount_paid", e.target.value)}
            />

            <input
              type="number"
              placeholder="Balance (if any)"
              value={payment.balance}
              onChange={(e) => updatePaymentField("balance", e.target.value)}
            />

            <input
              type="date"
              value={payment.date_paid}
              onChange={(e) => updatePaymentField("date_paid", e.target.value)}
            />

            <input
              type="number"
              placeholder="Duration (Months) *"
              value={payment.duration}
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
              <button type="button" onClick={handleReset}>
                ← Back
              </button>

              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Record Renewal"}
              </button>
            </div>
          </div>
        )}

      </form>
    </div>
  );
}

export default RenewalPayment;