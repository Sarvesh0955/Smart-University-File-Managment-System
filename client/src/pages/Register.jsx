import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STUDENT",
    year: "",
    collegeId: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [colleges, setColleges] = useState([]);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    import("../utils/api").then((module) => {
      module.default.get("/colleges").then((res) => {
        setColleges(res.data.colleges);
      });
    });
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await register(form);
      if (result.user?.status === "PENDING") {
        setSuccess(result.message);
        setTimeout(() => navigate("/pending"), 2000);
      } else {
        navigate("/drive");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-card-logo">
            <span className="material-symbols-outlined">hub</span>
          </div>
          <h2 className="auth-card-title">Create Account</h2>
          <p className="auth-card-subtitle">
            Join the Academic Resource Hub
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="form-error" style={{ marginBottom: 16, textAlign: "center" }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginBottom: 16, textAlign: "center", color: "#4ade80", fontSize: 14 }}>
              {success}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              className="form-input"
              name="name"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className="form-input"
              type="email"
              name="email"
              placeholder="you@college.edu"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              className="form-input"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-college">College</label>
            <select
              id="reg-college"
              className="form-select"
              name="collegeId"
              value={form.collegeId}
              onChange={handleChange}
              required
            >
              <option value="">Select College</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-role">I am a</label>
            <select
              id="reg-role"
              className="form-select"
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              <option value="STUDENT">Student</option>
              <option value="SENIOR">Senior (requires admin approval)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-year">Year</label>
            <select
              id="reg-year"
              className="form-select"
              name="year"
              value={form.year}
              onChange={handleChange}
            >
              <option value="">Select Year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
