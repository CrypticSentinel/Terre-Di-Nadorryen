import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isApproved, approvalStatus } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Se l'utente non è ancora approvato, redirigi alla pagina di attesa
  if (approvalStatus && !isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};
