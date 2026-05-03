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
  "Addome",
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
  Addome: 4,
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
        : a?.locations
          ? [a.locations]
          : [BODY_PARTS[0]];

      const locations = rawLocations
        .map((loc: any) => String(loc))
        .filter((loc: string) =>
          BODY_PARTS.includes(loc as (typeof BODY_PARTS)[number]),
        );

      return {
        id: String(a?.id ?? crypto.randomUUID()),
        name: String(a?.name ?? ""),
        protection: Math.max(0, Number(a?.protection) || 0),
        locations: locations.length > 0 ? locations : [BODY_PARTS[0]],
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
  const isTorso = part === "Torace" || part === "Addome";
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
        title: `${part}: ferita grave`,
        description:
      part === "Torace"
        ? "La ferita può causare difficoltà respiratorie, dolore intenso o emorragie interne. Il personaggio subisce -5 a tutte le azioni dal round successivo."
        : "La ferita può compromettere organi interni, equilibrio e resistenza al dolore. Il personaggio subisce -5 a tutte le azioni dal round successivo.",
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
  const [abilityDrafts, setAbilityDrafts] = useState<Partial<Record<Ability, string>>>({});
  
  const [magicDrafts, setMagicDrafts] = useState<Partial<Record<MagicSchool, string>>>({});
  
  const [armorProtectionDrafts, setArmorProtectionDrafts] = useState<Record<string, string>>({});

  const [skillGradeDrafts, setSkillGradeDrafts] = useState<Record<string, string>>({});
  
  const totalPoints = useMemo(
    () => ABILITIES.reduce((acc, a) => acc + (Number(value.abilities[a.key]) || 0), 0),
    [value.abilities],
  );

const armorByBodyPart = useMemo(() => {
  const totals: Record<string, number> = Object.fromEntries(
    BODY_PARTS.map((part) => [part, 0]),
  ) as Record<string, number>;

  for (const armor of value.armors ?? []) {
    const protection = Math.max(0, Number(armor.protection) || 0);
    const locations = Array.isArray(armor.locations) ? armor.locations : [];

    for (const location of locations) {
      if (!location || !(location in totals)) continue;
      totals[location] += protection;
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
  setAbilityDrafts((prev) => ({ ...prev, [key]: raw }));

  if (raw === "") return;

  const n = Math.max(0, Math.min(30, Number(raw)));
  onChange({
    ...value,
    abilities: {
      ...value.abilities,
      [key]: Number.isFinite(n) ? n : 0,
    },
  });
};

const setMagic = (school: MagicSchool, raw: string) => {
  setMagicDrafts((prev) => ({ ...prev, [school]: raw }));

  if (raw === "") return;

  const n = Math.max(0, Math.min(99, Number(raw)));
  onChange({
    ...value,
    magic: {
      ...value.magic,
      [school]: Number.isFinite(n) ? n : 0,
    },
  });
};

const setFeritaValue = (part: string, nextValue: string) => {
  if (nextValue === "") return;

  const numericValue = Number(nextValue);
  const damage = Math.max(0, Math.abs(Number.isFinite(numericValue) ? numericValue : 0));
  const threshold = natural_soglia[part] ?? 0;
  const severity = getWoundSeverity(damage, threshold);

  const nextFerite = {
    ...value.ferite,
    [part]: { wounds: damage },
  };

  let totalPenalty = 0;
  for (const bodyPart of BODY_PARTS) {
    const bodyDamage = Math.max(0, Number(nextFerite?.[bodyPart]?.wounds ?? 0) || 0);
    const bodyThreshold = natural_soglia[bodyPart] ?? 0;
    const bodySeverity = getWoundSeverity(bodyDamage, bodyThreshold);
    totalPenalty += getPenaltyFromSeverity(bodySeverity);
  }

  onChange({ ...value, ferite: nextFerite });
  setBodyPartPopup(getBodyPartPopupInfo(part, damage, threshold, severity, totalPenalty));
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
            const draftValue = abilityDrafts[a.key];
            const inputValue = draftValue ?? String(v);
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
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={inputValue}
  onChange={(e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setAbility(a.key, raw);
  }}
  onBlur={() => {
    setAbilityDrafts((prev) => {
      const next = { ...prev };
      delete next[a.key];
      return next;
    });
  }}
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
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={skillGradeDrafts[s.id] ?? String(s.grade)}
  onChange={(e) => {
    const raw = e.target.value.replace(/\D/g, "");

    setSkillGradeDrafts((prev) => ({
      ...prev,
      [s.id]: raw,
    }));

    if (raw === "") return;

    updateSkill(s.id, {
      grade: Math.max(0, Math.min(20, Number(raw))),
    });
  }}
  onBlur={() => {
    setSkillGradeDrafts((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
  }}
  className="h-9 w-16 border border-border60 px-0 text-center font-display focus-visible:ring-0"
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
          const woundedParts = BODY_PARTS.filter(
            (part) => Math.max(0, Number(value.ferite?.[part]?.wounds ?? 0)) > 0,
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
    { locations: "Addome", roll: "61 - 100", key: "Addome" },
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
			  const totalArmor = Math.max(0, Number(armorByBodyPart[part] ?? 0));
			  const totalProtection = constitutionModifier + totalArmor;

			  return {
				constitutionModifier,
				totalArmor,
				totalProtection,
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
            bodyPartSummaries.map((summary) => [summary.part, summary]),
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
      d="M86 88
         C92 78, 104 72, 120 72
         C136 72, 148 78, 154 88
         L152 118
         C144 125, 134 129, 120 129
         C106 129, 96 125, 88 118 Z"
      className={className}
      style={style}
    />
  ),
},
{
  key: "Addome",
  render: (className: string, style: React.CSSProperties) => (
    <path
      d="M88 118
         C96 126, 106 130, 120 130
         C134 130, 144 126, 152 118
         L158 154
         C148 163, 136 168, 120 168
         C104 168, 92 163, 82 154 Z"
      className={className}
      style={style}
    />
  ),
},
            {
              key: "Braccio SX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M72 112
                     C64 128, 61 145, 62 163
                     C63 176, 67 189, 74 201
                     L87 195
                     C82 181, 79 166, 79 151
                     C79 137, 82 123, 89 109 Z"
                  className={className}
                  style={style}
                />
              ),
            },
            {
              key: "Braccio DX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M168 112
                     C176 128, 179 145, 178 163
                     C177 176, 173 189, 166 201
                     L153 195
                     C158 181, 161 166, 161 151
                     C161 137, 158 123, 151 109 Z"
                  className={className}
                  style={style}
                />
              ),
            },
            {
              key: "Mano SX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M70 205
                     C63 207, 58 213, 58 219
                     C58 226, 64 231, 71 231
                     C77 231, 82 226, 82 220
                     C82 213, 77 207, 70 205 Z"
                  className={className}
                  style={style}
                />
              ),
            },
            {
              key: "Mano DX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M170 205
                     C177 207, 182 213, 182 219
                     C182 226, 176 231, 169 231
                     C163 231, 158 226, 158 220
                     C158 213, 163 207, 170 205 Z"
                  className={className}
                  style={style}
                />
              ),
            },
            {
              key: "Gamba SX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M105 160
                     C98 181, 94 200, 92 223
                     C91 242, 93 262, 98 285
                     L110 285
                     C112 263, 114 243, 117 223
                     C120 201, 123 180, 127 160 Z"
                  className={className}
                  style={style}
                />
              ),
            },
            {
              key: "Gamba DX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M135 160
                     C142 181, 146 200, 148 223
                     C149 242, 147 262, 142 285
                     L130 285
                     C128 263, 126 243, 123 223
                     C120 201, 117 180, 113 160 Z"
                  className={className}
                  style={style}
                />
              ),
            },
            {
              key: "Piede SX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M95 289
                     C88 289, 82 291, 77 295
                     L78 304
                     C87 307, 99 307, 109 304
                     L108 295
                     C104 291, 100 289, 95 289 Z"
                  className={className}
                  style={style}
                />
              ),
            },
            {
              key: "Piede DX",
              render: (className: string, style: React.CSSProperties) => (
                <path
                  d="M145 289
                     C150 289, 154 291, 158 295
                     L157 304
                     C147 307, 135 307, 126 304
                     L127 295
                     C132 291, 138 289, 145 289 Z"
                  className={className}
                  style={style}
                />
              ),
            },
          ] as const;

          return (
            <>
              <section className="space-y-3">
                {lbl("section.stati", "Stati", "font-display text-xl gold-text", "h3")}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    ["iniziativa", "Iniziativa"],
                    ["woundPenalty", "Penalità ferite"],
                    ["penalita", "Penalità aggiuntive"],
                    ["fatica", "Fatica"],
                  ] as const).map(([k, label]) => {
                    const autoIniziativa =
                      abilityModifier(value.abilities.des ?? 0) + abilityModifier(value.abilities.pro ?? 0);

                    const isInit = k === "iniziativa";
                    const isWoundPenalty = k === "woundPenalty";
                    const editableKey = k === "penalita" || k === "fatica" ? k : null;

                    return (
                      <div
                        key={k}
                        className="rounded border border-border/60 bg-parchment-deep/20 p-3 text-center"
                      >
                        {lbl(
                          `stat.${k}`,
                          label,
                          "font-heading text-xs uppercase tracking-wider text-ink-faded",
                          "label",
                        )}

                        {isInit ? (
                          <>
                            <div
                              className="font-display text-primary"
                              style={{ fontSize: "22px" }}
                              title="Calcolata automaticamente: Mod. DES + Mod. PRO"
                            >
                              {formatModifier(autoIniziativa)}
                            </div>
                            <div className="mt-1 font-script text-xs text-ink-faded">
                              Calcolata automaticamente da Mod. Destrezza + Mod. Prontezza
                            </div>
                          </>
                        ) : isWoundPenalty ? (
                          <>
                            <div className="font-display text-primary" style={{ fontSize: "22px" }}>
                              {formatModifier(woundPenalty)}
                            </div>
                            <div className="mt-1 font-script text-xs text-ink-faded">
                              Calcolata automaticamente dalle ferite inserite
                            </div>
                          </>
                        ) : canEdit && editableKey ? (
                          <Input
                            value={value[editableKey] ?? ""}
                            onChange={(e) => set(editableKey, e.target.value)}
                            className="h-9 border-0 bg-transparent px-0 text-center font-display focus-visible:ring-0"
                            style={{ fontSize: "18px" }}
                          />
                        ) : (
                          <div className="font-display" style={{ fontSize: "18px" }}>
                            {editableKey ? String(value[editableKey] ?? "") || "—" : "—"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

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

              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
                  <div className="rounded-[1.25rem] border border-border60 bg-parchment-deep20 p-4 h-full">
                    <p className="mb-3 text-center font-script text-xs italic text-ink-faded">
                      Locazioni interattive.
                    </p>

                    <div className="mx-auto flex max-w-[230px] justify-center">
                      <svg viewBox="0 0 220 320" className="h-auto w-full">
  <defs>
    <linearGradient id="bodyFillSoft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(249, 242, 223, 0.99)" />
      <stop offset="48%" stopColor="rgba(233, 220, 191, 0.96)" />
      <stop offset="100%" stopColor="rgba(202, 176, 132, 0.92)" />
    </linearGradient>

    <linearGradient id="bodyRimLight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
      <stop offset="45%" stopColor="rgba(255,248,235,0.16)" />
      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
    </linearGradient>

    <radialGradient id="bodyGlow" cx="50%" cy="18%" r="70%">
      <stop offset="0%" stopColor="rgba(255,248,233,0.38)" />
      <stop offset="100%" stopColor="rgba(255,248,233,0)" />
    </radialGradient>

    <filter id="bodyShadow" x="-24%" y="-20%" width="148%" height="148%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(75, 48, 22, 0.16)" />
    </filter>
  </defs>

  <g filter="url(#bodyShadow)">
    <g className="text-border/75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M110 16
           C123 17, 135 28, 139 44
           C142 58, 138 71, 128 81
           C142 87, 153 98, 159 113
           C164 126, 165 141, 163 156
           C160 160, 156 161, 151 160
           C147 145, 142 132, 134 121
           C131 132, 129 144, 129 156
           C130 181, 134 206, 137 236
           C139 260, 138 283, 134 306
           L122 306
           C121 286, 118 262, 113 228
           L107 228
           C102 262, 99 286, 98 306
           L86 306
           C82 283, 81 260, 83 236
           C86 206, 90 181, 91 156
           C91 144, 89 132, 86 121
           C78 132, 73 145, 69 160
           C64 161, 60 160, 57 156
           C55 141, 56 126, 61 113
           C67 98, 78 87, 92 81
           C82 71, 78 58, 81 44
           C85 28, 97 17, 110 16 Z"
        strokeWidth="2.35"
      />

      <path
        d="M97 77
           C101 72, 106 70, 110 70
           C114 70, 119 72, 123 77"
        strokeWidth="1.2"
        className="text-border/38"
      />
      <path
        d="M90 93
           C97 88, 103 86, 110 86
           C117 86, 123 88, 130 93"
        strokeWidth="1"
        className="text-border/28"
      />
      <path
        d="M95 113
           C100 108, 105 106, 110 106
           C115 106, 120 108, 125 113"
        strokeWidth="0.95"
        className="text-border/22"
      />
      <path
        d="M96 146
           C101 150, 119 150, 124 146"
        strokeWidth="1.05"
        className="text-border/34"
      />
      <path
        d="M101 182
           C103 178, 107 176, 110 176
           C113 176, 117 178, 119 182"
        strokeWidth="0.95"
        className="text-border/22"
      />
      <path
        d="M110 186
           C110 197, 110 210, 110 225"
        strokeWidth="0.85"
        className="text-border/18"
      />
      <path
        d="M98 242
           C97 252, 97 262, 98 272"
        strokeWidth="0.8"
        className="text-border/18"
      />
      <path
        d="M122 242
           C123 252, 123 262, 122 272"
        strokeWidth="0.8"
        className="text-border/18"
      />
      <path
        d="M88 120
           C83 130, 79 142, 77 154"
        strokeWidth="0.7"
        className="text-border/16"
      />
      <path
        d="M132 120
           C137 130, 141 142, 143 154"
        strokeWidth="0.7"
        className="text-border/16"
      />
    </g>

    <g opacity="0.85" pointerEvents="none">
      <ellipse cx="110" cy="70" rx="48" ry="70" fill="url(#bodyGlow)" />
    </g>

    <g fill="url(#bodyFillSoft)" stroke="currentColor" className="text-border/85" strokeLinecap="round" strokeLinejoin="round">
      {fantasyZones.map((zone) => {
        const summary = bodyPartSummaryMap[zone.key];
        const isActive = summary.isExpanded;

        const sharedStyle: React.CSSProperties = {
          strokeWidth: isActive ? 4.15 : summary.isWounded ? 2.45 : 1.85,
          opacity: isActive ? 1 : summary.isWounded ? 0.97 : 0.9,
          filter: isActive
            ? "drop-shadow(0 0 10px rgba(13,148,136,0.28)) drop-shadow(0 0 16px rgba(15,118,110,0.18))"
            : summary.isWounded
              ? "drop-shadow(0 0 4px rgba(120,82,38,0.12))"
              : undefined,
          transition: "all 180ms ease",
        };

        const zoneClassName = isActive
          ? "fill-teal-700/35 stroke-teal-800"
          : summary.isWounded
            ? `${summary.styles.zone} stroke-current`
            : "fill-background/35 stroke-border";

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
              <>
                <path
                  d="M110 22
                     C121 22, 130 31, 132 44
                     C134 57, 130 68, 122 74
                     C118 77, 114 79, 110 79
                     C106 79, 102 77, 98 74
                     C90 68, 86 57, 88 44
                     C90 31, 99 22, 110 22 Z"
                  className={zoneClassName}
                  style={sharedStyle}
                />
                <path
                  d="M99 31
                     C103 28, 107 27, 110 27
                     C113 27, 117 28, 121 31"
                  fill="none"
                  stroke="url(#bodyRimLight)"
                  strokeWidth="1.6"
                  opacity="0.55"
                  pointerEvents="none"
                />
              </>
            )}

            {zone.key === "Torace" && (
              <path
                d="M82 82
                   C88 73, 98 67, 110 67
                   C122 67, 132 73, 138 82
                   C140 90, 140 98, 139 108
                   C136 119, 128 126, 118 129
                   C115 130, 112 131, 110 131
                   C108 131, 105 130, 102 129
                   C92 126, 84 119, 81 108
                   C80 98, 80 90, 82 82 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Addome" && (
              <path
                d="M82 116
                   C89 126, 98 132, 110 132
                   C122 132, 131 126, 138 116
                   L144 157
                   C138 165, 131 171, 122 174
                   C118 176, 114 177, 110 177
                   C106 177, 102 176, 98 174
                   C89 171, 82 165, 76 157 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Braccio SX" && (
              <path
                d="M66 106
                   C59 118, 56 132, 57 148
                   C58 164, 63 178, 70 191
                   L81 185
                   C76 171, 73 157, 73 142
                   C73 129, 76 117, 82 105 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Braccio DX" && (
              <path
                d="M154 106
                   C161 118, 164 132, 163 148
                   C162 164, 157 178, 150 191
                   L139 185
                   C144 171, 147 157, 147 142
                   C147 129, 144 117, 138 105 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Mano SX" && (
              <path
                d="M61 193
                   C66 188, 74 188, 79 192
                   C83 196, 83 205, 78 210
                   C73 214, 65 214, 61 210
                   C56 205, 56 197, 61 193 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Mano DX" && (
              <path
                d="M141 192
                   C146 188, 154 188, 159 193
                   C164 197, 164 205, 159 210
                   C155 214, 147 214, 142 210
                   C137 205, 137 196, 141 192 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Gamba SX" && (
              <path
                d="M99 177
                   C94 193, 90 212, 88 233
                   C87 251, 88 267, 92 282
                   L103 282
                   C105 262, 107 241, 111 219
                   C114 202, 117 189, 120 177 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Gamba DX" && (
              <path
                d="M121 177
                   C126 193, 130 212, 132 233
                   C133 251, 132 267, 128 282
                   L117 282
                   C115 262, 113 241, 109 219
                   C106 202, 103 189, 100 177 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Piede SX" && (
              <path
                d="M89 286
                   C81 286, 75 289, 71 293
                   L72 300
                   C81 303, 94 303, 105 300
                   L104 293
                   C99 289, 94 286, 89 286 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            {zone.key === "Piede DX" && (
              <path
                d="M131 286
                   C136 286, 141 289, 146 293
                   L145 300
                   C134 303, 121 303, 112 300
                   L113 293
                   C117 289, 123 286, 131 286 Z"
                className={zoneClassName}
                style={sharedStyle}
              />
            )}

            <title>{zone.key}</title>
          </g>
        );
      })}
    </g>

    <g className="text-primary/15" fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M110 22 L110 305" strokeWidth="0.8" strokeDasharray="3 5" />
    </g>
  </g>
</svg>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-border60 bg-parchment-deep20 p-3 h-full flex flex-col">
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

                    <div className="flex-1 overflow-hidden rounded-lg border border-border40 bg-background/10 p-2">
                      <div className="grid h-full auto-rows-fr gap-2">
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
                                  {entry.locations}
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
                              <span className="ml-2 normal-case tracking-normal text-ink-faded">
                                - Soglia {threshold}
                              </span>
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.35fr)_minmax(110px,0.65fr)]">
              <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                  Protezione
                </div>

                <div
                  className="mt-1 font-display text-base leading-7 text-primary"
                  title={`Mod. Costituzione + Armatura = ${protection.constitutionModifier} + ${protection.totalArmor}`}
                >
                  {protection.totalProtection}
                </div>

                <div className="mt-1 text-[11px] font-script italic leading-tight text-ink-faded">
                  Mod. Costituzione ({protection.constitutionModifier}) + Protezione armatura ({protection.totalArmor})
                </div>
              </div>

              <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                  Ferite
                </div>

                {canEdit ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={damage > 0 ? String(-damage) : ""}
                    onChange={(e) => setFeritaValue(part, e.target.value)}
                    placeholder="-0"
                    className="mt-1 h-7 border-0 bg-transparent px-0 text-center font-display text-base text-primary focus-visible:ring-0"
                  />
                ) : (
                  <div className="mt-1 h-7 font-display text-base leading-7 text-primary">
                    {damage > 0 ? -damage : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 text-xs font-script italic text-ink-faded">
              Penalità della zona{" "}
              <strong className="font-heading text-ink">{formatModifier(penalty)}</strong>
              {" · "}
              Protezione totale{" "}
              <strong className="font-heading text-ink">{protection.totalProtection}</strong>
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

      <div className="grid gap-6 xl:grid-cols-2 items-start">
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
          <div key={w.id} className="rounded-lg border border-border60 bg-parchment-deep20 p-2.5">
            {canEdit ? (
              <>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1.7fr)_130px_130px_auto] md:items-center">
                  <Input value={w.name} onChange={(e) => updateWeapon(w.id, { name: e.target.value })} placeholder="Nome arma" className="font-script" />
                  <Input value={w.damage} onChange={(e) => updateWeapon(w.id, { damage: e.target.value })} placeholder="Danno" className="font-script text-center" />
                  <Input value={w.range} onChange={(e) => updateWeapon(w.id, { range: e.target.value })} placeholder="Gittata" className="font-script text-center" />
                  <button type="button" onClick={() => removeWeapon(w.id)} className={`${iconButtonClass} text-destructive hover:bg-destructive/10`} aria-label="Rimuovi arma">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2">
                  <Input value={w.notes} onChange={(e) => updateWeapon(w.id, { notes: e.target.value })} placeholder="Note" className="font-script" />
                </div>
              </>
            ) : (
              <div className="space-y-1.5 font-script">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="font-heading text-ink">{w.name?.trim() || "Arma senza nome"}</strong>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faded">
                    {w.damage?.trim() ? <span className="rounded-full border border-border60 bg-background40 px-2 py-1">Danno {w.damage}</span> : null}
                    {w.range?.trim() ? <span className="rounded-full border border-border60 bg-background40 px-2 py-1">Gittata {w.range}</span> : null}
                  </div>
                </div>
                {w.notes?.trim() ? <div className="text-sm text-ink-faded">{w.notes}</div> : null}
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
          <div key={a.id} className="rounded border border-border60 bg-parchment-deep20 p-3">
            {canEdit ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-3">
                  <Input value={a.name} onChange={(e) => updateArmor(a.id, { name: e.target.value })} placeholder="Nome armatura" className="font-script" />
                </div>
                <div className="lg:col-span-1">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={armorProtectionDrafts[a.id] ?? String(a.protection)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setArmorProtectionDrafts((prev) => ({ ...prev, [a.id]: raw }));
                      if (raw === "") return;
                      updateArmor(a.id, { protection: Math.max(0, Number(raw)) });
                    }}
                    onBlur={() => {
                      setArmorProtectionDrafts((prev) => {
                        const next = { ...prev };
                        delete next[a.id];
                        return next;
                      });
                    }}
                    placeholder="Protezione"
                    className="font-script"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-input bg-background px-3 py-2">
                  <div className="mb-2 font-heading text-xs uppercase tracking-wider text-ink-faded">Zone coperte</div>
                  <div className="grid grid-cols-2 gap-1 lg:grid-cols-5">
                    {BODY_PARTS.map((part) => {
                      const selected = (a.locations ?? []).includes(part);
                      return (
                        <label key={part} className="flex items-center gap-2 font-script text-sm">
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
                          />
                          <span>{part}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                  <Input value={a.notes} onChange={(e) => updateArmor(a.id, { notes: e.target.value })} placeholder="Note" className="font-script" />
                  <button type="button" onClick={() => removeArmor(a.id)} className={`${iconButtonClass} text-destructive hover:bg-destructive/10`} aria-label="Rimuovi armatura">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 font-script">
                <div>
                  <strong className="font-heading text-ink">{a.name}</strong>
                </div>
                <div className="text-sm text-ink-faded">
                  Protezione {a.protection} · Zone {(a.locations ?? []).join(", ")}
                </div>
                {a.notes ? <div className="text-sm text-ink-faded">{a.notes}</div> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </section>
</div>

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
            const draftGrade = magicDrafts[school];
            const inputGrade = draftGrade ?? String(grade);
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
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={inputGrade}
  onChange={(e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setMagic(school, raw);
  }}
  onBlur={() => {
    setMagicDrafts((prev) => {
      const next = { ...prev };
      delete next[school];
      return next;
    });
  }}
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