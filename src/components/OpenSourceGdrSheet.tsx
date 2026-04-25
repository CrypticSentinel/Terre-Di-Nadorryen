import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { abilityModifier, formatModifier } from "@/lib/rulesets";
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
  "Testa", "Torace",
  "Braccio DX", "Braccio SX",
  "Mano DX", "Mano SX",
  "Gamba DX", "Gamba SX",
  "Piede DX", "Piede SX",
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
  "Acqua", "Fuoco", "Aria", "Terra",
  "Vita", "Morte", "Spirito", "Materia",
  "Mente", "Corpo",
] as const;

const COIN_TYPES = [
  { key: "oro", label: "Oro" },
  { key: "argento", label: "Argento" },
  { key: "rame", label: "Rame" },
] as const;

export type Ability = typeof ABILITIES[number]["key"];
export type EquipmentKey = typeof EQUIPMENT_SECTIONS[number]["key"];
export type MagicSchool = typeof MAGIC_SCHOOLS[number];
export type CoinKey = typeof COIN_TYPES[number]["key"];

export interface OsgdrSkill {
  id: string;
  name: string;
  grade: number;
}

export interface OsgdrSheet {
  // Anagrafica
  razza: string;
  provenienza: string;
  eta: string;
  peso: string;
  altezza: string;
  capelli: string;
  carnagione: string;
  occhi: string;
  // Caratteristiche (1-20)
  abilities: Record<Ability, number>;
  // Stati derivati / risorse
  iniziativa: string;
  penalita: string;
  fortuna: string;
  fatica: string;
  pe: number;
  // Magia: punteggio per ciascuna scuola
  magic: Record<MagicSchool, number>;
  // Monete
  coins: Record<CoinKey, number>;
  // Ferite localizzate (testo libero per descrivere stato)
  ferite: Record<string, string>;
  // Equipaggiamento (liste)
  equipment: Record<EquipmentKey, string[]>;
  note: string;
  // Abilità apprese (lista con grado)
  skills: OsgdrSkill[];
}

export const EMPTY_OSGDR_SHEET: OsgdrSheet = {
  razza: "", provenienza: "",
  eta: "", peso: "", altezza: "", capelli: "", carnagione: "", occhi: "",
  abilities: { for: 8, des: 8, cos: 8, vol: 8, pro: 8, emp: 8 },
  iniziativa: "", penalita: "", fortuna: "", fatica: "", pe: 0,
  magic: Object.fromEntries(MAGIC_SCHOOLS.map((s) => [s, 0])) as Record<MagicSchool, number>,
  coins: Object.fromEntries(COIN_TYPES.map((c) => [c.key, 0])) as Record<CoinKey, number>,
  ferite: Object.fromEntries(BODY_PARTS.map((p) => [p, ""])) as Record<string, string>,
  equipment: Object.fromEntries(EQUIPMENT_SECTIONS.map((s) => [s.key, [] as string[]])) as Record<EquipmentKey, string[]>,
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
}

