import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", ico: "◎", label: "Painel", end: true },
  { to: "/corridas", ico: "🚕", label: "Corridas" },
  { to: "/gastos", ico: "💸", label: "Gastos" },
  { to: "/metas", ico: "🎯", label: "Metas" },
];

export default function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="ico">{t.ico}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
