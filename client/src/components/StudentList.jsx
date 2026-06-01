import { useEffect, useState, useCallback } from "react";
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
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [membershipFilter, setMembershipFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");

  const [editStudent, setEditStudent] = useState(null);
  const [editStep, setEditStep] = useState(1);

  const [paymentData, setPaymentData] = useState({
    id: null,
    amount: "",
    date_paid: "",
    duration: "",
  });

  const [deleteStudent, setDeleteStudent] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [editPayment, setEditPayment] = useState(null);

  const role = localStorage.getItem("role");
  const canManageStudents = role === "receptionist";
  const canViewBalance = role === "admin" || role === "director" || role === "receptionist";

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/students");
      setStudents(res.data);
    } catch {
      alert("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const getStudentStatus = (datePaid, duration) => {
    if (!datePaid) return "Left";
    const paymentDate = new Date(datePaid);
    const expiryDate = new Date(paymentDate);
    expiryDate.setMonth(expiryDate.getMonth() + Number(duration || 1));
    const today = new Date();
    const diffDays = (today - expiryDate) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return "Active";
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


  const openPaymentHistory = async (student) => {
    try {
      setSelectedStudent(student);
      const res = await API.get(`/payments/${student.id}`);
      setPaymentHistory(res.data);
    } catch (error) {
      console.error("Failed to load payments:", error);
      setPaymentHistory([]);
    }
  };

  const updatePayment = async () => {
    try {
      await API.put(`/payments/${editPayment.id}`, editPayment);
      setPaymentHistory((prev) =>
        prev.map((p) => (p.id === editPayment.id ? editPayment : p))
      );
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
      setPaymentHistory((prev) => prev.filter((p) => p.id !== id));
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

  const filteredStudents = students.filter((s) => {
    const text = search.toLowerCase();
    const studentStatus = getStudentStatus(s.payment?.date_paid, s.payment?.duration);
    const matchesSearch =
      !text ||
      s.name?.toLowerCase().includes(text) ||
      s.course?.toLowerCase().includes(text) ||
      String(s.phone || "").toLowerCase().includes(text);

    return (
      matchesSearch &&
      (statusFilter === "All" || studentStatus === statusFilter) &&
      (modeFilter === "All" || s.mode === modeFilter) &&
      (levelFilter === "All" || s.level === levelFilter) &&
      (membershipFilter === "All" ||
        (membershipFilter === "Yes" && s.membership) ||
        (membershipFilter === "No" && !s.membership))
    );
  });

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
          onSuccess={(updatedStudent) => {
            setStudents(prev =>
              prev.map(s => s.id === updatedStudent.id ? updatedStudent : s)
            ); 
          }}
        />
      )}

      {selectedStudent && (
        <PaymentHistoryModal
          selectedStudent={selectedStudent}
          setSelectedStudent={setSelectedStudent}
          paymentHistory={paymentHistory}
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