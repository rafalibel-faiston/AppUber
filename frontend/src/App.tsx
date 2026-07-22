import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "./lib/auth";
import TabBar from "./components/TabBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Corridas from "./pages/Corridas";
import Gastos from "./pages/Gastos";
import Metas from "./pages/Metas";
import Ajustes from "./pages/Ajustes";
import Agenda from "./pages/Agenda";

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
            path="/corridas"
            element={
              <Protected>
                <Corridas />
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
            path="/agenda"
            element={
              <Protected>
                <Agenda />
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
          <Route
            path="/ajustes"
            element={
              <Protected>
                <Ajustes />
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
