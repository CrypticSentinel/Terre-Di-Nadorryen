import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { abilityModifier, formatModifier, magicBaseDamage } from "@/lib/rulesets";
import { EditableLabel, type LabelOverride } from "@/components/EditableLabel";

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

const natural_soglia: Record<string, number> = {
  Testa: 3,
  Torace: 5,
  "Braccio DX": 4,
  "Braccio SX": 4,
  "Mano DX": 3,
  "Mano SX": 3,
  "Gamba DX": 4,
  "Gamba SX": 4,
  "Piede DX": 3,
  "Piede SX": 3,
};

const EQUIPMENT_SECTIONS = [
  { key: "pozioni", label: "Pozioni" },
  { key: "cibo", label: "Cibo" },
  { key: "pergamene", label: "Pergamene" },
  { key: "varie", label: "Varie ed eventuali" },
  { key: "oggetti", label: "Oggetti" },
  { key: "materiali", label: "Materiali" },
] as const;

const MAGIC_SCHOOLS = [
  "Acqua",
  "Vita",
  "Mente",
  "Aria",
  "Spirito",
  "Fuoco",
  "Morte",
  "Corpo",
  "Terra",
  "Materia",
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

export interface OsgdrEquipmentItem {
  id: string;
  text: string;
}

export interface OsgdrWeapon {
  id: string;
  name: string;
  damage: string;
  range: string;
  notes: string;
}

export interface OsgdrArmor {
  id: string;
  name: string;
  protection: number;
  locations: string[];
  notes: string;
}

export interface OsgdrBodyPartState {
  wounds: number;
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
  ferite: Record<string, OsgdrBodyPartState>;
  equipment: Record<EquipmentKey, OsgdrEquipmentItem[]>;
  weapons: OsgdrWeapon[];
  armors: OsgdrArmor[];
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
  ferite: Object.fromEntries(
    BODY_PARTS.map((p) => [
      p,
      {
        wounds: 0,
      },
    ]),
  ) as Record<string, OsgdrBodyPartState>,
  equipment: Object.fromEntries(
    EQUIPMENT_SECTIONS.map((s) => [s.key, [] as OsgdrEquipmentItem[]]),
  ) as Record<EquipmentKey, OsgdrEquipmentItem[]>,
  weapons: [],
  armors: [],
  note: "",
  skills: [],
};

const sortSkillsAlphabetically = (skills: OsgdrSkill[]): OsgdrSkill[] =>
  [...skills].sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));

const sortEquipmentAlphabetically = (items: OsgdrEquipmentItem[]): OsgdrEquipmentItem[] => {
  const normalized = items.map((item) => ({
    ...item,
    text: item.text ?? "",
  }));

  const filled = normalized
    .filter((item) => item.text.trim().length > 0)
    .sort((a, b) => a.text.localeCompare(b.text, "it", { sensitivity: "base" }));

  const empty = normalized.filter((item) => item.text.trim().length === 0);

  return [...filled, ...empty];
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
      weapons: [],
      armors: [],
      skills: [],
    };
  }

  const abilities = { ...base.abilities, ...(input.abilities ?? {}) };

  const ferite: Record<string, OsgdrBodyPartState> = { ...base.ferite };
  if (input.ferite && typeof input.ferite === "object") {
    for (const part of BODY_PARTS) {
      const raw = input.ferite[part];
      if (raw && typeof raw === "object") {
        ferite[part] = {
          wounds: Math.max(0, Number(raw.wounds) || 0),
        };
      }
    }
  }

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

  const equipment: Record<EquipmentKey, OsgdrEquipmentItem[]> = { ...base.equipment };
  if (input.equipment) {
    for (const s of EQUIPMENT_SECTIONS) {
      const raw = input.equipment[s.key];

      if (Array.isArray(raw)) {
        equipment[s.key] = sortEquipmentAlphabetically(
          raw.map((item: any) => {
            if (typeof item === "string") {
              return { id: crypto.randomUUID(), text: item };
            }

            return {
              id: String(item?.id ?? crypto.randomUUID()),
              text: String(item?.text ?? ""),
            };
          }),
        );
      } else {
        equipment[s.key] = [];
      }
    }
  }

  const skills: OsgdrSkill[] = Array.isArray(input.skills)
    ? input.skills.map((sk: any) => ({
        id: String(sk?.id ?? crypto.randomUUID()),
        name: String(sk?.name ?? ""),
        grade: Number(sk?.grade ?? 0),
      }))
    : [];

  const weapons: OsgdrWeapon[] = Array.isArray(input.weapons)
    ? input.weapons.map((w: any) => ({
        id: String(w?.id ?? crypto.randomUUID()),
        name: String(w?.name ?? ""),
        damage: String(w?.damage ?? ""),
        range: String(w?.range ?? ""),
        notes: String(w?.notes ?? ""),
      }))
    : [];

