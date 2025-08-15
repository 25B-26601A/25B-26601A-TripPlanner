import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Trips from "./pages/Trips";
import NewTrip from "./pages/NewTrip";
import TripDetails from "./pages/TripDetails";
import { AuthProvider } from "./context/AuthContext";

function Placeholder({ title }) {
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>{title}</h1>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewTrip />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/trips/:id" element={<TripDetails />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Routes>
    </AuthProvider>
  );
}
