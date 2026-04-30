import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { abilityModifier, formatModifier, magicBaseDamage } from "@/lib/rulesets";
import { EditableLabel, type LabelOverride } from "@/components/EditableLabel";

// === Schema dati Open Source GDR ===
const ABILITIES = [
  { key: "for", label: "FOR", full: "Forza" },
  { key: "des", label: "DES", full: "Destrezza" },
  { key: "cos", label: "COS", full: "Costituzione" },
  { key: "vol", label: "VOL", full: "Volontà" },
  { key: "pro", label: "PRO", full: "Prontezza" },
  { key: "emp", label: "EMP", full: "Empatia" },
] as const;

const BODY_PARTS = [
  "Testa",
  "Torace",
  "Braccio DX",
  "Braccio SX",
  "Mano DX",
  "Mano SX",
  "Gamba DX",
  "Gamba SX",
  "Piede DX",
  "Piede SX",
] as const;

const EQUIPMENT_SECTIONS = [
  { key: "pozioni", label: "Pozioni" },
  { key: "cibo", label: "Cibo" },
  { key: "pergamene", label: "Pergamene" },
  { key: "varie", label: "Varie ed eventuali" },
  { key: "oggetti", label: "Oggetti" },
  { key: "materiali", label: "Materiali" },
  { key: "armi", label: "Armi" },
  { key: "armature", label: "Armature" },
] as const;

const MAGIC_SCHOOLS = [
  "Acqua",
  "Fuoco",
  "Aria",
  "Terra",
  "Vita",
  "Morte",
  "Spirito",
  "Materia",
  "Mente",
  "Corpo",
] as const;

const COIN_TYPES = [
  { key: "oro", label: "Oro" },
  { key: "argento", label: "Argento" },
  { key: "rame", label: "Rame" },
] as const;

export type Ability = (typeof ABILITIES)[number]["key"];
export type EquipmentKey = (typeof EQUIPMENT_SECTIONS)[number]["key"];
export type MagicSchool = (typeof MAGIC_SCHOOLS)[number];
export type CoinKey = (typeof COIN_TYPES)[number]["key"];

export interface OsgdrSkill {
  id: string;
  name: string;
  grade: number;
}

export interface OsgdrSheet {
  razza: string;
  provenienza: string;
  eta: string;
  peso: string;
  altezza: string;
  capelli: string;
  carnagione: string;
  occhi: string;
  abilities: Record<Ability, number>;
  iniziativa: string;
  penalita: string;
  fortuna: string;
  fatica: string;
  pe: number;
  magic: Record<MagicSchool, number>;
  coins: Record<CoinKey, number>;
  ferite: Record<string, string>;
  equipment: Record<EquipmentKey, string[]>;
  note: string;
  skills: OsgdrSkill[];
}

export const EMPTY_OSGDR_SHEET: OsgdrSheet = {
  razza: "",
  provenienza: "",
  eta: "",
  peso: "",
  altezza: "",
  capelli: "",
  carnagione: "",
  occhi: "",
  abilities: { for: 8, des: 8, cos: 8, vol: 8, pro: 8, emp: 8 },
  iniziativa: "",
  penalita: "",
  fortuna: "",
  fatica: "",
  pe: 0,
  magic: Object.fromEntries(MAGIC_SCHOOLS.map((s) => [s, 0])) as Record<MagicSchool, number>,
  coins: Object.fromEntries(COIN_TYPES.map((c) => [c.key, 0])) as Record<CoinKey, number>,
  ferite: Object.fromEntries(BODY_PARTS.map((p) => [p, ""])) as Record<string, string>,
  equipment: Object.fromEntries(EQUIPMENT_SECTIONS.map((s) => [s.key, [] as string[]])) as Record<
    EquipmentKey,
    string[]
  >,
  note: "",
  skills: [],
};

