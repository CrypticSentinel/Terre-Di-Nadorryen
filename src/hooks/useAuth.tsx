import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "narratore" | "giocatore";
export type ApprovalStatus = "pending" | "approved" | "rejected";

const ACTIVE_ROLE_STORAGE_KEY = "tdn:active-role";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Tutti i ruoli effettivi assegnati all'utente */
  roles: AppRole[];
  /** Ruolo attualmente impersonato (uno tra `roles`) */
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
  /** Vero se l'utente HA il ruolo admin, indipendentemente dall'impersonazione */
  hasAdminRole: boolean;
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

const ROLE_PRIORITY: AppRole[] = ["admin", "narratore", "giocatore"];

function pickDefaultActive(rs: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) if (rs.includes(r)) return r;
  return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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

  const setActiveRole = useCallback((role: AppRole) => {
    if (!roles.includes(role)) return;
    setActiveRoleState(role);
    try { localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role); } catch { /* noop */ }
  }, [roles]);

  const signOut = async () => {
    try { localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY); } catch { /* noop */ }
    await supabase.auth.signOut();
  };

  const refreshRoles = async () => loadRoles(user?.id);
  const refreshApprovalStatus = async () => loadApprovalStatus(user?.id);

  const hasAdminRole = roles.includes("admin");

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        activeRole,
        setActiveRole,
        hasAdminRole,
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