export const OpenSourceGdrSheet = ({
  value,
  onChange,
  canEdit,
  labelOverrides = {},
  canCustomizeLabels = false,
  onLabelOverrideChange,
}: Props) => {
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
    onChange({ ...value, skills: [...value.skills, { id: crypto.randomUUID(), name: "Nuova abilità", grade: 1 }] });
  const updateSkill = (id: string, patch: Partial<OsgdrSkill>) =>
    onChange({ ...value, skills: value.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeSkill = (id: string) =>
    onChange({ ...value, skills: value.skills.filter((s) => s.id !== id) });

  const renderText = (val: string | number) => (
    <span className="font-script whitespace-pre-wrap">{val || "—"}</span>
  );

  // Shorthand: render an editable label that admins can rename/resize.
  const lbl = (key: string, defaultText: string, className: string, as: "span" | "div" | "label" | "h3" = "span") => (
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
    <div className="space-y-6">
      {/* === Anagrafica === */}
      <section className="space-y-3">
        <h3 className="font-display text-xl gold-text">Anagrafica</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ["razza", "Razza"], ["provenienza", "Provenienza"], ["eta", "Età"],
            ["altezza", "Altezza"], ["peso", "Peso"], ["carnagione", "Carnagione"],
            ["capelli", "Capelli"], ["occhi", "Occhi"],
          ] as const).map(([k, label]) => (
            <div key={k} className="bg-parchment-deep/20 border border-border/60 rounded p-3">
              <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">{label}</Label>
              {canEdit ? (
                <Input
                  value={(value as any)[k] ?? ""}
                  onChange={(e) => set(k as any, e.target.value as any)}
                  className="bg-transparent border-0 px-0 h-7 focus-visible:ring-0 font-script"
                />
              ) : renderText((value as any)[k])}
            </div>
          ))}
        </div>
      </section>

      {/* === Caratteristiche === */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h3 className="font-display text-xl gold-text">Caratteristiche</h3>
          <p className="font-script italic text-xs text-ink-faded">
            Totale punti distribuiti: <strong>{totalPoints}</strong> · base 48 + 5d4 + 1d6
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ABILITIES.map((a) => {
            const v = value.abilities[a.key] ?? 0;
            const mod = abilityModifier(v);
            return (
              <div key={a.key} className="bg-parchment-deep/20 border border-border/60 rounded p-3 text-center">
                <div className="font-heading text-xs uppercase tracking-wider text-ink-faded" title={a.full}>{a.label}</div>
                {canEdit ? (
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={v}
                    onChange={(e) => setAbility(a.key, e.target.value)}
                    className="bg-transparent border-0 text-center font-display text-2xl h-10 px-0 focus-visible:ring-0"
                  />
                ) : (
                  <div className="font-display text-2xl">{v}</div>
                )}
                <div className="font-script text-xs text-primary">{formatModifier(mod)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* === Stati / Risorse === */}
      <section className="space-y-3">
        <h3 className="font-display text-xl gold-text">Stati & Risorse</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {([
            ["iniziativa", "Iniziativa"],
            ["penalita", "Penalità"],
            ["fortuna", "Fortuna"],
            ["fatica", "Fatica"],
            ["pe", "PE"],
          ] as const).map(([k, label]) => (
            <div key={k} className="bg-parchment-deep/20 border border-border/60 rounded p-3 text-center">
              <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">{label}</Label>
              {canEdit ? (
                <Input
                  value={(value as any)[k] ?? ""}
                  onChange={(e) =>
                    k === "pe"
                      ? set("pe", Math.max(0, Number(e.target.value) || 0) as any)
                      : set(k as any, e.target.value as any)
                  }
                  className="bg-transparent border-0 text-center font-display text-xl h-9 px-0 focus-visible:ring-0"
                />
              ) : (
                <div className="font-display text-xl">{String((value as any)[k]) || "—"}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* === Magia === */}
      <section className="space-y-3">
        <h3 className="font-display text-xl gold-text">Magia</h3>
        <p className="font-script italic text-xs text-ink-faded">
          Punteggio per ciascuna delle dieci scuole di magia libera.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {MAGIC_SCHOOLS.map((school) => (
            <div key={school} className="bg-parchment-deep/20 border border-border/60 rounded p-3 text-center">
              <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">{school}</Label>
              {canEdit ? (
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={value.magic[school] ?? 0}
                  onChange={(e) => setMagic(school, e.target.value)}
                  className="bg-transparent border-0 text-center font-display text-xl h-9 px-0 focus-visible:ring-0"
                />
              ) : (
                <div className="font-display text-xl">{value.magic[school] ?? 0}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* === Monete === */}
      <section className="space-y-3">
        <h3 className="font-display text-xl gold-text">Monete</h3>
        <div className="grid grid-cols-3 gap-2">
          {COIN_TYPES.map((c) => (
            <div key={c.key} className="bg-parchment-deep/20 border border-border/60 rounded p-3 text-center">
              <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">{c.label}</Label>
              {canEdit ? (
                <Input
                  type="number"
                  min={0}
                  value={value.coins[c.key] ?? 0}
                  onChange={(e) => setCoin(c.key, e.target.value)}
                  className="bg-transparent border-0 text-center font-display text-xl h-9 px-0 focus-visible:ring-0"
                />
              ) : (
                <div className="font-display text-xl">{value.coins[c.key] ?? 0}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* === Abilità apprese === */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl gold-text">Abilità</h3>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addSkill} className="font-heading">
              <Plus className="h-4 w-4 mr-1" /> Aggiungi
            </Button>
          )}
        </div>
        {value.skills.length === 0 ? (
          <p className="font-script italic text-ink-faded text-sm">Nessuna abilità appresa.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {value.skills.map((s) => (
              <div key={s.id} className="bg-parchment-deep/20 border border-border/60 rounded p-2 flex items-center gap-2">
                {canEdit ? (
                  <>
                    <Input
                      value={s.name}
                      onChange={(e) => updateSkill(s.id, { name: e.target.value })}
                      className="bg-transparent border-0 px-0 h-7 focus-visible:ring-0 font-script flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={s.grade}
                      onChange={(e) => updateSkill(s.id, { grade: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
                      className="bg-transparent border border-border/60 text-center w-16 h-7 px-0 focus-visible:ring-0 font-display"
                    />
                    <button onClick={() => removeSkill(s.id)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-script flex-1">{s.name}</span>
                    <span className="font-display text-primary">{s.grade}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* === Ferite localizzate === */}
      <section className="space-y-3">
        <h3 className="font-display text-xl gold-text">Ferite & Stato del corpo</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {BODY_PARTS.map((p) => (
            <div key={p} className="bg-parchment-deep/20 border border-border/60 rounded p-3">
              <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">{p}</Label>
              {canEdit ? (
                <Input
                  value={value.ferite[p] ?? ""}
                  onChange={(e) => setFerita(p, e.target.value)}
                  placeholder="Stato / ferita..."
                  className="bg-transparent border-0 px-0 h-7 focus-visible:ring-0 font-script"
                />
              ) : renderText(value.ferite[p])}
            </div>
          ))}
        </div>
      </section>

      {/* === Equipaggiamento === */}
      <section className="space-y-3">
        <h3 className="font-display text-xl gold-text">Equipaggiamento</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {EQUIPMENT_SECTIONS.map((sec) => {
            const items = value.equipment[sec.key] ?? [];
            return (
              <div key={sec.key} className="bg-parchment-deep/20 border border-border/60 rounded p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-sm uppercase tracking-wider text-ink-faded">{sec.label}</h4>
                  {canEdit && (
                    <button onClick={() => addEquipItem(sec.key)} className="text-primary hover:text-primary/80">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {items.length === 0 && !canEdit && (
                  <p className="font-script italic text-xs text-ink-faded">—</p>
                )}
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-1 group">
                    {canEdit ? (
                      <>
                        <Input
                          value={it}
                          onChange={(e) => setEquipItem(sec.key, idx, e.target.value)}
                          className="bg-transparent border-0 px-0 h-7 focus-visible:ring-0 font-script"
                        />
                        <button
                          onClick={() => removeEquipItem(sec.key, idx)}
                          className="opacity-0 group-hover:opacity-100 text-destructive shrink-0"
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

      {/* === Note === */}
      <section className="space-y-3">
        <h3 className="font-display text-xl gold-text">Note</h3>
        {canEdit ? (
          <Textarea
            value={value.note}
            onChange={(e) => set("note", e.target.value)}
            rows={4}
            className="bg-parchment-deep/20 border-border/60 font-script focus-visible:ring-0"
            placeholder="Annotazioni libere sul personaggio..."
          />
        ) : (
          <p className="font-script whitespace-pre-wrap">{value.note || "—"}</p>
        )}
      </section>
    </div>
  );
};
