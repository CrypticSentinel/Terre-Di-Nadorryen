import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "narratore" | "giocatore";
export type ApprovalStatus = "pending" | "approved" | "rejected";

const ACTIVE_ROLE_STORAGE_KEY = "tdn:active-role";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  naturalRole: AppRole | null;
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
  hasAdminRole: boolean;
  isImpersonatingAdmin: boolean;
  isAdmin: boolean;
  isActingAsNarrator: boolean;
  isActingAsPlayer: boolean;
  approvalStatus: ApprovalStatus | null;
  isApproved: boolean;
  refreshRoles: () => Promise<void>;
  refreshApprovalStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function pickNaturalRole(rs: AppRole[]): AppRole | null {
  if (rs.includes("giocatore")) return "giocatore";
  if (rs.includes("narratore")) return "narratore";
  if (rs.includes("admin")) return "admin";
  return null;
}

function pickDefaultActive(rs: AppRole[]): AppRole | null {
  if (rs.includes("admin")) return "admin";
  return pickNaturalRole(rs);
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

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);

    if (error) {
      setRoles([]);
      setActiveRoleState(null);
      return;
    }

    const rs = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
    setRoles(rs);

    const stored =
      typeof window !== "undefined"
        ? (localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as AppRole | null)
        : null;

    const next = stored && rs.includes(stored) ? stored : pickDefaultActive(rs);
    setActiveRoleState(next);
  }, []);

  const loadApprovalStatus = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setApprovalStatus(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("approval_status")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      setApprovalStatus(null);
      return;
    }

    setApprovalStatus((data?.approval_status as ApprovalStatus) ?? null);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      setTimeout(() => {
        void loadRoles(newSession?.user?.id);
        void loadApprovalStatus(newSession?.user?.id);
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

  const hasAdminRole = useMemo(() => roles.includes("admin"), [roles]);
  const naturalRole = useMemo(() => pickNaturalRole(roles), [roles]);

  const setActiveRole = useCallback(
    (role: AppRole) => {
      if (!roles.includes(role)) return;

      if (hasAdminRole) {
        const allowedForAdmin = role === "admin" || role === "giocatore";
        if (!allowedForAdmin) return;
      } else {
        if (role !== naturalRole) return;
      }

      setActiveRoleState(role);

      try {
        localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
      } catch {
        // noop
      }
    },
    [roles, hasAdminRole, naturalRole]
  );

  const signOut = async () => {
    try {
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    } catch {
      // noop
    }

    await supabase.auth.signOut();
  };

  const refreshRoles = async () => {
    await loadRoles(user?.id);
  };

  const refreshApprovalStatus = async () => {
    await loadApprovalStatus(user?.id);
  };

  const isAdmin = activeRole === "admin";
  const isActingAsPlayer = activeRole === "giocatore";
  const isActingAsNarrator = activeRole === "narratore";

  const isImpersonatingAdmin =
    hasAdminRole &&
    activeRole === "admin" &&
    naturalRole !== null &&
    naturalRole !== "admin";

  const value: AuthContextValue = {
    user,
    session,
    loading,
    roles,
    naturalRole,
    activeRole,
    setActiveRole,
    hasAdminRole,
    isImpersonatingAdmin,
    isAdmin,
    isActingAsNarrator,
    isActingAsPlayer,
    approvalStatus,
    isApproved: approvalStatus === "approved",
    refreshRoles,
    refreshApprovalStatus,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};