import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, BookOpen, Loader2, Scroll, ShieldCheck, Pencil, ExternalLink } from "lucide-react";
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

const Campaigns = () => {
  const { user, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [loading, setLoading] = useState(true);

  // create campaign dialog
  const [openCamp, setOpenCamp] = useState(false);
  const [campName, setCampName] = useState("");
  const [campDesc, setCampDesc] = useState("");
  const [campRuleset, setCampRuleset] = useState<string>("");

  // create ruleset dialog
  const [openRule, setOpenRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [ruleUrl, setRuleUrl] = useState("");

  // edit ruleset dialog
  const [editRule, setEditRule] = useState<Ruleset | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      supabase
        .from("campaigns")
        .select("id, name, description, ruleset_id, ruleset:rulesets(name)")
        .order("created_at", { ascending: true }),
      supabase.from("rulesets").select("id, name, description, external_url").order("name"),
    ]);
    if (c.error) toast.error("Impossibile caricare le campagne");
    else setCampaigns((c.data ?? []) as any);
    if (r.error) toast.error("Impossibile caricare i regolamenti");
    else setRulesets((r.data ?? []) as Ruleset[]);
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
      setCampName(""); setCampDesc(""); setCampRuleset("");
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
      setRuleName(""); setRuleDesc(""); setRuleUrl("");
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

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl gold-text mb-1">Le campagne</h1>
            <p className="font-script italic text-ink-faded">
              Le cronache aperte nelle Terre di Nadorryen
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Dialog open={openRule} onOpenChange={setOpenRule}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="font-heading">
                    <BookOpen className="h-4 w-4 mr-2" /> Nuovo regolamento
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
                      <Label htmlFor="rname" className="font-heading">Nome</Label>
                      <Input id="rname" value={ruleName} onChange={(e) => setRuleName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="rdesc" className="font-heading">Descrizione</Label>
                      <Textarea id="rdesc" value={ruleDesc} onChange={(e) => setRuleDesc(e.target.value)} rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="rurl" className="font-heading">Link al regolamento</Label>
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
                    <Plus className="h-4 w-4 mr-2" /> Nuova campagna
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
                      <Label htmlFor="cname" className="font-heading">Nome</Label>
                      <Input id="cname" value={campName} onChange={(e) => setCampName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="cdesc" className="font-heading">Descrizione</Label>
                      <Textarea id="cdesc" value={campDesc} onChange={(e) => setCampDesc(e.target.value)} rows={3} />
                    </div>
                    <div>
                      <Label className="font-heading">Regolamento</Label>
                      <Select value={campRuleset} onValueChange={setCampRuleset}>
                        <SelectTrigger>
                          <SelectValue placeholder="Scegli un regolamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {rulesets.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
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
        </div>

        {isAdmin && (
          <div className="parchment-panel p-3 mb-6 flex items-center gap-2 text-sm font-script italic text-ink-faded">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Sei <span className="font-heading not-italic text-ink">Admin</span>: puoi gestire campagne, regolamenti e membri.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="parchment-panel p-12 text-center">
            <Scroll className="h-16 w-16 mx-auto text-primary/60 mb-4" />
            <h2 className="font-heading text-2xl mb-2">Nessuna campagna ancora.</h2>
            <p className="font-script italic text-ink-faded">
              {isAdmin ? "Apri la prima cronaca." : "Attendi che un Admin apra una campagna."}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {campaigns.map((c) => (
              <Link key={c.id} to={`/campaigns/${c.id}`}>
                <article className="parchment-panel p-6 h-full hover:shadow-glow transition-shadow group">
                  <h3 className="font-heading text-xl group-hover:text-primary transition-colors mb-1">
                    {c.name}
                  </h3>
                  <p className="text-xs uppercase tracking-wider font-heading text-primary/80 mb-3">
                    {c.ruleset?.name ?? "—"}
                  </p>
                  {c.description && (
                    <p className="font-script text-sm text-ink-faded line-clamp-3">
                      {c.description}
                    </p>
                  )}
                  <div className="ornament-divider my-3"><span>✦</span></div>
                  <div className="flex items-center gap-1 text-sm text-ink-faded font-script">
                    <BookOpen className="h-4 w-4" /> Apri la cronaca
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* Sezione regolamenti */}
        <section className="mt-12">
          <h2 className="font-heading text-2xl mb-4">Regolamenti disponibili</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {rulesets.map((r) => (
              <div key={r.id} className="parchment-panel p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
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
                  <p className="font-script text-sm text-ink-faded mb-2">{r.description}</p>
                )}
                {r.external_url && (
                  <a
                    href={r.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-heading"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Apri il regolamento
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Edit ruleset dialog */}
        <Dialog open={!!editRule} onOpenChange={(o) => !o && setEditRule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display gold-text">Modifica regolamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveRuleset} className="space-y-4">
              <div>
                <Label htmlFor="ename" className="font-heading">Nome</Label>
                <Input id="ename" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="edesc" className="font-heading">Descrizione</Label>
                <Textarea id="edesc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
              </div>
              <div>
                <Label htmlFor="eurl" className="font-heading">Link al regolamento</Label>
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
