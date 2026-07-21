import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "./lib/auth";
import TabBar from "./components/TabBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Jornadas from "./pages/Jornadas";
import Gastos from "./pages/Gastos";
import Metas from "./pages/Metas";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/jornadas"
            element={
              <Protected>
                <Jornadas />
              </Protected>
            }
          />
          <Route
            path="/gastos"
            element={
              <Protected>
                <Gastos />
              </Protected>
            }
          />
          <Route
            path="/metas"
            element={
              <Protected>
                <Metas />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      {user && location.pathname !== "/login" && <TabBar />}
    </div>
  );
}
