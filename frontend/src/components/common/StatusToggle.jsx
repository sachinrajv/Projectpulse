import { COLORS } from "../../constants/theme";

/**
 * Active / Inactive switch for Add/Edit panels. Same look as the toggle in the
 * list screens (StatusBadge): green track + "Active" when on, grey track +
 * red "Inactive" when off, so the state is obvious in colour, knob position
 * and label. Unlike StatusBadge it carries no data-access tag — the panel's
 * own Submit is what is permission-checked.
 */
export function StatusToggle({ active, onToggle, disabled = false, onLabel = "Active", offLabel = "Inactive" }) {
  return (
    <div
      role="switch"
      aria-checked={!!active}
      aria-label="Status"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => { if (!disabled && (e.key === " " || e.key === "Enter")) { e.preventDefault(); onToggle(); } }}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}
    >
      <div style={{
        width: 36, height: 20, borderRadius: 999, flexShrink: 0, position: "relative",
        background: active ? "linear-gradient(180deg,#22B07F,#1B9C6E)" : "#D3D9E6",
        boxShadow: active ? "0 2px 8px rgba(27,156,110,0.35), inset 0 1px 1px rgba(0,0,0,0.08)" : "inset 0 1px 2px rgba(15,23,48,0.12)",
        transition: "background 0.18s ease, box-shadow 0.18s ease",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2,
          left: active ? 18 : 2, transition: "left 0.18s cubic-bezier(.2,.7,.2,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? COLORS.success : COLORS.danger, minWidth: 48 }}>
        {active ? onLabel : offLabel}
      </span>
    </div>
  );
}
