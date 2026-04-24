import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "narratore" | "giocatore";
export type ApprovalStatus = "pending" | "approved" | "rejected";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  approvalStatus: ApprovalStatus | null;
  isApproved: boolean;
  refreshRoles: () => Promise<void>;
  refreshApprovalStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);

  const loadRoles = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRoles = async () => loadRoles(user?.id);
  const refreshApprovalStatus = async () => loadApprovalStatus(user?.id);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        isAdmin: roles.includes("admin"),
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
