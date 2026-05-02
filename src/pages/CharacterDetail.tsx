import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  ShieldCheck,
  Skull,
  Coins,
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

interface CampaignMember {
  id: string;
  user_id: string;
  role: "narratore" | "giocatore";
}

interface SelectableProfile {
  id: string;
  display_name: string;
}

const OSGDR_FIELD_ID = "__osgdr_sheet__";
const LABEL_OVERRIDES_FIELD_ID = "__label_overrides__";
const BACKGROUND_FIELD_ID = "__background__";

type LabelOverridesMap = Record<string, LabelOverride>;

function extractOsgdrSheet(fields: CustomField[]): OsgdrSheet {
  const f = fields.find((x) => x.id === OSGDR_FIELD_ID);
  if (!f)
    return {
      ...EMPTY_OSGDR_SHEET,
      ferite: { ...EMPTY_OSGDR_SHEET.ferite },
      equipment: { ...EMPTY_OSGDR_SHEET.equipment },
      abilities: { ...EMPTY_OSGDR_SHEET.abilities },
      skills: [],
    };

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
    { id: OSGDR_FIELD_ID, label: "Open Source GDR", value: JSON.stringify(sheet) },
  ];
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
  return [
    ...others,
    {
      id: LABEL_OVERRIDES_FIELD_ID,
      label: "Label overrides",
      value: JSON.stringify(overrides),
    },
  ];
}