export function normalizeOsgdrSheet(input: any): OsgdrSheet {
  const base = EMPTY_OSGDR_SHEET;
  if (!input || typeof input !== "object") {
    return {
      ...base,
      ferite: { ...base.ferite },
      equipment: { ...base.equipment },
      abilities: { ...base.abilities },
      magic: { ...base.magic },
      coins: { ...base.coins },
      skills: [],
    };
  }

  const abilities = { ...base.abilities, ...(input.abilities ?? {}) };
  const ferite = { ...base.ferite, ...(input.ferite ?? {}) };

  const magic: Record<MagicSchool, number> = { ...base.magic };
  if (input.magic && typeof input.magic === "object") {
    for (const s of MAGIC_SCHOOLS) {
      const v = Number(input.magic[s]);
      if (Number.isFinite(v)) magic[s] = v;
    }
  }

  const coins: Record<CoinKey, number> = { ...base.coins };
  if (input.coins && typeof input.coins === "object") {
    for (const c of COIN_TYPES) {
      const v = Number(input.coins[c.key]);
      if (Number.isFinite(v)) coins[c.key] = v;
    }
  }

  const equipment: Record<EquipmentKey, string[]> = { ...base.equipment };
  if (input.equipment) {
    for (const s of EQUIPMENT_SECTIONS) {
      const v = input.equipment[s.key];
      equipment[s.key] = Array.isArray(v) ? v.map(String) : [];
    }
  }

  const skills: OsgdrSkill[] = Array.isArray(input.skills)
    ? input.skills.map((sk: any) => ({
        id: String(sk?.id ?? crypto.randomUUID()),
        name: String(sk?.name ?? ""),
        grade: Number(sk?.grade ?? 0),
      }))
    : [];

  return {
    ...base,
    ...input,
    abilities,
    magic,
    coins,
    ferite,
    equipment,
    skills,
  };
}

interface SelectableProfile {
  id: string;
  display_name: string;
}

interface Props {
  value: OsgdrSheet;
  onChange: (next: OsgdrSheet) => void;
  canEdit: boolean;
  /** Override map (key → text/size) used for admin label customisation */
  labelOverrides?: Record<string, LabelOverride>;
  /** Whether the current user can customise labels (admin) */
  canCustomizeLabels?: boolean;
  /** Persist a label override change (called immediately on save) */
  onLabelOverrideChange?: (key: string, override: LabelOverride | undefined) => void;
  assignedUserId?: string;
  onAssignedUserIdChange?: (next: string | undefined) => void;
}

