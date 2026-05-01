import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import type { AuthSession, AuthUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "narratore" | "giocatore";
export type ApprovalStatus = "pending" | "approved" | "rejected";

const ACTIVE_ROLE_STORAGE_KEY = "tdn:active-role";

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  /** Tutti i ruoli effettivi assegnati all'utente */
  roles: AppRole[];
  /** Ruolo "naturale" non-admin dell'utente (narratore o giocatore); admin se admin-puro */
  naturalRole: AppRole | null;
  /** Ruolo attualmente impersonato (uno tra `roles`) */
  activeRole: AppRole | null;
  /** Cambia ruolo attivo. Sono ammesse solo transizioni naturale ⇄ admin. */
  setActiveRole: (role: AppRole) => void;
  /** Vero se l'utente HA il ruolo admin, indipendentemente dall'impersonazione */
  hasAdminRole: boolean;
  /** Vero se l'utente sta impersonando admin pur avendo un ruolo naturale diverso */
  isImpersonatingAdmin: boolean;
  /** Vero solo se l'utente sta agendo come admin (impersonazione attiva) */
  isAdmin: boolean;
  /** Vero se sta agendo come narratore (anche se è admin che impersona narratore) */
  isActingAsNarrator: boolean;
  /** Vero se sta agendo come giocatore */
  isActingAsPlayer: boolean;
  approvalStatus: ApprovalStatus | null;
  isApproved: boolean;
  refreshRoles: () => Promise<void>;
  refreshApprovalStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Ruolo "naturale" dell'utente: il primo ruolo non-admin disponibile.
 * Per un admin-puro (senza altri ruoli) il naturale resta "admin".
 */
function pickNaturalRole(rs: AppRole[]): AppRole | null {
  if (rs.includes("narratore")) return "narratore";
  if (rs.includes("giocatore")) return "giocatore";
  if (rs.includes("admin")) return "admin";
  return null;
}

/**
 * Default iniziale: SEMPRE il ruolo naturale. L'impersonazione admin
 * deve essere un'azione esplicita dell'utente.
 */
function pickDefaultActive(rs: AppRole[]): AppRole | null {
  return pickNaturalRole(rs);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);

  const loadRoles = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      setActiveRoleState(null);
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const rs = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
    setRoles(rs);

    // Determina il ruolo attivo: usa quello salvato se ancora valido, altrimenti
    // prendi il "più alto" disponibile. Per gli admin il default rimane "admin"
    // (nessuna regressione di permessi a meno di scelta esplicita).
    const stored = (typeof window !== "undefined"
      ? (localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as AppRole | null)
      : null);
    const next = stored && rs.includes(stored) ? stored : pickDefaultActive(rs);
    setActiveRoleState(next);
  }, []);

  const loadApprovalStatus = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setApprovalStatus(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("approval_status")
      .eq("id", uid)
      .maybeSingle();
    setApprovalStatus((data?.approval_status as ApprovalStatus) ?? null);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setTimeout(() => {
        loadRoles(newSession?.user?.id);
        loadApprovalStatus(newSession?.user?.id);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      Promise.all([
        loadRoles(existing?.user?.id),
        loadApprovalStatus(existing?.user?.id),
      ]).finally(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, [loadRoles, loadApprovalStatus]);

  const naturalRole = pickNaturalRole(roles);

  const setActiveRole = useCallback((role: AppRole) => {
    if (!roles.includes(role)) return;
    // Sono ammesse solo le transizioni naturale ⇄ admin.
    // Vietato lo switch diretto giocatore ⇄ narratore.
    const allowed = role === "admin" || role === naturalRole;
    if (!allowed) return;
    setActiveRoleState(role);
    try { localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role); } catch { /* noop */ }
  }, [roles, naturalRole]);

  const signOut = async () => {
    try { localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY); } catch { /* noop */ }
    await supabase.auth.signOut();
  };

  const refreshRoles = async () => loadRoles(user?.id);
  const refreshApprovalStatus = async () => loadApprovalStatus(user?.id);

  const hasAdminRole = roles.includes("admin");
  const isImpersonatingAdmin =
    activeRole === "admin" && naturalRole !== null && naturalRole !== "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        naturalRole,
        activeRole,
        setActiveRole,
        hasAdminRole,
        isImpersonatingAdmin,
        isAdmin: activeRole === "admin",
        isActingAsNarrator: activeRole === "narratore",
        isActingAsPlayer: activeRole === "giocatore",
        approvalStatus,
        isApproved: approvalStatus === "approved",
        refreshRoles,
        refreshApprovalStatus,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
