import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Plus, Crown, Loader2, Trash2, ScrollText, UserPlus, ShieldCheck, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { isOpenSourceGdr } from "@/lib/rulesets";
import { OsgdrCharacterWizard, type WizardResult } from "@/components/OsgdrCharacterWizard";

interface Character {
  id: string;
  name: string;
  concept: string | null;
  image_url: string | null;
  owner_id: string;
}
interface Member {
  id: string;
  user_id: string;
  role: "narratore" | "giocatore";
  profile?: { display_name: string; avatar_url: string | null };
}
interface CampaignData {
  id: string;
  name: string;
  description: string | null;
  ruleset_id: string;
  ruleset?: { name: string };
}
interface ProfileLite {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

const CampaignDetail = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user, isAdmin, isActingAsNarrator, isActingAsPlayer } = useAuth();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);

  // create char dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // add member dialog (admin)
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<"giocatore" | "narratore">("giocatore");

  // edit campaign dialog (admin)
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isNarrator = myMembership?.role === "narratore";
  const isMember = !!myMembership;
  const narrator = members.find((m) => m.role === "narratore");

  const load = async () => {
    if (!campaignId) return;
    setLoading(true);
    const [camp, chars, mem] = await Promise.all([
      supabase
        .from("campaigns")
        .select("id, name, description, ruleset_id, ruleset:rulesets(name)")
        .eq("id", campaignId)
        .maybeSingle(),
      supabase
        .from("characters")
        .select("id, name, concept, image_url, owner_id")
        .eq("campaign_id", campaignId)
        .order("created_at"),
      supabase
        .from("campaign_members")
        .select("id, user_id, role")
        .eq("campaign_id", campaignId),
    ]);

    if (camp.error || !camp.data) {
      toast.error("Campagna non trovata");
      navigate("/campaigns");
      return;
    }
    setCampaign(camp.data as any);

    const memberRows = (mem.data ?? []) as Member[];
    const userIds = memberRows.map((r) => r.user_id);
    const profiles = userIds.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
      : { data: [] as ProfileLite[] };

    setMembers(
      memberRows.map((r) => ({
        ...r,
        profile: (profiles.data ?? []).find((p: any) => p.id === r.user_id) as any,
      }))
    );

    setCharacters((chars.data ?? []) as Character[]);

    if (isAdmin) {
      const all = await supabase.from("profiles").select("id, display_name, avatar_url");
      setAllProfiles((all.data ?? []) as ProfileLite[]);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [campaignId, isAdmin]);

  const handleCreateChar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !campaignId) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("characters")
      .insert({
        name,
        concept: concept || null,
        campaign_id: campaignId,
        owner_id: user.id,
      })
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

  const useOsgdr = isOpenSourceGdr(campaign?.ruleset?.name);
  const OSGDR_FIELD_ID = "__osgdr_sheet__";

  const handleWizardComplete = async (result: WizardResult) => {
    if (!user || !campaignId) return;
    setSubmitting(true);
    const customFields = [
      {
        id: OSGDR_FIELD_ID,
        label: "Open Source GDR",
        value: JSON.stringify(result.sheet),
      },
    ];
    const { data, error } = await supabase
      .from("characters")
      .insert({
        name: result.name,
        concept: result.concept || null,
        campaign_id: campaignId,
        owner_id: user.id,
        custom_fields: customFields as any,
      })
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Eroe creato!");
      setWizardOpen(false);
      navigate(`/characters/${data.id}`);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !newMemberId) return;
    setSubmitting(true);
    const { error } = await supabase.from("campaign_members").insert({
      campaign_id: campaignId,
      user_id: newMemberId,
      role: newMemberRole,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.error("Questa campagna ha già un narratore o l'utente è già membro");
      else toast.error(error.message);
    } else {
      toast.success("Membro aggiunto");
      setAddMemberOpen(false);
      setNewMemberId(""); setNewMemberRole("giocatore");
      load();
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Rimuovere questo membro dalla campagna?")) return;
    const { error } = await supabase.from("campaign_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Membro rimosso"); load(); }
  };

  const openEditCampaign = () => {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditDesc(campaign.description ?? "");
    setEditOpen(true);
  };

  const saveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("campaigns")
      .update({ name: editName, description: editDesc || null })
      .eq("id", campaign.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Campagna aggiornata");
      setEditOpen(false);
      load();
    }
  };

  const promoteToNarrator = async (memberId: string) => {
    if (narrator) {
      toast.error("C'è già un Narratore in questa campagna. Rimuovi prima il ruolo all'attuale Narratore.");
      return;
    }
    const { error } = await supabase
      .from("campaign_members")
      .update({ role: "narratore" })
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Narratore assegnato"); load(); }
  };

  const demoteNarrator = async (memberId: string) => {
    const { error } = await supabase
      .from("campaign_members")
      .update({ role: "giocatore" })
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Ruolo di Narratore rimosso"); load(); }
  };

  const deleteCampaign = async () => {
    if (!campaign || !confirm("Eliminare definitivamente questa campagna e tutte le sue schede?")) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Campagna eliminata");
      navigate("/campaigns");
    }
  };

  const deleteCharacter = async (charId: string, charName: string) => {
    if (!confirm(`Eliminare la scheda di "${charName}"? L'azione è irreversibile.`)) return;
    const { error } = await supabase.from("characters").delete().eq("id", charId);
    if (error) toast.error(error.message);
    else { toast.success("Scheda eliminata"); load(); }
  };

  if (loading || !campaign) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Schede visibili in lista: giocatore vede solo le sue, narratore/admin vedono tutte (RLS lo impone già)
  const visibleCharacters = isNarrator || isAdmin
    ? characters
    : characters.filter((c) => c.owner_id === user?.id);

  const availableProfiles = allProfiles.filter(
    (p) => !members.some((m) => m.user_id === p.id)
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container py-8">
        <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm font-script italic text-ink-faded hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4" /> Tutte le campagne
        </Link>

        <div className="parchment-panel p-6 md:p-8 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-heading text-primary/80 mb-1">
                {campaign.ruleset?.name}
              </p>
              <h1 className="font-display text-3xl md:text-4xl gold-text mb-2">{campaign.name}</h1>
              {campaign.description && (
                <p className="font-script italic text-ink-faded max-w-2xl">{campaign.description}</p>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={openEditCampaign}>
                  <Pencil className="h-4 w-4 mr-1" /> Modifica
                </Button>
                <Button variant="ghost" size="sm" onClick={deleteCampaign} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Elimina
                </Button>
              </div>
            )}
          </div>

          <div className="ornament-divider my-5"><span>✦</span></div>

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-heading uppercase tracking-wider text-ink-faded">
                  Membri
                </Label>
                {isAdmin && (
                  <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="font-heading h-7">
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Aggiungi
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-display gold-text">Aggiungi un membro</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={addMember} className="space-y-4">
                        <div>
                          <Label className="font-heading">Utente</Label>
                          <Select value={newMemberId} onValueChange={setNewMemberId}>
                            <SelectTrigger><SelectValue placeholder="Scegli un utente" /></SelectTrigger>
                            <SelectContent>
                              {availableProfiles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="font-heading">Ruolo</Label>
                          <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="giocatore">Giocatore</SelectItem>
                              <SelectItem value="narratore" disabled={!!narrator}>
                                Narratore {narrator ? "(già assegnato)" : ""}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={submitting || !newMemberId} className="font-heading">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aggiungi"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {members.length === 0 && (
                  <span className="font-script italic text-ink-faded text-sm">Nessun membro ancora.</span>
                )}
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 bg-parchment-deep/30 rounded-full pl-1 pr-2 py-1 border border-border/60">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-script">{m.profile?.display_name ?? "..."}</span>
                    {m.role === "narratore" && (
                      <Crown className="h-3.5 w-3.5 text-primary" aria-label="Narratore" />
                    )}
                    {isAdmin && m.role === "giocatore" && !narrator && (
                      <button
                        onClick={() => promoteToNarrator(m.id)}
                        className="text-primary/70 hover:text-primary ml-1"
                        aria-label="Promuovi a Narratore"
                        title="Promuovi a Narratore"
                      >
                        <Crown className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isAdmin && m.role === "narratore" && (
                      <button
                        onClick={() => demoteNarrator(m.id)}
                        className="text-ink-faded hover:text-ink ml-1"
                        aria-label="Rimuovi ruolo Narratore"
                        title="Rimuovi ruolo Narratore"
                      >
                        <Crown className="h-3.5 w-3.5 line-through opacity-60" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-destructive/70 hover:text-destructive ml-1"
                        aria-label="Rimuovi"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(isNarrator || isAdmin) && (
            <div className="mt-4 flex items-center gap-2 text-xs font-script italic text-ink-faded">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {isAdmin ? "Come Admin vedi tutte le schede." : "Come Narratore vedi tutte le schede dei giocatori."}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-2xl">
            {isNarrator || isAdmin ? "Schede della campagna" : "Le tue schede"}
          </h2>
          {((isMember && !isNarrator) || isAdmin) && (
            // Il wizard OSGDR si attiva SOLO se l'utente sta agendo come Giocatore.
            // Admin e Narratore aprono direttamente la compilazione libera.
            useOsgdr && isActingAsPlayer ? (
              <Button className="font-heading" onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nuovo eroe
              </Button>
            ) : (
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
                      <Label htmlFor="cconcept" className="font-heading">Breve descrizione</Label>
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
            )
          )}
        </div>

        {!isMember && !isAdmin ? (
          <div className="parchment-panel p-10 text-center">
            <p className="font-script italic text-ink-faded">
              Non sei membro di questa campagna. Chiedi all'Admin di aggiungerti.
            </p>
          </div>
        ) : visibleCharacters.length === 0 ? (
          <div className="parchment-panel p-10 text-center">
            <ScrollText className="h-12 w-12 text-primary/60 mx-auto mb-3" />
            <p className="font-script italic text-ink-faded">Nessuna scheda ancora.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleCharacters.map((c) => {
              const canDelete = c.owner_id === user?.id || isAdmin;
              return (
                <article key={c.id} className="parchment-panel overflow-hidden hover:shadow-glow transition-shadow group relative">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteCharacter(c.id, c.name); }}
                      title="Elimina scheda"
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-ink/50 text-destructive opacity-0 group-hover:opacity-100 hover:bg-ink/70 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <Link to={`/characters/${c.id}`} className="block">
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
                      {(() => {
                        if (c.owner_id === user?.id) {
                          return <Badge variant="outline" className="mt-2 text-xs">Tuo</Badge>;
                        }
                        // Per Admin/Narratore mostra il nome del giocatore proprietario
                        if (isAdmin || isActingAsNarrator || isNarrator) {
                          const ownerMember = members.find((m) => m.user_id === c.owner_id);
                          const ownerName =
                            ownerMember?.profile?.display_name ??
                            allProfiles.find((p) => p.id === c.owner_id)?.display_name ??
                            "Giocatore";
                          return (
                            <Badge variant="outline" className="mt-2 text-xs">
                              Di {ownerName}
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {/* Edit campaign dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display gold-text">Modifica campagna</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveCampaign} className="space-y-4">
              <div>
                <Label htmlFor="ecname" className="font-heading">Nome</Label>
                <Input id="ecname" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="ecdesc" className="font-heading">Descrizione</Label>
                <Textarea id="ecdesc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="font-heading">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Wizard creazione personaggio OSGDR */}
        <OsgdrCharacterWizard
          open={wizardOpen}
          submitting={submitting}
          onCancel={() => setWizardOpen(false)}
          onComplete={handleWizardComplete}
        />
      </main>
    </div>
  );
};

export default CampaignDetail;