const armors: OsgdrArmor[] = Array.isArray(input.armors)
  ? input.armors.map((a: any) => {
      const rawLocations = Array.isArray(a?.locations)
        ? a.locations
        : a?.location
          ? [a.locations]
          : [BODY_PARTS[0]];

      const normalizedLocations = rawLocations
        .map((loc: any) => String(loc))
        .filter((loc: string) => BODY_PARTS.includes(loc as (typeof BODY_PARTS)[number]));

      return {
        id: String(a?.id ?? crypto.randomUUID()),
        name: String(a?.name ?? ""),
        protection: Math.max(0, Number(a?.protection ?? 0)),
        locations: normalizedLocations.length > 0 ? normalizedLocations : [BODY_PARTS[0]],
        notes: String(a?.notes ?? ""),
      };
    })
  : [];

  return {
    ...base,
    ...input,
    abilities,
    magic,
    coins,
    ferite,
    equipment,
    weapons,
    armors,
    skills: sortSkillsAlphabetically(skills),
  };
}

interface Props {
  value: OsgdrSheet;
  onChange: (next: OsgdrSheet) => void;
  canEdit: boolean;
  labelOverrides?: Record<string, LabelOverride>;
  canCustomizeLabels?: boolean;
  onLabelOverrideChange?: (key: string, override: LabelOverride | undefined) => void;
}

type WoundSeverity = "none" | "light" | "grave" | "lethal";

interface BodyPartPopupState {
  part: string;
  damage: number;
  threshold: number;
  severity: WoundSeverity;
  localPenalty: number;
  totalPenalty: number;
  title: string;
  description: string;
}

const getWoundSeverity = (damage: number, threshold: number): WoundSeverity => {
  if (damage >= threshold * 2) return "lethal";
  if (damage >= threshold) return "grave";
  if (damage >= 2) return "light";
  return "none";
};

const getPenaltyFromSeverity = (severity: WoundSeverity): number => {
  switch (severity) {
    case "light":
      return -2;
    case "grave":
      return -5;
    case "lethal":
      return -5;
    default:
      return 0;
  }
};

const getBodyPartPopupInfo = (
  part: string,
  damage: number,
  threshold: number,
  severity: WoundSeverity,
  totalPenalty: number,
): BodyPartPopupState => {
  const localPenalty = getPenaltyFromSeverity(severity);

const base = {
  part,
  damage,
  threshold,
  severity,
  localPenalty,
  totalPenalty,
};

  const isHead = part === "Testa";
  const isTorso = part === "Torace";
  const isArm = part === "Braccio DX" || part === "Braccio SX";
  const isHand = part === "Mano DX" || part === "Mano SX";
  const isLeg = part === "Gamba DX" || part === "Gamba SX";
  const isFoot = part === "Piede DX" || part === "Piede SX";

  if (severity === "none") {
    return {
      ...base,
      title: `${part}: nessuna ferita rilevante`,
      description:
        "Il danno accumulato non è sufficiente a produrre una penalità o una conseguenza meccanica significativa.",
    };
  }

  if (severity === "light") {
    return {
      ...base,
      title: `${part}: ferita leggera`,
      description:
        "La parte del corpo è ferita ma ancora funzionale. Il personaggio subisce -2 a tutte le azioni dal round successivo.",
    };
  }

  if (severity === "grave") {
    if (isHead) {
      return {
        ...base,
        title: "Testa: ferita grave",
        description:
          "Possibile stordimento o perdita di sensi. Il personaggio subisce -5 a tutte le azioni dal round successivo.",
      };
    }

    if (isTorso) {
      return {
        ...base,
        title: "Torace: ferita grave",
        description:
          "La ferita può causare difficoltà respiratorie, dolore intenso o emorragie interne. Il personaggio subisce -5 a tutte le azioni dal round successivo.",
      };
    }

    if (isArm) {
      return {
        ...base,
        title: `${part}: ferita grave`,
        description:
          "L'arto è compromesso: il personaggio può perdere l'uso del braccio o lasciar cadere l'arma. Subisce -5 a tutte le azioni dal round successivo.",
      };
    }

    if (isHand) {
      return {
        ...base,
        title: `${part}: ferita grave`,
        description:
          "La mano perde precisione e forza: impugnare o manipolare oggetti diventa difficile. Il personaggio subisce -5 a tutte le azioni dal round successivo.",
      };
    }

    if (isLeg) {
      return {
        ...base,
        title: `${part}: ferita grave`,
        description:
          "La gamba è compromessa: il movimento diventa difficile e la caduta è possibile. Il personaggio subisce -5 a tutte le azioni dal round successivo.",
      };
    }

    if (isFoot) {
      return {
        ...base,
        title: `${part}: ferita grave`,
        description:
          "Il piede è seriamente colpito: correre o mantenere l'equilibrio diventa difficile. Il personaggio subisce -5 a tutte le azioni dal round successivo.",
      };
    }
  }

  return {
    ...base,
    title: `${part}: ferita letale`,
    description:
      "La zona è devastata. La conseguenza è potenzialmente mortale o permanentemente invalidante, a discrezione del Narratore.",
  };
};

const iconButtonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors";

