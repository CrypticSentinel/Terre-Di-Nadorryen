import { Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

const NATURAL_LABEL: Record<string, string> = {
  narratore: "Narratore",
  giocatore: "Giocatore",
  admin: "Admin",
};

/**
 * Toggle "Impersona Admin".
 *
 * - Visibile solo agli utenti che possiedono il ruolo admin E hanno un ruolo
 *   naturale diverso (narratore o giocatore).
 * - Permette di alternare esplicitamente tra il proprio ruolo naturale e
 *   l'impersonazione admin. Non consente switch giocatore ⇄ narratore.
 */
export const RoleSwitcher = () => {
  const { hasAdminRole, naturalRole, isImpersonatingAdmin, setActiveRole } = useAuth();

  // Admin-puro o utenti senza admin: nessun toggle.
  if (!hasAdminRole) return null;
  if (!naturalRole || naturalRole === "admin") return null;

  if (isImpersonatingAdmin) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="font-heading gap-1">
          <Shield className="h-3 w-3" />
          Impersonando Admin
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="font-heading"
          onClick={() => setActiveRole(naturalRole)}
        >
          <ShieldOff className="h-4 w-4 mr-2" />
          Torna a {NATURAL_LABEL[naturalRole] ?? naturalRole}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="font-heading"
      onClick={() => setActiveRole("admin")}
      title={`Stai agendo come ${NATURAL_LABEL[naturalRole] ?? naturalRole}`}
    >
      <Shield className="h-4 w-4 mr-2" />
      Impersona Admin
    </Button>
  );
};
