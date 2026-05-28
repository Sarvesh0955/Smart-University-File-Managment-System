import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import api from "../utils/api";
import { formatBytes, CATEGORIES } from "../utils/helpers";

export default function UploadModal({ semesterId, initialSubjectId, onClose, onUploadComplete }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState("NOTES");
  
  // Subject Selection
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(
    initialSubjectId ? [initialSubjectId] : []
  );

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch subjects for this semester to allow multi-select
    if (semesterId) {
      api.get(`/subjects?semesterId=${semesterId}`).then(res => {
        setSubjects(res.data.subjects || []);
      }).catch(err => {
        console.error("Failed to fetch subjects:", err);
      });
    }
  }, [semesterId]);

  const onDrop = useCallback((acceptedFiles) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSubject = (id) => {
    setSelectedSubjectIds(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (selectedSubjectIds.length === 0) {
      setError("Please select at least one subject");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("subjectIds", JSON.stringify(selectedSubjectIds));
    formData.append("category", category);

    try {
      await api.post("/resources/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      onUploadComplete?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Upload Files</h3>
          <button className="btn-icon" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="form-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Subjects (Select Multiple)</label>
              <div 
                style={{ 
                  maxHeight: 120, 
                  overflowY: "auto", 
                  border: "1px solid var(--border-color)", 
                  borderRadius: 8, 
                  padding: 8,
                  background: "var(--bg-card)"
                }}
              >
                {subjects.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--color-on-surface-variant)", padding: 8 }}>
                    Loading subjects...
                  </div>
                ) : (
                  subjects.map(sub => (
                    <label key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={selectedSubjectIds.includes(sub.id)}
                        onChange={() => toggleSubject(sub.id)}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      <span style={{ fontSize: 14 }}>{sub.name} ({sub.code})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? "active" : ""}`}
            style={{ marginTop: 16 }}
          >
            <input {...getInputProps()} />
            <span className="material-symbols-outlined dropzone-icon">
              cloud_upload
            </span>
            <p className="dropzone-text">
              {isDragActive
                ? "Drop files here..."
                : "Drag & drop files here, or click to browse"}
            </p>
            <p className="dropzone-hint">Maximum 50 MB per file • Up to 10 files</p>
          </div>

          {files.length > 0 && (
            <div className="upload-file-list" style={{ marginTop: 16 }}>
              {files.map((file, index) => (
                <div key={index} className="upload-file-item">
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "var(--color-primary)", fontSize: 20 }}
                  >
                    insert_drive_file
                  </span>
                  <div className="upload-file-info">
                    <div className="upload-file-name">{file.name}</div>
                    <div className="upload-file-size">{formatBytes(file.size)}</div>
                  </div>
                  {!uploading && (
                    <button
                      className="btn-icon"
                      onClick={() => removeFile(index)}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </div>
              ))}

              {uploading && (
                <div className="upload-progress">
                  <div
                    className="upload-progress-bar"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading || files.length === 0 || selectedSubjectIds.length === 0}
          >
            <span className="material-symbols-outlined">cloud_upload</span>
            {uploading ? `Uploading ${progress}%` : `Upload ${files.length} file(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
