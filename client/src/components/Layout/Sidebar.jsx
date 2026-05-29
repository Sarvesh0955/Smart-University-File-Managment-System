import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
        </div>
        <div className="sidebar-logo-text">
          <h1>Academic Hub</h1>
          <p>Resource Manager</p>
        </div>
      </div>

      <div className="sidebar-nav">
        <NavLink
          to="/drive"
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="material-symbols-outlined">library_books</span>
          My Drive
        </NavLink>
        {(user?.role === "SENIOR" || user?.role === "ADMIN") && (
          <NavLink
            to="/auto-sort"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            Auto-Sort
          </NavLink>
        )}
        {user?.role === "ADMIN" && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
          >
            <span className="material-symbols-outlined">admin_panel_settings</span>
            Admin Panel
          </NavLink>
        )}
      </div>
    </nav>
  );
}
