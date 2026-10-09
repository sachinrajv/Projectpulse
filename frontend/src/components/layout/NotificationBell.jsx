// NotificationBell.jsx — notification icon in the top bar (Defect 1, Sep 29).
//
// Source: the SAME AuditLog table the Audit Log screen reads
// (callAuditLogFlow("LIST")), shown newest-first. Each row already carries
// the screen it happened on, so clicking a notification opens that screen.
//
// Visibility follows the signed-in user's role and permissions: a row is only
// shown when it belongs to a screen this user is allowed to open
// (usePermissions().canOpen — admins see everything).
//
// Read state is kept per signed-in user (localStorage): individual items are
// marked read when clicked or via the per-row check, and "Mark all as read"
// clears everything up to now. The audit table has no read state of its own.
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Bell, Plus, Pencil, Trash2, CheckCircle2, XCircle, Repeat, Mail } from "lucide-react";
import { callAuditLogFlow, callProjectFlow, callBillingFlow } from "../../api/flows";
import { loadDirectory } from "../../utils/userDirectory";
import { audienceMatch } from "../../utils/notificationAudience";
import { COLORS } from "../../constants/theme";
import { lsGet, lsSet } from "../../utils/storage";
import { usePermissions } from "../../context/PermissionContext";
import { moduleForAuditScreen } from "../../utils/notificationRoutes";

const POLL_MS = 60000;
const MAX_SHOWN = 20;
const seenKey = (userId) => `pp_notif_last_seen_${userId || "anon"}`; // "read everything before" time
const readKey = (userId) => `pp_notif_read_${userId || "anon"}`;       // ids read one by one
const unreadKey = (userId) => `pp_notif_unread_${userId || "anon"}`;   // ids the user flagged unread again
const deletedKey = (userId) => `pp_notif_deleted_${userId || "anon"}`; // removed from THIS user's list only (audit log is untouched)
const idOf = (r) => String(r.guid || r.id);

const ACTION_ICON = { Create: Plus, Update: Pencil, Delete: Trash2, Approve: CheckCircle2, Reject: XCircle, "Convert to Project": Repeat };
const ACTION_COLOR = { Create: COLORS.success, Update: COLORS.accent, Delete: COLORS.danger, Approve: COLORS.success, Reject: COLORS.danger };

