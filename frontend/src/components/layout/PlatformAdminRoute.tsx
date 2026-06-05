import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

/**
 * Route guard: only PLATFORM_ADMIN role (Averio employees) can access.
 * Any authenticated client user hitting a /platform/* route is sent to /dashboard.
 * Unauthenticated users are sent to /login.
 */
export default function PlatformAdminRoute() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "PLATFORM_ADMIN") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
