import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="pending-page">
      <span className="material-symbols-outlined pending-icon">hourglass_top</span>
      <h2 className="pending-title">Account Pending Approval</h2>
      <p className="pending-text">
        Your senior account is awaiting admin approval. You&apos;ll be able to
        upload and manage resources once approved. Check back soon!
      </p>
      <button
        className="btn btn-secondary"
        onClick={handleLogout}
        style={{ marginTop: 24 }}
      >
        Sign Out
      </button>
    </div>
  );
}
