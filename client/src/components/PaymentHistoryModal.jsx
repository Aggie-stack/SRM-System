function PaymentHistoryModal({
  selectedStudent,
  setSelectedStudent,
  paymentHistory,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">

        <h3>Payment History - {selectedStudent.name}</h3>

        {paymentHistory.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "center", padding: "8px" }}>Amount</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Date Paid</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Duration</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Due Date</th>
              </tr>
            </thead>

            <tbody>
              {paymentHistory.map((p) => {
                const isExpired = new Date(p.due_date) < new Date();

                return (
                  <tr
                    key={p.id}
                    className={isExpired ? "expired-row" : ""}
                  >
                    <td style={{ textAlign: "center", padding: "8px" }}>{p.amount}</td>
                    <td style={{ textAlign: "center", padding: "8px" }}>{p.date_paid}</td>
                    <td style={{ textAlign: "center", padding: "8px" }}>{p.duration}</td>
                    <td style={{ textAlign: "center", padding: "8px" }}>{p.due_date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No payment history found</p>
        )}

        <div className="modal-actions">
          <button onClick={() => setSelectedStudent(null)}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

export default PaymentHistoryModal;