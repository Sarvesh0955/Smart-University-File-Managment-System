import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Layout/Header";
import UploadModal from "../components/UploadModal";
import FilePreview from "../components/FilePreview";
import {
  formatBytes,
  formatDate,
  getFileIcon,
  getFileIconType,
  getCategoryLabel,
  CATEGORIES,
} from "../utils/helpers";

export default function Drive() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("search");

  // Navigation state
  // path is an array of objects: { id, name, type: 'department' | 'semester' | 'subject' }
  const [path, setPath] = useState([]);
  
  // Data states
  const [folders, setFolders] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // View options
  const [viewMode, setViewMode] = useState("grid");
  const [activeCategory, setActiveCategory] = useState(null);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  
  // Modals / Overlays
  const [showUpload, setShowUpload] = useState(false);
  const [previewResource, setPreviewResource] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  
  // Smart search state
  const [semanticResults, setSemanticResults] = useState([]);
  const [semanticLoading, setSemanticLoading] = useState(false);

  const contextRef = useRef(null);

  const canUpload = user?.role === "SENIOR" || user?.role === "ADMIN";
  const canDeleteAny = user?.role === "ADMIN";

  // Check what level we are currently viewing
  const currentLevel = path.length === 0 ? "root" : path[path.length - 1].type;
  const currentId = path.length > 0 ? path[path.length - 1].id : null;
  const isViewingFiles = currentLevel === "subject" || searchQuery;

  const fetchData = async () => {
    setLoading(true);
    try {
      if (searchQuery) {
        // Search mode: fetch both filename matches and semantic matches
        const filenamePromise = api.get(`/resources/search?q=${encodeURIComponent(searchQuery)}`);
        
        // Also kick off semantic search
        setSemanticLoading(true);
        const semanticPromise = api.get(`/search/smart?q=${encodeURIComponent(searchQuery)}`)
          .catch(err => {
            console.warn("Semantic search failed:", err);
            return { data: { results: [] } };
          });

        const [filenameRes, semanticRes] = await Promise.all([filenamePromise, semanticPromise]);
        setResources(filenameRes.data.resources);
        setSemanticResults(semanticRes.data.results || []);
        setSemanticLoading(false);
        setFolders([]);
      } else if (currentLevel === "root") {
        // Root: Show colleges for admin, otherwise departments for user's college
        if (user?.role === "ADMIN") {
          const res = await api.get("/colleges");
          setFolders(res.data.colleges.map(c => ({ ...c, _type: 'college' })));
        } else if (user?.collegeId) {
          const res = await api.get(`/departments?collegeId=${user.collegeId}`);
          setFolders(res.data.departments.map(d => ({ ...d, _type: 'department' })));
        } else {
          setFolders([]);
        }
        setResources([]);
      } else if (currentLevel === "college") {
        // Inside college: Show departments
        const res = await api.get(`/departments?collegeId=${currentId}`);
        setFolders(res.data.departments.map(d => ({ ...d, _type: 'department' })));
        setResources([]);
      } else if (currentLevel === "department") {
        // Inside department: Show semesters
        const res = await api.get(`/semesters?departmentId=${currentId}`);
        setFolders(res.data.semesters.map(s => ({ ...s, _type: 'semester', name: `Semester ${s.number}` })));
        setResources([]);
      } else if (currentLevel === "semester") {
        // Inside semester: Show subjects
        const res = await api.get(`/subjects?semesterId=${currentId}`);
        setFolders(res.data.subjects.map(s => ({ ...s, _type: 'subject' })));
        setResources([]);
      } else if (currentLevel === "subject") {
        // Inside subject: Show actual files
        const params = new URLSearchParams({ subjectId: currentId, sort, order });
        if (activeCategory) params.set("category", activeCategory);
        const res = await api.get(`/resources?${params}`);
        setResources(res.data.resources);
        setFolders([]);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [path, searchQuery, activeCategory, sort, order, user]);

  // Clear search when navigating manually
  useEffect(() => {
    if (path.length > 0 && searchQuery) {
      setSearchParams({});
    }
  }, [path]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (contextRef.current && !contextRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleFolderClick = (folder) => {
    setPath([...path, { id: folder.id, name: folder.name, type: folder._type }]);
  };

  const navigateToBreadcrumb = (index) => {
    if (searchQuery) setSearchParams({});
    if (index === -1) {
      setPath([]); // Go to root
    } else {
      setPath(path.slice(0, index + 1));
    }
  };

  const handleContextMenu = (e, resource) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      resource,
    });
  };

  const handleDownload = async (resource) => {
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
    setContextMenu(null);
  };

  const handleDelete = async (resource) => {
    if (!confirm(`Delete "${resource.name}" permanently?`)) return;
    try {
      await api.delete(`/resources/${resource.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    }
    setContextMenu(null);
  };

  const handleRenameSubmit = async () => {
    if (!renameValue.trim() || !renameModal) return;
    try {
      await api.patch(`/resources/${renameModal.id}/rename`, {
        name: renameValue.trim(),
      });
      fetchData();
      setRenameModal(null);
    } catch (err) {
      alert(err.response?.data?.error || "Rename failed");
    }
  };

  const openRename = (resource) => {
    setRenameModal(resource);
    setRenameValue(resource.name);
    setContextMenu(null);
  };

  const toggleSort = (field) => {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
  };

  const pageTitle = searchQuery
    ? `Search: "${searchQuery}"`
    : currentLevel === "root"
    ? (user?.role === "ADMIN" ? "Colleges" : "Departments")
    : path[path.length - 1].name;

  return (
    <>
      <Header viewMode={viewMode} setViewMode={setViewMode} />

      <div className="page-content">
        {/* Breadcrumb */}
        {!searchQuery && (
          <nav className="breadcrumb">
            <span 
              className={`breadcrumb-item ${path.length === 0 ? "active" : ""}`}
              onClick={() => navigateToBreadcrumb(-1)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>home</span>
              Home
            </span>
            {path.map((item, idx) => (
              <span key={item.id} style={{ display: "flex", alignItems: "center" }}>
                <span className="material-symbols-outlined breadcrumb-separator">chevron_right</span>
                <span 
                  className={`breadcrumb-item ${idx === path.length - 1 ? "active" : ""}`}
                  onClick={() => navigateToBreadcrumb(idx)}
                >
                  {item.name}
                </span>
              </span>
            ))}
          </nav>
        )}

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h2 className="page-title">{pageTitle}</h2>
            <p className="page-subtitle">
              {!isViewingFiles 
                ? `${folders.length} folder${folders.length !== 1 ? "s" : ""}`
                : `${resources.length} item${resources.length !== 1 ? "s" : ""} ${resources.length > 0 ? `• ${formatBytes(resources.reduce((sum, r) => sum + r.size, 0))} total` : ""}`
              }
            </p>
          </div>
          {canUpload && currentLevel === "subject" && !searchQuery && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <span className="material-symbols-outlined">add</span>
              New Upload
            </button>
          )}
        </div>

        {/* Filter / Sort Bar - Only show when viewing files */}
        {isViewingFiles && (
          <div className="filter-bar">
            <div className="filter-bar-left">
              <button
                className={`filter-chip ${!activeCategory ? "active" : ""}`}
                onClick={() => setActiveCategory(null)}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`filter-chip ${activeCategory === cat.value ? "active" : ""}`}
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === cat.value ? null : cat.value
                    )
                  }
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <select
              className="sort-select"
              value={`${sort}-${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split("-");
                setSort(s);
                setOrder(o);
              }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="size-desc">Largest First</option>
              <option value="size-asc">Smallest First</option>
            </select>
          </div>
        )}

        {/* Loading */}
        {(loading || semanticLoading) && (
          <div className="flex-center" style={{ padding: 64 }}>
            <div className="spinner" />
          </div>
        )}

        {/* Empty State */}
        {!(loading || semanticLoading) && folders.length === 0 && resources.length === 0 && semanticResults.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-outlined empty-state-icon">
              {searchQuery ? "search_off" : isViewingFiles ? "draft" : "folder_open"}
            </span>
            <h3 className="empty-state-title">
              {searchQuery
                ? "No results found"
                : isViewingFiles
                ? "No files uploaded yet"
                : "No folders found"}
            </h3>
            <p className="empty-state-text">
              {searchQuery
                ? "Try a different search term or ask the AI assistant."
                : isViewingFiles
                ? (canUpload ? "Upload some files to get started." : "Check back later for new resources.")
                : "Contact your administrator if this seems incorrect."}
            </p>
          </div>
        )}

        {/* Grid View (Filename Matches) */}
        {!(loading || semanticLoading) && viewMode === "grid" && (
          <div className="file-grid-container">
            {searchQuery && (resources.length > 0 || folders.length > 0) && (
              <div className="search-section-header">
                <span className="material-symbols-outlined">match_case</span>
                <h3>Filename Matches</h3>
                <span className="search-section-badge">{resources.length + folders.length} found</span>
              </div>
            )}
            
            {(resources.length > 0 || folders.length > 0) && (
              <div className="file-grid" style={{ marginBottom: searchQuery ? "var(--space-2xl)" : 0 }}>
            {/* Folders */}
            {!isViewingFiles && folders.map((f) => (
              <div
                key={f.id}
                className="file-card"
                onDoubleClick={() => handleFolderClick(f)}
                title="Double click to open"
              >
                <div className="file-card-header">
                  <div className="file-card-icon default" style={{ background: "rgba(128, 131, 255, 0.1)", color: "#8083ff", borderColor: "rgba(128, 131, 255, 0.2)" }}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                  </div>
                </div>
                <div className="file-card-footer">
                  <div className="file-card-name">{f.name}</div>
                  <div className="file-card-meta">
                    <span>{f.code || f.number ? (f.code || `Sem ${f.number}`) : "Folder"}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Files */}
            {isViewingFiles && resources.map((r) => {
              const iconType = getFileIconType(r.mimeType);
              return (
                <div
                  key={r.id}
                  className="file-card"
                  onDoubleClick={() => setPreviewResource(r)}
                  onContextMenu={(e) => handleContextMenu(e, r)}
                >
                  <div className="file-card-header">
                    <div className={`file-card-icon ${iconType}`}>
                      <span className="material-symbols-outlined">
                        {getFileIcon(r.mimeType)}
                      </span>
                    </div>
                    <div className="file-card-menu">
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, r);
                        }}
                      >
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                    </div>
                  </div>
                  <div className="file-card-footer">
                    <div className="file-card-name">{r.name}</div>
                    <div className="file-card-meta">
                      <span>{formatDate(r.createdAt)}</span>
                      <span>{formatBytes(r.size)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            )}
            
            {/* Semantic Matches (Grid View) */}
            {searchQuery && semanticResults.length > 0 && (
              <div className="search-results-section">
                <div className="search-section-header">
                  <span className="material-symbols-outlined">psychology</span>
                  <h3>Related by Content</h3>
                  <span className="search-section-badge">AI Matches</span>
                </div>
                
                <div className="file-grid">
                  {semanticResults.map((result) => {
                    // Extract minimal resource info for the file card
                    const r = {
                      id: result.resourceId,
                      name: result.resourceName,
                      mimeType: result.mimeType,
                      size: result.size,
                      category: result.category,
                      createdAt: result.createdAt,
                      diskPath: result.diskPath
                    };
                    const iconType = getFileIconType(r.mimeType);
                    
                    return (
                      <div
                        key={`semantic-${r.id}`}
                        className="file-card"
                        onDoubleClick={() => setPreviewResource(r)}
                        onContextMenu={(e) => handleContextMenu(e, r)}
                      >
                        <div className="file-card-header">
                          <div className={`file-card-icon ${iconType}`}>
                            <span className="material-symbols-outlined">
                              {getFileIcon(r.mimeType)}
                            </span>
                          </div>
                          
                          <div className="search-relevance-bar" title={`Relevance: ${Math.round(result.topSimilarity * 100)}%`}>
                            <div 
                              className="search-relevance-fill" 
                              style={{ width: `${Math.max(10, result.topSimilarity * 100)}%` }} 
                            />
                          </div>
                        </div>
                        <div className="file-card-footer">
                          <div className="file-card-name">{r.name}</div>
                          <div className="file-card-meta">
                            <span>{getCategoryLabel(r.category)}</span>
                            <span>{Math.round(result.topSimilarity * 100)}% Match</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {!(loading || semanticLoading) && viewMode === "list" && (
          <div className="file-list-container">
            {searchQuery && (resources.length > 0 || folders.length > 0) && (
              <div className="search-section-header" style={{ marginBottom: "var(--space-md)" }}>
                <span className="material-symbols-outlined">match_case</span>
                <h3>Filename Matches</h3>
                <span className="search-section-badge">{resources.length + folders.length} found</span>
              </div>
            )}
            
            {(resources.length > 0 || folders.length > 0) && (
              <div className="file-list" style={{ marginBottom: searchQuery ? "var(--space-2xl)" : 0 }}>
            <div className="file-list-header">
              <span onClick={() => isViewingFiles && toggleSort("name")}>
                Name {isViewingFiles && sort === "name" && (order === "asc" ? "↑" : "↓")}
              </span>
              <span>{isViewingFiles ? "Category" : "Code/Details"}</span>
              <span onClick={() => isViewingFiles && toggleSort("size")}>
                {isViewingFiles ? `Size ${sort === "size" && (order === "asc" ? "↑" : "↓")}` : ""}
              </span>
              <span onClick={() => isViewingFiles && toggleSort("createdAt")}>
                {isViewingFiles ? `Date ${sort === "createdAt" && (order === "asc" ? "↑" : "↓")}` : ""}
              </span>
              <span>{isViewingFiles ? "Actions" : ""}</span>
            </div>

            {/* Folders List */}
            {!isViewingFiles && folders.map((f) => (
              <div
                key={f.id}
                className="file-row"
                onDoubleClick={() => handleFolderClick(f)}
                title="Double click to open"
              >
                <div className="file-row-name">
                  <div className="file-row-icon default" style={{ background: "rgba(128, 131, 255, 0.1)", color: "#8083ff", borderColor: "rgba(128, 131, 255, 0.2)" }}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                  </div>
                  <span>{f.name}</span>
                </div>
                <span className="file-row-meta">{f.code || (f.number ? `Semester ${f.number}` : "")}</span>
                <span className="file-row-meta">--</span>
                <span className="file-row-meta">--</span>
                <div className="file-row-actions"></div>
              </div>
            ))}

            {/* Files List */}
            {isViewingFiles && resources.map((r) => {
              const iconType = getFileIconType(r.mimeType);
              return (
                <div
                  key={r.id}
                  className="file-row"
                  onDoubleClick={() => setPreviewResource(r)}
                  onContextMenu={(e) => handleContextMenu(e, r)}
                >
                  <div className="file-row-name">
                    <div className={`file-row-icon ${iconType}`}>
                      <span className="material-symbols-outlined">
                        {getFileIcon(r.mimeType)}
                      </span>
                    </div>
                    <span>{r.name}</span>
                  </div>
                  <span className="file-row-meta">
                    {getCategoryLabel(r.category)}
                  </span>
                  <span className="file-row-meta">{formatBytes(r.size)}</span>
                  <span className="file-row-meta">{formatDate(r.createdAt)}</span>
                  <div className="file-row-actions">
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(r);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                    </button>
                  </div>
                </div>
              );
            })}
              </div>
            )}
            
            {/* Semantic Matches (List View) */}
            {searchQuery && semanticResults.length > 0 && (
              <div className="search-results-section">
                <div className="search-section-header" style={{ marginBottom: "var(--space-md)" }}>
                  <span className="material-symbols-outlined">psychology</span>
                  <h3>Related by Content</h3>
                  <span className="search-section-badge">AI Matches</span>
                </div>
                
                <div className="file-list">
                  <div className="file-list-header">
                    <span>Name</span>
                    <span>Category</span>
                    <span>Size</span>
                    <span>Relevance</span>
                    <span>Actions</span>
                  </div>
                  
                  {semanticResults.map((result) => {
                    const r = {
                      id: result.resourceId,
                      name: result.resourceName,
                      mimeType: result.mimeType,
                      size: result.size,
                      category: result.category,
                      createdAt: result.createdAt,
                      diskPath: result.diskPath
                    };
                    const iconType = getFileIconType(r.mimeType);
                    
                    return (
                      <div
                        key={`semantic-list-${r.id}`}
                        className="file-row"
                        onDoubleClick={() => setPreviewResource(r)}
                        onContextMenu={(e) => handleContextMenu(e, r)}
                      >
                        <div className="file-row-name">
                          <div className={`file-row-icon ${iconType}`}>
                            <span className="material-symbols-outlined">
                              {getFileIcon(r.mimeType)}
                            </span>
                          </div>
                          <span>{r.name}</span>
                        </div>
                        <span className="file-row-meta">
                          {getCategoryLabel(r.category)}
                        </span>
                        <span className="file-row-meta">{formatBytes(r.size)}</span>
                        <span className="file-row-meta" style={{ display: 'flex', alignItems: 'center' }}>
                          <div className="search-relevance-bar" title={`Relevance: ${Math.round(result.topSimilarity * 100)}%`} style={{ marginLeft: 0, marginTop: 0 }}>
                            <div 
                              className="search-relevance-fill" 
                              style={{ width: `${Math.max(10, result.topSimilarity * 100)}%` }} 
                            />
                          </div>
                        </span>
                        <div className="file-row-actions">
                          <button
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(r);
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              setPreviewResource(contextMenu.resource);
              setContextMenu(null);
            }}
          >
            <span className="material-symbols-outlined">visibility</span>
            Preview
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleDownload(contextMenu.resource)}
          >
            <span className="material-symbols-outlined">download</span>
            Download
          </button>
          {canUpload && (contextMenu.resource.uploadedById === user.id || canDeleteAny) && (
            <>
              <div className="context-menu-divider" />
              <button
                className="context-menu-item"
                onClick={() => openRename(contextMenu.resource)}
              >
                <span className="material-symbols-outlined">edit</span>
                Rename
              </button>
              <button
                className="context-menu-item danger"
                onClick={() => handleDelete(contextMenu.resource)}
              >
                <span className="material-symbols-outlined">delete</span>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Rename File</h3>
              <button className="btn-icon" onClick={() => setRenameModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New name</label>
                <input
                  className="form-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRenameModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleRenameSubmit}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          semesterId={path[path.length - 2]?.id}
          initialSubjectId={currentId}
          onClose={() => setShowUpload(false)}
          onUploadComplete={fetchData}
        />
      )}

      {/* File Preview */}
      {previewResource && (
        <FilePreview
          resource={previewResource}
          onClose={() => setPreviewResource(null)}
        />
      )}
    </>
  );
}
