import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Crown, Users, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  description: string | null;
  master_id: string;
  invite_code: string;
  member_count?: number;
}

const Groups = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("groups")
      .select("id, name, description, master_id, invite_code, group_members(count)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Impossibile caricare i gruppi");
    } else {
      setGroups(
        (data ?? []).map((g: any) => ({
          ...g,
          member_count: g.group_members?.[0]?.count ?? 0,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadGroups();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("groups").insert({
      name,
      description: description || null,
      master_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Gruppo fondato!");
      setCreateOpen(false);
      setName(""); setDescription("");
      loadGroups();
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { data: group, error: findErr } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", inviteCode.trim().toLowerCase())
      .maybeSingle();

    if (findErr || !group) {
      toast.error("Codice non valido");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "player",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.code === "23505" ? "Sei già in questo gruppo" : error.message);
    } else {
      toast.success("Benvenuto nella compagnia!");
      setJoinOpen(false);
      setInviteCode("");
      loadGroups();
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl gold-text mb-1">Le tue compagnie</h1>
            <p className="font-script italic text-ink-faded">Scegli un gruppo o fonda una nuova avventura</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="font-heading">
                  <KeyRound className="h-4 w-4 mr-2" />
                  Unisciti
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display gold-text">Unisciti a una compagnia</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <Label htmlFor="code" className="font-heading">Codice di invito</Label>
                    <Input id="code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="es. a1b2c3d4" required />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={submitting} className="font-heading">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entra"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="font-heading">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo gruppo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display gold-text">Fonda una nuova compagnia</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <Label htmlFor="gname" className="font-heading">Nome</Label>
                    <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Es. La Compagnia dell'Anello" />
                  </div>
                  <div>
                    <Label htmlFor="gdesc" className="font-heading">Descrizione (opzionale)</Label>
                    <Textarea id="gdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={submitting} className="font-heading">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fonda"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="parchment-panel p-12 text-center">
            <Users className="h-16 w-16 mx-auto text-primary/60 mb-4" />
            <h2 className="font-heading text-2xl mb-2">Nessuna compagnia, ancora.</h2>
            <p className="font-script italic text-ink-faded mb-6">
              Fonda il tuo primo gruppo o usa un codice di invito per unirti a uno esistente.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((g) => (
              <Link key={g.id} to={`/groups/${g.id}`}>
                <article className="parchment-panel p-6 h-full hover:shadow-glow transition-shadow group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-heading text-xl group-hover:text-primary transition-colors">{g.name}</h3>
                    {g.master_id === user?.id && <Crown className="h-5 w-5 text-primary shrink-0" />}
                  </div>
                  {g.description && (
                    <p className="font-script text-sm text-ink-faded mb-4 line-clamp-2">{g.description}</p>
                  )}
                  <div className="ornament-divider my-3"><span>✦</span></div>
                  <div className="flex items-center gap-4 text-sm text-ink-faded font-script">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> {g.member_count} membri
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Groups;
