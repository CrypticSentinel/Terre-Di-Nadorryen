import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, LogOut, User as UserIcon, ShieldCheck } from "lucide-react";

export const SiteHeader = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

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
    const channel = supabase
      .channel("admin-pending-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => loadPendingCount()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-parchment/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to={user ? "/campaigns" : "/"} className="flex items-center gap-2 group">
          <ScrollText className="h-6 w-6 text-primary group-hover:rotate-6 transition-transform" />
          <span className="font-display text-xl gold-text">Terre di Nadorryen</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/campaigns">
                <Button variant="ghost" size="sm" className="font-heading">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Le campagne
                </Button>
              </Link>
              {isAdmin && (
                <Link to="/admin" className="relative">
                  <Button variant="ghost" size="sm" className="font-heading">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Admin
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
