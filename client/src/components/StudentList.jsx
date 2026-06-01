import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import API from "../api";
import axios from "axios";

import StudentTable from "./StudentTable";
import SearchFilter from "./SearchFilter";
import EditStudentRegistration from "./EditStudentRegistration";
import PaymentHistoryModal from "./PaymentHistoryModal";
import DeleteModal from "./DeleteModal";

function StudentListSkeleton() {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="skeleton" style={{ height: 40, width: 220, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 40, width: 140, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 40, width: 140, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 40, width: 140, borderRadius: 8 }} />
      </div>
      <div className="skeleton" style={{ height: 44, borderRadius: "8px 8px 0 0", marginBottom: 2 }} />
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 48, borderRadius: 0, marginBottom: 2, opacity: 1 - i * 0.08 }}
        />
      ))}
    </>
  );
}

function StudentList({ refresh, triggerRefresh }) {
  const [search, setSearch]                   = useState("");
  const [statusFilter, setStatusFilter]       = useState("All");
  const [membershipFilter, setMembershipFilter] = useState("All");
  const [modeFilter, setModeFilter]           = useState("All");
  const [levelFilter, setLevelFilter]         = useState("All");

  const [editStudent, setEditStudent]         = useState(null);
  const [editStep, setEditStep]               = useState(1);
  const [paymentData, setPaymentData]         = useState({
    id: null, amount: "", date_paid: "", duration: "",
  });

  const [deleteStudent, setDeleteStudent]     = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editPayment, setEditPayment]         = useState(null);

  const queryClient = useQueryClient();

  const role = localStorage.getItem("role");
  const canManageStudents = role === "receptionist";
  const canViewBalance    = role === "admin" || role === "director" || role === "receptionist";

  // ── Students list (cached) ──────────────────────────────────────
  const { data: students = [], isLoading: loading, refetch: fetchStudents } = useQuery({
    queryKey: ["students", refresh],
    queryFn:  () => API.get("/students").then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });

  // ── Payment history (cached per student) ───────────────────────
  const { data: paymentHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["payments", selectedStudent?.id],
    queryFn:  () => API.get(`/payments/${selectedStudent.id}`).then(r => r.data),
    enabled:  !!selectedStudent,
    staleTime: 5 * 60 * 1000,
  });

  // ── Helpers ────────────────────────────────────────────────────
  const getStudentStatus = (datePaid, duration) => {
    if (!datePaid) return "Left";
    const paymentDate = new Date(datePaid);
    const expiryDate  = new Date(paymentDate);
    expiryDate.setMonth(expiryDate.getMonth() + Number(duration || 1));
    const today    = new Date();
    const diffDays = (today - expiryDate) / (1000 * 60 * 60 * 24);
    if (diffDays < 0)              return "Active";
    if (diffDays >= 0 && diffDays < 30) return "Expired";
    return "Left";
  };

  const openEditModal = (student) => {
    setEditStudent({ ...student });
    setEditStep(1);
    setPaymentData({
      amount_paid: student.payment?.amount_paid || "",
      date_paid:   student.payment?.date_paid   || "",
      duration:    student.payment?.duration    || "",
      method:      student.payment?.method      || "cash",
      reference:   student.payment?.reference   || "",
    });
  };

  const handleUpdateStudent = () => setEditStep(2);

  const openPaymentHistory = (student) => setSelectedStudent(student);

  // ── Payment actions ────────────────────────────────────────────
  const updatePayment = async () => {
    try {
      await API.put(`/payments/${editPayment.id}`, editPayment);
      queryClient.invalidateQueries({ queryKey: ["payments", selectedStudent?.id] });
      setEditPayment(null);
      fetchStudents();
      triggerRefresh();
    } catch (error) {
      console.error("Update payment failed:", error);
    }
  };

  const deletePayment = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`https://riseway-app.onrender.com/api/payments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      queryClient.invalidateQueries({ queryKey: ["payments", selectedStudent?.id] });
    } catch (error) {
      console.log("Delete failed:", error.response?.data || error);
    }
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      await API.delete(`/students/${deleteStudent.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteStudent(null);
      fetchStudents();
      triggerRefresh();
    } catch (err) {
      console.log(err.response?.data || err);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────
  const filteredStudents = students.filter((s) => {
    const text          = search.toLowerCase();
    const studentStatus = getStudentStatus(s.payment?.date_paid, s.payment?.duration);
    const matchesSearch =
      !text ||
      s.name?.toLowerCase().includes(text) ||
      s.course?.toLowerCase().includes(text) ||
      String(s.phone || "").toLowerCase().includes(text);

    return (
      matchesSearch &&
      (statusFilter    === "All" || studentStatus === statusFilter) &&
      (modeFilter      === "All" || s.mode        === modeFilter) &&
      (levelFilter     === "All" || s.level       === levelFilter) &&
      (membershipFilter === "All" ||
        (membershipFilter === "Yes" && s.membership) ||
        (membershipFilter === "No"  && !s.membership))
    );
  });

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div>
      <h2>Students List</h2>

      {loading ? (
        <StudentListSkeleton />
      ) : (
        <>
          <SearchFilter
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            membershipFilter={membershipFilter}
            setMembershipFilter={setMembershipFilter}
            modeFilter={modeFilter}
            setModeFilter={setModeFilter}
            levelFilter={levelFilter}
            setLevelFilter={setLevelFilter}
            totalStudents={filteredStudents.length}
          />

          <StudentTable
            students={filteredStudents}
            onHistory={openPaymentHistory}
            onEdit={canManageStudents ? openEditModal : null}
            onDelete={canManageStudents ? setDeleteStudent : null}
            canManageStudents={canManageStudents}
            canViewBalance={canViewBalance}
            getStudentStatus={getStudentStatus}
          />
        </>
      )}

      {editStudent && (
        <EditStudentRegistration
          editStudent={editStudent}
          setEditStudent={setEditStudent}
          editStep={editStep}
          setEditStep={setEditStep}
          paymentData={paymentData}
          setPaymentData={setPaymentData}
          handleUpdateStudent={handleUpdateStudent}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
          }}
        />
      )}

      {selectedStudent && (
        <PaymentHistoryModal
          selectedStudent={selectedStudent}
          setSelectedStudent={setSelectedStudent}
          paymentHistory={paymentHistory}
          loading={historyLoading}
          editPayment={editPayment}
          setEditPayment={setEditPayment}
          updatePayment={updatePayment}
          deletePayment={deletePayment}
        />
      )}

      {deleteStudent && (
        <DeleteModal
          deleteStudent={deleteStudent}
          setDeleteStudent={setDeleteStudent}
          confirmDelete={confirmDelete}
        />
      )}
    </div>
  );
}

export default StudentList;