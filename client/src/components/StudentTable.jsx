import { useState } from "react";
import ActionButtons from "./ActionButtons";

function StudentTable({
  students,
  onHistory,
  onEdit,
  onDelete,
  canManageStudents,
  canViewBalance,
  getStudentStatus,
}) {
  const [selected, setSelected] = useState(null);

  const showActionsCol = canManageStudents || canViewBalance;

  return (
    <div className="table-wrapper">

      {/* TABLE */}
      <table className="modern-table">
        <thead>
          <tr>
            <th>Adm No</th>
            <th>Full Name</th>
            <th>Course</th>
            <th>Amount Paid (KSh)</th>
            <th>Mode of Study</th>
            <th>Level</th>
            <th>Status</th>
            <th>Membership</th>
            <th>Membership Benefits</th>
            {showActionsCol && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {students.length > 0 ? (
            students.map((s) => {
              const studentStatus = getStudentStatus(
                s.payment?.date_paid,
                s.payment?.duration
              );

              return (
                <tr key={s.id} onClick={() => setSelected(s)}>
                  <td style={{ fontWeight: 600, color: "#2563eb", fontSize: 13 }}>
                    {s.admission_number || "—"}
                  </td>

                  <td className="name">{s.name}</td>

                  <td>{s.course}</td>

                  <td>
                    {s.payment?.amount_paid !== undefined
                       ? s.membership_benefit === "free" && Number(s.payment.amount_paid) === 0
                         ? <span style={{ color: "#16a34a", fontWeight: 700 }}>0 (Free)</span>
                         : Number(s.payment.amount_paid).toLocaleString()
                      : "—"}
                  </td>

                  <td>
                    <span className={`badge ${s.mode}`}>{s.mode}</span>
                  </td>

                  <td>
                    <span className={`badge level-${s.level}`}>{s.level}</span>
                  </td>

                  <td>
                    <span className={`status ${studentStatus.toLowerCase()}`}>
                      {studentStatus}
                    </span>
                  </td>

                  <td>
                    <span className={`membership ${s.membership ? "yes" : "no"}`}>
                      {s.membership ? "Yes" : "No"}
                    </span>
                  </td>

                  <td>
                    {s.membership ? (
                      <span style={{ color: "#16a34a", fontWeight: 600 }}>
                        {s.membership_benefit === "free"
                          ? "Free"
                          : "50% Discount"}
                      </span>
                    ) : (
                      <span style={{ color: "#a1a1aa" }}>---</span>
                    )}
                  </td>

                  {showActionsCol && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <ActionButtons
                        student={s}
                        onHistory={onHistory}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </td>
                  )}
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={
                  (showActionsCol ? 1 : 0) + 9
                }
                className="no-results"
              >
                No students found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* MODAL (DETAIL VIEW) */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="student-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selected.name}</h3>

            <p><strong>Admission No:</strong> {selected.admission_number || "—"}</p>
            <p><strong>Email Address:</strong> {selected.email}</p>
            <p><strong>Phone No.:</strong> {selected.phone}</p>
            <p><strong>Gender:</strong> {selected.gender}</p>

            <p>
              <strong>Amount Paid (KSh):</strong>{" "}
              {selected.payment?.amount_paid !== undefined
                ? selected.membership_benefit === "free" && Number(selected.payment.amount_paid) === 0
                ? <span style={{ color: "#16a34a", fontWeight: 700 }}>0 (Free)</span>
                : Number(selected.payment.amount_paid).toLocaleString()
                : "-"}
            </p>

            {/* Balance only visible here in the modal */}
            {canViewBalance && (
              <p>
                <strong>Balance (KSh):</strong>{" "}
                {(() => {
                  const bal =
                    selected.balance !== undefined && selected.balance !== null
                      ? selected.balance
                      : selected.payment?.balance ?? 0;
                  return (
                    <span
                      style={{
                        fontWeight: 700,
                        color: bal > 0 ? "#b45309" : "#15803d",
                      }}
                    >
                      {bal > 0 ? bal.toLocaleString() : "0 (Fully Paid)"}
                    </span>
                  );
                })()}
              </p>
            )}

            <p><strong>Date Paid:</strong> {selected.payment?.date_paid || "—"}</p>

            <p>
              <strong>Duration:</strong>{" "}
              {selected.payment?.duration
                ? `${selected.payment.duration} month${selected.payment.duration > 1 ? "s" : ""}`
                : "—"}
            </p>

            <p><strong>Due Date:</strong> {selected.payment?.due_date || "—"}</p>
            <p><strong>Renewal No:</strong> {selected.payment?.renewal_no || "—"}</p>
            <p><strong>Payment Method:</strong> {selected.payment?.method || "—"}</p>

            <p>
              <strong>Status:</strong>{" "}
              {getStudentStatus(
                selected.payment?.date_paid,
                selected.payment?.duration
              )}
            </p>

            <p><strong>Membership:</strong> {selected.membership ? "Yes" : "No"}</p>
            <p><strong>Membership No:</strong> {selected.membership_no || "—"}</p>

            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentTable;