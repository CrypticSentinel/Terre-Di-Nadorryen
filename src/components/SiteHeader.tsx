import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, LogOut, User as UserIcon, ShieldCheck, Menu, X,} from "lucide-react";
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

    loadPendingCount();

    const channel = supabase.channel(`admin-pending-profiles-${Math.random().toString(36).slice(2)}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      () => loadPendingCount()
    );
    channel.subscribe();

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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-parchment/80 backdrop-blur-md">
      <div className="container">
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <Link
            to={user ? "/campaigns" : "/"}
            className="group flex min-w-0 items-center gap-2"
            onClick={closeMobileMenu}
          >
            <ScrollText className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:rotate-6 sm:h-6 sm:w-6" />
            <EditableUiText
              textKey="header.title"
              defaultText="Terre di Nadorryen"
              className="font-display text-lg gold-text sm:text-xl"
            />
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeSwitcher />
            {user ? (
              <>
                <RoleSwitcher />

                <Button asChild variant="ghost" size="sm" className="font-heading">
                  <Link to="/campaigns">
                    <ScrollText className="mr-2 h-4 w-4" />
                    <EditableUiText
                      textKey="nav.campaigns"
                      defaultText="Le campagne"
                    />
                  </Link>
                </Button>

                <Button asChild variant="ghost" size="sm" className="font-heading">
                  <Link to="/profile">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <EditableUiText
                      textKey="nav.profile"
                      defaultText="Profilo"
                    />
                  </Link>
                </Button>

                {isAdmin && (
                  <Button asChild variant="ghost" size="sm" className="font-heading">
                    <Link to="/admin" className="relative">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      <EditableUiText textKey="nav.admin" defaultText="Admin" />
                      {pendingCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-2 h-5 min-w-5 px-1.5 text-xs"
                        >
                          {pendingCount}
                        </Badge>
                      )}
                    </Link>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="font-heading"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <EditableUiText textKey="nav.signout" defaultText="Esci" />
                </Button>
              </>
            ) : (
              <Button asChild variant="default" size="sm" className="font-heading">
                <Link to="/auth">
                  <EditableUiText
                    textKey="nav.signin"
                    defaultText="Entra nella sala"
                  />
                </Link>
              </Button>
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
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="border-t border-border/50 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {user ? (
                <>
                  <div className="rounded-md border border-border/60 bg-background/60 p-2">
                    <RoleSwitcher />
                  </div>

                  <Button
                    asChild
                    variant="ghost"
                    className="h-11 w-full justify-start font-heading"
                  >
                    <Link to="/campaigns" onClick={closeMobileMenu}>
                      <ScrollText className="mr-2 h-4 w-4" />
                      <EditableUiText
                        textKey="nav.campaigns"
                        defaultText="Le campagne"
                      />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="ghost"
                    className="h-11 w-full justify-start font-heading"
                  >
                    <Link to="/profile" onClick={closeMobileMenu}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <EditableUiText
                        textKey="nav.profile"
                        defaultText="Profilo"
                      />
                    </Link>
                  </Button>

                  {isAdmin && (
                    <Button
                      asChild
                      variant="ghost"
                      className="h-11 w-full justify-start font-heading"
                    >
                      <Link to="/admin" onClick={closeMobileMenu} className="relative">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <EditableUiText
                          textKey="nav.admin"
                          defaultText="Admin"
                        />
                        {pendingCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                          >
                            {pendingCount}
                          </Badge>
                        )}
                      </Link>
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="h-11 w-full justify-start font-heading"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <EditableUiText
                      textKey="nav.signout"
                      defaultText="Esci"
                    />
                  </Button>
                </>
              ) : (
                <Button asChild variant="default" className="h-11 w-full font-heading">
                  <Link to="/auth" onClick={closeMobileMenu}>
                    <EditableUiText
                      textKey="nav.signin"
                      defaultText="Entra nella sala"
                    />
                  </Link>
                </Button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};