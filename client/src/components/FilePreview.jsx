import { useState, useEffect } from "react";
import { getPreviewType } from "../utils/helpers";
import api from "../utils/api";

export default function FilePreview({ resource, onClose }) {
  const [textContent, setTextContent] = useState("");
  const previewType = getPreviewType(resource.mimeType);
  const fileUrl = `/uploads/${resource.diskPath}`;

  useEffect(() => {
    if (previewType === "text") {
      fetch(fileUrl)
        .then((res) => res.text())
        .then(setTextContent)
        .catch(() => setTextContent("Failed to load file content."));
    }
  }, [previewType, fileUrl]);

  const handleDownload = async () => {
    try {
      const res = await api.get(`/resources/${resource.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", resource.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-header" onClick={(e) => e.stopPropagation()}>
        <span className="preview-title">{resource.name}</span>
        <div className="preview-actions">
          <button className="btn btn-secondary" onClick={handleDownload}>
            <span className="material-symbols-outlined">download</span>
            Download
          </button>
          <button className="btn-icon" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <div className="preview-content" onClick={(e) => e.stopPropagation()}>
        {previewType === "image" && (
          <img src={fileUrl} alt={resource.name} />
        )}
        {previewType === "pdf" && (
          <iframe src={fileUrl} title={resource.name} />
        )}
        {previewType === "video" && (
          <video controls src={fileUrl} />
        )}
        {previewType === "audio" && (
          <audio controls src={fileUrl} />
        )}
        {previewType === "text" && <pre>{textContent}</pre>}
        {previewType === "unsupported" && (
          <div className="preview-unsupported">
            <span className="material-symbols-outlined">visibility_off</span>
            <p>Preview not available for this file type.</p>
            <button
              className="btn btn-primary"
              onClick={handleDownload}
              style={{ marginTop: 16 }}
            >
              <span className="material-symbols-outlined">download</span>
              Download Instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
