import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollText, LogOut, User as UserIcon } from "lucide-react";

export const SiteHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-parchment/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to={user ? "/groups" : "/"} className="flex items-center gap-2 group">
          <ScrollText className="h-6 w-6 text-primary group-hover:rotate-6 transition-transform" />
          <span className="font-display text-xl gold-text">Terre di Nadorryen</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/groups">
                <Button variant="ghost" size="sm" className="font-heading">
                  <UserIcon className="h-4 w-4 mr-2" />
                  I miei gruppi
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="font-heading">
                <LogOut className="h-4 w-4 mr-2" />
                Esci
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="font-heading">
                Entra nella sala
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