export const OpenSourceGdrSheet = ({
  value,
  onChange,
  canEdit,
  labelOverrides = {},
  canCustomizeLabels = false,
  onLabelOverrideChange,
}: Props) => {
  const [bodyPartPopup, setBodyPartPopup] = useState<BodyPartPopupState | null>(null);
  const [expandedBodyPart, setExpandedBodyPart] = useState<string | null>(null);
  const [selectedHitZone, setSelectedHitZone] = useState<"Alta" | "Bassa">("Alta");

  const totalPoints = useMemo(
    () => ABILITIES.reduce((acc, a) => acc + (Number(value.abilities[a.key]) || 0), 0),
    [value.abilities],
  );

  const armorByBodyPart = useMemo(() => {
  const totals: Record<string, number> = Object.fromEntries(
    BODY_PARTS.map((part) => [part, 0])
  ) as Record<string, number>;

  for (const armor of value.armors ?? []) {
    const armorLocations = Array.isArray(armor.locations) ? armor.locations : [];

    for (const location of armorLocations) {
      if (!location || !(location in totals)) continue;
      totals[location] += Math.max(0, Number(armor.protection ?? 0));
    }
  }

  return totals;
}, [value.armors]);

  const woundPenalty = useMemo(() => {
  let totalPenalty = 0;

  for (const part of BODY_PARTS) {
    const damage = Math.max(0, Number(value.ferite?.[part]?.wounds ?? 0) || 0);
    const threshold = natural_soglia[part] ?? 0;
    const severity = getWoundSeverity(damage, threshold);
    const penalty = getPenaltyFromSeverity(severity);

    totalPenalty += penalty;
  }

  return totalPenalty;
}, [value.ferite]);

  const set = <K extends keyof OsgdrSheet>(k: K, v: OsgdrSheet[K]) =>
    onChange({ ...value, [k]: v });

  const setAbility = (key: Ability, raw: string) => {
    const n = Math.max(0, Math.min(30, Number(raw) || 0));
    onChange({ ...value, abilities: { ...value.abilities, [key]: n } });
  };

  const setMagic = (school: MagicSchool, raw: string) => {
    const n = Math.max(0, Math.min(99, Number(raw) || 0));
    onChange({ ...value, magic: { ...value.magic, [school]: n } });
  };

  const setFeritaValue = (part: string, nextValue: string) => {
  const damage = Math.max(0, Math.abs(Number(nextValue) || 0));
  const threshold = natural_soglia[part] ?? 0;
  const severity = getWoundSeverity(damage, threshold);

  const nextFerite = {
    ...value.ferite,
    [part]: {
      wounds: damage,
    },
  };

  let totalPenalty = 0;

  for (const bodyPart of BODY_PARTS) {
    const bodyDamage = Math.max(0, Number(nextFerite?.[bodyPart]?.wounds ?? 0) || 0);
    const bodyThreshold = natural_soglia[bodyPart] ?? 0;
    const bodySeverity = getWoundSeverity(bodyDamage, bodyThreshold);
    totalPenalty += getPenaltyFromSeverity(bodySeverity);
  }

  onChange({
    ...value,
    ferite: nextFerite,
  });

  setBodyPartPopup(
    getBodyPartPopupInfo(part, damage, threshold, severity, totalPenalty)
  );
};

  const setEquipItem = (sec: EquipmentKey, id: string, txt: string) => {
    const arr = (value.equipment[sec] ?? []).map((item) =>
      item.id === id ? { ...item, text: txt } : item,
    );

    onChange({
      ...value,
      equipment: {
        ...value.equipment,
        [sec]: sortEquipmentAlphabetically(arr),
      },
    });
  };

  const addEquipItem = (sec: EquipmentKey) => {
    const arr = [
      ...(value.equipment[sec] ?? []),
      { id: crypto.randomUUID(), text: "" },
    ];

    onChange({
      ...value,
      equipment: {
        ...value.equipment,
        [sec]: arr,
      },
    });
  };

  const removeEquipItem = (sec: EquipmentKey, id: string) => {
    const arr = (value.equipment[sec] ?? []).filter((item) => item.id !== id);

    onChange({
      ...value,
      equipment: {
        ...value.equipment,
        [sec]: sortEquipmentAlphabetically(arr),
      },
    });
  };

  const addWeapon = () =>
    onChange({
      ...value,
      weapons: [
        ...(value.weapons ?? []),
        {
          id: crypto.randomUUID(),
          name: "",
          damage: "",
          range: "",
          notes: "",
        },
      ],
    });

  const updateWeapon = (id: string, patch: Partial<OsgdrWeapon>) =>
    onChange({
      ...value,
      weapons: (value.weapons ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)),
    });

  const removeWeapon = (id: string) =>
    onChange({
      ...value,
      weapons: (value.weapons ?? []).filter((w) => w.id !== id),
    });

