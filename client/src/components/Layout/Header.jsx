import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Header({ viewMode, setViewMode }) {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/drive?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="header">
      <form className="header-search" onSubmit={handleSearch}>
        <span className="material-symbols-outlined">search</span>
        <input
          type="text"
          placeholder="Search academic resources..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="header-actions">
        {viewMode !== undefined && (
          <>
            <button
              className={`btn-icon ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <span className="material-symbols-outlined">grid_view</span>
            </button>
            <button
              className={`btn-icon ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <span className="material-symbols-outlined">view_list</span>
            </button>
          </>
        )}

        <div className="header-user" ref={dropdownRef} onClick={() => setShowDropdown(!showDropdown)} style={{ cursor: "pointer", position: "relative" }}>
          <div className="header-user-avatar">{initials}</div>
          <div className="header-user-info">
            <span className="header-user-name">{user?.name}</span>
            <span className="header-user-role">
              <span className={`role-badge ${user?.role?.toLowerCase()}`}>
                {user?.role}
              </span>
            </span>
          </div>
          {showDropdown && (
            <div className="profile-dropdown">
              <Link to="/profile" className="profile-dropdown-item">
                <span className="material-symbols-outlined">person</span>
                Profile
              </Link>
              <div className="profile-dropdown-divider" />
              <button className="profile-dropdown-item text-danger" onClick={logout}>
                <span className="material-symbols-outlined">logout</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
