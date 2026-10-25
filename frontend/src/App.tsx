import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Search from "./pages/Search";
import BusDetail from "./pages/BusDetail";
import RouteDetail from "./pages/RouteDetail";
import Favourites from "./pages/Favourites";
import Admin from "./pages/Admin";

/** Redirects to /login when signed out; optionally requires the ADMIN role. */
function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6" role="status">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/search" element={<Protected><Search /></Protected>} />
      <Route path="/bus/:id" element={<Protected><BusDetail /></Protected>} />
      <Route path="/routes/:id" element={<Protected><RouteDetail /></Protected>} />
      <Route path="/favourites" element={<Protected><Favourites /></Protected>} />
      <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
