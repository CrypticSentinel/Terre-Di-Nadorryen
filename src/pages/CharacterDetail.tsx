import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { DiceRollerDock } from "@/components/DiceRoller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Loader2, Camera, BookMarked, ScrollText, Save, BookOpen, History } from "lucide-react";
import { toast } from "sonner";
import { isOpenSourceGdr } from "@/lib/rulesets";
import {
  OpenSourceGdrSheet,
  EMPTY_OSGDR_SHEET,
  normalizeOsgdrSheet,
  type OsgdrSheet,
} from "@/components/OpenSourceGdrSheet";
import { EditableLabel, type LabelOverride } from "@/components/EditableLabel";
import { Badge } from "@/components/ui/badge";

interface CustomField {
  id: string;
  label: string;
  value: string;
}
interface Character {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  concept: string | null;
  image_url: string | null;
  custom_fields: CustomField[];
}

const OSGDR_FIELD_ID = "__osgdr_sheet__";
const LABEL_OVERRIDES_FIELD_ID = "__label_overrides__";
const BACKGROUND_FIELD_ID = "__background__";

type LabelOverridesMap = Record<string, LabelOverride>;

function extractOsgdrSheet(fields: CustomField[]): OsgdrSheet {
  const f = fields.find((x) => x.id === OSGDR_FIELD_ID);
  if (!f) return { ...EMPTY_OSGDR_SHEET, ferite: { ...EMPTY_OSGDR_SHEET.ferite }, equipment: { ...EMPTY_OSGDR_SHEET.equipment }, abilities: { ...EMPTY_OSGDR_SHEET.abilities }, skills: [] };
  try { return normalizeOsgdrSheet(JSON.parse(f.value)); }
  catch { return normalizeOsgdrSheet({}); }
}

function packOsgdrSheet(fields: CustomField[], sheet: OsgdrSheet): CustomField[] {
  const others = fields.filter((x) => x.id !== OSGDR_FIELD_ID);
  return [...others, { id: OSGDR_FIELD_ID, label: "Open Source GDR", value: JSON.stringify(sheet) }];
}

function extractBackground(fields: CustomField[]): string {
  const f = fields.find((x) => x.id === BACKGROUND_FIELD_ID);
  return f?.value ?? "";
}
function packBackground(fields: CustomField[], background: string): CustomField[] {
  const others = fields.filter((x) => x.id !== BACKGROUND_FIELD_ID);
  if (!background.trim()) return others;
  return [...others, { id: BACKGROUND_FIELD_ID, label: "Background", value: background }];
}

