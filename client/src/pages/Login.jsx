import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
      nav("/trips");
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <form onSubmit={onSubmit} style={{ width: 360, display: "grid", gap: 12 }}>
        <h1 style={{ fontWeight: 800, fontSize: 24, textAlign: "center" }}>Login</h1>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={{ padding: "0.65rem 0.8rem", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••"
            minLength={6}
            style={{ padding: "0.65rem 0.8rem", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        {err ? (
          <div style={{ color: "#b00020", fontWeight: 600, background: "#ffe8ea", padding: "0.5rem 0.75rem", borderRadius: 10 }}>
            {err}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ textAlign: "center", fontSize: 14 }}>
          New here? <Link to="/register">Create an account</Link>
        </div>
      </form>
    </main>
  );
}