const addArmor = () =>
  onChange({
    ...value,
    armors: [
      ...(value.armors ?? []),
      {
        id: crypto.randomUUID(),
        name: "",
        protection: 0,
        locations: [BODY_PARTS[0]],
        notes: "",
      },
    ],
  });

  const updateArmor = (id: string, patch: Partial<OsgdrArmor>) =>
    onChange({
      ...value,
      armors: (value.armors ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });

  const removeArmor = (id: string) =>
    onChange({
      ...value,
      armors: (value.armors ?? []).filter((a) => a.id !== id),
    });

  const addSkill = () =>
    onChange({
      ...value,
      skills: sortSkillsAlphabetically([
        ...value.skills,
        { id: crypto.randomUUID(), name: "Nuova abilità", grade: 1 },
      ]),
    });

  const updateSkill = (id: string, patch: Partial<OsgdrSkill>) =>
    onChange({
      ...value,
      skills: sortSkillsAlphabetically(
        value.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      ),
    });

  const removeSkill = (id: string) =>
    onChange({
      ...value,
      skills: sortSkillsAlphabetically(value.skills.filter((s) => s.id !== id)),
    });

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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {lbl("section.caratteristiche", "Caratteristiche", "font-display text-xl gold-text", "h3")}
          <p className="font-script text-xs italic text-ink-faded">
            Totale punti distribuiti: <strong>{totalPoints}</strong>
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
                    inputMode="numeric"
                    pattern="[0-9]*"
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
            {sortSkillsAlphabetically(value.skills).map((s) => (
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
                      inputMode="numeric"
                      pattern="[0-9]*"
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
                    <button
                      type="button"
                      onClick={() => removeSkill(s.id)}
                      className={`${iconButtonClass} text-destructive hover:bg-destructive/10`}
                      aria-label="Rimuovi abilità"
                    >
                      <Trash2 className="h-4 w-4" />
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

      <section className="space-y-4">
  {(() => {
    // Logica ferite - da mettere prima del return del componente
const woundedParts = BODY_PARTS.filter(
  (part) => Math.max(0, Number(value.ferite?.[part]?.wounds ?? 0)) > 0
);

const hitLocations = {
  Alta: [
    { locations: "Testa", roll: "1 - 10", key: "Testa" },
    { locations: "Braccio SX", roll: "11 - 20", key: "Braccio SX" },
    { locations: "Braccio DX", roll: "21 - 30", key: "Braccio DX" },
    { locations: "Mano SX", roll: "31 - 35", key: "Mano SX" },
    { locations: "Mano DX", roll: "36 - 40", key: "Mano DX" },
    { locations: "Torace", roll: "41 - 100", key: "Torace" },
  ],
  Bassa: [
    { locations: "Piede SX", roll: "1 - 5", key: "Piede SX" },
    { locations: "Piede DX", roll: "6 - 10", key: "Piede DX" },
    { locations: "Gamba SX", roll: "11 - 35", key: "Gamba SX" },
    { locations: "Gamba DX", roll: "36 - 60", key: "Gamba DX" },
    { locations: "Torace", roll: "61 - 100", key: "Torace" },
  ],
} as const;

const getHitZoneFromBodyPart = (part: string): "Alta" | "Bassa" => {
  const upperParts = ["Testa", "Torace", "Braccio SX", "Braccio DX", "Mano SX", "Mano DX"];
  return upperParts.includes(part) ? "Alta" : "Bassa";
};

const getSeverityStyles = (severity: WoundSeverity) => {
  if (severity === "light") {
    return {
      badge: "border-amber-600/30 bg-amber-500/10 text-amber-700",
      zone: "fill-amber-500/25 text-amber-700",
      row: "border-amber-600/20 bg-amber-500/5",
      accent: "text-amber-700",
    };
  }

  if (severity === "grave") {
    return {
      badge: "border-destructive/30 bg-destructive/10 text-destructive",
      zone: "fill-destructive/22 text-destructive",
      row: "border-destructive/25 bg-destructive/5",
      accent: "text-destructive",
    };
  }

  if (severity === "lethal") {
    return {
      badge: "border-destructive/40 bg-destructive/15 text-destructive",
      zone: "fill-destructive/38 text-destructive",
      row: "border-destructive/35 bg-destructive/10",
      accent: "text-destructive",
    };
  }

  return {
    badge: "border-border60 bg-background/40 text-ink-faded",
    zone: "fill-background/35 text-border",
    row: "border-border30 bg-background/15",
    accent: "text-ink-faded",
  };
};

const getSeverityLabel = (severity: WoundSeverity) => {
  if (severity === "light") return "Leggera";
  if (severity === "grave") return "Grave";
  if (severity === "lethal") return "Letale";
  return "Integro";
};

const getPartDamage = (part: string) =>
  Math.max(0, Number(value.ferite?.[part]?.wounds ?? 0));

const getPartThreshold = (part: string) => natural_soglia[part] ?? 0;

const getPartSeverity = (part: string): WoundSeverity =>
  getWoundSeverity(getPartDamage(part), getPartThreshold(part));

const getPartPenalty = (part: string) =>
  getPenaltyFromSeverity(getPartSeverity(part));

const getPartProtection = (part: string) => {
  const constitutionModifier = abilityModifier(value.abilities.cos ?? 0);
  const naturalThreshold = getPartThreshold(part);
  const totalNaturalArmor = naturalThreshold + constitutionModifier;
  const totalArmor = armorByBodyPart[part] ?? 0;

  return {
    totalNaturalArmor,
    totalArmor,
    totalProtection: totalNaturalArmor + totalArmor,
  };
};

const bodyPartSummaries = BODY_PARTS.map((part) => {
  const damage = getPartDamage(part);
  const threshold = getPartThreshold(part);
  const severity = getPartSeverity(part);
  const penalty = getPartPenalty(part);
  const protection = getPartProtection(part);
  const styles = getSeverityStyles(severity);

  return {
    part,
    damage,
    threshold,
    severity,
    severityLabel: getSeverityLabel(severity),
    penalty,
    protection,
    styles,
    isWounded: damage > 0,
    isExpanded: expandedBodyPart === part,
  };
});

const bodyPartSummaryMap = Object.fromEntries(
  bodyPartSummaries.map((summary) => [summary.part, summary])
) as Record<(typeof BODY_PARTS)[number], (typeof bodyPartSummaries)[number]>;

const fantasyZones = [
  {
    key: "Testa",
    render: (className: string, style: React.CSSProperties) => (
      <ellipse cx="120" cy="48" rx="24" ry="28" className={className} style={style} />
    ),
  },
  {
    key: "Torace",
    render: (className: string, style: React.CSSProperties) => (
      <path
        d="M86 94 C92 82, 104 76, 120 76 C136 76, 148 82, 154 94 L158 142 C149 153, 137 159, 120 159 C103 159, 91 153, 82 142 Z"
        className={className}
        style={style}
      />
    ),
  },
  // ... resto fantasyZones come nel tuo codice originale
] as const;

      
        <div className="flex flex-wrap items-end justify-between gap-2">
          {lbl("section.ferite", "Ferite & Stato del corpo", "font-display text-xl gold-text", "h3")}

          <div className="flex flex-wrap gap-2 text-xs font-script italic text-ink-faded">
            <span className="rounded-full border border-border60 bg-parchment-deep20 px-3 py-1.5">
              Zone ferite:{" "}
              <strong className="font-heading text-ink">{woundedParts.length}</strong>/{BODY_PARTS.length}
            </span>

            <span className="rounded-full border border-border60 bg-parchment-deep20 px-3 py-1.5">
              Penalità totale:{" "}
              <strong className="font-heading text-primary">{formatModifier(woundPenalty)}</strong>
            </span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[280px,minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-border60 bg-parchment-deep20 p-4">
              <p className="mb-3 text-center font-script text-xs italic text-ink-faded">
                Figura di riferimento interattiva in stile cronaca illustrata.
              </p>

              <div className="mx-auto flex max-w-[230px] justify-center">
                <svg viewBox="0 0 220 320" className="h-auto w-full">
  <defs>
    <linearGradient id="bodyFillSoft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(246, 238, 214, 0.96)" />
      <stop offset="100%" stopColor="rgba(222, 201, 162, 0.92)" />
    </linearGradient>
  </defs>

  <g className="text-border/65" fill="none" stroke="currentColor">
    <path
      d="M110 18
         C124 20, 136 31, 138 46
         C140 60, 135 73, 126 82
         C137 87, 145 96, 151 109
         C159 126, 163 146, 162 168
         C158 169, 154 169, 150 168
         C146 150, 141 134, 132 121
         L128 141
         C127 157, 127 173, 129 192
         C132 211, 135 233, 136 258
         C137 275, 136 291, 134 306
         L122 306
         C122 282, 119 255, 114 223
         L106 223
         C101 255, 98 282, 98 306
         L86 306
         C84 291, 83 275, 84 258
         C85 233, 88 211, 91 192
         C93 173, 93 157, 92 141
         L88 121
         C79 134, 74 150, 70 168
         C66 169, 62 169, 58 168
         C57 146, 61 126, 69 109
         C75 96, 83 87, 94 82
         C85 73, 80 60, 82 46
         C84 31, 96 20, 110 18 Z"
      strokeWidth="2.2"
    />
    <path d="M101 73 C104 76, 116 76, 119 73" strokeWidth="1.2" className="text-border/40" />
    <path d="M96 148 C101 151, 119 151, 124 148" strokeWidth="1.1" className="text-border/30" />
  </g>

  <g fill="url(#bodyFillSoft)" stroke="currentColor" className="text-border/80">
    {fantasyZones.map((zone) => {
      const summary = bodyPartSummaryMap[zone.key];
      const isActive = summary.isExpanded;

      const sharedStyle: React.CSSProperties = {
  strokeWidth: isActive ? 4.5 : summary.isWounded ? 2.5 : 2,
  opacity: isActive ? 1 : summary.isWounded ? 0.96 : 0.82,
  filter: isActive
  ? "drop-shadow(0 0 10px rgba(13,148,136,0.30)) drop-shadow(0 0 18px rgba(15,118,110,0.22))"
  : summary.isWounded
    ? "drop-shadow(0 0 4px rgba(120,82,38,0.10))"
    : undefined,
};

      const zoneClassName = isActive
  ? "fill-teal-700/35 stroke-teal-800"
  : summary.isWounded
    ? `${summary.styles.zone} stroke-current`
    : "fill-background/30 stroke-border";

      return (
        <g
          key={zone.key}
          onClick={() => {
  setSelectedHitZone(getHitZoneFromBodyPart(zone.key));
  setExpandedBodyPart((prev) => (prev === zone.key ? null : zone.key));
}}
          className="cursor-pointer transition-all"
        >
          {zone.key === "Testa" && (
            <ellipse
              cx="110"
              cy="46"
              rx="21"
              ry="25"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Torace" && (
            <path
              d="M84 82
                 C90 73, 99 69, 110 69
                 C121 69, 130 73, 136 82
                 L140 132
                 C132 142, 122 148, 110 148
                 C98 148, 88 142, 80 132 Z"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Braccio SX" && (
            <path
              d="M68 106
                 C61 120, 58 135, 59 151
                 C60 163, 64 175, 70 186
                 L81 181
                 C76 167, 74 153, 74 139
                 C74 127, 77 115, 83 103 Z"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Braccio DX" && (
            <path
              d="M152 106
                 C159 120, 162 135, 161 151
                 C160 163, 156 175, 150 186
                 L139 181
                 C144 167, 146 153, 146 139
                 C146 127, 143 115, 137 103 Z"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Mano SX" && (
            <ellipse
              cx="69"
              cy="201"
              rx="11"
              ry="12"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Mano DX" && (
            <ellipse
              cx="151"
              cy="201"
              rx="11"
              ry="12"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Gamba SX" && (
            <path
              d="M98 148
                 C92 167, 89 187, 88 209
                 C87 228, 89 250, 93 279
                 L104 279
                 C106 252, 108 229, 111 207
                 C114 186, 117 166, 120 148 Z"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Gamba DX" && (
            <path
              d="M122 148
                 C128 167, 131 187, 132 209
                 C133 228, 131 250, 127 279
                 L116 279
                 C114 252, 112 229, 109 207
                 C106 186, 103 166, 100 148 Z"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Piede SX" && (
            <path
              d="M90 282
                 C82 282, 76 285, 72 289
                 L73 297
                 C82 300, 94 300, 104 297
                 L103 289
                 C99 285, 95 282, 90 282 Z"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          {zone.key === "Piede DX" && (
            <path
              d="M130 282
                 C135 282, 139 285, 143 289
                 L142 297
                 C132 300, 120 300, 111 297
                 L112 289
                 C116 285, 122 282, 130 282 Z"
              className={zoneClassName}
              style={sharedStyle}
            />
          )}

          <title>{zone.key}</title>
        </g>
      );
    })}
  </g>

  <g className="text-primary/20" fill="none" stroke="currentColor">
    <path d="M110 24 L110 304" strokeWidth="0.8" strokeDasharray="3 5" />
  </g>
</svg>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border60 bg-parchment-deep20 p-3">
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedHitZone === "Alta" ? "default" : "outline"}
                  className="font-heading"
                  onClick={() => setSelectedHitZone("Alta")}
                >
                  Zona alta
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={selectedHitZone === "Bassa" ? "default" : "outline"}
                  className="font-heading"
                  onClick={() => setSelectedHitZone("Bassa")}
                >
                  Zona bassa
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border border-border40">
                <table className="w-full text-left">
                  <thead className="bg-background/40">
                  </thead>
                  <tbody>
                    <div className="space-y-2">
  {hitLocations[selectedHitZone].map((entry) => {
    const isActive = expandedBodyPart === entry.key;
    const summary = bodyPartSummaryMap[entry.key];
    const zoneStyles = summary?.styles ?? getSeverityStyles("none");

    return (
      <button
        key={`${selectedHitZone}-${entry.key}`}
        type="button"
        onClick={() => {
          setSelectedHitZone(getHitZoneFromBodyPart(entry.key));
          setExpandedBodyPart((prev) => (prev === entry.key ? null : entry.key));
        }}
        className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-3 text-left transition-all ${
          isActive
  ? "border-teal-800 bg-teal-700/10 shadow-[0_0_0_1px_rgba(13,148,136,0.28),0_0_16px_rgba(13,148,136,0.16)]"
  : "border-border40 bg-background/20 hover:border-border60 hover:bg-background/35"
        }`}
      >
        <div className="min-w-0 self-center">
          <div className="font-heading text-sm leading-5 text-ink">
            {entry.location}
          </div>
        </div>

        <div className="flex min-w-[88px] flex-col items-end justify-center gap-1 self-center text-right">
          <span className="font-display text-sm leading-5 text-primary">
            {entry.roll}
          </span>

          <span
            className={`rounded-md px-2 py-1 text-[10px] leading-none font-heading uppercase tracking-[0.12em] ${
              isActive
  ? "border border-teal-800/40 bg-teal-700/10 text-teal-900"
  : zoneStyles.badge
            }`}
          >
            {summary ? summary.severityLabel : "Integro"}
          </span>
        </div>
      </button>
    );
  })}
</div>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-2">
  {bodyPartSummaries.map((summary) => {
    const {
      part,
      damage,
      threshold,
      severityLabel,
      penalty,
      protection,
      styles,
      isWounded,
      isExpanded,
    } = summary;

    return (
      <div
        key={part}
        className={`rounded-xl border transition-all ${
          isExpanded
  ? "border-teal-800 bg-teal-700/10 shadow-[0_0_0_1px_rgba(13,148,136,0.20)]"
  : isWounded
    ? "border-border60 bg-parchment-deep20"
    : "border-border30 bg-background/15 opacity-80"
        }`}
      >
        <button
          type="button"
          onClick={() => {
  setSelectedHitZone(getHitZoneFromBodyPart(part));
  setExpandedBodyPart((prev) => (prev === part ? null : part));
}}
          className="flex w-full flex-col items-start gap-2 px-3 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="font-heading text-[13px] uppercase tracking-[0.14em] text-ink">
              {part}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="min-w-[54px] text-right font-display text-sm text-primary">
              {damage > 0 ? -damage : "—"}
            </div>

            <span
              className={`rounded-md px-2 py-1 text-[11px] font-heading uppercase tracking-[0.12em] ${styles.badge}`}
            >
              {severityLabel}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border40 px-3 pb-3 pt-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                  Ferite
                </div>

                {canEdit ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={damage > 0 ? -damage : ""}
                    onChange={(e) => setFeritaValue(part, e.target.value)}
                    placeholder="-0"
                    className="mt-1 h-7 border-0 bg-transparent px-0 text-center font-display text-base text-primary focus-visible:ring-0"
                  />
                ) : (
                  <div className="mt-1 h-7 font-display text-base leading-7 text-primary">
                    {damage > 0 ? -damage : "—"}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                  Soglia
                </div>
                <div className="mt-1 h-7 font-display text-base leading-7 text-primary">
                  {threshold}
                </div>
              </div>

              <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                  Naturale
                </div>
                <div className="mt-1 h-7 font-display text-base leading-7 text-primary">
                  {protection.totalNaturalArmor}
                </div>
              </div>

              <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                  Armatura
                </div>
                <div
                  className="mt-1 h-7 font-display text-base leading-7 text-primary"
                  title={`Protezione totale ${protection.totalProtection}`}
                >
                  {protection.totalArmor}
                </div>
              </div>
            </div>

            <div className="mt-2 text-xs font-script italic text-ink-faded">
              Penalità della zona:{" "}
              <strong className="font-heading text-ink">
                {formatModifier(penalty)}
              </strong>
              {" · "}
              Protezione totale:{" "}
              <strong className="font-heading text-ink">
                {protection.totalProtection}
              </strong>
            </div>
          </div>
        )}
      </div>
    );
  })}
</div>
        </div>
      </>
    );
  })()}
</section>

      <section className="space-y-3">
  <div className="flex items-center justify-between gap-2">
    {lbl("section.weapons", "Armi", "font-display text-xl gold-text", "h3")}
    {canEdit ? (
      <Button variant="outline" size="sm" onClick={addWeapon} className="font-heading">
        <Plus className="mr-1 h-4 w-4" />
        Aggiungi
      </Button>
    ) : null}
  </div>

  {!value.weapons || value.weapons.length === 0 ? (
    <p className="text-sm font-script italic text-ink-faded">Nessuna arma inserita.</p>
  ) : (
    <div className="space-y-2">
      {value.weapons.map((w) => (
        <div
          key={w.id}
          className="rounded-lg border border-border60 bg-parchment-deep20 p-2.5"
        >
          {canEdit ? (
            <>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1.7fr)_130px_130px_auto] md:items-center">
                <Input
                  value={w.name}
                  onChange={(e) => updateWeapon(w.id, { name: e.target.value })}
                  placeholder="Nome arma"
                  className="font-script"
                />

                <Input
                  value={w.damage}
                  onChange={(e) => updateWeapon(w.id, { damage: e.target.value })}
                  placeholder="Danno"
                  className="font-script text-center"
                />

                <Input
                  value={w.range}
                  onChange={(e) => updateWeapon(w.id, { range: e.target.value })}
                  placeholder="Gittata"
                  className="font-script text-center"
                />

                <button
                  type="button"
                  onClick={() => removeWeapon(w.id)}
                  className={`${iconButtonClass} text-destructive hover:bg-destructive/10`}
                  aria-label="Rimuovi arma"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2">
                <Input
                  value={w.notes}
                  onChange={(e) => updateWeapon(w.id, { notes: e.target.value })}
                  placeholder="Note"
                  className="font-script"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5 font-script">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <strong className="font-heading text-ink">
                    {w.name?.trim() || "Arma senza nome"}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faded">
                  {w.damage?.trim() ? (
                    <span className="rounded-full border border-border60 bg-background/40 px-2 py-1">
                      Danno {w.damage}
                    </span>
                  ) : null}

                  {w.range?.trim() ? (
                    <span className="rounded-full border border-border60 bg-background/40 px-2 py-1">
                      Gittata {w.range}
                    </span>
                  ) : null}
                </div>
              </div>

              {w.notes?.trim() ? (
                <div className="text-sm text-ink-faded">{w.notes}</div>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</section>

      <section className="space-y-3">
  <div className="flex items-center justify-between gap-2">
    {lbl("section.armors", "Armature", "font-display text-xl gold-text", "h3")}
    {canEdit ? (
      <Button variant="outline" size="sm" onClick={addArmor} className="font-heading">
        <Plus className="mr-1 h-4 w-4" />
        Aggiungi
      </Button>
    ) : null}
  </div>

  {!value.armors || value.armors.length === 0 ? (
    <p className="text-sm font-script italic text-ink-faded">Nessuna armatura inserita.</p>
  ) : (
    <div className="space-y-2">
      {value.armors.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-border60 bg-parchment-deep20 p-2.5"
        >
          {canEdit ? (
            <>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1.7fr)_88px_auto] md:items-center">
                <Input
                  value={a.name}
                  onChange={(e) => updateArmor(a.id, { name: e.target.value })}
                  placeholder="Nome armatura"
                  className="font-script"
                />

                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  value={a.protection}
                  onChange={(e) =>
                    updateArmor(a.id, {
                      protection: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  placeholder="Prot."
                  className="font-script text-center"
                />

                <button
                  type="button"
                  onClick={() => removeArmor(a.id)}
                  className={`${iconButtonClass} text-destructive hover:bg-destructive/10 justify-self-end`}
                  aria-label="Rimuovi armatura"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 rounded-md border border-border40 bg-background/20 px-2.5 py-2">
                <div className="mb-2 text-[11px] font-heading uppercase tracking-[0.16em] text-ink-faded">
                  Zone coperte
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BODY_PARTS.map((part) => {
                    const selected = (a.locations ?? []).includes(part);

                    return (
                      <label
                        key={part}
                        className="flex items-center gap-2 rounded-md border border-border40 bg-background/25 px-2 py-1.5 text-sm font-script text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const current = Array.isArray(a.locations) ? a.locations : [];
                            const next = e.target.checked
                              ? [...current, part]
                              : current.filter((loc) => loc !== part);

                            updateArmor(a.id, {
                              locations: next.length > 0 ? next : [BODY_PARTS[0]],
                            });
                          }}
                          className="h-4 w-4 accent-current"
                        />
                        <span>{part}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2">
                <Input
                  value={a.notes}
                  onChange={(e) => updateArmor(a.id, { notes: e.target.value })}
                  placeholder="Note"
                  className="font-script"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5 font-script">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <strong className="font-heading text-ink">
                    {a.name?.trim() || "Armatura senza nome"}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faded">
                  <span className="rounded-full border border-border60 bg-background/40 px-2 py-1">
                    Protezione {a.protection}
                  </span>
                </div>
              </div>

              {(a.locations ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {a.locations.map((loc) => (
                    <span
                      key={loc}
                      className="rounded-full border border-border60 bg-background/40 px-2 py-1 text-xs text-ink-faded"
                    >
                      {loc}
                    </span>
                  ))}
                </div>
              ) : null}

              {a.notes?.trim() ? (
                <div className="text-sm text-ink-faded">{a.notes}</div>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</section>

<section className="space-y-3">
  {lbl("section.equip", "Equipaggiamento", "font-display text-xl gold-text", "h3")}

  <div className="grid gap-3 sm:grid-cols-2">
    {EQUIPMENT_SECTIONS.map((sec) => {
      const items = sortEquipmentAlphabetically(value.equipment[sec.key] ?? []);
      const filledItems = items.filter((it) => it.text.trim().length > 0);
      const emptyItems = items.filter((it) => it.text.trim().length === 0);

      return (
        <div
          key={sec.key}
          className="rounded-lg border border-border60 bg-parchment-deep20 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            {lbl(
              `equip.${sec.key}`,
              sec.label,
              "font-heading text-sm uppercase tracking-wider text-ink-faded",
              "h3"
            )}

            {canEdit ? (
              <button
                type="button"
                onClick={() => addEquipItem(sec.key)}
                className={`${iconButtonClass} text-primary hover:bg-primary/10`}
                aria-label={`Aggiungi item a ${sec.label}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {items.length === 0 && !canEdit ? (
            <p className="text-xs font-script italic text-ink-faded">
              Nessun elemento in questa categoria.
            </p>
          ) : (
            <div className="space-y-1.5">
              {[...filledItems, ...emptyItems].map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 rounded-md border border-border40 bg-background/20 px-2.5 py-2"
                >
                  {canEdit ? (
                    <>
                      <Input
                        value={it.text}
                        onChange={(e) => setEquipItem(sec.key, it.id, e.target.value)}
                        className="h-8 flex-1 border-0 bg-transparent px-0 font-script focus-visible:ring-0"
                        placeholder={`Aggiungi ${sec.label.toLowerCase()}`}
                      />

                      <button
                        type="button"
                        onClick={() => removeEquipItem(sec.key, it.id)}
                        className={`${iconButtonClass} h-8 w-8 text-destructive hover:bg-destructive/10`}
                        aria-label={`Rimuovi item da ${sec.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : it.text.trim() ? (
                    <span className="font-script text-sm text-ink">{it.text}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
</section>

<section className="space-y-3">
        {lbl("section.magia", "Magia", "font-display text-xl gold-text", "h3")}
        <div className="flex flex-wrap items-center gap-2">
  <a
    href="https://crypticsentinel.github.io/Open-Source-GDR/Magia%20Libera/SpellCheck/"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 rounded-lg border border-border60 bg-parchment-deep20 px-3 py-2 text-sm font-heading text-primary transition-all hover:border-border80 hover:bg-background/40"
  >
    <span>Apri Spell Check</span>
    <span aria-hidden="true">↗</span>
  </a>

  <p className="text-xs font-script italic text-ink-faded">
    Calcolo rapido della difficoltà degli incantesimi.
  </p>
</div>
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
                    inputMode="numeric"
                    pattern="[0-9]*"
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

      {bodyPartPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
            <h3 className="font-display text-xl gold-text">
              {bodyPartPopup.title}
            </h3>

            <div className="mt-3 space-y-2 font-script text-sm text-ink">
              <p>{bodyPartPopup.description}</p>

              <div className="rounded border border-border/60 bg-parchment-deep/20 p-3 space-y-1">
  <div><strong>Zona:</strong> {bodyPartPopup.part}</div>
  <div><strong>Danno accumulato:</strong> -{bodyPartPopup.damage}</div>
  <div><strong>Soglia:</strong> {bodyPartPopup.threshold}</div>
  <div><strong>Stato:</strong> {bodyPartPopup.severity}</div>
  <div>
    <strong>Penalità della zona:</strong>{" "}
    {formatModifier(bodyPartPopup.localPenalty)}
  </div>
  <div>
    <strong>Penalità totale attuale:</strong>{" "}
    {formatModifier(bodyPartPopup.totalPenalty)}
  </div>
</div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                onClick={() => setBodyPartPopup(null)}
                className="font-heading"
              >
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};