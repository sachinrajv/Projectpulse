import { Menu, ChevronRight } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { ADMIN_MODULES, AUDIT_MODULES, FINANCE_MODULES, PROJECT_MODULES, MAIL_MODULES, MODULES } from "../../constants/modules";

const GROUP_LABELS = [
  [ADMIN_MODULES, "Admin"],
  [PROJECT_MODULES, "Project Management"],
  [FINANCE_MODULES, "Finance"],
  [AUDIT_MODULES, "Audits"],
  [MAIL_MODULES, "Notifications"],
];

// Slim navy top bar: menu button (small screens) + breadcrumb for the open
// screen, and the notification bell on the right (Audit Log driven — see
// NotificationBell.jsx). Navigation lives in the left rail.
export function TopNav({ current, onToggleNav, userId, onOpenModule }) {
  const isDash = current === "dashboard";
  const mod = MODULES.find((m) => m.key === current);
  const group = GROUP_LABELS.find(([mods]) => mods.some((m) => m.key === current))?.[1];

  return (
    <header className={`pp-topbar${isDash ? " is-dash" : ""}`}>
      <button className="pp-menu-btn" onClick={onToggleNav} aria-label="Open menu"><Menu size={18} /></button>
      {!isDash && (
        <div className="pp-crumbs">
          {mod ? (
            <>
              <span className="pp-crumb-group">{group}</span>
              <ChevronRight size={14} className="pp-crumb-sep" />
              <span className="pp-crumb-cur">{mod.label}</span>
            </>
          ) : (
            <span className="pp-crumb-cur">Dashboard</span>
          )}
        </div>
      )}
      <div className="pp-bell-slot"><NotificationBell userId={userId} onOpenModule={onOpenModule} /></div>
    </header>
  );
}