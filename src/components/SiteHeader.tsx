import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, LogOut, User as UserIcon, ShieldCheck, Menu, X } from "lucide-react";
import { EditableUiText } from "@/components/EditableUiText";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { RoleSwitcher } from "@/components/RoleSwitcher";

export const SiteHeader = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadPendingCount = async () => {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "pending");
    setPendingCount(count ?? 0);
  };

  useEffect(() => {
    if (!isAdmin) {
      setPendingCount(0);
      return;
    }
    void loadPendingCount();
    const channel = supabase
      .channel("admin-pending-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void loadPendingCount()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate("/");
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-parchment/90 backdrop-blur-md">
      <div className="container py-3">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Link to={user ? "/campaigns" : "/"} className="flex min-w-0 items-center gap-2 group" onClick={closeMobileMenu}>
            <ScrollText className="h-5 w-5 shrink-0 text-primary group-hover:rotate-6 transition-transform sm:h-6 sm:w-6" />
            <EditableUiText
              textKey="header.title"
              defaultText="Terre di Nadorryen"
              className="font-display text-lg leading-none gold-text sm:text-xl"
            />
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <ThemeSwitcher />
            {user ? (
              <>
                <RoleSwitcher />
                <Link to="/campaigns">
                  <Button variant="ghost" size="sm" className="font-heading">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <EditableUiText textKey="nav.campaigns" defaultText="Le campagne" />
                  </Button>
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="relative">
                    <Button variant="ghost" size="sm" className="font-heading">
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      <EditableUiText textKey="nav.admin" defaultText="Admin" />
                      {pendingCount > 0 && (
                        <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                          {pendingCount}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="font-heading">
                  <LogOut className="h-4 w-4 mr-2" />
                  <EditableUiText textKey="nav.signout" defaultText="Esci" />
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm" className="font-heading">
                  <EditableUiText textKey="nav.signin" defaultText="Entra nella sala" />
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeSwitcher />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Chiudi menu" : "Apri menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/95 p-3 shadow-sm md:hidden">
            {user ? (
              <>
                <div className="rounded-md border border-border/50 bg-parchment-deep/20 p-2">
                  <RoleSwitcher />
                </div>

                <Link to="/campaigns" onClick={closeMobileMenu} className="block">
                  <Button variant="ghost" className="h-11 w-full justify-start font-heading">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <EditableUiText textKey="nav.campaigns" defaultText="Le campagne" />
                  </Button>
                </Link>

                {isAdmin && (
                  <Link to="/admin" onClick={closeMobileMenu} className="block">
                    <Button variant="ghost" className="h-11 w-full justify-start font-heading">
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      <EditableUiText textKey="nav.admin" defaultText="Admin" />
                      {pendingCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                          {pendingCount}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                )}

                <Button variant="ghost" onClick={handleSignOut} className="h-11 w-full justify-start font-heading">
                  <LogOut className="h-4 w-4 mr-2" />
                  <EditableUiText textKey="nav.signout" defaultText="Esci" />
                </Button>
              </>
            ) : (
              <Link to="/auth" onClick={closeMobileMenu} className="block">
                <Button variant="default" className="h-11 w-full font-heading">
                  <EditableUiText textKey="nav.signin" defaultText="Entra nella sala" />
                </Button>
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};
