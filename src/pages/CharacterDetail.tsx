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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Camera,
  BookMarked,
  ScrollText,
  Save,
  BookOpen,
  History,
  Skull,
} from "lucide-react";
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
  is_dead: boolean;
  death_description: string | null;
  died_at: string | null;
}

const OSGDR_FIELD_ID = "osgdr_sheet";
const LABEL_OVERRIDES_FIELD_ID = "label_overrides";
const BACKGROUND_FIELD_ID = "background";

type LabelOverridesMap = Record<string, LabelOverride>;

function extractOsgdrSheet(fields: CustomField[]): OsgdrSheet {
  const f = fields.find((x) => x.id === OSGDR_FIELD_ID);
  if (!f) {
    return {
      ...EMPTY_OSGDR_SHEET,
      ferite: [...EMPTY_OSGDR_SHEET.ferite],
      equipment: [...EMPTY_OSGDR_SHEET.equipment],
      abilities: { ...EMPTY_OSGDR_SHEET.abilities },
      skills: [...EMPTY_OSGDR_SHEET.skills],
    };
  }
  try {
    return normalizeOsgdrSheet(JSON.parse(f.value));
  } catch {
    return normalizeOsgdrSheet({});
  }
}

function packOsgdrSheet(fields: CustomField[], sheet: OsgdrSheet): CustomField[] {
  const others = fields.filter((x) => x.id !== OSGDR_FIELD_ID);
  return [
    ...others,
    {
      id: OSGDR_FIELD_ID,
      label: "Open Source GDR",
      value: JSON.stringify(sheet),
    },
  ];
}

function extractBackground(fields: CustomField[]): string {
  const f = fields.find((x) => x.id === BACKGROUND_FIELD_ID);
  return f?.value ?? "";
}

function packBackground(fields: CustomField[], background: string): CustomField[] {
  const others = fields.filter((x) => x.id !== BACKGROUND_FIELD_ID);
  if (!background.trim()) return others;
  return [
    ...others,
    {
      id: BACKGROUND_FIELD_ID,
      label: "Background",
      value: background,
    },
  ];
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
  return [
    ...others,
    {
      id: LABEL_OVERRIDES_FIELD_ID,
      label: "Label overrides",
      value: JSON.stringify(overrides),
    },
  ];
}

interface Note {
  id: string;
  title: string;
  content: string;
  session_date: string | null;
  author_id: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  user_id: string;
  user_display_name: string | null;
  summary: string;
  details: any;
  created_at: string;
}

