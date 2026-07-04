function PaymentHistoryModal({
  selectedStudent,
  setSelectedStudent,
  paymentHistory,
  loading,
  editPayment,
  setEditPayment,
  updatePayment,
  deletePayment,
}) {
  const role = localStorage.getItem("role");
  const canDelete = role === "admin" || role === "director";

  return (
    <div className="modal-overlay">
      <div className="modal-content">

        <h3>Payment History - {selectedStudent.name}</h3>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
            ⏳ Loading payments...
          </div>
        ) : paymentHistory.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "center", padding: "8px" }}>Receipt No</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Amount</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Date Paid</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Duration</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Due Date</th>
                {canDelete && (
                  <th style={{ textAlign: "center", padding: "8px" }}>Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paymentHistory.map((p) => {
                const isExpired = new Date(p.due_date) < new Date();
                const isEditing = editPayment?.id === p.id;

                return (
                  <tr key={p.id} className={isExpired ? "expired-row" : ""}>

                    {/* ── Edit mode ── */}
                    {isEditing ? (
                      <>
                        <td style={{ textAlign: "center", padding: "6px" }}>
                          {p.renewal_no || "—"}
                        </td>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="number"
                            value={editPayment.amount_paid}
                            onChange={(e) =>
                              setEditPayment({ ...editPayment, amount_paid: e.target.value })
                            }
                            style={{ width: 80 }}
                          />
                        </td>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="date"
                            value={editPayment.date_paid}
                            onChange={(e) =>
                              setEditPayment({ ...editPayment, date_paid: e.target.value })
                            }
                          />
                        </td>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="number"
                            value={editPayment.duration}
                            onChange={(e) =>
                              setEditPayment({ ...editPayment, duration: e.target.value })
                            }
                            style={{ width: 50 }}
                          />
                        </td>
                        <td style={{ textAlign: "center", padding: "6px" }}>
                          {p.due_date}
                        </td>
                        {canDelete && (
                          <td style={{ textAlign: "center", padding: "6px" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button
                                onClick={updatePayment}
                                style={{
                                  background: "#15803d",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 4,
                                  padding: "3px 8px",
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                ✓ Save
                              </button>
                              <button
                                onClick={() => setEditPayment(null)}
                                style={{
                                  background: "#71717a",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 4,
                                  padding: "3px 8px",
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    ) : (

                      /* ── View mode ── */
                      <>
                        <td style={{ textAlign: "center", padding: "8px", fontSize: 12, color: "#71717a" }}>
                          {p.renewal_no || "—"}
                        </td>
                        <td style={{ textAlign: "center", padding: "8px" }}>
                          KSh {Number(p.amount_paid ?? p.amount).toLocaleString()}
                        </td>
                        <td style={{ textAlign: "center", padding: "8px" }}>{p.date_paid}</td>
                        <td style={{ textAlign: "center", padding: "8px" }}>{p.duration} mo</td>
                        <td style={{ textAlign: "center", padding: "8px" }}>{p.due_date}</td>
                        {canDelete && (
                          <td style={{ textAlign: "center", padding: "8px" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>

                              {/* Edit button */}
                              <button
                                onClick={() => setEditPayment({ ...p })}
                                title="Edit payment"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "1rem",
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  color: "#2563eb",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                              >
                                ✏️
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete this payment of KSh ${Number(p.amount_paid ?? p.amount).toLocaleString()}? This cannot be undone.`)) {
                                    deletePayment(p.id);
                                  }
                                }}
                                title="Delete payment"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "1rem",
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  color: "#ef4444",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                              >
                                🗑️
                              </button>

                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: 20 }}>
            No payment history found
          </p>
        )}

        <div className="modal-actions">
          <button onClick={() => setSelectedStudent(null)}>Close</button>
        </div>

      </div>
    </div>
  );
}

export default PaymentHistoryModal;