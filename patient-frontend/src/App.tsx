import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Patients from "@/pages/Patients";
import System from "@/pages/System";

function RequireAuth() {
  const { session } = useAuth();
  return session ? <Layout /> : <Navigate to="/login" replace />;
}
function RequireAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}
function GuestOnly() {
  const { session } = useAuth();
  return session ? <Navigate to="/" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}><Route path="/login" element={<Login />} /></Route>
      <Route element={<RequireAuth />}>
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route element={<RequireAdmin />}><Route path="system" element={<System />} /></Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
