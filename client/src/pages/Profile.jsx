import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Layout/Header";
import api from "../utils/api";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState(user?.collegeId || "");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.get("/colleges").then((res) => {
      setColleges(res.data.colleges);
    }).catch(err => console.error(err));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await updateProfile({ collegeId: selectedCollegeId || null });
      setSuccess("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const currentCollege = colleges.find(c => c.id === user?.collegeId);

  return (
    <>
      <Header />
      <div className="page-content">
        <h2 className="page-title" style={{ marginBottom: 32 }}>User Profile</h2>
        
        {error && (
          <div className="form-error" style={{ marginBottom: 16, maxWidth: 600 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginBottom: 16, maxWidth: 600, padding: 12, borderRadius: 8, background: "rgba(74, 222, 128, 0.1)", color: "#4ade80", border: "1px solid rgba(74, 222, 128, 0.2)" }}>
            {success}
          </div>
        )}

        <div className="file-card" style={{ height: "auto", cursor: "default", maxWidth: 600 }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 24 }}>
            <div 
              style={{ 
                width: 80, 
                height: 80, 
                borderRadius: "50%", 
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: "bold",
                color: "white"
              }}
            >
              {user?.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <h3 style={{ fontSize: 24, marginBottom: 4 }}>{user?.name}</h3>
              <p style={{ color: "var(--color-on-surface-variant)" }}>{user?.email}</p>
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: "var(--color-on-surface-variant)", textTransform: "uppercase" }}>Role</span>
              <p style={{ fontWeight: 500, marginTop: 4 }}>{user?.role}</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: "var(--color-on-surface-variant)", textTransform: "uppercase" }}>Status</span>
              <p style={{ fontWeight: 500, marginTop: 4 }}>
                <span className={`role-badge ${user?.status?.toLowerCase()}`}>
                  {user?.status}
                </span>
              </p>
            </div>
            {user?.year && (
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "var(--color-on-surface-variant)", textTransform: "uppercase" }}>Year</span>
                <p style={{ fontWeight: 500, marginTop: 4 }}>{user?.year}</p>
              </div>
            )}

            <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 8, gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--color-on-surface-variant)", textTransform: "uppercase" }}>College</span>
                {!isEditing ? (
                  <button className="btn-ghost" onClick={() => setIsEditing(true)} style={{ fontSize: 12, padding: "2px 8px" }}>
                    Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-ghost" onClick={() => { setIsEditing(false); setSelectedCollegeId(user?.collegeId || ""); }} style={{ fontSize: 12, padding: "2px 8px" }}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4 }}>
                      {loading ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
              
              {!isEditing ? (
                <p style={{ fontWeight: 500 }}>
                  {currentCollege ? `${currentCollege.name} (${currentCollege.code})` : "No college selected"}
                </p>
              ) : (
                <select
                  className="form-select"
                  value={selectedCollegeId}
                  onChange={(e) => setSelectedCollegeId(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">Select College</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
