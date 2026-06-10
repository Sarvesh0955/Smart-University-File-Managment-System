import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import api from "../utils/api";
import Header from "../components/Layout/Header";
import { formatBytes, formatDate, getFileIcon, getFileIconType, CATEGORIES } from "../utils/helpers";

export default function AutoSort() {
  const [activeTab, setActiveTab] = useState("upload"); // upload | processing | review
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Data for processing / review tabs
  const [pendingResources, setPendingResources] = useState([]);
  const [reviewResources, setReviewResources] = useState([]);
  const [historyResources, setHistoryResources] = useState([]);
  const [queueStats, setQueueStats] = useState({ waiting: 0, active: 0 });
  const [loading, setLoading] = useState(false);

  // Manual classify modal
  const [classifyModal, setClassifyModal] = useState(null);
  const [allSubjects, setAllSubjects] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("NOTES");
  const [classifying, setClassifying] = useState(false);

  // Dropzone
  const onDrop = useCallback((acceptedFiles) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    setError("");
    setSuccessMsg("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 100 * 1024 * 1024,
  });

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Fetch pending/review resources
  const fetchPendingData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [pendingRes, reviewRes, historyRes] = await Promise.all([
        api.get("/resources/pending-review?status=PENDING"),
        api.get("/resources/pending-review?status=NEEDS_REVIEW"),
        api.get("/resources/auto-history"),
      ]);
      setPendingResources(pendingRes.data.resources);
      setReviewResources(reviewRes.data.resources);
      setHistoryResources(historyRes.data.resources);
      setQueueStats(pendingRes.data.queueStats || { waiting: 0, active: 0 });
    } catch (err) {
      console.error("Failed to fetch pending data:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Fetch all subjects for the classify modal
  const fetchSubjects = async () => {
    try {
      // Get all colleges first, then departments, semesters, subjects
      const colleges = await api.get("/colleges");
      const allSubs = [];
      for (const college of colleges.data.colleges) {
        const depts = await api.get(`/departments?collegeId=${college.id}`);
        for (const dept of depts.data.departments) {
          const sems = await api.get(`/semesters?departmentId=${dept.id}`);
          for (const sem of sems.data.semesters) {
            const subs = await api.get(`/subjects?semesterId=${sem.id}`);
            for (const sub of subs.data.subjects) {
              allSubs.push({
                ...sub,
                semesterNumber: sem.number,
                departmentName: dept.name,
                collegeName: college.name,
              });
            }
          }
        }
      }
      setAllSubjects(allSubs);
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "processing" || activeTab === "review" || activeTab === "history") {
      fetchPendingData(false);
    }
  }, [activeTab]);

  // Auto-refresh processing tab every 5 seconds
  useEffect(() => {
    if (activeTab !== "processing" && activeTab !== "review" && activeTab !== "history") return;
    const interval = setInterval(() => fetchPendingData(true), 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Fetch subjects when classify modal opens
  useEffect(() => {
    if (classifyModal && allSubjects.length === 0) {
      fetchSubjects();
    }
  }, [classifyModal]);

  // Upload handler
  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setSuccessMsg("");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const res = await api.post("/resources/auto-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      setSuccessMsg(res.data.message);
      setFiles([]);
      setProgress(0);
      // Switch to processing tab
      setTimeout(() => setActiveTab("processing"), 1500);
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Manual classify handler
  const handleManualClassify = async () => {
    if (!selectedSubjectIds.length || !selectedCategory || !classifyModal) return;
    setClassifying(true);
    try {
      if (classifyModal.classStatus === "CLASSIFIED") {
        await api.patch(`/resources/${classifyModal.id}/move`, {
          subjectIds: selectedSubjectIds,
          category: selectedCategory,
        });
      } else {
        await api.patch(`/resources/${classifyModal.id}/classify`, {
          subjectIds: selectedSubjectIds,
          category: selectedCategory,
        });
      }
      setClassifyModal(null);
      setSelectedSubjectIds([]);
      setSelectedCategory("NOTES");
      fetchPendingData();
    } catch (err) {
      setError(err.response?.data?.error || "Classification failed");
    } finally {
      setClassifying(false);
    }
  };

  // Delete handler for unclassified files
  const handleDelete = async (resource) => {
    if (!confirm(`Delete "${resource.name}" permanently?`)) return;
    try {
      await api.delete(`/resources/${resource.id}`);
      fetchPendingData();
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  const totalPending = pendingResources.length + reviewResources.length;

  return (
    <>
      <Header />

      <div className="page-content">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h2 className="page-title">
              <span className="material-symbols-outlined" style={{ fontSize: 28, marginRight: 8, verticalAlign: "middle", color: "var(--color-primary)" }}>
                auto_awesome
              </span>
              Auto-Sort Documents
            </h2>
            <p className="page-subtitle">
              Upload files and let AI automatically classify and organize them
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="autosort-tabs">
          <button
            className={`autosort-tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            <span className="material-symbols-outlined">cloud_upload</span>
            Upload
          </button>
          <button
            className={`autosort-tab ${activeTab === "processing" ? "active" : ""}`}
            onClick={() => setActiveTab("processing")}
          >
            <span className="material-symbols-outlined">pending</span>
            Processing
            {pendingResources.length > 0 && (
              <span className="autosort-tab-badge pulse">{pendingResources.length}</span>
            )}
          </button>
          <button
            className={`autosort-tab ${activeTab === "review" ? "active" : ""}`}
            onClick={() => setActiveTab("review")}
          >
            <span className="material-symbols-outlined">rate_review</span>
            Needs Review
            {reviewResources.length > 0 && (
              <span className="autosort-tab-badge">{reviewResources.length}</span>
            )}
          </button>
          <button
            className={`autosort-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <span className="material-symbols-outlined">history</span>
            History
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div className="autosort-upload-section">
            {error && (
              <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>
            )}
            {successMsg && (
              <div className="autosort-success">
                <span className="material-symbols-outlined">check_circle</span>
                {successMsg}
              </div>
            )}

            <div
              {...getRootProps()}
              className={`autosort-dropzone ${isDragActive ? "active" : ""}`}
            >
              <input {...getInputProps()} />
              <div className="autosort-dropzone-content">
                <div className="autosort-dropzone-icon">
                  <span className="material-symbols-outlined">
                    {isDragActive ? "download" : "cloud_upload"}
                  </span>
                </div>
                <h3>
                  {isDragActive ? "Drop files here..." : "Drag & drop files for AI sorting"}
                </h3>
                <p>
                  Supports PDF, DOCX, PPTX, Images, and more • Up to 100 MB per file
                </p>
                <button className="btn btn-secondary" style={{ marginTop: 16 }}>
                  <span className="material-symbols-outlined">folder_open</span>
                  Browse Files
                </button>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="autosort-file-list">
                <div className="autosort-file-list-header">
                  <span>{files.length} file{files.length !== 1 ? "s" : ""} selected</span>
                  <span className="autosort-file-list-size">
                    {formatBytes(files.reduce((sum, f) => sum + f.size, 0))} total
                  </span>
                </div>
                {files.map((file, index) => (
                  <div key={index} className="autosort-file-item">
                    <div className={`file-row-icon ${getFileIconType(file.type)}`}>
                      <span className="material-symbols-outlined">
                        {getFileIcon(file.type)}
                      </span>
                    </div>
                    <div className="autosort-file-info">
                      <div className="autosort-file-name">{file.name}</div>
                      <div className="autosort-file-meta">{formatBytes(file.size)}</div>
                    </div>
                    {!uploading && (
                      <button className="btn-icon" onClick={() => removeFile(index)}>
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    )}
                  </div>
                ))}

                {uploading && (
                  <div className="upload-progress" style={{ marginTop: 12 }}>
                    <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                )}

                <div className="autosort-file-list-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setFiles([])}
                    disabled={uploading}
                  >
                    Clear All
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0}
                  >
                    <span className="material-symbols-outlined">auto_awesome</span>
                    {uploading ? `Uploading ${progress}%` : `Upload & Auto-Sort ${files.length} file(s)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Tab */}
        {activeTab === "processing" && (
          <div className="autosort-status-section">
            {/* Queue Stats */}
            <div className="autosort-stats-bar">
              <div className="autosort-stat">
                <span className="material-symbols-outlined">schedule</span>
                <span>{queueStats.waiting} in queue</span>
              </div>
              <div className="autosort-stat">
                <span className="material-symbols-outlined">sync</span>
                <span>{queueStats.active} processing</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={fetchPendingData}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                Refresh
              </button>
            </div>

            {loading && (
              <div className="flex-center" style={{ padding: 64 }}>
                <div className="spinner" />
              </div>
            )}

            {!loading && pendingResources.length === 0 && (
              <div className="empty-state">
                <span className="material-symbols-outlined empty-state-icon">task_alt</span>
                <h3 className="empty-state-title">All caught up!</h3>
                <p className="empty-state-text">No files are currently being processed.</p>
              </div>
            )}

            {!loading && pendingResources.length > 0 && (
              <div className="autosort-resource-list">
                {pendingResources.map((r) => (
                  <div key={r.id} className="autosort-resource-card processing">
                    <div className={`file-row-icon ${getFileIconType(r.mimeType)}`}>
                      <span className="material-symbols-outlined">{getFileIcon(r.mimeType)}</span>
                    </div>
                    <div className="autosort-resource-info">
                      <div className="autosort-resource-name">{r.name}</div>
                      <div className="autosort-resource-meta">
                        {formatBytes(r.size)} • {formatDate(r.createdAt)}
                      </div>
                    </div>
                    <div className="autosort-status-badge pending">
                      <div className="autosort-spinner" />
                      AI Processing
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === "review" && (
          <div className="autosort-status-section">
            {loading && (
              <div className="flex-center" style={{ padding: 64 }}>
                <div className="spinner" />
              </div>
            )}

            {!loading && reviewResources.length === 0 && (
              <div className="empty-state">
                <span className="material-symbols-outlined empty-state-icon">verified</span>
                <h3 className="empty-state-title">No files need review</h3>
                <p className="empty-state-text">All uploaded files have been successfully classified by AI.</p>
              </div>
            )}

            {!loading && reviewResources.length > 0 && (
              <div className="autosort-resource-list">
                {reviewResources.map((r) => (
                  <div key={r.id} className="autosort-resource-card review">
                    <div className={`file-row-icon ${getFileIconType(r.mimeType)}`}>
                      <span className="material-symbols-outlined">{getFileIcon(r.mimeType)}</span>
                    </div>
                    <div className="autosort-resource-info">
                      <div className="autosort-resource-name">{r.name}</div>
                      <div className="autosort-resource-meta">
                        {formatBytes(r.size)} • {formatDate(r.createdAt)}
                        {r.aiConfidence != null && (
                          <span className="autosort-confidence">
                            • AI Confidence: {r.aiConfidence}%
                          </span>
                        )}
                        {r.category && (
                          <span className="autosort-suggestion">
                            • Suggested Category: {r.category}
                          </span>
                        )}
                        {r.subjects && r.subjects.length > 0 && (
                          <span className="autosort-suggestion">
                            • Suggested Subjects: {r.subjects.map(s => s.name).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="autosort-resource-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setClassifyModal(r);
                          if (r.category) setSelectedCategory(r.category);
                          if (r.subjects && r.subjects.length > 0) {
                            setSelectedSubjectIds(r.subjects.map(s => s.id));
                          } else {
                            setSelectedSubjectIds([]);
                          }
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        Classify
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(r)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="autosort-status-section">
            {loading && (
              <div className="flex-center" style={{ padding: 64 }}>
                <div className="spinner" />
              </div>
            )}

            {!loading && historyResources.length === 0 && (
              <div className="empty-state">
                <span className="material-symbols-outlined empty-state-icon">history</span>
                <h3 className="empty-state-title">No history yet</h3>
                <p className="empty-state-text">Files classified by AI will appear here.</p>
              </div>
            )}

            {!loading && historyResources.length > 0 && (
              <div className="autosort-resource-list">
                {historyResources.map((r) => (
                  <div key={r.id} className="autosort-resource-card review">
                    <div className={`file-row-icon ${getFileIconType(r.mimeType)}`}>
                      <span className="material-symbols-outlined">{getFileIcon(r.mimeType)}</span>
                    </div>
                    <div className="autosort-resource-info">
                      <div className="autosort-resource-name">{r.name}</div>
                      <div className="autosort-resource-meta">
                        {formatBytes(r.size)} • {formatDate(r.createdAt)}
                        <span className="autosort-confidence">
                          • AI Confidence: {r.aiConfidence}%
                        </span>
                        {r.category && (
                          <span className="autosort-suggestion">
                            • Category: {r.category}
                          </span>
                        )}
                        {r.subjects && r.subjects.length > 0 && (
                          <span className="autosort-suggestion">
                            • Subjects: {r.subjects.map(s => s.name).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="autosort-resource-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setClassifyModal(r);
                          if (r.category) setSelectedCategory(r.category);
                          if (r.subjects && r.subjects.length > 0) {
                            setSelectedSubjectIds(r.subjects.map(s => s.id));
                          } else {
                            setSelectedSubjectIds([]);
                          }
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        Edit Location
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Classify Modal */}
      {classifyModal && (
        <div className="modal-overlay" onClick={() => setClassifyModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{classifyModal.classStatus === "CLASSIFIED" ? "Edit Location" : "Classify Document"}</h3>
              <button className="btn-icon" onClick={() => setClassifyModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="autosort-classify-file">
                <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>
                  {getFileIcon(classifyModal.mimeType)}
                </span>
                <span>{classifyModal.name}</span>
              </div>

              {classifyModal.aiConfidence != null && (
                <div className="autosort-ai-hint">
                  <span className="material-symbols-outlined">smart_toy</span>
                  AI suggested <strong>{classifyModal.category || "Unknown"}</strong> {classifyModal.subjects && classifyModal.subjects.length > 0 && <span>for <strong>{classifyModal.subjects.map(s => s.name).join(", ")}</strong></span>} with{" "}
                  <strong>{classifyModal.aiConfidence}%</strong> confidence
                </div>
              )}

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Subjects (Select multiple if needed)</label>
                {allSubjects.length === 0 ? (
                  <div style={{ padding: 12, color: "var(--color-on-surface-variant)", fontSize: 13 }}>
                    Loading subjects...
                  </div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--color-surface-variant)", borderRadius: 6, padding: 8 }}>
                    {allSubjects.map((sub) => (
                      <label key={sub.id} style={{ display: "block", marginBottom: 6, fontSize: 14, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.includes(sub.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjectIds([...selectedSubjectIds, sub.id]);
                            } else {
                              setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== sub.id));
                            }
                          }}
                          style={{ marginRight: 8 }}
                        />
                        {sub.name} ({sub.code}) — Sem {sub.semesterNumber}, {sub.departmentName}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setClassifyModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleManualClassify}
                disabled={classifying || selectedSubjectIds.length === 0}
              >
                <span className="material-symbols-outlined">check</span>
                {classifying ? "Saving..." : classifyModal.classStatus === "CLASSIFIED" ? "Save Changes" : "Assign & Classify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
