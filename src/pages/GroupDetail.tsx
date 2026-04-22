import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Crown, Loader2, Copy, Trash2, ScrollText } from "lucide-react";
import { toast } from "sonner";

interface Character {
  id: string;
  name: string;
  concept: string | null;
  image_url: string | null;
  owner_id: string;
}
interface Member {
  user_id: string;
  role: string;
  profile?: { display_name: string; avatar_url: string | null };
}
interface GroupData {
  id: string;
  name: string;
  description: string | null;
  master_id: string;
  invite_code: string;
}

const GroupDetail = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isMaster = group?.master_id === user?.id;

  const load = async () => {
    if (!groupId) return;
    setLoading(true);
    const [g, c, m] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("characters").select("id,name,concept,image_url,owner_id").eq("group_id", groupId).order("created_at"),
      supabase.from("group_members").select("user_id, role").eq("group_id", groupId),
    ]);
    if (g.error || !g.data) {
      toast.error("Gruppo non trovato");
      navigate("/groups");
      return;
    }
    setGroup(g.data);
    setCharacters(c.data ?? []);

    const memberRows = m.data ?? [];
    const userIds = memberRows.map((r) => r.user_id);
    const profiles = userIds.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
      : { data: [] as any[] };

    setMembers(
      memberRows.map((r) => ({
        ...r,
        profile: profiles.data?.find((p: any) => p.id === r.user_id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [groupId]);

  const handleCreateChar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("characters")
      .insert({ name, concept: concept || null, group_id: groupId, owner_id: user.id })
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Eroe creato!");
      setCreateOpen(false);
      setName(""); setConcept("");
      navigate(`/characters/${data.id}`);
    }
  };

  const copyInvite = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.invite_code);
    toast.success("Codice copiato!");
  };

  const deleteGroup = async () => {
    if (!group || !confirm("Eliminare definitivamente questo gruppo e tutte le sue schede?")) return;
    const { error } = await supabase.from("groups").delete().eq("id", group.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Gruppo dissolto");
      navigate("/groups");
    }
  };

  if (loading || !group) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container py-8">
        <Link to="/groups" className="inline-flex items-center gap-1 text-sm font-script italic text-ink-faded hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4" /> Tutte le compagnie
        </Link>

        <div className="parchment-panel p-6 md:p-8 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl gold-text mb-2">{group.name}</h1>
              {group.description && (
                <p className="font-script italic text-ink-faded max-w-2xl">{group.description}</p>
              )}
            </div>
            {isMaster && (
              <Button variant="ghost" size="sm" onClick={deleteGroup} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Dissolvi
              </Button>
            )}
          </div>

          <div className="ornament-divider my-5"><span>✦</span></div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <Label className="text-xs font-heading uppercase tracking-wider text-ink-faded">Codice di invito</Label>
              <button onClick={copyInvite} className="flex items-center gap-2 font-mono bg-parchment-deep/40 px-3 py-1.5 rounded border border-border hover:border-primary transition-colors">
                {group.invite_code}
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1">
              <Label className="text-xs font-heading uppercase tracking-wider text-ink-faded mb-2 block">Membri</Label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 bg-parchment-deep/30 rounded-full pl-1 pr-3 py-1 border border-border/60">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">{m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-script">{m.profile?.display_name ?? "..."}</span>
                    {m.role === "master" && <Crown className="h-3.5 w-3.5 text-primary" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-2xl">Schede dei personaggi</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="font-heading"><Plus className="h-4 w-4 mr-2" /> Nuovo eroe</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display gold-text">Forgia un nuovo eroe</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateChar} className="space-y-4">
                <div>
                  <Label htmlFor="cname" className="font-heading">Nome</Label>
                  <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="cconcept" className="font-heading">Concept (opzionale)</Label>
                  <Input id="cconcept" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Es. Ladro elfico in cerca di redenzione" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting} className="font-heading">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Forgia"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {characters.length === 0 ? (
          <div className="parchment-panel p-10 text-center">
            <ScrollText className="h-12 w-12 text-primary/60 mx-auto mb-3" />
            <p className="font-script italic text-ink-faded">Nessuna scheda ancora. Forgia il tuo primo eroe!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {characters.map((c) => (
              <Link key={c.id} to={`/characters/${c.id}`}>
                <article className="parchment-panel overflow-hidden hover:shadow-glow transition-shadow group">
                  <div className="aspect-[4/3] bg-gradient-ember/20 relative overflow-hidden">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-parchment-deep to-parchment-shadow">
                        <ScrollText className="h-16 w-16 text-primary/40" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-heading text-lg group-hover:text-primary transition-colors">{c.name}</h3>
                    {c.concept && <p className="font-script italic text-sm text-ink-faded line-clamp-1">{c.concept}</p>}
                    {c.owner_id === user?.id && <Badge variant="outline" className="mt-2 text-xs">Tuo</Badge>}
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

export default GroupDetail;
