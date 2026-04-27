import { ChevronDown, Crown, ScrollText, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, type AppRole } from "@/hooks/useAuth";

const ROLE_META: Record<AppRole, { label: string; icon: any }> = {
  admin: { label: "Admin", icon: Shield },
  narratore: { label: "Narratore", icon: Crown },
  giocatore: { label: "Giocatore", icon: Users },
};

/**
 * Mostra il ruolo correntemente impersonato e permette il cambio esplicito.
 * Visibile solo se l'utente possiede più di un ruolo (tipicamente admin che
 * vuole agire come narratore o giocatore).
 */
export const RoleSwitcher = () => {
  const { roles, activeRole, setActiveRole } = useAuth();

  if (!activeRole || roles.length <= 1) return null;

  const Current = ROLE_META[activeRole].icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="font-heading">
          <Current className="h-4 w-4 mr-2" />
          {ROLE_META[activeRole].label}
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-heading text-xs uppercase tracking-wider">
          Agisci come
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((r) => {
          const Icon = ROLE_META[r].icon;
          return (
            <DropdownMenuItem
              key={r}
              onClick={() => setActiveRole(r)}
              className={r === activeRole ? "bg-primary/10 text-primary" : ""}
            >
              <Icon className="h-4 w-4 mr-2" />
              {ROLE_META[r].label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
