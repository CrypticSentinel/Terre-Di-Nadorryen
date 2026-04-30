import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Check, X, ShieldCheck, Hourglass } from "lucide-react";

interface PendingProfile {
  id: string;
  display_name: string;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
}

const Admin = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, approval_status, created_at, approved_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Errore nel caricamento dei profili");
    } else {
      setProfiles((data ?? []) as PendingProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadProfiles();
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/campaigns" replace />;

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    setActioning(id);
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: status,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    setActioning(null);
    if (error) {
      toast.error("Operazione fallita: " + error.message);
    } else {
      toast.success(status === "approved" ? "Utente approvato!" : "Utente respinto");
      loadProfiles();
    }
  };

  const pending = profiles.filter((p) => p.approval_status === "pending");
  const others = profiles.filter((p) => p.approval_status !== "pending");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="font-display text-4xl gold-text mb-2 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8" />
            Sala del cronista
          </h1>
          <p className="font-script italic text-ink-faded">
            Approva o respingi le richieste di accesso alle Terre di Nadorryen
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="font-heading text-2xl mb-4 flex items-center gap-2">
                <Hourglass className="h-5 w-5 text-primary" />
                In attesa di approvazione
                {pending.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pending.length}</Badge>
                )}
              </h2>

              {pending.length === 0 ? (
                <div className="parchment-panel p-6 text-center text-ink-faded">
                  Nessuna richiesta in attesa
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((p) => (
                    <div key={p.id} className="parchment-panel p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-heading text-lg">{p.display_name}</div>
                        <div className="text-xs text-ink-faded">
                          Iscritto il {new Date(p.created_at).toLocaleDateString("it-IT")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAction(p.id, "approved")}
                          disabled={actioning === p.id}
                          className="font-heading"
                        >
                          {actioning === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Approva</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(p.id, "rejected")}
                          disabled={actioning === p.id}
                          className="font-heading"
                        >
                          <X className="h-4 w-4 mr-1" /> Respingi
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-heading text-2xl mb-4">Cronache già giudicate</h2>
              <div className="space-y-2">
                {others.map((p) => (
                  <div key={p.id} className="parchment-panel p-3 flex items-center justify-between">
                    <span className="font-heading">{p.display_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.approval_status === "approved" ? "default" : "destructive"}>
                        {p.approval_status === "approved" ? "Approvato" : "Respinto"}
                      </Badge>
                      {p.approval_status === "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(p.id, "approved")}
                          disabled={actioning === p.id}
                        >
                          Riapprova
                        </Button>
                      )}
                      {p.approval_status === "approved" && p.id !== user.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction(p.id, "rejected")}
                          disabled={actioning === p.id}
                        >
                          Revoca
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Admin;
