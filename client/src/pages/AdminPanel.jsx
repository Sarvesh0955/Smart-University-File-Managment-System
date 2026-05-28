import { useState, useEffect } from "react";
import api from "../utils/api";
import Header from "../components/Layout/Header";
import { formatDate } from "../utils/helpers";

export default function AdminPanel() {
  const [tab, setTab] = useState("structure");

  // Pending users
  const [pendingUsers, setPendingUsers] = useState([]);

  // Structure data
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Selection
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedSem, setSelectedSem] = useState("");

  // Add forms
  const [newCollege, setNewCollege] = useState({ name: "", code: "" });
  const [newDept, setNewDept] = useState({ name: "", code: "" });
  const [newSemNumber, setNewSemNumber] = useState("");
  const [newSubject, setNewSubject] = useState({ name: "", code: "" });

  const [error, setError] = useState("");

  const generateShortName = (name) => {
    if (!name) return "";
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, "");
    const words = clean.trim().split(/\s+/).filter(w => {
      const lower = w.toLowerCase();
      return !["and", "of", "the", "for", "in", "to"].includes(lower);
    });
    
    if (words.length === 0) return "";
    if (words.length === 1) {
      return words[0].substring(0, 4).toUpperCase();
    }
    return words.map(w => w[0]).join("").toUpperCase();
  };

  useEffect(() => {
    loadColleges();
    loadPending();
  }, []);

  useEffect(() => {
    if (selectedCollege) {
      api.get(`/departments?collegeId=${selectedCollege}`).then((r) => setDepartments(r.data.departments));
    } else {
      setDepartments([]);
    }
    setSelectedDept("");
  }, [selectedCollege]);

  useEffect(() => {
    if (selectedDept) {
      api.get(`/semesters?departmentId=${selectedDept}`).then((r) => setSemesters(r.data.semesters));
    } else {
      setSemesters([]);
    }
    setSelectedSem("");
  }, [selectedDept]);

  useEffect(() => {
    if (selectedSem) {
      api.get(`/subjects?semesterId=${selectedSem}`).then((r) => setSubjects(r.data.subjects));
    } else {
      setSubjects([]);
    }
  }, [selectedSem]);

  const loadColleges = () => api.get("/colleges").then((r) => setColleges(r.data.colleges));
  const loadPending = () => api.get("/auth/pending").then((r) => setPendingUsers(r.data.users));

  const handleApprove = async (id) => {
    await api.patch(`/auth/approve/${id}`);
    loadPending();
  };

  const handleReject = async (id) => {
    if (!confirm("Reject this user?")) return;
    await api.delete(`/auth/reject/${id}`);
    loadPending();
  };

  const addCollege = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/colleges", newCollege);
      setNewCollege({ name: "", code: "" });
      loadColleges();
    } catch (err) {
      setError(err.response?.data?.error || "Failed");
    }
  };

  const addDept = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/departments", { ...newDept, collegeId: selectedCollege });
      setNewDept({ name: "", code: "" });
      api.get(`/departments?collegeId=${selectedCollege}`).then((r) => setDepartments(r.data.departments));
    } catch (err) {
      setError(err.response?.data?.error || "Failed");
    }
  };

  const addSemester = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/semesters", { number: parseInt(newSemNumber), departmentId: selectedDept });
      setNewSemNumber("");
      api.get(`/semesters?departmentId=${selectedDept}`).then((r) => setSemesters(r.data.semesters));
    } catch (err) {
      setError(err.response?.data?.error || "Failed");
    }
  };

  const addSubject = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/subjects", {
        ...newSubject,
        semesterId: selectedSem,
        departmentId: selectedDept,
      });
      setNewSubject({ name: "", code: "" });
      api.get(`/subjects?semesterId=${selectedSem}`).then((r) => setSubjects(r.data.subjects));
    } catch (err) {
      setError(err.response?.data?.error || "Failed");
    }
  };

  const deleteItem = async (endpoint, id, reload) => {
    if (!confirm("Delete this item and all its children?")) return;
    try {
      await api.delete(`/${endpoint}/${id}`);
      if (endpoint === "colleges" && id === selectedCollege) {
        setSelectedCollege("");
        setSelectedDept("");
        setSelectedSem("");
      }
      if (endpoint === "departments" && id === selectedDept) {
        setSelectedDept("");
        setSelectedSem("");
      }
      if (endpoint === "semesters" && id === selectedSem) {
        setSelectedSem("");
      }
      reload();
    } catch (err) {
      setError(err.response?.data?.error || "Failed");
    }
  };

  return (
    <>
      <Header />
      <div className="page-content">
        <h2 className="page-title">Admin Panel</h2>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === "structure" ? "active" : ""}`}
            onClick={() => setTab("structure")}
          >
            Academic Structure
          </button>
          <button
            className={`admin-tab ${tab === "approvals" ? "active" : ""}`}
            onClick={() => setTab("approvals")}
          >
            Pending Approvals ({pendingUsers.length})
          </button>
        </div>

        {error && (
          <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {/* Structure Tab */}
        {tab === "structure" && (
          <div className="admin-panel">
            {/* Colleges */}
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Colleges</h3>
            <form className="admin-add-form" onSubmit={addCollege}>
              <input
                className="form-input"
                placeholder="College Name"
                value={newCollege.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCollege(prev => ({
                    ...prev,
                    name: val,
                    code: prev.code === generateShortName(prev.name) ? generateShortName(val) : prev.code
                  }));
                }}
                required
              />
              <input
                className="form-input"
                placeholder="Short Name"
                value={newCollege.code}
                onChange={(e) => setNewCollege({ ...newCollege, code: e.target.value })}
                required
                style={{ maxWidth: 120 }}
              />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
            {colleges.map((c) => (
              <div key={c.id} className="admin-list-item">
                <div className="admin-list-item-info">
                  <span className="admin-list-item-name">{c.name}</span>
                  <span className="admin-list-item-meta">Short Name: {c.code} • {c._count?.departments || 0} departments</span>
                </div>
                <div className="admin-list-item-actions">
                  <button
                    className={`btn btn-secondary ${selectedCollege === c.id ? "active" : ""}`}
                    onClick={() => setSelectedCollege(selectedCollege === c.id ? "" : c.id)}
                    style={{ fontSize: 12 }}
                  >
                    {selectedCollege === c.id ? "Close" : "Manage"}
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteItem("colleges", c.id, loadColleges)} style={{ fontSize: 12 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* Departments */}
            {selectedCollege && (
              <>
                <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Departments</h3>
                <form className="admin-add-form" onSubmit={addDept}>
                  <input className="form-input" placeholder="Department Name" value={newDept.name} onChange={(e) => {
                    const val = e.target.value;
                    setNewDept(prev => ({
                      ...prev,
                      name: val,
                      code: prev.code === generateShortName(prev.name) ? generateShortName(val) : prev.code
                    }));
                  }} required />
                  <input className="form-input" placeholder="Short Name" value={newDept.code} onChange={(e) => setNewDept({ ...newDept, code: e.target.value })} required style={{ maxWidth: 120 }} />
                  <button className="btn btn-primary" type="submit">Add</button>
                </form>
                {departments.map((d) => (
                  <div key={d.id} className="admin-list-item">
                    <div className="admin-list-item-info">
                      <span className="admin-list-item-name">{d.name} ({d.code})</span>
                      <span className="admin-list-item-meta">{d._count?.semesters || 0} semesters</span>
                    </div>
                    <div className="admin-list-item-actions">
                      <button className={`btn btn-secondary`} onClick={() => setSelectedDept(selectedDept === d.id ? "" : d.id)} style={{ fontSize: 12 }}>
                        {selectedDept === d.id ? "Close" : "Manage"}
                      </button>
                      <button className="btn btn-danger" onClick={() => deleteItem("departments", d.id, () => api.get(`/departments?collegeId=${selectedCollege}`).then((r) => setDepartments(r.data.departments)))} style={{ fontSize: 12 }}>Delete</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Semesters */}
            {selectedDept && (
              <>
                <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Semesters</h3>
                <form className="admin-add-form" onSubmit={addSemester}>
                  <input className="form-input" type="number" placeholder="Semester Number" min="1" max="12" value={newSemNumber} onChange={(e) => setNewSemNumber(e.target.value)} required style={{ maxWidth: 200 }} />
                  <button className="btn btn-primary" type="submit">Add</button>
                </form>
                {semesters.map((s) => (
                  <div key={s.id} className="admin-list-item">
                    <div className="admin-list-item-info">
                      <span className="admin-list-item-name">Semester {s.number}</span>
                      <span className="admin-list-item-meta">{s._count?.subjects || 0} subjects</span>
                    </div>
                    <div className="admin-list-item-actions">
                      <button className="btn btn-secondary" onClick={() => setSelectedSem(selectedSem === s.id ? "" : s.id)} style={{ fontSize: 12 }}>
                        {selectedSem === s.id ? "Close" : "Manage"}
                      </button>
                      <button className="btn btn-danger" onClick={() => deleteItem("semesters", s.id, () => api.get(`/semesters?departmentId=${selectedDept}`).then((r) => setSemesters(r.data.semesters)))} style={{ fontSize: 12 }}>Delete</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Subjects */}
            {selectedSem && (
              <>
                <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Subjects</h3>
                <form className="admin-add-form" onSubmit={addSubject}>
                  <input className="form-input" placeholder="Subject Name" value={newSubject.name} onChange={(e) => {
                    const val = e.target.value;
                    setNewSubject(prev => ({
                      ...prev,
                      name: val,
                      code: prev.code === generateShortName(prev.name) ? generateShortName(val) : prev.code
                    }));
                  }} required />
                  <input className="form-input" placeholder="Short Name" value={newSubject.code} onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })} required style={{ maxWidth: 120 }} />
                  <button className="btn btn-primary" type="submit">Add</button>
                </form>
                {subjects.map((sub) => (
                  <div key={sub.id} className="admin-list-item">
                    <div className="admin-list-item-info">
                      <span className="admin-list-item-name">{sub.name} ({sub.code})</span>
                      <span className="admin-list-item-meta">{sub._count?.resources || 0} resources</span>
                    </div>
                    <div className="admin-list-item-actions">
                      <button className="btn btn-danger" onClick={() => deleteItem("subjects", sub.id, () => api.get(`/subjects?semesterId=${selectedSem}`).then((r) => setSubjects(r.data.subjects)))} style={{ fontSize: 12 }}>Delete</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Approvals Tab */}
        {tab === "approvals" && (
          <div className="admin-panel">
            {pendingUsers.length === 0 ? (
              <div className="empty-state">
                <span className="material-symbols-outlined empty-state-icon">check_circle</span>
                <h3 className="empty-state-title">All caught up!</h3>
                <p className="empty-state-text">No pending approvals.</p>
              </div>
            ) : (
              pendingUsers.map((u) => (
                <div key={u.id} className="admin-list-item">
                  <div className="admin-list-item-info">
                    <span className="admin-list-item-name">{u.name}</span>
                    <span className="admin-list-item-meta">
                      {u.email} • Year {u.year || "—"} • Registered {formatDate(u.createdAt)}
                    </span>
                  </div>
                  <div className="admin-list-item-actions">
                    <button className="btn btn-primary" onClick={() => handleApprove(u.id)} style={{ fontSize: 12 }}>
                      Approve
                    </button>
                    <button className="btn btn-danger" onClick={() => handleReject(u.id)} style={{ fontSize: 12 }}>
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
