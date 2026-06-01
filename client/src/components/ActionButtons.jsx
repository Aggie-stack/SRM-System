import { FaEdit, FaTrash } from "react-icons/fa";

function ActionButtons({ student, onHistory, onEdit, onDelete }) {
  return (
    <div className="actions-cell">
      {/* Payment History — visible to all roles */}
      <button
        className="icon-btn"
        data-tooltip="Payment History"
        onClick={() => onHistory(student)}
      >
        💰
      </button>

      {/* Edit & Delete — only rendered when handlers are provided (receptionist only) */}
      {onEdit && (
        <button
          className="icon-btn edit"
          data-tooltip="Edit Student"
          onClick={() => onEdit(student)}
        >
          <FaEdit />
        </button>
      )}

      {onDelete && (
        <button
          className="icon-btn delete"
          data-tooltip="Delete Student"
          onClick={() => onDelete(student)}
        >
          <FaTrash />
        </button>
      )}
    </div>
  );
}

export default ActionButtons;