const CharacterDetail = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const { user, isAdmin, isActingAsNarrator } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [character, setCharacter] = useState<Character | null>(null);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<{ display_name: string } | null>(null);
  const [rulesetName, setRulesetName] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);
  const [destinySaving, setDestinySaving] = useState(false);

  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [osgdrSheet, setOsgdrSheet] = useState<OsgdrSheet>(EMPTY_OSGDR_SHEET);
  const [labelOverrides, setLabelOverrides] = useState<LabelOverridesMap>({});
  const [background, setBackground] = useState<string>("");
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>(undefined);
  const [assignableProfiles, setAssignableProfiles] = useState<SelectableProfile[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [deathDescription, setDeathDescription] = useState("");
  const [diedAt, setDiedAt] = useState("");

  const dbSnapshotRef = useRef<{
    name: string;
    concept: string;
    fields: CustomField[];
    osgdrSheet: OsgdrSheet;
    background: string;
    owner_id: string;
    is_dead: boolean;
    death_description: string;
    died_at: string;
  } | null>(null);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isNarrator = myMembership?.role === "narratore";
  const canManageAllCharacters = isAdmin || isActingAsNarrator || isNarrator;

  const getCharacterAccess = (ch: Character | null) => {
    const isOwner = !!ch && !!user && ch.owner_id === user.id;
    const canView =
      !!ch && (canManageAllCharacters || isOwner || !!ch.is_dead);
    const canEdit =
      !!ch && (canManageAllCharacters || isOwner);
    const canAssignCharacter =
      !!ch && canManageAllCharacters;
    const canEditBackground =
      !!ch && canEdit;
    const canManageDestiny =
      !!ch && canManageAllCharacters;

    return {
      isOwner,
      canView,
      canEdit,
      canAssignCharacter,
      canEditBackground,
      canManageDestiny,
    };
  };

  const access = getCharacterAccess(character);
  const useOsgdrForm = isOpenSourceGdr(rulesetName);

  const visibleFields = fields.filter(
    (f) =>
      f.id !== OSGDR_FIELD_ID &&
      f.id !== LABEL_OVERRIDES_FIELD_ID &&
      f.id !== BACKGROUND_FIELD_ID
  );

    const setSheetField = <
    K extends
      | "razza"
      | "provenienza"
      | "eta"
      | "altezza"
      | "peso"
      | "carnagione"
      | "capelli"
      | "occhi"
  >(
    key: K,
    next: OsgdrSheet[K],
  ) => {
    setOsgdrSheet((prev) => ({
      ...prev,
      [key]: next,
    }));
  };

  const setSheetCoin = (key: "oro" | "argento" | "rame", raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    setOsgdrSheet((prev) => ({
      ...prev,
      coins: {
        ...prev.coins,
        [key]: n,
      },
    }));
  };

    const setSheetPe = (raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    setOsgdrSheet((prev) => ({
      ...prev,
      pe: n,
    }));
  };
  
  const load = async () => {
    if (!characterId) return;
    setLoading(true);

    const [c, n] = await Promise.all([
  supabase
    .from("characters")
    .select("*")
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

    const { data: memberRows } = await supabase
      .from("campaign_members")
      .select("id, user_id, role")
      .eq("campaign_id", ch.campaign_id);

    const normalizedMembers = ((memberRows ?? []) as CampaignMember[]);
    setMembers(normalizedMembers);

    const currentMembership = normalizedMembers.find((m) => m.user_id === user?.id);
    const currentIsNarrator = currentMembership?.role === "narratore";
    const currentCanManageAllCharacters =
      isAdmin || isActingAsNarrator || currentIsNarrator;

    const isAllowed =
      !!user &&
      (currentCanManageAllCharacters || ch.owner_id === user.id || !!ch.is_dead);

    if (!isAllowed) {
      toast.error("Non puoi visualizzare questa scheda");
      navigate(`/campaigns/${ch.campaign_id}`);
      return;
    }

    setCharacter(ch);
    setAssignedUserId(ch.owner_id);
    const { data: campaignRow } = await supabase
      .from("campaigns")
      .select("ruleset_id, rulesets(name)")
      .eq("id", ch.campaign_id)
      .maybeSingle();

    setRulesetName((campaignRow as any)?.rulesets?.name ?? null);
    setName(ch.name);
    setConcept(ch.concept ?? "");
    setFields(ch.custom_fields);
    setOsgdrSheet(extractOsgdrSheet(ch.custom_fields));
    setLabelOverrides(extractLabelOverrides(ch.custom_fields));
    setBackground(extractBackground(ch.custom_fields));
    setNotes((n.data ?? []) as Note[]);
    setIsDead(!!ch.is_dead);
    setDeathDescription(ch.death_description ?? "");
    setDiedAt(ch.died_at ? String(ch.died_at).slice(0, 10) : "");

    dbSnapshotRef.current = {
      name: ch.name,
      concept: ch.concept ?? "",
      fields: ch.custom_fields,
      osgdrSheet: extractOsgdrSheet(ch.custom_fields),
      background: extractBackground(ch.custom_fields),
      owner_id: ch.owner_id,
      is_dead: !!ch.is_dead,
      death_description: ch.death_description ?? "",
      died_at: ch.died_at ? String(ch.died_at).slice(0, 10) : "",
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
    void load();
  }, [characterId, user?.id, isAdmin, isActingAsNarrator]);

    useEffect(() => {
    if (!access.canAssignCharacter) {
      setAssignableProfiles([]);
      return;
    }

    const loadAssignableProfiles = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("approval_status", "approved")
        .order("display_name", { ascending: true });

      if (!error) {
        setAssignableProfiles((data ?? []) as SelectableProfile[]);
      }
    };

    void loadAssignableProfiles();
  }, [access.canAssignCharacter]);

    const assignmentOptions = useMemo(() => {
    if (!assignedUserId) return assignableProfiles;

    const exists = assignableProfiles.some((profile) => profile.id === assignedUserId);
    if (exists) return assignableProfiles;

    const fallbackName =
      ownerProfile?.display_name ||
      (assignedUserId === user?.id ? "Tu" : "Utente attuale");

    return [
      ...assignableProfiles,
      {
        id: assignedUserId,
        display_name: fallbackName,
      },
    ];
  }, [assignableProfiles, assignedUserId, ownerProfile?.display_name, user?.id]);

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

  const persistLabelOverride = async (key: string, override: LabelOverride | undefined) => {
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

    if (snap.owner_id !== (assignedUserId ?? character?.owner_id ?? snap.owner_id)) {
      changes.push("Proprietario scheda aggiornato");
    }

    if (snap.is_dead !== isDead) {
      changes.push(isDead ? "Personaggio segnato come morto" : "Personaggio segnato come vivo");
    }

    if ((snap.death_description ?? "") !== (deathDescription ?? "")) {
      changes.push("Descrizione della morte aggiornata");
    }

    if ((snap.died_at ?? "") !== (diedAt ?? "")) {
      changes.push("Data di morte aggiornata");
    }

    if (useOsgdrForm) {
      const a1 = snap.osgdrSheet;
      const a2 = osgdrSheet;

      const abilityKeys = Object.keys(a2.abilities ?? {}) as (keyof typeof a2.abilities)[];

      for (const k of abilityKeys) {
        if ((a1.abilities?.[k] ?? 0) !== (a2.abilities?.[k] ?? 0)) {
          changes.push(
            `${String(k).toUpperCase()}: ${a1.abilities?.[k] ?? 0} → ${a2.abilities?.[k] ?? 0}`
          );
        }
      }

      for (const sk of Object.keys(a2.magic ?? {})) {
        if ((a1.magic as any)?.[sk] !== (a2.magic as any)?.[sk]) {
          changes.push(
            `Magia ${sk}: ${(a1.magic as any)?.[sk] ?? 0} → ${(a2.magic as any)?.[sk] ?? 0}`
          );
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

      if (JSON.stringify(v1) !== JSON.stringify(v2)) {
        changes.push("Campi liberi modificati");
      }
    }

    return changes;
  };

  const handleSave = async () => {
    if (!character || !access.canEdit) return;
    setSaving(true);

    const snap = dbSnapshotRef.current;
    let finalFields = useOsgdrForm ? packOsgdrSheet(fields, osgdrSheet) : fields;
    finalFields = packLabelOverrides(finalFields, labelOverrides);
    finalFields = packBackground(finalFields, background);

    const nextOwnerId = access.canAssignCharacter
      ? assignedUserId ?? character.owner_id
      : character.owner_id;

    const payload: any = {
      name,
      concept: concept || null,
      custom_fields: finalFields as any,
      owner_id: nextOwnerId,
    };

    if (access.canManageDestiny) {
      payload.is_dead = isDead;
      payload.death_description = isDead ? deathDescription || null : null;
      payload.died_at = isDead ? diedAt || null : null;
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

      await load();
    }
  };

  const saveBackground = async () => {
    if (!character || !access.canEditBackground) return;
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
          length_before: prev.length,
          length_after: background.length,
        });
      }

      await load();
    }
  };

  const saveDestiny = async () => {
    if (!character || !access.canManageDestiny) return;
    setDestinySaving(true);

    const snap = dbSnapshotRef.current;

    const { error } = await supabase
      .from("characters")
      .update({
        is_dead: isDead,
        death_description: isDead ? deathDescription || null : null,
        died_at: isDead ? diedAt || null : null,
      })
      .eq("id", character.id);

    setDestinySaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Destino del personaggio aggiornato");

    if (snap) {
      const changes: string[] = [];

      if (snap.is_dead !== isDead) {
        changes.push(isDead ? "Personaggio segnato come morto" : "Personaggio segnato come vivo");
      }
      if ((snap.death_description ?? "") !== (deathDescription ?? "")) {
        changes.push("Descrizione della morte aggiornata");
      }
      if ((snap.died_at ?? "") !== (diedAt ?? "")) {
        changes.push("Data di morte aggiornata");
      }

      if (changes.length > 0) {
        await logAudit(
          changes.length === 1 ? changes[0] : "Destino del personaggio aggiornato",
          { changes }
        );
      }
    }

    await load();
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !character || !user || !access.canEdit) return;

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
      await load();
    }
  };

  const handleDelete = async () => {
    if (!character || !access.canEdit || !confirm("Eliminare questa scheda?")) return;

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
    if (!user || !character || !access.canView) return;

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
      await load();
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Eliminare questa annotazione?")) return;

    const { error } = await supabase.from("session_notes").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Annotazione rimossa");
      await load();
    }
  };

  if (loading || !character) {
    return (
      <div className="min-h-screen">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!access.canView) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <main className="container py-8 md:py-12">
        <Link
          to={`/campaigns/${character.campaign_id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm font-script italic text-ink-faded hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Torna alla campagna
        </Link>

        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 font-display text-4xl gold-text">
            <ScrollText className="h-8 w-8" />
            {access.canEdit ? name || "Scheda personaggio" : character.name}
          </h1>
          <p className="font-script italic text-ink-faded">
            Cronaca, dettagli e memoria viva del personaggio
          </p>
        </div>

        <div className="parchment-panel mb-8 flex flex-wrap items-center gap-2 p-3 text-sm font-script italic text-ink-faded">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {access.isOwner
            ? "Questa scheda appartiene a te."
            : ownerProfile
            ? `Scheda assegnata a ${ownerProfile.display_name}.`
            : "Scheda condivisa della campagna."}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                    <aside className="space-y-4 lg:self-start">
            <div className="parchment-panel overflow-hidden p-4 sm:p-5">
              <div className="space-y-5">
                <section className="space-y-4">
                  <div className="group relative mx-auto aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded bg-gradient-to-br from-parchment-deep to-parchment-shadow">
                    {character.image_url ? (
                      <img
                        src={character.image_url}
                        alt={character.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ScrollText className="h-20 w-20 text-primary/40" />
                      </div>
                    )}

                    {access.canEdit && (
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

                  {isDead && (
                    <div className="space-y-3">
                      <Badge variant="destructive" className="font-heading">
                        <Skull className="mr-1 h-3.5 w-3.5" />
                        Caduto
                      </Badge>

                      <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
                        <p className="mb-1 font-heading text-[11px] uppercase tracking-[0.18em] text-destructive">
                          Memoria della caduta
                        </p>

                        <p className="font-script text-sm italic leading-relaxed text-ink-faded">
                          {deathDescription?.trim()
                            ? deathDescription
                            : "La cronaca della sua fine non è ancora stata tramandata."}
                        </p>

                        {diedAt && (
                          <p className="mt-2 text-xs font-script italic text-ink-faded">
                            Caduto il{" "}
                            {new Date(diedAt).toLocaleDateString("it-IT", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                {useOsgdrForm && (
                  <>
                    <div className="h-px bg-border/50" />

                    <section className="space-y-4">
                      <div className="space-y-1">
                        <h3 className="font-heading text-sm uppercase tracking-[0.18em] text-ink-faded">
                          Anagrafica
                        </h3>
                        <p className="font-script text-xs italic text-ink-faded">
                          Identità, provenienza e tratti visibili del personaggio.
                        </p>
                      </div>

                      {access.canAssignCharacter && (
                        <div className="space-y-2 rounded border border-border/60 bg-parchment-deep/20 p-3">
                          <Label
                            htmlFor="assigned-user"
                            className="font-heading text-[11px] uppercase tracking-[0.18em] text-ink-faded"
                          >
                            Assegna scheda a
                          </Label>

                          <select
                            id="assigned-user"
                            value={assignedUserId ?? ""}
                            onChange={(e) => setAssignedUserId(e.target.value || undefined)}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-script text-sm"
                          >
                            <option value="">Nessuna assegnazione</option>
                            {assignmentOptions.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.display_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ["razza", "Razza"],
                          ["provenienza", "Provenienza"],
                          ["eta", "Età"],
                          ["altezza", "Altezza"],
                          ["peso", "Peso"],
                          ["carnagione", "Carnagione"],
                          ["capelli", "Capelli"],
                          ["occhi", "Occhi"],
                        ] as const).map(([key, label]) => (
                          <div
                            key={key}
                            className="rounded border border-border/60 bg-parchment-deep/20 p-2.5"
                          >
                            <Label className="mb-1 block font-heading text-[11px] uppercase tracking-[0.18em] text-ink-faded">
                              {label}
                            </Label>

                            {access.canEdit ? (
                              <Input
                                value={osgdrSheet[key] ?? ""}
                                onChange={(e) =>
                                  setSheetField(key, e.target.value as OsgdrSheet[typeof key])
                                }
                                className="h-8 border-0 bg-transparent px-0 font-script text-sm focus-visible:ring-0"
                              />
                            ) : (
                              <div className="min-h-8 font-script text-sm leading-8 text-ink">
                                {String(osgdrSheet[key] ?? "").trim() || "—"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="h-px bg-border/50" />

                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        <h3 className="font-heading text-sm uppercase tracking-[0.18em] text-ink-faded">
                          Monete
                        </h3>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { key: "oro", short: "MO", title: "Monete d'Oro" },
                          { key: "argento", short: "MA", title: "Monete d'Argento" },
                          { key: "rame", short: "MR", title: "Monete di Rame" },
                        ] as const).map((coin) => (
                          <div
                            key={coin.key}
                            className="rounded border border-border/60 bg-parchment-deep/20 p-2 text-center"
                            title={coin.title}
                          >
                            <Label className="mb-1 flex items-center justify-center gap-1 font-heading text-[11px] uppercase tracking-[0.18em] text-ink-faded">
                              <Coins className="h-3.5 w-3.5 text-primary/80" />
                              <span>{coin.short}</span>
                            </Label>

                            {access.canEdit ? (
                              <Input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min={0}
                                value={osgdrSheet.coins[coin.key] ?? 0}
                                onChange={(e) => setSheetCoin(coin.key, e.target.value)}
                                className="h-8 border-0 bg-transparent px-0 text-center font-display text-lg focus-visible:ring-0"
                              />
                            ) : (
                              <div className="font-display text-lg text-primary">
                                {osgdrSheet.coins[coin.key] ?? 0}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                                          <div className="h-px bg-border/50" />

                    <section className="space-y-3">
                      <h3 className="font-heading text-sm uppercase tracking-[0.18em] text-ink-faded">
                        Risorse
                      </h3>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded border border-border/60 bg-parchment-deep/20 p-2.5 text-center">
                          <Label className="mb-1 block font-heading text-[11px] uppercase tracking-[0.18em] text-ink-faded">
                            Fortuna
                          </Label>

                          {access.canEdit ? (
                            <Input
                              value={osgdrSheet.fortuna ?? ""}
                              onChange={(e) =>
                                setSheetField("fortuna", e.target.value as OsgdrSheet["fortuna"])
                              }
                              className="h-8 border-0 bg-transparent px-0 text-center font-display text-lg focus-visible:ring-0"
                            />
                          ) : (
                            <div className="font-display text-lg text-primary">
                              {String(osgdrSheet.fortuna ?? "").trim() || "—"}
                            </div>
                          )}
                        </div>

                        <div className="rounded border border-border/60 bg-parchment-deep/20 p-2.5 text-center">
                          <Label className="mb-1 block font-heading text-[11px] uppercase tracking-[0.18em] text-ink-faded">
                            PE
                          </Label>

                          {access.canEdit ? (
                            <Input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={0}
                              value={osgdrSheet.pe ?? 0}
                              onChange={(e) => setSheetPe(e.target.value)}
                              className="h-8 border-0 bg-transparent px-0 text-center font-display text-lg focus-visible:ring-0"
                            />
                          ) : (
                            <div className="font-display text-lg text-primary">
                              {osgdrSheet.pe ?? 0}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                    </section>
                  </>
                )}

                {access.canManageDestiny && (
                  <>
                    <div className="h-px bg-border/50" />

                    <section className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Skull className="h-4 w-4 text-destructive" />
                        <h3 className="font-heading text-sm uppercase tracking-[0.18em] text-ink-faded">
                          Destino
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <label className="flex items-center gap-2 text-sm font-heading">
                          <input
                            type="checkbox"
                            checked={isDead}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsDead(checked);
                              if (!checked) {
                                setDeathDescription("");
                                setDiedAt("");
                              }
                            }}
                            className="h-4 w-4 accent-current"
                          />
                          Segna come morto
                        </label>

                        {isDead && (
                          <>
                            <div>
                              <Label htmlFor="diedAt" className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                                Data della morte
                              </Label>
                              <Input
                                id="diedAt"
                                type="date"
                                value={diedAt}
                                onChange={(e) => setDiedAt(e.target.value)}
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label htmlFor="deathDescription" className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                                Descrizione della morte
                              </Label>
                              <Textarea
                                id="deathDescription"
                                value={deathDescription}
                                onChange={(e) => setDeathDescription(e.target.value)}
                                rows={5}
                                placeholder="Racconta come il personaggio è caduto: battaglia, sacrificio, tradimento, ultima impresa..."
                                className="mt-1 font-script"
                              />
                            </div>
                          </>
                        )}

                        <div className="flex justify-end border-t border-border/40 pt-3">
                          <Button
                            size="sm"
                            onClick={saveDestiny}
                            disabled={destinySaving}
                            className="font-heading"
                            variant={isDead ? "destructive" : "default"}
                          >
                            {destinySaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="mr-1 h-4 w-4" /> Salva destino
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-6">
              <DiceRollerDock
                campaignId={character.campaign_id}
                characterId={character.id}
                characterName={character.name}
              />
            </div>
          </aside>

          <div className="space-y-5">
            <div className="parchment-panel p-5 md:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  {access.canEdit ? (
                    <>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-auto rounded-none border-0 border-b border-border bg-transparent px-0 py-1 font-display text-2xl gold-text focus-visible:border-primary focus-visible:ring-0 sm:text-3xl"
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
                      <h2 className="font-display text-2xl gold-text sm:text-3xl">
                        {character.name}
                      </h2>
                      {character.concept && (
                        <p className="font-script italic text-ink-faded">{character.concept}</p>
                      )}
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {access.isOwner ? (
                      <Badge variant="outline" className="text-xs">
                        Tuo
                      </Badge>
                    ) : ownerProfile ? (
                      <Badge variant="outline" className="text-xs">
                        {ownerProfile.display_name}
                      </Badge>
                    ) : null}

                    {isDead && (
                      <Badge variant="destructive" className="text-xs">
                        Caduto
                      </Badge>
                    )}
                  </div>
                </div>

                {access.canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="shrink-0 self-start text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Tabs defaultValue="sheet">
                <TabsList className="flex h-auto w-full flex-nowrap overflow-x-auto bg-parchment-deep/40 p-1">
                  <TabsTrigger value="sheet" className="shrink-0 font-heading text-xs sm:text-sm">
                    <ScrollText className="mr-1 h-4 w-4" /> Scheda
                  </TabsTrigger>
                  <TabsTrigger value="diary" className="shrink-0 font-heading text-xs sm:text-sm">
                    <BookMarked className="mr-1 h-4 w-4" /> Diario ({notes.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="background"
                    className="shrink-0 font-heading text-xs sm:text-sm"
                  >
                    <BookOpen className="mr-1 h-4 w-4" /> Background
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="shrink-0 font-heading text-xs sm:text-sm">
                    <History className="mr-1 h-4 w-4" /> Modifiche
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sheet" className="mt-5 space-y-4">
                  {useOsgdrForm ? (
                    <>
                      <div className="parchment-panel border border-border/50 bg-parchment-deep/20 p-3">
                        <p className="font-script text-xs italic text-ink-faded">
                          Scheda <strong>Open Source GDR</strong>
                          {isAdmin && (
                            <span className="ml-2 not-italic text-primary">
                              · Admin: passa il mouse sulle etichette per modificarne testo e dimensione.
                            </span>
                          )}
                        </p>
                      </div>

                      <OpenSourceGdrSheet
                        value={osgdrSheet}
                        onChange={setOsgdrSheet}
                        canEdit={!!access.canEdit}
                        labelOverrides={labelOverrides}
                        canCustomizeLabels={isAdmin}
                        onLabelOverrideChange={persistLabelOverride}
                      />

                      {access.canEdit && (
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
                                <Save className="mr-1 h-4 w-4" /> Salva scheda
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {visibleFields.length === 0 && (
                        <div className="parchment-panel p-8 text-center">
                          <p className="font-script italic text-ink-faded">
                            {access.canEdit
                              ? "Nessun campo. Aggiungi caratteristiche, abilità, equipaggiamento o altri dettagli."
                              : "Scheda vuota."}
                          </p>
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        {visibleFields.map((f) => (
                          <div
                            key={f.id}
                            className="rounded border border-border/60 bg-parchment-deep/20 p-3"
                          >
                            {access.canEdit ? (
                              <>
                                <div className="mb-1 flex items-center gap-1">
                                  <Input
                                    value={f.label}
                                    onChange={(e) => updateField(f.id, "label", e.target.value)}
                                    className="h-6 border-0 bg-transparent px-0 font-heading text-xs uppercase tracking-wider focus-visible:ring-0"
                                  />
                                  <button
                                    onClick={() => removeField(f.id)}
                                    className="text-destructive"
                                    type="button"
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
                                      ? {
                                          fontSize: `${labelOverrides[`free.${f.id}.value`]!.size}px`,
                                        }
                                      : undefined
                                  }
                                >
                                  {f.value}
                                </div>
                                {isAdmin && (
                                  <div className="mt-1">
                                    <EditableLabel
                                      defaultText="Dimensione testo"
                                      override={labelOverrides[`free.${f.id}.value`]}
                                      onChange={(o) =>
                                        persistLabelOverride(`free.${f.id}.value`, o)
                                      }
                                      canCustomize={isAdmin}
                                      className="font-script text-[10px] italic text-ink-faded/70"
                                      as="span"
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {access.canEdit && (
                        <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addField}
                            className="font-heading"
                          >
                            <Plus className="mr-1 h-4 w-4" /> Aggiungi campo
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="font-heading sm:ml-auto"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="mr-1 h-4 w-4" /> Salva scheda
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="diary" className="mt-5 space-y-4">
                  <div className="flex justify-end">
                    <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="font-heading">
                          <Plus className="mr-1 h-4 w-4" /> Nuova annotazione
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
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
                          <DialogFooter className="flex-col gap-2 sm:flex-row">
                            <Button
                              type="submit"
                              disabled={noteSubmitting}
                              className="w-full font-heading sm:w-auto"
                            >
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
                    <div className="parchment-panel p-8 text-center">
                      <p className="font-script italic text-ink-faded">
                        Nessuna pagina ancora scritta nel diario.
                      </p>
                    </div>
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
                              <button
                                onClick={() => deleteNote(n.id)}
                                className="text-destructive"
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <p className="drop-cap whitespace-pre-wrap font-script leading-relaxed text-ink">
                            {n.content}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="background" className="mt-5 space-y-3">
                  {access.canEditBackground ? (
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
                              <Save className="mr-1 h-4 w-4" /> Salva background
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : background.trim() ? (
                    <div className="rounded border border-border/60 bg-parchment-deep/20 p-4">
                      <p className="drop-cap whitespace-pre-wrap font-script leading-relaxed text-ink">
                        {background}
                      </p>
                    </div>
                  ) : (
                    <div className="parchment-panel p-8 text-center">
                      <p className="font-script italic text-ink-faded">
                        Nessun background scritto.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="mt-5 space-y-3">
                  {auditLog.length === 0 ? (
                    <div className="parchment-panel p-8 text-center">
                      <p className="font-script italic text-ink-faded">
                        Nessuna modifica registrata.
                      </p>
                    </div>
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
                              {entry.user_display_name ?? "Utente sconosciuto"}
                            </div>

                            {changes.length > 1 && (
                              <ul className="mt-2 list-inside list-disc space-y-0.5 font-script text-sm">
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