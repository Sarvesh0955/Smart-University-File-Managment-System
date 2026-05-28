import { useAuth } from "../context/AuthContext";

export default function PendingApproval() {
  const { logout } = useAuth();

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
        onClick={logout}
        style={{ marginTop: 24 }}
      >
        Sign Out
      </button>
    </div>
  );
}