// Same date format the Audit Log screen shows for a row, so the two always agree.
function whenText(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export function NotificationBell({ userId, onOpenModule }) {
  const { canOpen, isAdmin, loaded: permsLoaded } = usePermissions();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [lastSeen, setLastSeen] = useState(() => lsGet(seenKey(userId), 0));
  const [readIds, setReadIds] = useState(() => { const v = lsGet(readKey(userId), []); return Array.isArray(v) ? v : []; });
  const [unreadIds, setUnreadIds] = useState(() => { const v = lsGet(unreadKey(userId), []); return Array.isArray(v) ? v : []; });
  const [deletedIds, setDeletedIds] = useState(() => { const v = lsGet(deletedKey(userId), []); return Array.isArray(v) ? v : []; });
  const [notice, setNotice] = useState("");
  const boxRef = useRef(null);

  // Who each event is for (PM / Delivery Head / resource / Finance …) is worked
  // out from these lists — see utils/notificationAudience.js. null = not loaded
  // (or failed): audience-based rows stay hidden rather than shown to the wrong person.
  const [audCtx, setAudCtx] = useState(null);

  const load = useCallback(() => {
    callAuditLogFlow("LIST")
      .then((res) => setRows(res.data || []))
      .catch(() => {}); // never break the top bar if the log can't be read
    Promise.all([loadDirectory(), callProjectFlow("LIST"), callBillingFlow("LIST")])
      .then(([dir, pr, bl]) => setAudCtx({ dir, projects: pr.data || [], billings: bl.data || [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Newest first, only screens this user can open, capped.
  const items = useMemo(() => {
    if (!permsLoaded) return [];
    return [...rows]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((r) => ({ ...r, moduleKey: moduleForAuditScreen(r.screen) }))
      .filter((r) => r.moduleKey && (isAdmin || canOpen(r.moduleKey)))
      .filter((r) => {
        if (isAdmin) return true;
        // Events with an audience (project/billing/allocation/approval …) go only to the people they concern.
        const hit = audCtx ? audienceMatch(r, userId, audCtx) : audienceMatch(r, userId, { dir: {} });
        return hit === null ? true : (audCtx ? hit : false);
      })
      .filter((r) => !deletedIds.includes(idOf(r)))
      .slice(0, MAX_SHOWN);
  }, [rows, permsLoaded, isAdmin, canOpen, deletedIds, audCtx, userId]);

  const isUnread = (r) => unreadIds.includes(idOf(r)) || (new Date(r.timestamp).getTime() > lastSeen && !readIds.includes(idOf(r)));
  const unreadCount = items.filter(isUnread).length;

  const saveLists = (reads, unreads) => {
    setReadIds(reads); setUnreadIds(unreads);
    lsSet(readKey(userId), reads); lsSet(unreadKey(userId), unreads);
  };
  const markRead = (r) => {
    const id = idOf(r);
    saveLists(readIds.includes(id) ? readIds : [...readIds, id].slice(-500), unreadIds.filter((x) => x !== id));
  };
  const markUnread = (r) => {
    const id = idOf(r);
    saveLists(readIds.filter((x) => x !== id), unreadIds.includes(id) ? unreadIds : [...unreadIds, id].slice(-500));
  };
  const deleteOne = (r) => {
    const next = [...deletedIds, idOf(r)].slice(-1000);
    setDeletedIds(next);
    lsSet(deletedKey(userId), next);
  };
  const deleteAll = () => {
    const next = [...new Set([...deletedIds, ...items.map(idOf)])].slice(-1000);
    setDeletedIds(next);
    lsSet(deletedKey(userId), next);
  };
  const markAllRead = () => {
    const now = Date.now();
    setLastSeen(now);
    lsSet(seenKey(userId), now);
    saveLists([], []);
  };

  const toggle = () => {
    setNotice("");
    setOpen((o) => {
      const next = !o;
      if (next) {
        load(); // refresh when opened (items stay unread until marked read)
      }
      return next;
    });
  };

  const openItem = (r) => {
    markRead(r);
    setOpen(false);
    if (onOpenModule) onOpenModule(r.moduleKey);
  };

  return (
    <div ref={boxRef} className="pp-bell" style={{ position: "relative" }}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        title="Notifications"
        style={{ position: "relative", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span data-testid="bell-count" style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: COLORS.danger, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0F1529" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 46, right: 0, width: 360, maxHeight: 440, overflowY: "auto", background: "#fff", borderRadius: 14, border: `1px solid ${COLORS.border}`, boxShadow: "0 18px 40px rgba(15,23,48,0.18)", zIndex: 80 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.text }}>Notifications</span>
            <span style={{ display: "flex", gap: 12 }}>
              {/* <button data-testid="bell-mark-all" onClick={markAllRead} disabled={unreadCount === 0} style={{ border: "none", background: "transparent", color: unreadCount === 0 ? COLORS.textMuted : COLORS.accent, fontSize: 12, fontWeight: 600, cursor: unreadCount === 0 ? "default" : "pointer" }}>Mark all as read</button> */}
              {/* <button data-testid="bell-delete-all" onClick={deleteAll} disabled={items.length === 0} style={{ border: "none", background: "transparent", color: items.length === 0 ? COLORS.textMuted : COLORS.danger, fontSize: 12, fontWeight: 600, cursor: items.length === 0 ? "default" : "pointer" }}>Clear all</button> */}
            </span>
          </div>
          {notice && <div style={{ padding: "8px 14px", fontSize: 12, color: COLORS.danger, background: COLORS.dangerSoft }}>{notice}</div>}
          {items.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
              <Mail size={20} style={{ marginBottom: 6, opacity: 0.5 }} /><br />No notifications yet.
            </div>
          ) : (
            items.map((r) => {
              const Icon = ACTION_ICON[r.action] || Bell;
              const color = ACTION_COLOR[r.action] || COLORS.textMuted;
              const fresh = isUnread(r);
              return (
                <div key={idOf(r)} style={{ borderBottom: `1px solid ${COLORS.border}`, background: fresh ? COLORS.accentSoft : "#fff" }}>
                  <button
                    data-testid="bell-item"
                    data-unread={fresh ? "1" : "0"}
                    onClick={() => openItem(r)}
                    style={{ display: "flex", gap: 10, padding: "10px 14px 4px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, background: `${color}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      <Icon size={14} color={color} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: fresh ? 700 : 600, color: COLORS.text }}>{r.screen} · {r.action}</div>
                      <div style={{ fontSize: 12, color: COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.record}</div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>by {r.user || "—"} · {whenText(r.timestamp)}</div>
                    </div>
                  </button>
                  <div style={{ display: "flex", gap: 14, padding: "0 14px 8px 52px" }}>
                    <button
                      data-testid={fresh ? "bell-mark-one" : "bell-mark-unread"}
                      onClick={() => (fresh ? markRead(r) : markUnread(r))}
                      style={{ border: "none", background: "transparent", padding: 0, fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: COLORS.accent }}
                    >{fresh ? "Mark as read" : "Mark as unread"}</button>
                    <button data-testid="bell-delete-one" onClick={() => deleteOne(r)} style={{ border: "none", background: "transparent", padding: 0, fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: COLORS.danger }}>Delete</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}