export const OpenSourceGdrSheet = ({
  value,
  onChange,
  canEdit,
  labelOverrides = {},
  canCustomizeLabels = false,
  onLabelOverrideChange,
  assignedUserId,
  onAssignedUserIdChange,
}: Props) => {
  const { user, isAdmin, isActingAsNarrator } = useAuth();
  const [profiles, setProfiles] = useState<SelectableProfile[]>([]);

  const canAssignCharacter = canEdit && !!onAssignedUserIdChange && (isAdmin || isNarratore);

  useEffect(() => {
    if (!canAssignCharacter) return;

    const loadProfiles = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("approval_status", "approved")
        .order("display_name", { ascending: true });

      if (!error) {
        setProfiles((data ?? []) as SelectableProfile[]);
      }
    };

    void loadProfiles();
  }, [canAssignCharacter]);

  useEffect(() => {
    if (!canAssignCharacter) return;
    if (assignedUserId) return;
    if (!user?.id) return;

    onAssignedUserIdChange?.(user.id);
  }, [canAssignCharacter, assignedUserId, onAssignedUserIdChange, user?.id]);

  const totalPoints = useMemo(
    () => ABILITIES.reduce((acc, a) => acc + (Number(value.abilities[a.key]) || 0), 0),
    [value.abilities],
  );

  const set = <K extends keyof OsgdrSheet>(k: K, v: OsgdrSheet[K]) => onChange({ ...value, [k]: v });

  const setAbility = (key: Ability, raw: string) => {
    const n = Math.max(0, Math.min(30, Number(raw) || 0));
    onChange({ ...value, abilities: { ...value.abilities, [key]: n } });
  };

  const setMagic = (school: MagicSchool, raw: string) => {
    const n = Math.max(0, Math.min(99, Number(raw) || 0));
    onChange({ ...value, magic: { ...value.magic, [school]: n } });
  };

  const setCoin = (key: CoinKey, raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    onChange({ ...value, coins: { ...value.coins, [key]: n } });
  };

  const setFerita = (part: string, txt: string) =>
    onChange({ ...value, ferite: { ...value.ferite, [part]: txt } });

  const setEquipItem = (sec: EquipmentKey, idx: number, txt: string) => {
    const arr = [...(value.equipment[sec] ?? [])];
    arr[idx] = txt;
    onChange({ ...value, equipment: { ...value.equipment, [sec]: arr } });
  };
  const addEquipItem = (sec: EquipmentKey) => {
    const arr = [...(value.equipment[sec] ?? []), ""];
    onChange({ ...value, equipment: { ...value.equipment, [sec]: arr } });
  };
  const removeEquipItem = (sec: EquipmentKey, idx: number) => {
    const arr = [...(value.equipment[sec] ?? [])];
    arr.splice(idx, 1);
    onChange({ ...value, equipment: { ...value.equipment, [sec]: arr } });
  };

  const addSkill = () =>
    onChange({
      ...value,
      skills: [...value.skills, { id: crypto.randomUUID(), name: "Nuova abilità", grade: 1 }],
    });
  const updateSkill = (id: string, patch: Partial<OsgdrSkill>) =>
    onChange({ ...value, skills: value.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeSkill = (id: string) =>
    onChange({ ...value, skills: value.skills.filter((s) => s.id !== id) });

  const renderText = (val: string | number) => (
    <span className="font-script whitespace-pre-wrap">{val || "—"}</span>
  );

  const lbl = (
    key: string,
    defaultText: string,
    className: string,
    as: "span" | "div" | "label" | "h3" = "span",
  ) => (
    <EditableLabel
      defaultText={defaultText}
      override={labelOverrides[key]}
      onChange={(o) => onLabelOverrideChange?.(key, o)}
      canCustomize={canCustomizeLabels && !!onLabelOverrideChange}
      className={className}
      as={as}
    />
  );

  return (
    <div className="osgdr-sheet space-y-5 sm:space-y-6">
      <section className="space-y-3">
        {lbl("section.anagrafica", "Anagrafica", "font-display text-xl gold-text", "h3")}

        {canAssignCharacter && (
          <div className="rounded border border-border/60 bg-parchment-deep/20 p-3">
            <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">
              Assegna scheda a
            </Label>
            <select
              value={assignedUserId ?? user?.id ?? ""}
              onChange={(e) => onAssignedUserIdChange?.(e.target.value || undefined)}
              className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-script text-foreground"
            >
              <option value="">Seleziona un utente</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["razza", "Razza"],
              ["provenienza", "Provenienza"],
              ["eta", "Età"],
              ["altezza", "Altezza"],
              ["peso", "Peso"],
              ["carnagione", "Carnagione"],
              ["capelli", "Capelli"],
              ["occhi", "Occhi"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="rounded border border-border/60 bg-parchment-deep/20 p-3">
              {lbl(
                `field.${k}`,
                label,
                "font-heading text-xs uppercase tracking-wider text-ink-faded",
                "label",
              )}
              {canEdit ? (
                <Input
                  value={(value as any)[k] ?? ""}
                  onChange={(e) => set(k as any, e.target.value as any)}
                  className="h-9 border-0 bg-transparent px-0 font-script focus-visible:ring-0"
                />
              ) : (
                renderText((value as any)[k])
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {lbl("section.caratteristiche", "Caratteristiche", "font-display text-xl gold-text", "h3")}
          <p className="font-script text-xs italic text-ink-faded">
            Totale punti distribuiti: <strong>{totalPoints}</strong> · base 48 + 5d4 + 1d6
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ABILITIES.map((a) => {
            const v = value.abilities[a.key] ?? 0;
            const mod = abilityModifier(v);
            return (
              <div
                key={a.key}
                className="rounded border border-border/60 bg-parchment-deep/20 p-3 text-center"
              >
                {lbl(
                  `ability.${a.key}`,
                  a.label,
                  "font-heading text-xs uppercase tracking-wider text-ink-faded",
                  "div",
                )}
                {canEdit ? (
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={v}
                    onChange={(e) => setAbility(a.key, e.target.value)}
                    className="h-10 border-0 bg-transparent px-0 text-center font-display focus-visible:ring-0"
                    style={{ fontSize: "18px" }}
                  />
                ) : (
                  <div className="font-display" style={{ fontSize: "18px" }}>
                    {v}
                  </div>
                )}
                <div className="mt-1 font-script text-xs text-primary" style={{ fontSize: "22px" }}>
                  {formatModifier(mod)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        {lbl("section.stati", "Stati & Risorse", "font-display text-xl gold-text", "h3")}
        <p className="font-script text-xs italic text-ink-faded">
          L'<strong>Iniziativa</strong> è calcolata automaticamente come <em>Mod. Destrezza + Mod. Prontezza</em>.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["iniziativa", "Iniziativa"],
              ["penalita", "Penalità"],
              ["fortuna", "Fortuna"],
              ["fatica", "Fatica"],
              ["pe", "PE"],
            ] as const
          ).map(([k, label]) => {
            const autoIniziativa =
              abilityModifier(value.abilities.des ?? 0) + abilityModifier(value.abilities.pro ?? 0);
            const isInit = k === "iniziativa";
            const displayValue = isInit ? formatModifier(autoIniziativa) : String((value as any)[k]) || "—";

            return (
              <div
                key={k}
                className="rounded border border-border/60 bg-parchment-deep/20 p-3 text-center"
              >
                {lbl(`stat.${k}`, label, "font-heading text-xs uppercase tracking-wider text-ink-faded", "label")}
                {isInit ? (
                  <div
                    className="font-display text-primary"
                    style={{ fontSize: "22px" }}
                    title="Calcolata automaticamente: Mod. DES + Mod. PRO"
                  >
                    {formatModifier(autoIniziativa)}
                  </div>
                ) : canEdit ? (
                  <Input
                    value={(value as any)[k] ?? ""}
                    onChange={(e) =>
                      k === "pe"
                        ? set("pe", Math.max(0, Number(e.target.value) || 0) as any)
                        : set(k as any, e.target.value as any)
                    }
                    className="h-9 border-0 bg-transparent px-0 text-center font-display focus-visible:ring-0"
                    style={{ fontSize: "18px" }}
                  />
                ) : (
                  <div className="font-display" style={{ fontSize: "18px" }}>
                    {displayValue}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        {lbl("section.magia", "Magia", "font-display text-xl gold-text", "h3")}
        <p className="font-script text-xs italic text-ink-faded">
          Punteggio per ciascuna delle dieci scuole di magia libera.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {MAGIC_SCHOOLS.map((school) => {
            const grade = value.magic[school] ?? 0;
            const dmg = magicBaseDamage(grade);
            return (
              <div
                key={school}
                className="rounded border border-border/60 bg-parchment-deep/20 p-3 text-center"
              >
                {lbl(
                  `magic.${school}`,
                  school,
                  "font-heading text-xs uppercase tracking-wider text-ink-faded",
                  "label",
                )}
                {canEdit ? (
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={grade}
                    onChange={(e) => setMagic(school, e.target.value)}
                    className="h-9 border-0 bg-transparent px-0 text-center font-display text-xl focus-visible:ring-0"
                  />
                ) : (
                  <div className="font-display text-xl">{grade}</div>
                )}
                <div className="mt-1 text-xs font-script text-primary" title="Danno base incantesimo per questa scuola">
                  Danno base {formatModifier(dmg)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        {lbl("section.monete", "Monete", "font-display text-xl gold-text", "h3")}
        <div className="grid grid-cols-3 gap-2">
          {COIN_TYPES.map((c) => (
            <div key={c.key} className="rounded border border-border/60 bg-parchment-deep/20 p-3 text-center">
              {lbl(
                `coin.${c.key}`,
                c.label,
                "font-heading text-xs uppercase tracking-wider text-ink-faded",
                "label",
              )}
              {canEdit ? (
                <Input
                  type="number"
                  min={0}
                  value={value.coins[c.key] ?? 0}
                  onChange={(e) => setCoin(c.key, e.target.value)}
                  className="h-9 border-0 bg-transparent px-0 text-center font-display text-xl focus-visible:ring-0"
                />
              ) : (
                <div className="font-display text-xl">{value.coins[c.key] ?? 0}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          {lbl("section.abilita", "Abilità", "font-display text-xl gold-text", "h3")}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addSkill} className="font-heading">
              <Plus className="mr-1 h-4 w-4" /> Aggiungi
            </Button>
          )}
        </div>

        {value.skills.length === 0 ? (
          <p className="text-sm font-script italic text-ink-faded">Nessuna abilità appresa.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {value.skills.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded border border-border/60 bg-parchment-deep/20 p-2"
              >
                {canEdit ? (
                  <>
                    <Input
                      value={s.name}
                      onChange={(e) => updateSkill(s.id, { name: e.target.value })}
                      className="h-9 flex-1 border-0 bg-transparent px-0 font-script focus-visible:ring-0"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={s.grade}
                      onChange={(e) =>
                        updateSkill(s.id, {
                          grade: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
                        })
                      }
                      className="h-9 w-16 border border-border/60 px-0 text-center font-display focus-visible:ring-0"
                    />
                    <button onClick={() => removeSkill(s.id)} className="shrink-0 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-script">{s.name}</span>
                    <span className="font-display text-primary">{s.grade}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        {lbl("section.ferite", "Ferite & Stato del corpo", "font-display text-xl gold-text", "h3")}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BODY_PARTS.map((p) => (
            <div key={p} className="rounded border border-border/60 bg-parchment-deep/20 p-3">
              {lbl(
                `ferita.${p}`,
                p,
                "font-heading text-xs uppercase tracking-wider text-ink-faded",
                "label",
              )}
              {canEdit ? (
                <Input
                  value={value.ferite[p] ?? ""}
                  onChange={(e) => setFerita(p, e.target.value)}
                  placeholder="Stato / ferita..."
                  className="h-9 border-0 bg-transparent px-0 font-script focus-visible:ring-0"
                />
              ) : (
                renderText(value.ferite[p])
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {lbl("section.equip", "Equipaggiamento", "font-display text-xl gold-text", "h3")}
        <div className="grid gap-3 sm:grid-cols-2">
          {EQUIPMENT_SECTIONS.map((sec) => {
            const items = value.equipment[sec.key] ?? [];
            return (
              <div
                key={sec.key}
                className="space-y-1 rounded border border-border/60 bg-parchment-deep/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  {lbl(
                    `equip.${sec.key}`,
                    sec.label,
                    "font-heading text-sm uppercase tracking-wider text-ink-faded",
                    "h3",
                  )}
                  {canEdit && (
                    <button onClick={() => addEquipItem(sec.key)} className="text-primary hover:text-primary/80">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {items.length === 0 && !canEdit && (
                  <p className="text-xs font-script italic text-ink-faded">—</p>
                )}

                {items.map((it, idx) => (
                  <div key={idx} className="group flex items-center gap-1">
                    {canEdit ? (
                      <>
                        <Input
                          value={it}
                          onChange={(e) => setEquipItem(sec.key, idx, e.target.value)}
                          className="h-9 flex-1 border-0 bg-transparent px-0 font-script focus-visible:ring-0"
                        />
                        <button
                          onClick={() => removeEquipItem(sec.key, idx)}
                          className="shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="font-script">• {it}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        {lbl("section.note", "Note", "font-display text-xl gold-text", "h3")}
        {canEdit ? (
          <Textarea
            value={value.note}
            onChange={(e) => set("note", e.target.value)}
            rows={4}
            className="border-border/60 bg-parchment-deep/20 font-script focus-visible:ring-0"
            placeholder="Annotazioni libere sul personaggio..."
          />
        ) : (
          <p className="font-script whitespace-pre-wrap">{value.note || "—"}</p>
        )}
      </section>
    </div>
  );
};