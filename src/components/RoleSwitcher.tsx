import { Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export const RoleSwitcher = () => {
  const { hasAdminRole, activeRole, setActiveRole } = useAuth();

  if (!hasAdminRole) return null;

  const isActingAsPlayer = activeRole === "giocatore";

  if (isActingAsPlayer) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setActiveRole("admin")}
        title="Torna ad agire come Admin"
      >
        <Shield className="w-4 h-4 mr-2" />
        Impersonando Giocatore
        <Badge className="ml-2" variant="secondary">
          Giocatore
        </Badge>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => setActiveRole("giocatore")}
      title="Impersona Giocatore"
    >
      <ShieldOff className="w-4 h-4 mr-2" />
      Impersona Giocatore
    </Button>
  );
};