function extractLabelOverrides(fields: CustomField[]): LabelOverridesMap {
  const f = fields.find((x) => x.id === LABEL_OVERRIDES_FIELD_ID);
  if (!f) return {};
  try {
    const parsed = JSON.parse(f.value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function packLabelOverrides(fields: CustomField[], overrides: LabelOverridesMap): CustomField[] {
  const others = fields.filter((x) => x.id !== LABEL_OVERRIDES_FIELD_ID);
  if (Object.keys(overrides).length === 0) return others;
  return [...others, { id: LABEL_OVERRIDES_FIELD_ID, label: "Label overrides", value: JSON.stringify(overrides) }];
}
interface Note {
  id: string;
  title: string;
  content: string;
  session_date: string | null;
  author_id: string;
  created_at: string;
}

const CharacterDetail = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const { user, isAdmin, isActingAsNarrator } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [character, setCharacter] = useState<Character | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<{ display_name: string } | null>(null);
  const [rulesetName, setRulesetName] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [osgdrSheet, setOsgdrSheet] = useState<OsgdrSheet>(EMPTY_OSGDR_SHEET);
  const [labelOverrides, setLabelOverrides] = useState<LabelOverridesMap>({});
  const [background, setBackground] = useState<string>("");
  const [bgSaving, setBgSaving] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>(undefined);

  interface AuditEntry {
    id: string;
    user_id: string;
    user_display_name: string | null;
    summary: string;
    details: any;
    created_at: string;
  }
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const dbSnapshotRef = useRef<{
    name: string;
    concept: string;
    fields: CustomField[];
    osgdrSheet: OsgdrSheet;
    background: string;
    owner_id: string;
  } | null>(null);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const isOwner = !!character && !!user && character.owner_id === user.id;
  const canEdit = isOwner || isAdmin || isActingAsNarrator;
  const canAssignCharacter = canEdit && (isAdmin || isActingAsNarrator);
  const canEditBackground = isOwner || isActingAsNarrator || isAdmin;
  const useOsgdrForm = isOpenSourceGdr(rulesetName);
  const visibleFields = fields.filter((f) => f.id !== OSGDR_FIELD_ID && f.id !== LABEL_OVERRIDES_FIELD_ID && f.id !== BACKGROUND_FIELD_ID);

  const load = async () => {
    if (!characterId) return;
    setLoading(true);
    const [c, n] = await Promise.all([
      supabase.from("characters").select("*, campaigns(ruleset_id, rulesets(name))").eq("id", characterId).maybeSingle(),
      supabase.from("session_notes").select("*").eq("character_id", characterId).order("created_at", { ascending: false }),
    ]);
    if (c.error || !c.data) {
      toast.error("Personaggio non trovato");
      navigate("/campaigns");
      return;
    }
    const raw = c.data as any;
    const ch = raw as Character;
    if (!Array.isArray(ch.custom_fields)) ch.custom_fields = [];
    setCharacter(ch);
    setAssignedUserId(ch.owner_id);
    setRulesetName(raw?.campaigns?.rulesets?.name ?? null);
    setName(ch.name);
    setConcept(ch.concept ?? "");
    setFields(ch.custom_fields);
    setOsgdrSheet(extractOsgdrSheet(ch.custom_fields));
    setLabelOverrides(extractLabelOverrides(ch.custom_fields));
    setBackground(extractBackground(ch.custom_fields));
    setNotes((n.data ?? []) as Note[]);

    dbSnapshotRef.current = {
      name: ch.name,
      concept: ch.concept ?? "",
      fields: ch.custom_fields,
      osgdrSheet: extractOsgdrSheet(ch.custom_fields),
      background: extractBackground(ch.custom_fields),
      owner_id: ch.owner_id,
    };

    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", ch.owner_id).maybeSingle();
    setOwnerProfile(prof ?? null);

    const { data: auditRows } = await supabase.from("character_audit_log").select("id, user_id, user_display_name, summary, details, created_at").eq("character_id", ch.id).order("created_at", { ascending: false }).limit(100);
    setAuditLog((auditRows ?? []) as AuditEntry[]);

    setLoading(false);
  };

  useEffect(() => { void load(); }, [characterId]);

  const addField = () => setFields((prev) => [...prev, { id: crypto.randomUUID(), label: "Nuovo campo", value: "" }]);
  const updateField = (id: string, key: "label" | "value", val: string) => setFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
  const removeField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));

  const persistLabelOverride = async (key: string, override: LabelOverride | undefined) => {
    if (!character) return;
    const next = { ...labelOverrides };
    if (!override || (override.text === undefined && override.size === undefined)) delete next[key];
    else next[key] = override;
    setLabelOverrides(next);
    const newFields = packLabelOverrides(fields, next);
    setFields(newFields);
    const { error } = await supabase.from("characters").update({ custom_fields: newFields as any }).eq("id", character.id);
    if (error) toast.error(error.message);
    else toast.success("Etichetta aggiornata");
  };

  const logAudit = async (summary: string, details?: any) => {
    if (!character || !user) return;
    let userName: string | null = null;
    try {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      userName = prof?.display_name ?? null;
    } catch {}
    await supabase.from("character_audit_log").insert({ character_id: character.id, user_id: user.id, user_display_name: userName, summary, details: details ?? null });
  };

  const buildChangeSummary = (snap: NonNullable<typeof dbSnapshotRef.current>) => {
    const changes: string[] = [];
    if (snap.name !== name) changes.push(`Nome: "${snap.name}" → "${name}"`);
    if ((snap.concept ?? "") !== (concept ?? "")) changes.push("Descrizione aggiornata");
    if (snap.owner_id !== (assignedUserId ?? character?.owner_id ?? snap.owner_id)) changes.push("Proprietario scheda aggiornato");
    if (useOsgdrForm) {
      const a1 = snap.osgdrSheet, a2 = osgdrSheet;
      const abilityKeys = Object.keys(a2.abilities ?? {}) as (keyof typeof a2.abilities)[];
      for (const k of abilityKeys) if ((a1.abilities?.[k] ?? 0) !== (a2.abilities?.[k] ?? 0)) changes.push(`${String(k).toUpperCase()}: ${a1.abilities?.[k] ?? 0} → ${a2.abilities?.[k] ?? 0}`);
      for (const sk of Object.keys(a2.magic ?? {})) if ((a1.magic as any)?.[sk] !== (a2.magic as any)?.[sk]) changes.push(`Magia ${sk}: ${(a1.magic as any)?.[sk] ?? 0} → ${(a2.magic as any)?.[sk] ?? 0}`);
      if ((a1.note ?? "") !== (a2.note ?? "")) changes.push("Note aggiornate");
      if ((a1.skills?.length ?? 0) !== (a2.skills?.length ?? 0)) changes.push(`Abilità: ${a1.skills?.length ?? 0} → ${a2.skills?.length ?? 0}`);
    } else {
      const v1 = snap.fields.filter((f) => f.id !== OSGDR_FIELD_ID && f.id !== LABEL_OVERRIDES_FIELD_ID && f.id !== BACKGROUND_FIELD_ID);
      const v2 = fields.filter((f) => f.id !== OSGDR_FIELD_ID && f.id !== LABEL_OVERRIDES_FIELD_ID && f.id !== BACKGROUND_FIELD_ID);
      if (JSON.stringify(v1) !== JSON.stringify(v2)) changes.push("Campi liberi modificati");
    }
    return changes;
  };

  const handleSave = async () => {
    if (!character) return;
    setSaving(true);
    const snap = dbSnapshotRef.current;
    let finalFields = useOsgdrForm ? packOsgdrSheet(fields, osgdrSheet) : fields;
    finalFields = packLabelOverrides(finalFields, labelOverrides);
    finalFields = packBackground(finalFields, background);
    const nextOwnerId = canAssignCharacter ? (assignedUserId ?? character.owner_id) : character.owner_id;
    const { error } = await supabase.from("characters").update({ name, concept: concept || null, custom_fields: finalFields as any, owner_id: nextOwnerId }).eq("id", character.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Scheda salvata");
      if (snap) {
        const changes = buildChangeSummary(snap);
        if (changes.length > 0) await logAudit(changes.length === 1 ? changes[0] : `${changes.length} modifiche alla scheda`, { changes });
      }
      await load();
    }
  };

  const saveBackground = async () => {
    if (!character) return;
    setBgSaving(true);
    const prev = dbSnapshotRef.current?.background ?? "";
    const finalFields = packBackground(fields, background);
    const { error } = await supabase.from("characters").update({ custom_fields: finalFields as any }).eq("id", character.id);
    setBgSaving(false);
    if (error) toast.error(error.message);
    else {
      setFields(finalFields);
      toast.success("Background salvato");
      if (prev !== background) await logAudit("Background aggiornato", { length_before: prev.length, length_after: background.length });
      await load();
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !character || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${character.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    const url = signed?.signedUrl ?? null;
    const { error: updErr } = await supabase.from("characters").update({ image_url: url }).eq("id", character.id);
    setUploading(false);
    if (updErr) toast.error(updErr.message);
    else {
      toast.success("Immagine aggiornata");
      await load();
    }
  };

  const handleDelete = async () => {
    if (!character || !confirm("Eliminare questa scheda?")) return;
    const { error } = await supabase.from("characters").delete().eq("id", character.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Scheda eliminata");
      navigate(`/campaigns/${character.campaign_id}`);
    }
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !character) return;
    setNoteSubmitting(true);
    const { error } = await supabase.from("session_notes").insert({
      character_id: character.id,
      author_id: user.id,
      title: noteTitle,
      content: noteContent,
      session_date: noteDate || null,
    });
    setNoteSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Annotazione aggiunta al diario");
      setNoteOpen(false);
      setNoteTitle(""); setNoteContent(""); setNoteDate("");
      await load();
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Eliminare questa annotazione?")) return;
    const { error } = await supabase.from("session_notes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Annotazione rimossa"); await load(); }
  };

  if (loading || !character) {
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
      <main className="container py-4 sm:py-6 lg:py-8">
        <Link
          to={`/campaigns/${character.campaign_id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm font-script italic text-ink-faded hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Torna alla campagna
        </Link>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
          <aside className="order-1 space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="parchment-panel p-3">
              <div className="relative group mx-auto aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded bg-gradient-to-br from-parchment-deep to-parchment-shadow">
                {character.image_url ? (
                  <img src={character.image_url} alt={character.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ScrollText className="h-20 w-20 text-primary/40" />
                  </div>
                )}
                {canEdit && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition-opacity hover:bg-ink/40 hover:opacity-100"
                  >
                    <div className="flex flex-col items-center gap-1 text-primary-foreground">
                      {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                      <span className="text-xs font-heading">Cambia immagine</span>
                    </div>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </div>
            </div>

            <DiceRollerDock
              campaignId={character.campaign_id}
              characterId={character.id}
              characterName={character.name}
            />
          </aside>

          <div className="space-y-4">
            <div className="parchment-panel p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  {canEdit ? (
                    <>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-auto border-0 border-b border-border rounded-none bg-transparent px-0 py-1 text-2xl gold-text focus-visible:border-primary focus-visible:ring-0 sm:text-3xl font-display"
                      />
                      <Input
                        value={concept}
                        onChange={(e) => setConcept(e.target.value)}
                        placeholder="Breve descrizione del personaggio..."
                        className="mt-1 h-auto border-0 bg-transparent px-0 font-script italic text-ink-faded focus-visible:ring-0 text-sm sm:text-base"
                      />
                    </>
                  ) : (
                    <>
                      <h1 className="font-display text-2xl gold-text sm:text-3xl">{character.name}</h1>
                      {character.concept && <p className="font-script italic text-ink-faded text-sm sm:text-base">{character.concept}</p>}
                    </>
                  )}
                  <div className="mt-2">
                    {isOwner ? (
                      <Badge variant="outline" className="text-xs">Tuo</Badge>
                    ) : ownerProfile ? (
                      <Badge variant="outline" className="text-xs">Di {ownerProfile.display_name}</Badge>
                    ) : null}
                  </div>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={handleDelete} className="shrink-0 self-start text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Tabs defaultValue="sheet">
                <TabsList className="flex h-auto w-full gap-2 overflow-x-auto whitespace-nowrap bg-parchment-deep/40 p-1">
                  <TabsTrigger value="sheet" className="shrink-0 font-heading text-xs sm:text-sm">
                    <ScrollText className="mr-1 h-4 w-4" /> Scheda
                  </TabsTrigger>
                  <TabsTrigger value="diary" className="shrink-0 font-heading text-xs sm:text-sm">
                    <BookMarked className="mr-1 h-4 w-4" /> Diario ({notes.length})
                  </TabsTrigger>
                  <TabsTrigger value="background" className="shrink-0 font-heading text-xs sm:text-sm">
                    <BookOpen className="mr-1 h-4 w-4" /> Background
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="shrink-0 font-heading text-xs sm:text-sm">
                    <History className="mr-1 h-4 w-4" /> Modifiche
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sheet" className="mt-4 space-y-4">
                  {useOsgdrForm ? (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="font-script italic text-xs text-ink-faded">
                          Scheda <strong>Open Source GDR</strong>
                          {isAdmin && (
                            <span className="ml-2 text-primary not-italic">
                              · Admin: passa il mouse sulle etichette per modificarne testo e dimensione.
                            </span>
                          )}
                        </p>
                      </div>
                      <OpenSourceGdrSheet
                        value={osgdrSheet}
                        onChange={setOsgdrSheet}
                        canEdit={!!canEdit}
                        labelOverrides={labelOverrides}
                        canCustomizeLabels={isAdmin}
                        onLabelOverrideChange={persistLabelOverride}
                        assignedUserId={assignedUserId}
                        onAssignedUserIdChange={setAssignedUserId}
                      />
                      {canEdit && (
                        <div className="flex pt-3 border-t border-border/40">
                          <Button size="sm" onClick={handleSave} disabled={saving} className="font-heading ml-auto">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Salva scheda</>}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {visibleFields.length === 0 && (
                        <p className="text-center font-script italic text-ink-faded py-6">
                          {canEdit ? "Nessun campo. Aggiungi caratteristiche, abilità, equipaggiamento, incantesimi..." : "Scheda vuota."}
                        </p>
                      )}

                      <div className="grid sm:grid-cols-2 gap-3">
                        {visibleFields.map((f) => (
                          <div key={f.id} className="bg-parchment-deep/20 border border-border/60 rounded p-3 group">
                            {canEdit ? (
                              <>
                                <div className="flex items-center gap-1 mb-1">
                                  <Input
                                    value={f.label}
                                    onChange={(e) => updateField(f.id, "label", e.target.value)}
                                    className="font-heading text-xs uppercase tracking-wider bg-transparent border-0 px-0 h-6 focus-visible:ring-0"
                                  />
                                  <button onClick={() => removeField(f.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <Textarea
                                  value={f.value}
                                  onChange={(e) => updateField(f.id, "value", e.target.value)}
                                  className="bg-transparent border-0 px-0 min-h-[40px] font-script focus-visible:ring-0 resize-none"
                                  rows={1}
                                />
                              </>
                            ) : (
                              <>
                                <EditableLabel
                                  defaultText={f.label}
                                  override={labelOverrides[`free.${f.id}`]}
                                  onChange={(o) => persistLabelOverride(`free.${f.id}`, o)}
                                  canCustomize={isAdmin}
                                  className="font-heading text-xs uppercase tracking-wider text-ink-faded"
                                  as="div"
                                />
                                <div
                                  className="font-script whitespace-pre-wrap"
                                  style={labelOverrides[`free.${f.id}.value`]?.size ? { fontSize: `${labelOverrides[`free.${f.id}.value`]!.size}px` } : undefined}
                                >
                                  {f.value}
                                </div>
                                {isAdmin && (
                                  <div className="mt-1">
                                    <EditableLabel
                                      defaultText="Dimensione testo"
                                      override={labelOverrides[`free.${f.id}.value`]}
                                      onChange={(o) => persistLabelOverride(`free.${f.id}.value`, o)}
                                      canCustomize={isAdmin}
                                      className="font-script italic text-[10px] text-ink-faded/70"
                                      as="span"
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {canEdit && (
                        <div className="flex gap-2 pt-3 border-t border-border/40">
                          <Button variant="outline" size="sm" onClick={addField} className="font-heading">
                            <Plus className="h-4 w-4 mr-1" /> Aggiungi campo
                          </Button>
                          <Button size="sm" onClick={handleSave} disabled={saving} className="font-heading ml-auto">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Salva scheda</>}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="diary" className="mt-4 space-y-4">
                  <div className="flex justify-end">
                    <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="font-heading"><Plus className="h-4 w-4 mr-1" /> Nuova annotazione</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="font-display gold-text">Annotazione di sessione</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={submitNote} className="space-y-3">
                          <div>
                            <Label className="font-heading">Titolo</Label>
                            <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} required />
                          </div>
                          <div>
                            <Label className="font-heading">Data sessione</Label>
                            <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
                          </div>
                          <div>
                            <Label className="font-heading">Cronaca</Label>
                            <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={6} required />
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={noteSubmitting} className="font-heading w-full sm:w-auto">
                              {noteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Annota"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {notes.length === 0 ? (
                    <p className="text-center font-script italic text-ink-faded py-6">Nessuna pagina ancora scritta nel diario.</p>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((n) => (
                        <article key={n.id} className="bg-parchment-deep/20 border border-border/60 rounded p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-heading text-lg">{n.title}</h4>
                              <p className="text-xs font-script italic text-ink-faded">
                                {n.session_date ? new Date(n.session_date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : new Date(n.created_at).toLocaleDateString("it-IT")}
                              </p>
                            </div>
                            {n.author_id === user?.id && (
                              <button onClick={() => deleteNote(n.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <p className="font-script whitespace-pre-wrap text-ink leading-relaxed drop-cap">{n.content}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="background" className="mt-4 space-y-3">
                  {canEditBackground ? (
                    <>
                      <Textarea
                        value={background}
                        onChange={(e) => setBackground(e.target.value)}
                        rows={14}
                        placeholder="Scrivi qui il background del personaggio: origini, motivazioni, legami, segreti..."
                        className="bg-parchment-deep/20 border-border/60 font-script focus-visible:ring-0"
                      />
                      <div className="flex justify-end pt-2 border-t border-border/40">
                        <Button size="sm" onClick={saveBackground} disabled={bgSaving} className="font-heading w-full sm:w-auto">
                          {bgSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Salva background</>}
                        </Button>
                      </div>
                    </>
                  ) : background.trim() ? (
                    <p className="font-script whitespace-pre-wrap text-ink leading-relaxed drop-cap">{background}</p>
                  ) : (
                    <p className="text-center font-script italic text-ink-faded py-6">Nessun background scritto.</p>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="mt-4 space-y-3">
                  {auditLog.length === 0 ? (
                    <p className="text-center font-script italic text-ink-faded py-6">Nessuna modifica registrata.</p>
                  ) : (
                    <ul className="space-y-2">
                      {auditLog.map((entry) => {
                        const changes: string[] = Array.isArray(entry.details?.changes) ? entry.details.changes : [];
                        return (
                          <li key={entry.id} className="bg-parchment-deep/20 border border-border/60 rounded p-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="font-heading text-sm">{entry.summary}</div>
                              <div className="text-xs font-script italic text-ink-faded">
                                {new Date(entry.created_at).toLocaleString("it-IT", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            <div className="text-xs font-script italic text-ink-faded mt-1">di {entry.user_display_name ?? "Utente sconosciuto"}</div>
                            {changes.length > 1 && (
                              <ul className="mt-2 list-disc list-inside text-sm font-script space-y-0.5">
                                {changes.map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CharacterDetail;
