import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, BookOpen, Loader2, Scroll, ShieldCheck, Pencil, ExternalLink, Skull, Crown, Users } from "lucide-react";
import { toast } from "sonner";

interface Ruleset {
  id: string;
  name: string;
  description: string | null;
  external_url: string | null;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  ruleset_id: string;
  ruleset?: { name: string };
}

interface Character {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  concept: string | null;
  image_url: string | null;
  created_at: string;
  is_dead: boolean;
  death_description: string | null;
  died_at: string | null;
}

const Campaigns = () => {
  const { user, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [loading, setLoading] = useState(true);

  const [openCamp, setOpenCamp] = useState(false);
  const [campName, setCampName] = useState("");
  const [campDesc, setCampDesc] = useState("");
  const [campRuleset, setCampRuleset] = useState<string>("");

  const [openRule, setOpenRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [ruleUrl, setRuleUrl] = useState("");

  const [editRule, setEditRule] = useState<Ruleset | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);

    const [c, r, p] = await Promise.all([
      supabase
        .from("campaigns")
        .select("id, name, description, ruleset_id, ruleset:rulesets(name)")
        .order("created_at", { ascending: true }),
      supabase
        .from("rulesets")
        .select("id, name, description, external_url")
        .order("name"),
      supabase
        .from("characters")
        .select(
          "id, campaign_id, owner_id, name, concept, image_url, created_at, is_dead, death_description, died_at"
        )
        .order("created_at", { ascending: true }),
    ]);

    if (c.error) toast.error("Impossibile caricare le campagne");
    else setCampaigns((c.data ?? []) as any);

    if (r.error) toast.error("Impossibile caricare i regolamenti");
    else setRulesets((r.data ?? []) as Ruleset[]);

    if (p.error) toast.error("Impossibile caricare i personaggi");
    else setCharacters((p.data ?? []) as Character[]);

    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campRuleset) {
      toast.error("Seleziona un regolamento");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("campaigns").insert({
      name: campName,
      description: campDesc || null,
      ruleset_id: campRuleset,
    });

    setSubmitting(false);

    if (error) toast.error(error.message);
    else {
      toast.success("Campagna creata!");
      setOpenCamp(false);
      setCampName("");
      setCampDesc("");
      setCampRuleset("");
      load();
    }
  };

  const createRuleset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from("rulesets").insert({
      name: ruleName,
      description: ruleDesc || null,
      external_url: ruleUrl.trim() || null,
    });

    setSubmitting(false);

    if (error) toast.error(error.message);
    else {
      toast.success("Regolamento creato!");
      setOpenRule(false);
      setRuleName("");
      setRuleDesc("");
      setRuleUrl("");
      load();
    }
  };

  const openEditRuleset = (r: Ruleset) => {
    setEditRule(r);
    setEditName(r.name);
    setEditDesc(r.description ?? "");
    setEditUrl(r.external_url ?? "");
  };

  const saveRuleset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRule) return;

    setSubmitting(true);

    const { error } = await supabase
      .from("rulesets")
      .update({
        name: editName,
        description: editDesc || null,
        external_url: editUrl.trim() || null,
      })
      .eq("id", editRule.id);

    setSubmitting(false);

    if (error) toast.error(error.message);
    else {
      toast.success("Regolamento aggiornato");
      setEditRule(null);
      load();
    }
  };

  const aliveByCampaign = useMemo(() => {
    return campaigns.reduce<Record<string, Character[]>>((acc, campaign) => {
      acc[campaign.id] = characters.filter((c) => c.campaign_id === campaign.id && !c.is_dead);
      return acc;
    }, {});
  }, [campaigns, characters]);

  const deadByCampaign = useMemo(() => {
    return campaigns.reduce<Record<string, Character[]>>((acc, campaign) => {
      acc[campaign.id] = characters.filter((c) => c.campaign_id === campaign.id && c.is_dead);
      return acc;
    }, {});
  }, [campaigns, characters]);

  return (
    <div className="min-h-screen">
      <main className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 font-display text-4xl gold-text">
            <Scroll className="h-8 w-8" />
            Le campagne
          </h1>
          <p className="font-script italic text-ink-faded">
            Le cronache aperte nelle Terre di Nadorryen
          </p>
        </div>

        {isAdmin && (
          <div className="parchment-panel mb-8 flex items-center gap-2 p-3 text-sm font-script italic text-ink-faded">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Sei <span className="font-heading not-italic text-ink">Admin</span>: puoi gestire campagne, regolamenti e membri.
          </div>
        )}

        {isAdmin && (
          <div className="mb-10 flex flex-wrap gap-2">
            <Dialog open={openRule} onOpenChange={setOpenRule}>
              <DialogTrigger asChild>
                <Button variant="outline" className="font-heading">
                  <BookOpen className="mr-2 h-4 w-4" /> Nuovo regolamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display gold-text">
                    Nuovo regolamento
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={createRuleset} className="space-y-4">
                  <div>
                    <Label htmlFor="rname" className="font-heading">
                      Nome
                    </Label>
                    <Input
                      id="rname"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="rdesc" className="font-heading">
                      Descrizione
                    </Label>
                    <Textarea
                      id="rdesc"
                      value={ruleDesc}
                      onChange={(e) => setRuleDesc(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="rurl" className="font-heading">
                      Link al regolamento
                    </Label>
                    <Input
                      id="rurl"
                      type="url"
                      placeholder="https://..."
                      value={ruleUrl}
                      onChange={(e) => setRuleUrl(e.target.value)}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={submitting} className="font-heading">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openCamp} onOpenChange={setOpenCamp}>
              <DialogTrigger asChild>
                <Button className="font-heading">
                  <Plus className="mr-2 h-4 w-4" /> Nuova campagna
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display gold-text">
                    Apri una nuova campagna
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={createCampaign} className="space-y-4">
                  <div>
                    <Label htmlFor="cname" className="font-heading">
                      Nome
                    </Label>
                    <Input
                      id="cname"
                      value={campName}
                      onChange={(e) => setCampName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="cdesc" className="font-heading">
                      Descrizione
                    </Label>
                    <Textarea
                      id="cdesc"
                      value={campDesc}
                      onChange={(e) => setCampDesc(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label className="font-heading">Regolamento</Label>
                    <Select value={campRuleset} onValueChange={setCampRuleset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Scegli un regolamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {rulesets.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={submitting} className="font-heading">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="parchment-panel p-12 text-center">
            <Scroll className="mx-auto mb-4 h-16 w-16 text-primary/60" />
            <h2 className="mb-2 font-heading text-2xl">Nessuna campagna ancora.</h2>
            <p className="font-script italic text-ink-faded">
              {isAdmin ? "Apri la prima cronaca." : "Attendi che un Admin apra una campagna."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {campaigns.map((c) => (
              <section key={c.id} className="space-y-4">
                <Link to={`/campaigns/${c.id}`}>
                  <article className="parchment-panel group h-full p-6 transition-shadow hover:shadow-glow">
                    <h3 className="mb-1 font-heading text-xl transition-colors group-hover:text-primary">
                      {c.name}
                    </h3>

                    <p className="mb-3 text-xs font-heading uppercase tracking-wider text-primary/80">
                      {c.ruleset?.name ?? "—"}
                    </p>

                    {c.description && (
                      <p className="line-clamp-3 font-script text-sm text-ink-faded">
                        {c.description}
                      </p>
                    )}

                    <div className="ornament-divider my-3">
                      <span>✦</span>
                    </div>

                    <div className="flex items-center gap-1 text-sm font-script text-ink-faded">
                      <BookOpen className="h-4 w-4" /> Apri la cronaca
                    </div>
                  </article>
                </Link>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="parchment-panel p-5">
                    <h4 className="mb-3 flex items-center gap-2 font-heading text-lg">
                      <Users className="h-4 w-4 text-primary" />
                      Eroi ancora in cammino
                    </h4>

                    {aliveByCampaign[c.id]?.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {aliveByCampaign[c.id].map((character) => (
                          <Link key={character.id} to={`/characters/${character.id}`} className="group">
                            <div className="rounded border border-border/60 bg-parchment-deep/20 p-3 transition hover:-translate-y-0.5">
                              <div className="mb-2 aspect-[3/4] overflow-hidden rounded bg-gradient-to-br from-parchment-deep to-parchment-shadow">
                                {character.image_url ? (
                                  <img
                                    src={character.image_url}
                                    alt={character.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Scroll className="h-10 w-10 text-primary/40" />
                                  </div>
                                )}
                              </div>
                              <h5 className="font-heading text-base">{character.name}</h5>
                              {character.concept && (
                                <p className="font-script text-xs italic text-ink-faded">
                                  {character.concept}
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="font-script italic text-ink-faded">
                        Nessun personaggio attivo in questa campagna.
                      </p>
                    )}
                  </div>

                  <div className="parchment-panel p-5">
                    <h4 className="mb-3 flex items-center gap-2 font-heading text-lg">
                      <Skull className="h-4 w-4 text-destructive" />
                      Cimitero
                    </h4>

                    {deadByCampaign[c.id]?.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {deadByCampaign[c.id].map((character) => (
                          <Link key={character.id} to={`/characters/${character.id}`} className="group">
                            <div className="rounded border border-destructive/20 bg-parchment-deep/20 p-3 transition hover:-translate-y-0.5">
                              <div className="mb-2 aspect-[3/4] overflow-hidden rounded bg-gradient-to-br from-parchment-deep to-parchment-shadow">
                                {character.image_url ? (
                                  <img
                                    src={character.image_url}
                                    alt={character.name}
                                    className="h-full w-full object-cover grayscale"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Skull className="h-10 w-10 text-destructive/40" />
                                  </div>
                                )}
                              </div>
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <h5 className="font-heading text-base">{character.name}</h5>
                                <Badge variant="destructive" className="text-[10px]">
                                  Caduto
                                </Badge>
                              </div>
                              <p className="line-clamp-3 font-script text-xs italic text-ink-faded">
                                {character.death_description?.trim()
                                  ? character.death_description
                                  : "La sua fine non è ancora stata trascritta."}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="font-script italic text-ink-faded">
                        Nessun personaggio è ancora stato affidato al Cimitero.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-2xl">
            <BookOpen className="h-5 w-5 text-primary" />
            Regolamenti disponibili
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {rulesets.map((r) => (
              <div key={r.id} className="parchment-panel p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h3 className="font-heading text-lg">{r.name}</h3>
                  </div>

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => openEditRuleset(r)}
                      aria-label="Modifica regolamento"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {r.description && (
                  <p className="mb-2 font-script text-sm text-ink-faded">{r.description}</p>
                )}

                {r.external_url && (
                  <a
                    href={r.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-heading text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Apri il regolamento
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <Dialog open={!!editRule} onOpenChange={(o) => !o && setEditRule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display gold-text">Modifica regolamento</DialogTitle>
            </DialogHeader>

            <form onSubmit={saveRuleset} className="space-y-4">
              <div>
                <Label htmlFor="ename" className="font-heading">
                  Nome
                </Label>
                <Input
                  id="ename"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="edesc" className="font-heading">
                  Descrizione
                </Label>
                <Textarea
                  id="edesc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="eurl" className="font-heading">
                  Link al regolamento
                </Label>
                <Input
                  id="eurl"
                  type="url"
                  placeholder="https://..."
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting} className="font-heading">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Campaigns;