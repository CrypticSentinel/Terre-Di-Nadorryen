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

const statusBadge = (status: PendingProfile["approval_status"]) => {
  if (status === "approved") return <Badge className="bg-green-600 hover:bg-green-600 text-white">Approvato</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Respinto</Badge>;
  return <Badge variant="secondary">In attesa</Badge>;
};

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
    if (isAdmin) void loadProfiles();
  }, [isAdmin]);

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
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
      toast.success(status === "approved" ? "Utente approvato" : "Utente respinto");
      void loadProfiles();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/campaigns" replace />;

  const pending = profiles.filter((p) => p.approval_status === "pending");
  const others = profiles.filter((p) => p.approval_status !== "pending");

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="container py-4 sm:py-6 lg:py-8">
        <section className="parchment-panel p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-heading uppercase tracking-wide text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Amministrazione
              </div>
              <h1 className="mt-3 font-display text-2xl gold-text sm:text-3xl">Sala del cronista</h1>
              <p className="mt-1 max-w-2xl text-sm font-script italic text-muted-foreground sm:text-base">
                Approva o respingi le richieste di accesso alle Terre di Nadorryen.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">In attesa</div>
                <div className="mt-1 font-display text-xl text-primary">{pending.length}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Totali</div>
                <div className="mt-1 font-display text-xl text-foreground">{profiles.length}</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              <section className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Hourglass className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-lg gold-text">In attesa di approvazione</h2>
                  </div>
                  {pending.length > 0 && <Badge variant="secondary">{pending.length}</Badge>}
                </div>

                {pending.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-background/50 p-6 text-center">
                    <p className="font-script italic text-muted-foreground">Nessuna richiesta in attesa.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pending.map((p) => (
                      <article key={p.id} className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-heading text-base break-words">{p.display_name}</h3>
                              {statusBadge(p.approval_status)}
                            </div>
                            <p className="mt-1 text-sm font-script italic text-muted-foreground">
                              Iscritto il {new Date(p.created_at).toLocaleDateString("it-IT")}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground break-all">ID: {p.id}</p>
                          </div>

                          <div className="flex flex-col gap-2 sm:w-auto w-full sm:min-w-[180px]">
                            <Button
                              onClick={() => handleAction(p.id, "approved")}
                              disabled={actioning === p.id}
                              className="min-h-11 w-full font-heading"
                            >
                              {actioning === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> Approva</>}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleAction(p.id, "rejected")}
                              disabled={actioning === p.id}
                              className="min-h-11 w-full font-heading text-destructive border-destructive/40 hover:text-destructive"
                            >
                              <X className="mr-2 h-4 w-4" /> Respingi
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3 border-t border-border/50 pt-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-lg gold-text">Cronache già giudicate</h2>
                </div>

                {others.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-background/50 p-6 text-center">
                    <p className="font-script italic text-muted-foreground">Nessun profilo storico disponibile.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {others.map((p) => (
                      <article key={p.id} className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-heading text-base break-words">{p.display_name}</h3>
                              {statusBadge(p.approval_status)}
                            </div>
                            <p className="mt-1 text-sm font-script italic text-muted-foreground">
                              Creato il {new Date(p.created_at).toLocaleDateString("it-IT")}
                              {p.approved_at ? ` · Ultima decisione ${new Date(p.approved_at).toLocaleDateString("it-IT")}` : ""}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground break-all">ID: {p.id}</p>
                          </div>

                          <div className="flex flex-col gap-2 sm:w-auto w-full sm:min-w-[180px]">
                            {p.approval_status === "rejected" && (
                              <Button
                                onClick={() => handleAction(p.id, "approved")}
                                disabled={actioning === p.id}
                                className="min-h-11 w-full font-heading"
                              >
                                {actioning === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> Riapprova</>}
                              </Button>
                            )}

                            {p.approval_status === "approved" && p.id !== user.id && (
                              <Button
                                variant="outline"
                                onClick={() => handleAction(p.id, "rejected")}
                                disabled={actioning === p.id}
                                className="min-h-11 w-full font-heading text-destructive border-destructive/40 hover:text-destructive"
                              >
                                {actioning === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="mr-2 h-4 w-4" /> Revoca</>}
                              </Button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Admin;
