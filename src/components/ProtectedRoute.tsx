import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  /** Optional children for legacy usage; if absent renders <Outlet />. */
  children?: ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
  const { user, loading, isApproved, approvalStatus } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (approvalStatus && !isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children ?? <Outlet />}</>;
};
