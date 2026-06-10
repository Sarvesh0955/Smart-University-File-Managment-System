import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Layout/Header";
import api from "../utils/api";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  
  const [selectedCollegeId, setSelectedCollegeId] = useState(user?.collegeId || "");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(user?.departmentId || "");
  const [selectedSemesterId, setSelectedSemesterId] = useState(user?.semesterId || "");
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.get("/colleges").then((res) => {
      setColleges(res.data.colleges);
    }).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedCollegeId) {
      api.get(`/departments?collegeId=${selectedCollegeId}`).then((res) => {
        setDepartments(res.data.departments);
      }).catch(err => console.error(err));
    } else {
      setDepartments([]);
      setSelectedDepartmentId("");
    }
  }, [selectedCollegeId]);

  useEffect(() => {
    if (selectedDepartmentId) {
      api.get(`/semesters?departmentId=${selectedDepartmentId}`).then((res) => {
        setSemesters(res.data.semesters);
      }).catch(err => console.error(err));
    } else {
      setSemesters([]);
      setSelectedSemesterId("");
    }
  }, [selectedDepartmentId]);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await updateProfile({ 
        collegeId: selectedCollegeId || null,
        departmentId: selectedDepartmentId || null,
        semesterId: selectedSemesterId || null
      });
      setSuccess("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const currentCollege = colleges.find(c => c.id === user?.collegeId);
  const currentDepartment = departments.find(d => d.id === user?.departmentId);
  const currentSemester = semesters.find(s => s.id === user?.semesterId);

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
                    <button className="btn-ghost" onClick={() => { 
                      setIsEditing(false); 
                      setSelectedCollegeId(user?.collegeId || ""); 
                      setSelectedDepartmentId(user?.departmentId || ""); 
                      setSelectedSemesterId(user?.semesterId || ""); 
                    }} style={{ fontSize: 12, padding: "2px 8px" }}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4 }}>
                      {loading ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
              
              {!isEditing ? (
                <>
                  <p style={{ fontWeight: 500, marginBottom: 8 }}>
                    <span style={{ color: "var(--color-on-surface-variant)", fontSize: 13, marginRight: 8 }}>College:</span>
                    {currentCollege ? `${currentCollege.name} (${currentCollege.code})` : "Not set"}
                  </p>
                  <p style={{ fontWeight: 500, marginBottom: 8 }}>
                    <span style={{ color: "var(--color-on-surface-variant)", fontSize: 13, marginRight: 8 }}>Branch:</span>
                    {user?.departmentId ? (currentDepartment?.name || "Loading...") : "Not set"}
                  </p>
                  <p style={{ fontWeight: 500 }}>
                    <span style={{ color: "var(--color-on-surface-variant)", fontSize: 13, marginRight: 8 }}>Semester:</span>
                    {user?.semesterId ? (currentSemester?.number ? `Semester ${currentSemester.number}` : "Loading...") : "Not set"}
                  </p>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  
                  <select
                    className="form-select"
                    value={selectedDepartmentId}
                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                    disabled={!selectedCollegeId}
                  >
                    <option value="">Select Branch</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                  
                  <select
                    className="form-select"
                    value={selectedSemesterId}
                    onChange={(e) => setSelectedSemesterId(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                    disabled={!selectedDepartmentId}
                  >
                    <option value="">Select Semester</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        Semester {s.number}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
