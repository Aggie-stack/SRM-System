// ─── EditStudentRegistration ──────────────────────────────────────────────────

function EditStudentRegistration({
  editStudent,
  setEditStudent,
  editStep,
  setEditStep,
  paymentData,
  setPaymentData,
  handleUpdateStudent,
  handleSaveAll: handleSaveAllProp,
  onSuccess,
}) {
  const set = (field, value) =>
    setEditStudent((prev) => ({ ...prev, [field]: value }));

  const setPayment = (field, value) =>
    setPaymentData((prev) => ({ ...prev, [field]: value }));

  const handleSaveAllInternal = async () => {
    const token = localStorage.getItem("token");

    try {
      // ── 1. Update student details ─────────────────────────────────────────
      const studentRes = await fetch(`/api/students/${editStudent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editStudent.name,
          phone: editStudent.phone,
          email: editStudent.email,
          gender: editStudent.gender,
          mode: editStudent.mode,
          level: editStudent.level,
          course: editStudent.course,
          membership: editStudent.membership,
          membership_no: editStudent.membership_no,
          membership_benefit: editStudent.membership_benefit,
        }),
      });

      if (!studentRes.ok) {
        const err = await studentRes.json();
        alert("Failed to update student: " + (err.error || "Unknown error"));
        return;
      }

      // ── 2. Update or create payment ───────────────────────────────────────
      const existingPayment = editStudent.payment;

      // ✅ FIX 1: safer validation (DO NOT convert to Number here)
      const hasPaymentData =
        paymentData.amount_paid !== "" &&
        paymentData.amount_paid !== null &&
        paymentData.amount_paid !== undefined &&
        paymentData.date_paid &&
        paymentData.duration !== "" &&
        paymentData.duration !== null &&
        paymentData.duration !== undefined;
        

      if (existingPayment?.id && hasPaymentData) {
        // UPDATE existing payment
        const payRes = await fetch(`/api/payments/${existingPayment.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount_paid: paymentData.amount_paid,
            date_paid: paymentData.date_paid,
            duration: paymentData.duration,
            method: paymentData.method || "cash",
            reference: paymentData.reference || "",
          }),
        });

        if (!payRes.ok) {
          const err = await payRes.json();
          alert("Student saved, but payment update failed: " + (err.error || "Unknown error"));
          return;
        }

      } else if (!existingPayment && hasPaymentData) {
        // CREATE new payment
        const payRes = await fetch(`/api/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            student_id: editStudent.id,
            amount_paid: paymentData.amount_paid,
            date_paid: paymentData.date_paid,
            duration: paymentData.duration,
            method: paymentData.method || "cash",
            reference: paymentData.reference || "",
          }),
        });

        if (!payRes.ok) {
          const err = await payRes.json();
          alert("Student saved, but payment creation failed: " + (err.error || "Unknown error"));
          return;
        }
      }

      // ── 3. Re-fetch student (FIXED HEADERS) ───────────────────────────────
      const freshRes = await fetch(`/api/students/${editStudent.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const freshStudent = freshRes.ok ? await freshRes.json() : null;

      // ── 4. Reset UI ───────────────────────────────────────────────────────
      setEditStudent(null);
      setEditStep(1);
      setPaymentData({
        amount_paid: "",
        date_paid: "",
        duration: "",
        method: "cash",
        reference: "",
      });

      if (typeof onSuccess === "function" && freshStudent) {
        onSuccess(freshStudent);
      }

      alert("Student updated successfully!");

    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    }
  };

  const handleSaveAll = handleSaveAllProp ?? handleSaveAllInternal;

  return (
    <div className="modal-overlay">
      <div className="modal-content">

        {/* ── STEP 1 ── */}
        {editStep === 1 && (
          <>
            <h3>Edit Registration — Student Details</h3>

            {editStudent.admission_number && (
              <div style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                color: "#1d4ed8",
                fontWeight: 600,
                marginBottom: 4,
              }}>
                Admission No: {editStudent.admission_number}
              </div>
            )}

            <input
              placeholder="Full Name"
              value={editStudent.name || ""}
              onChange={(e) => set("name", e.target.value)}
            />

            <input
              placeholder="Email Address"
              type="email"
              value={editStudent.email || ""}
              onChange={(e) => set("email", e.target.value)}
            />

            <select
              value={editStudent.gender || ""}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>

            <select
              value={editStudent.mode || ""}
              onChange={(e) => set("mode", e.target.value)}
            >
              <option value="">Mode of Learning</option>
              <option value="online">Online</option>
              <option value="physical">Physical</option>
            </select>

            <select
              value={editStudent.level || ""}
              onChange={(e) => set("level", e.target.value)}
            >
              <option value="">Level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <input
              placeholder="Phone No"
              value={editStudent.phone || ""}
              onChange={(e) => set("phone", e.target.value)}
            />

            <input
              placeholder="Course"
              value={editStudent.course || ""}
              onChange={(e) => set("course", e.target.value)}
            />

            <div className="form-group">
              <label>Has Membership Card?</label>

              <select
                value={editStudent.membership ? "yes" : "no"}
                onChange={(e) => {
                  const hasMembership = e.target.value === "yes";
                  set("membership", hasMembership);

                  if (!hasMembership) {
                    set("membership_no", "");
                    set("membership_benefit", "");
                  }
                }}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {editStudent.membership && (
              <>
                <input
                  type="text"
                  placeholder="Membership Card Number"
                  value={editStudent.membership_no || ""}
                  onChange={(e) => set("membership_no", e.target.value)}
                />

                <select
                  value={editStudent.membership_benefit || ""}
                  onChange={(e) => set("membership_benefit", e.target.value)}
                >
                  <option value="">Select Membership Benefit</option>
                  <option value="free">Free 1 Month</option>
                  <option value="50% discount">50% Discount</option>
                </select>
              </>
            )}

            <div className="modal-actions">
              <button onClick={() => setEditStudent(null)}>Cancel</button>
              <button onClick={() => setEditStep(2)}>Next → Payment</button>
            </div>
          </>
        )}

        {/* ── STEP 2 ── */}
        {editStep === 2 && (
          <>
            <h3>Edit Registration — Payment Details</h3>

            <input
              type="number"
              placeholder="Amount paid(KSh)"
              value={paymentData.amount_paid || ""}
              onChange={(e) =>
                setPayment("amount_paid", e.target.value)
              }
            />

            <input
              type="date"
              value={paymentData.date_paid || ""}
              onChange={(e) =>
                setPayment("date_paid", e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Duration (Months)"
              value={paymentData.duration || ""}
              onChange={(e) =>
                setPayment("duration", e.target.value)
              }
            />

            <select
              value={paymentData.method || "cash"}
              onChange={(e) =>
                setPayment("method", e.target.value)
              }
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-pesa</option>
              <option value="bank">Bank</option>
            </select>

            <input
              type="text"
              placeholder="Reference Code (Optional)"
              value={paymentData.reference || ""}
              onChange={(e) =>
                setPayment("reference", e.target.value)
              }
            />

            <div className="modal-actions">
              <button onClick={() => setEditStep(1)}>← Back</button>
              <button
                onClick={() => {
                  handleSaveAllInternal();
                }}
                style={{ backgroundColor: "#38a169" }}
              >
                Save Registration
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default EditStudentRegistration;