const CharacterDetail = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const { user, isAdmin, isActingAsNarrator } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [character, setCharacter] = useState<Character | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<{ display_name: string } | null>(null);
  const [rulesetName, setRulesetName] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);

  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [osgdrSheet, setOsgdrSheet] = useState<OsgdrSheet>(EMPTY_OSGDR_SHEET);
  const [labelOverrides, setLabelOverrides] = useState<LabelOverridesMap>({});
  const [background, setBackground] = useState("");

  const [isDead, setIsDead] = useState(false);
  const [deathDescription, setDeathDescription] = useState("");
  const [diedAt, setDiedAt] = useState("");

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const dbSnapshotRef = useRef<{
    name: string;
    concept: string;
    fields: CustomField[];
    osgdrSheet: OsgdrSheet;
    background: string;
    isDead: boolean;
    deathDescription: string;
    diedAt: string;
  } | null>(null);

  const isOwner = !!character && !!user && character.owner_id === user.id;
  const canEdit = isOwner;
  const canEditBackground = isOwner || isActingAsNarrator || isAdmin;
  const canManageDeath = isActingAsNarrator || isAdmin;
  const useOsgdrForm = isOpenSourceGdr(rulesetName);

  const visibleFields = fields.filter(
    (f) =>
      f.id !== OSGDR_FIELD_ID &&
      f.id !== LABEL_OVERRIDES_FIELD_ID &&
      f.id !== BACKGROUND_FIELD_ID
  );

  const load = async () => {
    if (!characterId) return;
    setLoading(true);

    const [c, n] = await Promise.all([
      supabase
        .from("characters")
        .select(
          `
          *,
          campaigns (
            ruleset_id,
            rulesets (
              name
            )
          )
        `
        )
        .eq("id", characterId)
        .maybeSingle(),
      supabase
        .from("session_notes")
        .select("*")
        .eq("character_id", characterId)
        .order("created_at", { ascending: false }),
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
    setRulesetName(raw?.campaigns?.rulesets?.name ?? null);
    setName(ch.name);
    setConcept(ch.concept ?? "");
    setFields(ch.custom_fields);
    setOsgdrSheet(extractOsgdrSheet(ch.custom_fields));
    setLabelOverrides(extractLabelOverrides(ch.custom_fields));
    setBackground(extractBackground(ch.custom_fields));
    setNotes((n.data ?? []) as Note[]);
    setIsDead(!!ch.is_dead);
    setDeathDescription(ch.death_description ?? "");
    setDiedAt(ch.died_at ? ch.died_at.slice(0, 10) : "");

    dbSnapshotRef.current = {
      name: ch.name,
      concept: ch.concept ?? "",
      fields: ch.custom_fields,
      osgdrSheet: extractOsgdrSheet(ch.custom_fields),
      background: extractBackground(ch.custom_fields),
      isDead: !!ch.is_dead,
      deathDescription: ch.death_description ?? "",
      diedAt: ch.died_at ? ch.died_at.slice(0, 10) : "",
    };

    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", ch.owner_id)
      .maybeSingle();

    setOwnerProfile(prof ?? null);

    const { data: auditRows } = await supabase
      .from("character_audit_log")
      .select("id, user_id, user_display_name, summary, details, created_at")
      .eq("character_id", ch.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setAuditLog((auditRows ?? []) as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [characterId]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "Nuovo campo", value: "" },
    ]);
  };

  const updateField = (id: string, key: "label" | "value", val: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const persistLabelOverride = async (key: string, override?: LabelOverride) => {
    if (!character) return;

    const next = { ...labelOverrides };
    if (!override || (override.text === undefined && override.size === undefined)) {
      delete next[key];
    } else {
      next[key] = override;
    }

    setLabelOverrides(next);

    const newFields = packLabelOverrides(fields, next);
    setFields(newFields);

    const { error } = await supabase
      .from("characters")
      .update({ custom_fields: newFields as any })
      .eq("id", character.id);

    if (error) toast.error(error.message);
    else toast.success("Etichetta aggiornata");
  };

  const logAudit = async (summary: string, details?: any) => {
    if (!character || !user) return;

    let userName: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      userName = prof?.display_name ?? null;
    } catch {}

    await supabase.from("character_audit_log").insert({
      character_id: character.id,
      user_id: user.id,
      user_display_name: userName,
      summary,
      details: details ?? null,
    });
  };

  const buildChangeSummary = (snap: NonNullable<typeof dbSnapshotRef.current>) => {
    const changes: string[] = [];

    if (snap.name !== name) changes.push(`Nome: "${snap.name}" → "${name}"`);
    if ((snap.concept ?? "") !== (concept ?? "")) changes.push("Descrizione aggiornata");

    if (snap.isDead !== isDead) {
      changes.push(isDead ? "Personaggio segnato come deceduto" : "Personaggio rimosso dal Cimitero");
    }

    if ((snap.deathDescription ?? "") !== (deathDescription ?? "")) {
      changes.push("Cronaca della morte aggiornata");
    }

    if ((snap.diedAt ?? "") !== (diedAt ?? "")) {
      changes.push("Data della morte aggiornata");
    }

    if (useOsgdrForm) {
      const a1 = snap.osgdrSheet;
      const a2 = osgdrSheet;
      const abilityKeys = Object.keys(a2.abilities ?? {}) as (keyof typeof a2.abilities)[];
      for (const k of abilityKeys) {
        if ((a1.abilities?.[k] ?? 0) !== (a2.abilities?.[k] ?? 0)) {
          changes.push(`${String(k).toUpperCase()}: ${a1.abilities?.[k] ?? 0} → ${a2.abilities?.[k] ?? 0}`);
        }
      }
      for (const sk of Object.keys(a2.magic ?? {})) {
        if ((a1.magic as any)?.[sk] !== (a2.magic as any)?.[sk]) {
          changes.push(`Magia ${sk}: ${(a1.magic as any)?.[sk] ?? 0} → ${(a2.magic as any)?.[sk] ?? 0}`);
        }
      }
      if ((a1.note ?? "") !== (a2.note ?? "")) changes.push("Note aggiornate");
      if ((a1.skills?.length ?? 0) !== (a2.skills?.length ?? 0)) {
        changes.push(`Abilità: ${a1.skills?.length ?? 0} → ${a2.skills?.length ?? 0}`);
      }
    } else {
      const v1 = snap.fields.filter(
        (f) =>
          f.id !== OSGDR_FIELD_ID &&
          f.id !== LABEL_OVERRIDES_FIELD_ID &&
          f.id !== BACKGROUND_FIELD_ID
      );
      const v2 = fields.filter(
        (f) =>
          f.id !== OSGDR_FIELD_ID &&
          f.id !== LABEL_OVERRIDES_FIELD_ID &&
          f.id !== BACKGROUND_FIELD_ID
      );
      if (JSON.stringify(v1) !== JSON.stringify(v2)) changes.push("Campi liberi modificati");
    }

    return changes;
  };

  const handleSave = async () => {
    if (!character) return;

    if (isDead && !deathDescription.trim()) {
      toast.error("Scrivi come è morto il personaggio prima di salvarlo.");
      return;
    }

    setSaving(true);
    const snap = dbSnapshotRef.current;

    let finalFields = useOsgdrForm ? packOsgdrSheet(fields, osgdrSheet) : fields;
    finalFields = packLabelOverrides(finalFields, labelOverrides);
    finalFields = packBackground(finalFields, background);

    const payload: any = {
      name,
      concept: concept || null,
      custom_fields: finalFields as any,
    };

    if (canManageDeath) {
      payload.is_dead = isDead;
      payload.death_description = isDead ? deathDescription.trim() || null : null;
      payload.died_at = isDead ? (diedAt ? new Date(`${diedAt}T12:00:00`).toISOString() : new Date().toISOString()) : null;
    }

    const { error } = await supabase
      .from("characters")
      .update(payload)
      .eq("id", character.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Scheda salvata");

      if (snap) {
        const changes = buildChangeSummary(snap);
        if (changes.length > 0) {
          await logAudit(
            changes.length === 1 ? changes[0] : `${changes.length} modifiche alla scheda`,
            { changes }
          );
        }
      }

      load();
    }
  };

  const saveBackground = async () => {
    if (!character) return;

    setBgSaving(true);
    const prev = dbSnapshotRef.current?.background ?? "";
    const finalFields = packBackground(fields, background);

    const { error } = await supabase
      .from("characters")
      .update({ custom_fields: finalFields as any })
      .eq("id", character.id);

    setBgSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      setFields(finalFields);
      toast.success("Background salvato");
      if (prev !== background) {
        await logAudit("Background aggiornato", {
          lengthBefore: prev.length,
          lengthAfter: background.length,
        });
      }
      load();
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !character || !user) return;

    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${character.id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }

    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);

    const url = signed?.signedUrl ?? null;

    const { error: updErr } = await supabase
      .from("characters")
      .update({ image_url: url })
      .eq("id", character.id);

    setUploading(false);

    if (updErr) {
      toast.error(updErr.message);
    } else {
      toast.success("Immagine aggiornata");
      load();
    }
  };

  const handleDelete = async () => {
    if (!character || !confirm("Eliminare questa scheda?")) return;

    const { error } = await supabase.from("characters").delete().eq("id", character.id);

    if (error) {
      toast.error(error.message);
    } else {
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

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Annotazione aggiunta al diario");
      setNoteOpen(false);
      setNoteTitle("");
      setNoteContent("");
      setNoteDate("");
      load();
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Eliminare questa annotazione?")) return;

    const { error } = await supabase.from("session_notes").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Annotazione rimossa");
      load();
    }
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

      <main className="container py-8">
        <Link
          to={`/campaigns/${character.campaign_id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm font-script italic text-ink-faded hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alla campagna
        </Link>

        <div className="grid gap-4 lg:grid-cols-[300px_1fr] lg:gap-6">
          <aside className="space-y-5">
            <div className="parchment-panel p-3">
              <div className="group relative mx-auto aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded bg-gradient-to-br from-parchment-deep to-parchment-shadow">
                {character.image_url ? (
                  <img
                    src={character.image_url}
                    alt={character.name}
                    className={`h-full w-full object-cover ${character.is_dead ? "grayscale opacity-80" : ""}`}
                  />
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
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Camera className="h-6 w-6" />
                      )}
                      <span className="text-xs font-heading">Cambia immagine</span>
                    </div>
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                  className="hidden"
                />
              </div>

              {character.is_dead && (
                <div className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-3">
                  <div className="mb-1 flex items-center gap-2 font-heading text-sm text-destructive">
                    <Skull className="h-4 w-4" />
                    Caduto in avventura
                  </div>
                  <p className="font-script text-xs italic text-ink-faded">
                    {character.died_at
                      ? `Registrato il ${new Date(character.died_at).toLocaleDateString("it-IT")}`
                      : "La data della morte non è stata indicata."}
                  </p>
                </div>
              )}
            </div>

            <DiceRollerDock
              campaignId={character.campaign_id}
              characterId={character.id}
              characterName={character.name}
            />
          </aside>

          <div className="space-y-5">
            <div className="parchment-panel p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  {canEdit ? (
                    <>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-auto rounded-none border-0 border-b border-border bg-transparent px-0 py-1 font-display text-3xl gold-text focus-visible:ring-0 focus-visible:border-primary"
                      />
                      <Input
                        value={concept}
                        onChange={(e) => setConcept(e.target.value)}
                        placeholder="Breve descrizione del personaggio..."
                        className="mt-1 h-auto border-0 bg-transparent px-0 font-script italic text-ink-faded focus-visible:ring-0"
                      />
                    </>
                  ) : (
                    <>
                      <h1 className="font-display text-3xl gold-text">{character.name}</h1>
                      {character.concept && (
                        <p className="font-script italic text-ink-faded">{character.concept}</p>
                      )}
                    </>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {isOwner ? (
                      <Badge variant="outline" className="text-xs">
                        Tuo
                      </Badge>
                    ) : ownerProfile ? (
                      <Badge variant="outline" className="text-xs">
                        Di {ownerProfile.display_name}
                      </Badge>
                    ) : null}

                    {character.is_dead && (
                      <Badge variant="destructive" className="text-xs">
                        Deceduto
                      </Badge>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="shrink-0 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Tabs defaultValue="sheet">
                <TabsList className="h-auto flex-wrap bg-parchment-deep/40">
                  <TabsTrigger value="sheet" className="font-heading">
                    <ScrollText className="mr-1 h-4 w-4" />
                    Scheda
                  </TabsTrigger>
                  <TabsTrigger value="diary" className="font-heading">
                    <BookMarked className="mr-1 h-4 w-4" />
                    Diario {notes.length > 0 ? `(${notes.length})` : ""}
                  </TabsTrigger>
                  <TabsTrigger value="background" className="font-heading">
                    <BookOpen className="mr-1 h-4 w-4" />
                    Background
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="font-heading">
                    <History className="mr-1 h-4 w-4" />
                    Modifiche
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sheet" className="mt-4 space-y-4">
                  {canManageDeath && (
                    <div className="parchment-panel border border-destructive/30 bg-destructive/5 p-5">
                      <div className="mb-3">
                        <h3 className="flex items-center gap-2 font-heading text-lg text-destructive">
                          <Skull className="h-5 w-5" />
                          Destino del personaggio
                        </h3>
                        <p className="font-script text-sm italic text-ink-faded">
                          Solo Admin o Narratore possono segnare la morte del personaggio e affidarlo al Cimitero.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <label className="flex items-center gap-2 font-heading text-sm">
                          <input
                            type="checkbox"
                            checked={isDead}
                            onChange={(e) => setIsDead(e.target.checked)}
                            className="h-4 w-4"
                          />
                          Personaggio deceduto
                        </label>

                        {isDead && (
                          <div className="grid gap-4">
                            <div>
                              <Label className="font-heading">Data della morte</Label>
                              <Input
                                type="date"
                                value={diedAt}
                                onChange={(e) => setDiedAt(e.target.value)}
                              />
                            </div>

                            <div>
                              <Label className="font-heading">Come è morto</Label>
                              <Textarea
                                value={deathDescription}
                                onChange={(e) => setDeathDescription(e.target.value)}
                                rows={5}
                                placeholder="Descrivi il fato del personaggio, l'ultimo scontro, il sacrificio o la rovina..."
                                className="font-script"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {useOsgdrForm ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-script text-xs italic text-ink-faded">
                          Scheda <strong>Open Source GDR</strong>.
                          {isAdmin && (
                            <span className="ml-2 not-italic text-primary">
                              Admin: passa il mouse sulle etichette per modificarne testo e dimensione.
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
                      />

                      {canEdit && (
                        <div className="flex border-t border-border/40 pt-3">
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="ml-auto font-heading"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="mr-1 h-4 w-4" />
                                Salva scheda
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : visibleFields.length === 0 ? (
                    <p className="py-6 text-center font-script italic text-ink-faded">
                      {canEdit
                        ? "Nessun campo. Aggiungi caratteristiche, abilità, equipaggiamento, incantesimi..."
                        : "Scheda vuota."}
                    </p>
                  ) : null}

                  {!useOsgdrForm && visibleFields.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {visibleFields.map((f) => (
                        <div
                          key={f.id}
                          className="group rounded border border-border/60 bg-parchment-deep/20 p-3"
                        >
                          {canEdit ? (
                            <>
                              <div className="mb-1 flex items-center gap-1">
                                <Input
                                  value={f.label}
                                  onChange={(e) => updateField(f.id, "label", e.target.value)}
                                  className="h-6 border-0 bg-transparent px-0 font-heading text-xs uppercase tracking-wider focus-visible:ring-0"
                                />
                                <button
                                  onClick={() => removeField(f.id)}
                                  className="text-destructive opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <Textarea
                                value={f.value}
                                onChange={(e) => updateField(f.id, "value", e.target.value)}
                                className="min-h-[40px] resize-none border-0 bg-transparent px-0 font-script focus-visible:ring-0"
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
                                style={
                                  labelOverrides[`free.${f.id}.value`]?.size
                                    ? { fontSize: `${labelOverrides[`free.${f.id}.value`]!.size}px` }
                                    : undefined
                                }
                              >
                                {f.value}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!useOsgdrForm && canEdit && (
                    <div className="flex gap-2 border-t border-border/40 pt-3">
                      <Button variant="outline" size="sm" onClick={addField} className="font-heading">
                        <Plus className="mr-1 h-4 w-4" />
                        Aggiungi campo
                      </Button>

                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="ml-auto font-heading"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="mr-1 h-4 w-4" />
                            Salva scheda
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {useOsgdrForm && canManageDeath && !canEdit && (
                    <div className="flex justify-end border-t border-border/40 pt-3">
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="font-heading"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="mr-1 h-4 w-4" />
                            Salva destino
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="diary" className="mt-4 space-y-4">
                  <div className="flex justify-end">
                    <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="font-heading">
                          <Plus className="mr-1 h-4 w-4" />
                          Nuova annotazione
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="font-display gold-text">
                            Annotazione di sessione
                          </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={submitNote} className="space-y-3">
                          <div>
                            <Label className="font-heading">Titolo</Label>
                            <Input
                              value={noteTitle}
                              onChange={(e) => setNoteTitle(e.target.value)}
                              required
                            />
                          </div>

                          <div>
                            <Label className="font-heading">Data sessione</Label>
                            <Input
                              type="date"
                              value={noteDate}
                              onChange={(e) => setNoteDate(e.target.value)}
                            />
                          </div>

                          <div>
                            <Label className="font-heading">Cronaca</Label>
                            <Textarea
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              rows={6}
                              required
                            />
                          </div>

                          <DialogFooter>
                            <Button type="submit" disabled={noteSubmitting} className="font-heading">
                              {noteSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Annota"
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {notes.length === 0 ? (
                    <p className="py-6 text-center font-script italic text-ink-faded">
                      Nessuna pagina ancora scritta nel diario.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((n) => (
                        <article
                          key={n.id}
                          className="rounded border border-border/60 bg-parchment-deep/20 p-4"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-heading text-lg">{n.title}</h4>
                              <p className="text-xs font-script italic text-ink-faded">
                                {n.session_date
                                  ? new Date(n.session_date).toLocaleDateString("it-IT", {
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    })
                                  : new Date(n.created_at).toLocaleDateString("it-IT")}
                              </p>
                            </div>

                            {n.author_id === user?.id && (
                              <button onClick={() => deleteNote(n.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <p className="drop-cap font-script leading-relaxed text-ink whitespace-pre-wrap">
                            {n.content}
                          </p>
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
                        className="border-border/60 bg-parchment-deep/20 font-script focus-visible:ring-0"
                      />
                      <div className="flex justify-end border-t border-border/40 pt-2">
                        <Button
                          size="sm"
                          onClick={saveBackground}
                          disabled={bgSaving}
                          className="font-heading"
                        >
                          {bgSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="mr-1 h-4 w-4" />
                              Salva background
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : background.trim() ? (
                    <p className="drop-cap font-script leading-relaxed text-ink whitespace-pre-wrap">
                      {background}
                    </p>
                  ) : (
                    <p className="py-6 text-center font-script italic text-ink-faded">
                      Nessun background scritto.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="mt-4 space-y-3">
                  {auditLog.length === 0 ? (
                    <p className="py-6 text-center font-script italic text-ink-faded">
                      Nessuna modifica registrata.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {auditLog.map((entry) => {
                        const changes: string[] = Array.isArray(entry.details?.changes)
                          ? entry.details.changes
                          : [];

                        return (
                          <li
                            key={entry.id}
                            className="rounded border border-border/60 bg-parchment-deep/20 p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
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

                            <div className="mt-1 text-xs font-script italic text-ink-faded">
                              di {entry.user_display_name ?? "Utente sconosciuto"}
                            </div>

                            {changes.length > 0 && (
                              <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm font-script">
                                {changes.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
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