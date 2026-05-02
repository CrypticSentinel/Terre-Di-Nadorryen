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
  location: string;
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
    ? input.armors.map((a: any) => ({
        id: String(a?.id ?? crypto.randomUUID()),
        name: String(a?.name ?? ""),
        protection: Math.max(0, Number(a?.protection) || 0),
        location: String(a?.location ?? BODY_PARTS[0] ?? ""),
        notes: String(a?.notes ?? ""),
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
      BODY_PARTS.map((part) => [part, 0]),
    ) as Record<string, number>;

    for (const armor of value.armors ?? []) {
      const location = armor.location;
      if (!location || !(location in totals)) continue;
      totals[location] += Math.max(0, Number(armor.protection) || 0);
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
          location: BODY_PARTS[0],
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
    const woundedParts = BODY_PARTS.filter(
      (part) => Math.max(0, Number(value.ferite?.[part]?.wounds ?? 0)) > 0
    );

    const hitLocations = {
      Alta: [
        { location: "Testa", roll: "1 - 6", key: "Testa" },
        { location: "Collo", roll: "7 - 10", key: "Collo" },
        { location: "Spalla SX", roll: "12 - 25", key: "Spalla SX" },
        { location: "Spalla DX", roll: "26 - 40", key: "Spalla DX" },
        { location: "Braccio SX", roll: "41 - 50", key: "Braccio SX" },
        { location: "Braccio DX", roll: "51 - 60", key: "Braccio DX" },
        { location: "Mano SX", roll: "61 - 65", key: "Mano SX" },
        { location: "Mano DX", roll: "66 - 70", key: "Mano DX" },
        { location: "Torace", roll: "72 - 100", key: "Torace" },
      ],
      Bassa: [
        { location: "Piede SX", roll: "1 - 6", key: "Piede SX" },
        { location: "Piede DX", roll: "7 - 10", key: "Piede DX" },
        { location: "Gamba SX", roll: "12 - 25", key: "Gamba SX" },
        { location: "Gamba DX", roll: "26 - 40", key: "Gamba DX" },
        { location: "Stinco SX", roll: "41 - 50", key: "Stinco SX" },
        { location: "Stinco DX", roll: "51 - 60", key: "Stinco DX" },
        { location: "Ginocchio SX", roll: "61 - 65", key: "Ginocchio SX" },
        { location: "Ginocchio DX", roll: "66 - 70", key: "Ginocchio DX" },
        { location: "Addome", roll: "72 - 100", key: "Addome" },
      ],
    } as const;

    const getSeverityStyles = (severity: WoundSeverity) => {
      if (severity === "light") {
        return {
          badge: "border-amber-600/30 bg-amber-500/10 text-amber-700",
          zone: "fill-amber-500/25 stroke-amber-700",
          row: "border-amber-600/20 bg-amber-500/5",
        };
      }

      if (severity === "grave") {
        return {
          badge: "border-destructive/30 bg-destructive/10 text-destructive",
          zone: "fill-destructive/22 stroke-destructive",
          row: "border-destructive/25 bg-destructive/5",
        };
      }

      if (severity === "lethal") {
        return {
          badge: "border-destructive/40 bg-destructive/15 text-destructive",
          zone: "fill-destructive/38 stroke-destructive",
          row: "border-destructive/35 bg-destructive/10",
        };
      }

      return {
        badge: "border-border60 bg-background/40 text-ink-faded",
        zone: "fill-muted/15 stroke-border",
        row: "border-border40 bg-background/20",
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

    const bodyZoneMap = [
      {
        key: "Testa",
        label: "Testa",
        render: (className: string, style: React.CSSProperties) => (
          <ellipse cx="110" cy="42" rx="24" ry="28" className={className} style={style} />
        ),
      },
      {
        key: "Collo",
        label: "Collo",
        render: (className: string, style: React.CSSProperties) => (
          <rect x="102" y="68" width="16" height="16" rx="6" className={className} style={style} />
        ),
      },
      {
        key: "Torace",
        label: "Torace",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M78 88 C84 76, 96 72, 110 72 C124 72, 136 76, 142 88 L146 132 C136 144, 124 150, 110 150 C96 150, 84 144, 74 132 Z"
            className={className}
            style={style}
          />
        ),
      },
      {
        key: "Addome",
        label: "Addome",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M82 150 C90 144, 100 142, 110 142 C120 142, 130 144, 138 150 L132 192 C124 198, 118 202, 110 202 C102 202, 96 198, 88 192 Z"
            className={className}
            style={style}
          />
        ),
      },
      {
        key: "Spalla SX",
        label: "Spalla SX",
        render: (className: string, style: React.CSSProperties) => (
          <ellipse cx="63" cy="96" rx="15" ry="18" className={className} style={style} />
        ),
      },
      {
        key: "Spalla DX",
        label: "Spalla DX",
        render: (className: string, style: React.CSSProperties) => (
          <ellipse cx="157" cy="96" rx="15" ry="18" className={className} style={style} />
        ),
      },
      {
        key: "Braccio SX",
        label: "Braccio SX",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M44 112 C40 124, 38 138, 40 154 C42 166, 46 176, 52 184 L66 178 C60 164, 58 150, 58 136 C58 126, 60 116, 64 106 Z"
            className={className}
            style={style}
          />
        ),
      },
      {
        key: "Braccio DX",
        label: "Braccio DX",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M176 112 C180 124, 182 138, 180 154 C178 166, 174 176, 168 184 L154 178 C160 164, 162 150, 162 136 C162 126, 160 116, 156 106 Z"
            className={className}
            style={style}
          />
        ),
      },
      {
        key: "Mano SX",
        label: "Mano SX",
        render: (className: string, style: React.CSSProperties) => (
          <ellipse cx="52" cy="196" rx="12" ry="10" className={className} style={style} />
        ),
      },
      {
        key: "Mano DX",
        label: "Mano DX",
        render: (className: string, style: React.CSSProperties) => (
          <ellipse cx="168" cy="196" rx="12" ry="10" className={className} style={style} />
        ),
      },
      {
        key: "Gamba SX",
        label: "Gamba SX",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M98 202 C92 216, 88 228, 86 244 C85 254, 86 266, 88 278 L100 278 C102 266, 104 254, 106 242 C108 230, 110 216, 112 202 Z"
            className={className}
            style={style}
          />
        ),
      },
      {
        key: "Gamba DX",
        label: "Gamba DX",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M122 202 C128 216, 132 228, 134 244 C135 254, 134 266, 132 278 L120 278 C118 266, 116 254, 114 242 C112 230, 110 216, 108 202 Z"
            className={className}
            style={style}
          />
        ),
      },
      {
        key: "Stinco SX",
        label: "Stinco SX",
        render: (className: string, style: React.CSSProperties) => (
          <rect x="88" y="238" width="18" height="44" rx="8" className={className} style={style} />
        ),
      },
      {
        key: "Stinco DX",
        label: "Stinco DX",
        render: (className: string, style: React.CSSProperties) => (
          <rect x="114" y="238" width="18" height="44" rx="8" className={className} style={style} />
        ),
      },
      {
        key: "Ginocchio SX",
        label: "Ginocchio SX",
        render: (className: string, style: React.CSSProperties) => (
          <circle cx="97" cy="236" r="9" className={className} style={style} />
        ),
      },
      {
        key: "Ginocchio DX",
        label: "Ginocchio DX",
        render: (className: string, style: React.CSSProperties) => (
          <circle cx="123" cy="236" r="9" className={className} style={style} />
        ),
      },
      {
        key: "Piede SX",
        label: "Piede SX",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M82 282 C90 280, 100 280, 108 284 L106 294 C98 296, 88 296, 80 292 Z"
            className={className}
            style={style}
          />
        ),
      },
      {
        key: "Piede DX",
        label: "Piede DX",
        render: (className: string, style: React.CSSProperties) => (
          <path
            d="M112 284 C120 280, 130 280, 138 282 L140 292 C132 296, 122 296, 114 294 Z"
            className={className}
            style={style}
          />
        ),
      },
    ] as const;

    return (
      <>
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
                <svg viewBox="0 0 220 310" className="h-auto w-full">
                  <path
                    d="M110 12 C132 14, 146 28, 148 46 C150 64, 142 76, 136 84 C148 88, 158 96, 164 108 C176 132, 182 158, 180 188 C176 188, 172 188, 168 188 C162 164, 156 142, 146 124 L140 146 C138 162, 136 180, 136 198 C142 226, 146 254, 144 292 L130 292 C130 268, 126 242, 120 214 L114 214 C108 242, 104 268, 104 292 L90 292 C88 254, 92 226, 98 198 C98 180, 96 162, 94 146 L88 124 C78 142, 72 164, 66 188 C62 188, 58 188, 54 188 C52 158, 58 132, 70 108 C76 96, 86 88, 98 84 C92 76, 84 64, 86 46 C88 28, 102 14, 110 12 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className="text-border/70"
                  />

                  {bodyZoneMap.map((zone) => {
                    const damage = getPartDamage(zone.key);
                    const threshold = getPartThreshold(zone.key);
                    const severity = getWoundSeverity(damage, threshold);
                    const styles = getSeverityStyles(severity);
                    const isActive = expandedBodyPart === zone.key;

                    return (
                      <g
                        key={zone.key}
                        onClick={() =>
                          setExpandedBodyPart((prev) => (prev === zone.key ? null : zone.key))
                        }
                        className="cursor-pointer"
                      >
                        {zone.render(
                          `${styles.zone} transition-all`,
                          {
                            strokeWidth: isActive ? 3 : 2,
                            opacity: isActive ? 1 : damage > 0 ? 0.95 : 0.58,
                            filter: isActive ? "drop-shadow(0 0 8px rgba(120, 82, 38, 0.25))" : undefined,
                          }
                        )}
                        <title>{zone.label}</title>
                      </g>
                    );
                  })}
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
                    <tr>
                      <th className="px-3 py-2 font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                        Locazione
                      </th>
                      <th className="px-3 py-2 font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                        Dado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hitLocations[selectedHitZone].map((row) => {
                      const linked = expandedBodyPart === row.key;

                      return (
                        <tr
                          key={`${selectedHitZone}-${row.location}`}
                          className={`border-t border-border40 transition-colors ${
                            linked ? "bg-primary/10" : "bg-transparent"
                          }`}
                        >
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setExpandedBodyPart(row.key)}
                              className="font-script text-sm text-ink hover:text-primary"
                            >
                              {row.location}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-display text-sm text-primary">
                            {row.roll}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {BODY_PARTS.map((p) => {
              const damage = getPartDamage(p);
              const naturalThreshold = getPartThreshold(p);
              const severity = getWoundSeverity(damage, naturalThreshold);
              const severityLabel = getSeverityLabel(severity);
              const localPenalty = getPenaltyFromSeverity(severity);
              const styles = getSeverityStyles(severity);
              const { totalProtection, totalNaturalArmor, totalArmor } = getPartProtection(p);
              const isExpanded = expandedBodyPart === p;
              const isWounded = damage > 0;

              return (
                <div
                  key={p}
                  className={`rounded-xl border transition-all ${
                    isExpanded
                      ? `${styles.row} shadow-sm`
                      : isWounded
                        ? "border-border60 bg-parchment-deep20"
                        : "border-border30 bg-background/15 opacity-80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBodyPart((prev) => (prev === p ? null : p))
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <div className="font-heading text-[13px] uppercase tracking-[0.14em] text-ink">
                        {p}
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
                      <div className="grid gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                          <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                            Ferite
                          </div>

                          {canEdit ? (
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={damage > 0 ? -damage : ""}
                              onChange={(e) => setFeritaValue(p, e.target.value)}
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
                            {naturalThreshold}
                          </div>
                        </div>

                        <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                          <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                            Naturale
                          </div>
                          <div className="mt-1 h-7 font-display text-base leading-7 text-primary">
                            {totalNaturalArmor}
                          </div>
                        </div>

                        <div className="rounded-lg border border-border40 bg-background/35 p-2 text-center">
                          <div className="font-heading text-[10px] uppercase tracking-wider text-ink-faded">
                            Armatura
                          </div>
                          <div
                            className="mt-1 h-7 font-display text-base leading-7 text-primary"
                            title={`Protezione totale ${totalProtection}`}
                          >
                            {totalArmor}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs font-script italic text-ink-faded">
                        Penalità della zona:{" "}
                        <strong className="font-heading text-ink">
                          {formatModifier(localPenalty)}
                        </strong>
                        {" · "}
                        Protezione totale:{" "}
                        <strong className="font-heading text-ink">
                          {totalProtection}
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
        {lbl("section.equip", "Equipaggiamento", "font-display text-xl gold-text", "h3")}
        <div className="grid gap-3 sm:grid-cols-2">
          {EQUIPMENT_SECTIONS.map((sec) => {
            const items = sortEquipmentAlphabetically(value.equipment[sec.key] ?? []);

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
                    <button
                      type="button"
                      onClick={() => addEquipItem(sec.key)}
                      className={`${iconButtonClass} text-primary hover:bg-primary/10`}
                      aria-label={`Aggiungi item a ${sec.label}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {items.length === 0 && !canEdit && (
                  <p className="text-xs font-script italic text-ink-faded">—</p>
                )}

                {items.map((it) => (
                  <div key={it.id} className="group flex items-center gap-1">
                    {canEdit ? (
                      <>
                        <Input
                          value={it.text}
                          onChange={(e) => setEquipItem(sec.key, it.id, e.target.value)}
                          className="h-9 flex-1 border-0 bg-transparent px-0 font-script focus-visible:ring-0"
                        />
                        <button
                          type="button"
                          onClick={() => removeEquipItem(sec.key, it.id)}
                          className={`${iconButtonClass} text-destructive opacity-90 hover:bg-destructive/10`}
                          aria-label={`Rimuovi item da ${sec.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <span className="font-script">• {it.text}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          {lbl("section.weapons", "Armi", "font-display text-xl gold-text", "h3")}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addWeapon} className="font-heading">
              <Plus className="mr-1 h-4 w-4" /> Aggiungi
            </Button>
          )}
        </div>

        {!value.weapons || value.weapons.length === 0 ? (
          <p className="text-sm font-script italic text-ink-faded">Nessuna arma inserita.</p>
        ) : (
          <div className="space-y-2">
            {value.weapons.map((w) => (
              <div key={w.id} className="rounded border border-border/60 bg-parchment-deep/20 p-3">
                {canEdit ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      value={w.name}
                      onChange={(e) => updateWeapon(w.id, { name: e.target.value })}
                      placeholder="Nome arma"
                      className="font-script"
                    />
                    <Input
                      value={w.damage}
                      onChange={(e) => updateWeapon(w.id, { damage: e.target.value })}
                      placeholder="Danno es. 1d6+2"
                      className="font-script"
                    />
                    <Input
                      value={w.range}
                      onChange={(e) => updateWeapon(w.id, { range: e.target.value })}
                      placeholder="Gittata / tipo"
                      className="font-script"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={w.notes}
                        onChange={(e) => updateWeapon(w.id, { notes: e.target.value })}
                        placeholder="Note"
                        className="font-script"
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
                  </div>
                ) : (
                  <div className="space-y-1 font-script">
                    <div>
                      <strong className="font-heading text-ink">{w.name || "—"}</strong>
                    </div>
                    <div className="text-sm text-ink-faded">
                      Danno: {w.damage || "—"} · Gittata: {w.range || "—"}
                    </div>
                    {w.notes && <div className="text-sm text-ink-faded">{w.notes}</div>}
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
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addArmor} className="font-heading">
              <Plus className="mr-1 h-4 w-4" /> Aggiungi
            </Button>
          )}
        </div>

        {!value.armors || value.armors.length === 0 ? (
          <p className="text-sm font-script italic text-ink-faded">Nessuna armatura inserita.</p>
        ) : (
          <div className="space-y-2">
            {value.armors.map((a) => (
              <div key={a.id} className="rounded border border-border/60 bg-parchment-deep/20 p-3">
                {canEdit ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                      placeholder="Protezione"
                      className="font-script"
                    />
                    <select
                      value={a.location}
                      onChange={(e) => updateArmor(a.id, { location: e.target.value })}
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 font-script text-sm"
                    >
                      {BODY_PARTS.map((part) => (
                        <option key={part} value={part}>
                          {part}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Input
                        value={a.notes}
                        onChange={(e) => updateArmor(a.id, { notes: e.target.value })}
                        placeholder="Note"
                        className="font-script"
                      />
                      <button
                        type="button"
                        onClick={() => removeArmor(a.id)}
                        className={`${iconButtonClass} text-destructive hover:bg-destructive/10`}
                        aria-label="Rimuovi armatura"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 font-script">
                    <div>
                      <strong className="font-heading text-ink">{a.name || "—"}</strong>
                    </div>
                    <div className="text-sm text-ink-faded">
                      Protezione: {a.protection} · Zona: {a.location || "—"}
                    </div>
                    {a.notes && <div className="text-sm text-ink-faded">{a.notes}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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