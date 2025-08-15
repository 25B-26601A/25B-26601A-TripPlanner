import { Link, NavLink, useNavigate } from "react-router-dom";
import { Home, List, Map, User, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import styles from "./NavBar.module.css";

const item = (to, label, Icon, end = false) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) => [styles.link, isActive ? styles.active : ""].join(" ")}
  >
    <Icon className={styles.icon} />
    <span>{label}</span>
  </NavLink>
);

export default function NavBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  async function onLogout() {
    await logout();
    nav("/");
  }

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {/* Left: brand */}
        <Link to="/" className={styles.brand}>
          <span className={styles.logo}></span>
          <span className={styles.title}>Trip Planner</span>
        </Link>

        {/* Center: three buttons */}
        <div className={styles.center}>
          {item("/", "Home", Home, true)}
          {item("/trips", "Trips", List)}
          {item("/new", "New Trip", Map)}
        </div>

        {/* Right: login/logout */}
        <div className={styles.right}>
          {user ? (
            <button onClick={onLogout} className={`${styles.link} ${styles.btn}`} title="Logout">
              <LogOut className={styles.icon} />
              <span>Logout</span>
            </button>
          ) : (
            item("/login", "Login", User)
          )}
        </div>
      </nav>
    </header>
  );
}
