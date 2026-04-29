import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, ArrowRight, Dices, Plus, Trash2, Check } from "lucide-react";
import {
  EMPTY_OSGDR_SHEET,
  type OsgdrSheet,
  type OsgdrSkill,
} from "@/components/OpenSourceGdrSheet";
import { abilityModifier, formatModifier } from "@/lib/rulesets";
import { toast } from "sonner";

const ABILITIES = [
  { key: "for", label: "Forza" },
  { key: "des", label: "Destrezza" },
  { key: "cos", label: "Costituzione" },
  { key: "vol", label: "Volontà" },
  { key: "pro", label: "Prontezza" },
  { key: "emp", label: "Empatia" },
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

export interface WizardResult {
  name: string;
  concept: string;
  sheet: OsgdrSheet;
}

interface Props {
  open: boolean;
  onCancel: () => void;
  onComplete: (result: WizardResult) => void | Promise<void>;
  submitting?: boolean;
}

type WizardStep =
  | "anagrafica"
  | "caratteristiche"
  | "usa-magia"
  | "magia"
  | "abilita"
  | "soldi"
  | "punti-fortuna";

const TOTAL_POOL = 48;
const ABILITY_MIN = 1;
const ABILITY_MAX = 20;
const MAGIC_POINT_TOTAL = 15;
const MAGIC_POINT_MIN = 0;
const MAGIC_POINT_MAX = 3;
const SKILL_POINT_MIN = 1;
const SKILL_POINT_MAX = 3;

const getInitialBaseAbilities = () => ({
  for: 8,
  des: 8,
  cos: 8,
  vol: 8,
  pro: 8,
  emp: 8,
});

const getInitialMagic = () => Object.fromEntries(MAGIC_SCHOOLS.map((s) => [s, 0]));
const getInitialCoins = () => ({ oro: 0, argento: 0, rame: 0 });

export const OsgdrCharacterWizard = ({ open, onCancel, onComplete, submitting }: Props) => {
  const [stepIndex, setStepIndex] = useState(0);

  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");

  const [baseAbilities, setBaseAbilities] = useState<Record<string, number>>(getInitialBaseAbilities());
  const [d6Choice, setD6Choice] = useState<string | null>(null);
  const [d6Roll, setD6Roll] = useState<number | null>(null);
  const [d4Assignments, setD4Assignments] = useState<Record<string, number>>({});
  const [currentD4Roll, setCurrentD4Roll] = useState<number | null>(null);
  const [d6Rerolled, setD6Rerolled] = useState(false);
  const [d4RerollUsed, setD4RerollUsed] = useState(false);
  const [selectedD4RerollTarget, setSelectedD4RerollTarget] = useState<string | null>(null);

  const [isMagicUser, setIsMagicUser] = useState<boolean | null>(null);

  const [magic, setMagic] = useState<Record<string, number>>(getInitialMagic());

  const [skills, setSkills] = useState<OsgdrSkill[]>([]);
  const [coins, setCoins] = useState<Record<string, number>>(getInitialCoins());
  const [fortuna, setFortuna] = useState<string>("");

  const visibleSteps = useMemo(() => {
    const steps: WizardStep[] = ["anagrafica", "caratteristiche", "usa-magia"];
    if (isMagicUser !== false) steps.push("magia");
    steps.push("abilita", "soldi", "punti-fortuna");
    return steps;
  }, [isMagicUser]);

  const currentStep = visibleSteps[stepIndex] ?? visibleSteps[0];

  const stepLabelMap: Record<WizardStep, string> = {
    anagrafica: "Anagrafica",
    caratteristiche: "Caratteristiche",
    "usa-magia": "Magia",
    magia: "Scuole di magia",
    abilita: "Abilità",
    soldi: "Soldi",
    "punti-fortuna": "Punti Fortuna",
  };

  const totalBaseSum = useMemo(
    () => ABILITIES.reduce((acc, a) => acc + (Number(baseAbilities[a.key]) || 0), 0),
    [baseAbilities],
  );
  const remainingPoints = TOTAL_POOL - totalBaseSum;
  const distributionDone = remainingPoints === 0;

  const remainingD4Targets = useMemo(
    () => ABILITIES.map((a) => a.key).filter((key) => key !== d6Choice && !(key in d4Assignments)),
    [d6Choice, d4Assignments],
  );

  const allD4Assigned = d6Choice !== null && remainingD4Targets.length === 0;
  const bonusesAssigned = d6Choice !== null && d6Roll !== null && allD4Assigned && currentD4Roll === null;

  const magicPointsAssigned = useMemo(
    () => MAGIC_SCHOOLS.reduce((acc, school) => acc + (Number(magic[school]) || 0), 0),
    [magic],
  );
  const remainingMagicPoints = MAGIC_POINT_TOTAL - magicPointsAssigned;

  const skillPointTotal = isMagicUser === false ? 45 : 30;

  const finalAbilities = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of ABILITIES) {
      const base = Number(baseAbilities[a.key]) || 0;
      const d6Bonus = a.key === d6Choice ? d6Roll ?? 0 : 0;
      const d4Bonus = d4Assignments[a.key] ?? 0;
      out[a.key] = base + d6Bonus + d4Bonus;
    }
    return out;
  }, [baseAbilities, d6Choice, d6Roll, d4Assignments]);

  const totalSkillPointsAssigned = useMemo(
    () => skills.reduce((acc, s) => acc + (Number(s.grade) || 0), 0),
    [skills],
  );
  const remainingSkillPoints = skillPointTotal - totalSkillPointsAssigned;

  const resetWizardState = () => {
    setStepIndex(0);
    setName("");
    setConcept("");
    setBaseAbilities(getInitialBaseAbilities());
    setD6Choice(null);
    setD6Roll(null);
    setD4Assignments({});
    setCurrentD4Roll(null);
    setD6Rerolled(false);
    setD4RerollUsed(false);
    setSelectedD4RerollTarget(null);
    setIsMagicUser(null);
    setMagic(getInitialMagic());
    setSkills([]);
    setCoins(getInitialCoins());
    setFortuna("");
  };

  const handleCancel = () => {
    resetWizardState();
    onCancel();
  };

  const setBaseAbility = (key: string, raw: string) => {
    const n = Math.max(ABILITY_MIN, Math.min(ABILITY_MAX, Number(raw) || 0));
    const next = { ...baseAbilities, [key]: n };
    const sum = ABILITIES.reduce((acc, a) => acc + (Number(next[a.key]) || 0), 0);
    if (sum > TOTAL_POOL) {
      toast.error(`Il totale non può superare ${TOTAL_POOL} punti.`);
      return;
    }
    setBaseAbilities(next);
    setD6Choice(null);
    setD6Roll(null);
    setD4Assignments({});
    setCurrentD4Roll(null);
    setD6Rerolled(false);
    setD4RerollUsed(false);
    setSelectedD4RerollTarget(null);
  };

  const selectD6Choice = (key: string) => {
    if (d6Roll !== null) return;
    setD6Choice(key);
  };

  const rollD6Bonus = () => {
    if (!d6Choice) {
      toast.error("Scegli prima la caratteristica che riceverà 1d6.");
      return;
    }
    if (!distributionDone) {
      toast.error("Distribuisci tutti i 48 punti prima di tirare il d6.");
      return;
    }
    setD6Roll(1 + Math.floor(Math.random() * 6));
    setD4Assignments({});
    setCurrentD4Roll(null);
    setD6Rerolled(false);
    setD4RerollUsed(false);
    setSelectedD4RerollTarget(null);
  };

  const rerollD6 = () => {
    if (!d6Choice || d6Roll === null) return;
    if (d6Rerolled) {
      toast.error("Hai già ritirato il d6.");
      return;
    }
    setD6Roll(1 + Math.floor(Math.random() * 6));
    setD6Rerolled(true);
  };

  const rollNextD4 = () => {
    if (!d6Choice || d6Roll === null) {
      toast.error("Completa prima la scelta e il tiro del d6.");
      return;
    }
    if (currentD4Roll !== null) {
      toast.error("Assegna prima il d4 corrente a una caratteristica residua.");
      return;
    }
    if (remainingD4Targets.length === 0) {
      toast.error("Tutte le caratteristiche residue hanno già ricevuto il loro d4.");
      return;
    }
    setCurrentD4Roll(1 + Math.floor(Math.random() * 4));
  };

  const rerollAssignedD4 = () => {
    if (!selectedD4RerollTarget) {
      toast.error("Scegli prima quale d4 assegnato vuoi ritirare.");
      return;
    }
    if (!(selectedD4RerollTarget in d4Assignments)) {
      toast.error("La caratteristica selezionata non ha un d4 assegnato.");
      return;
    }
    if (d4RerollUsed) {
      toast.error("Puoi ritirare un solo d4.");
      return;
    }
    setD4Assignments((prev) => ({
      ...prev,
      [selectedD4RerollTarget]: 1 + Math.floor(Math.random() * 4),
    }));
    setD4RerollUsed(true);
  };

  const assignCurrentD4ToAbility = (key: string) => {
    if (currentD4Roll === null) {
      toast.error("Tira prima un d4.");
      return;
    }
    if (key === d6Choice) {
      toast.error("La caratteristica scelta per il d6 non può ricevere un d4.");
      return;
    }
    if (key in d4Assignments) {
      toast.error("Questa caratteristica ha già ricevuto un d4.");
      return;
    }
    setD4Assignments((prev) => ({ ...prev, [key]: currentD4Roll }));
    setCurrentD4Roll(null);
    setSelectedD4RerollTarget(null);
  };

  const setMagicScore = (school: string, raw: string) => {
    const n = Math.max(MAGIC_POINT_MIN, Math.min(MAGIC_POINT_MAX, Number(raw) || 0));
    const next = { ...magic, [school]: n };
    const total = MAGIC_SCHOOLS.reduce((acc, s) => acc + (Number(next[s]) || 0), 0);
    if (total > MAGIC_POINT_TOTAL) {
      toast.error(`Non puoi superare ${MAGIC_POINT_TOTAL} punti magia totali.`);
      return;
    }
    setMagic(next);
  };

  const setCoin = (key: string, raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    setCoins({ ...coins, [key]: n });
  };

  const addSkill = () => {
    if (remainingSkillPoints < SKILL_POINT_MIN) {
      toast.error(`Ti serve almeno ${SKILL_POINT_MIN} punto disponibile per aggiungere una nuova abilità.`);
      return;
    }
    setSkills([...skills, { id: crypto.randomUUID(), name: "Nuova abilità", grade: SKILL_POINT_MIN }]);
  };

  const updateSkill = (id: string, patch: Partial<OsgdrSkill>) => {
    const nextSkills = skills.map((s) => {
      if (s.id !== id) return s;
      const nextGrade = patch.grade !== undefined
        ? Math.max(SKILL_POINT_MIN, Math.min(SKILL_POINT_MAX, Number(patch.grade) || SKILL_POINT_MIN))
        : s.grade;
      return { ...s, ...patch, grade: nextGrade };
    });

    const total = nextSkills.reduce((acc, s) => acc + (Number(s.grade) || 0), 0);
    if (total > skillPointTotal) {
      toast.error(`Non puoi superare ${skillPointTotal} punti abilità totali.`);
      return;
    }

    setSkills(nextSkills);
  };

  const removeSkill = (id: string) => setSkills(skills.filter((s) => s.id !== id));

  const canGoNext = (() => {
    switch (currentStep) {
      case "anagrafica":
        return name.trim().length > 0;
      case "caratteristiche":
        return (
          distributionDone &&
          d6Choice !== null &&
          d6Roll !== null &&
          allD4Assigned &&
          currentD4Roll === null
        );
      case "usa-magia":
        return isMagicUser !== null;
      case "magia":
        return remainingMagicPoints === 0;
      case "abilita":
        return remainingSkillPoints === 0;
      default:
        return true;
    }
  })();

  const handleNext = () => {
    if (!canGoNext) {
      if (currentStep === "anagrafica") toast.error("Inserisci un nome per il personaggio.");
      else if (currentStep === "caratteristiche" && !distributionDone)
        toast.error(`Distribuisci tutti i 48 punti (rimanenti: ${remainingPoints}).`);
      else if (currentStep === "caratteristiche" && !d6Choice)
        toast.error("Scegli la caratteristica che riceverà 1d6.");
      else if (currentStep === "caratteristiche" && d6Roll === null)
        toast.error("Tira il d6 prima di proseguire.");
      else if (currentStep === "caratteristiche" && currentD4Roll !== null)
        toast.error("Assegna il d4 corrente prima di proseguire.");
      else if (currentStep === "caratteristiche" && !allD4Assigned)
        toast.error("Assegna un d4 a tutte le caratteristiche residue prima di proseguire.");
      else if (currentStep === "usa-magia")
        toast.error("Indica se il personaggio è un utilizzatore di magia.");
      else if (currentStep === "magia")
        toast.error(`Distribuisci tutti i ${MAGIC_POINT_TOTAL} punti magia disponibili.`);
      else if (currentStep === "abilita")
        toast.error(`Distribuisci tutti i ${skillPointTotal} punti abilità disponibili.`);
      return;
    }
    setStepIndex((s) => Math.min(visibleSteps.length - 1, s + 1));
  };

  const handleBack = () => setStepIndex((s) => Math.max(0, s - 1));

  const handleFinish = async () => {
    const sheet: OsgdrSheet = {
      ...EMPTY_OSGDR_SHEET,
      ferite: { ...EMPTY_OSGDR_SHEET.ferite },
      equipment: { ...EMPTY_OSGDR_SHEET.equipment },
      abilities: {
        for: finalAbilities.for, des: finalAbilities.des, cos: finalAbilities.cos,
        vol: finalAbilities.vol, pro: finalAbilities.pro, emp: finalAbilities.emp,
      } as any,
      magic: { ...magic } as any,
      coins: { ...coins } as any,
      fortuna: fortuna.trim(),
      skills,
    };
    await onComplete({ name: name.trim(), concept: concept.trim(), sheet });
    resetWizardState();
  };

  if (!open) return null;

  const progress = ((stepIndex + 1) / visibleSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-elegant max-w-3xl w-full my-8 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl gold-text">Forgia un nuovo eroe</h2>
            <span className="text-xs font-heading uppercase tracking-wider text-ink-faded">
              Step {stepIndex + 1} / {visibleSteps.length} · {stepLabelMap[currentStep]}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
          {currentStep === "anagrafica" && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Comincia con il nome del tuo personaggio e una breve descrizione.
              </p>
              <div>
                <Label className="font-heading">Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <Label className="font-heading">Breve descrizione</Label>
                <Textarea
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  rows={3}
                  placeholder="Es. Ladro elfico in cerca di redenzione"
                />
              </div>
            </div>
          )}

          {currentStep === "caratteristiche" && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Distribuisci liberamente <strong>{TOTAL_POOL} punti</strong> tra le sei caratteristiche
                (minimo <strong>{ABILITY_MIN}</strong>, massimo <strong>{ABILITY_MAX}</strong> ciascuna).
              </p>

              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <span className="font-heading text-sm">
                  Distribuiti: <strong>{totalBaseSum}</strong> / {TOTAL_POOL}
                </span>
                <span
                  className={`font-heading text-sm ${
                    remainingPoints === 0
                      ? "text-primary"
                      : remainingPoints < 0
                      ? "text-destructive"
                      : "text-ink-faded"
                  }`}
                >
                  Rimanenti: {remainingPoints}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ABILITIES.map((a) => {
                  const base = baseAbilities[a.key] ?? 1;
                  const d6Bonus = d6Choice === a.key ? d6Roll ?? 0 : 0;
                  const d4Bonus = d4Assignments[a.key] ?? 0;
                  const bonus = d6Bonus + d4Bonus;
                  const total = base + bonus;
                  const isD6 = d6Choice === a.key;
                  const mod = abilityModifier(total);

                  return (
                    <div
                      key={a.key}
                      className={`bg-parchment-deep/20 border rounded-lg p-3 text-center transition ${
                        isD6 ? "border-primary ring-1 ring-primary/40" : "border-border/60"
                      }`}
                    >
                      <div className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                        {a.label}
                      </div>
                      <Input
                        type="number"
                        min={ABILITY_MIN}
                        max={ABILITY_MAX}
                        value={base}
                        onChange={(e) => setBaseAbility(a.key, e.target.value)}
                        className="bg-transparent border-0 text-center font-display h-10 px-0 focus-visible:ring-0"
                        style={{ fontSize: "20px" }}
                      />

                      <div className="font-heading text-xs text-ink-faded">
                        {isD6
                          ? `Bonus +${d6Bonus} d6`
                          : d4Bonus > 0
                          ? `Bonus +${d4Bonus} d4`
                          : "Bonus +0"}
                      </div>

                      <div className="font-display text-lg">
                        = <span className="text-primary">{total}</span>
                      </div>
                      <div className="font-script text-primary text-sm">
                        {formatModifier(mod)}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={isD6 ? "default" : "outline"}
                        className="mt-2 h-7 text-xs font-heading w-full"
                        onClick={() => selectD6Choice(a.key)}
                        disabled={d6Roll !== null && !isD6}
                      >
                        {isD6 ? "★ Riceve 1d6" : "Scegli 1d6"}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4 pt-2 border-t border-border/40">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    onClick={rollD6Bonus}
                    variant="outline"
                    className="font-heading"
                    disabled={!distributionDone || !d6Choice || d6Roll !== null}
                    type="button"
                  >
                    <Dices className="h-4 w-4 mr-2" />
                    {d6Roll === null ? "Tira 1d6" : `d6: ${d6Roll}`}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="font-heading"
                    onClick={rerollD6}
                    disabled={d6Roll === null || d6Rerolled}
                  >
                    <Dices className="h-4 w-4 mr-2" />
                    {d6Rerolled ? "d6 ritirato" : "Ritira d6"}
                  </Button>

                  <span className="font-script italic text-xs text-ink-faded">
                    {!distributionDone
                      ? "Completa la distribuzione dei 48 punti."
                      : !d6Choice
                      ? "Scegli quale caratteristica riceverà 1d6."
                      : d6Roll === null
                      ? "Tira il d6 della caratteristica scelta. Dopo il tiro la scelta sarà bloccata."
                      : "Procedi con i d4 sulle caratteristiche residue."}
                  </span>
                </div>

                {d6Roll !== null && (
                  <div className="space-y-3 rounded-lg border border-border/60 bg-parchment-deep/20 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-heading text-sm">Bonus 1d4 residui</p>
                        <p className="font-script italic text-xs text-ink-faded">
                          Tira un d4 e assegnalo manualmente a una caratteristica residua non ancora selezionata.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={rollNextD4}
                          disabled={currentD4Roll !== null || remainingD4Targets.length === 0}
                          className="font-heading"
                        >
                          <Dices className="h-4 w-4 mr-2" />
                          Tira 1d4
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={rerollAssignedD4}
                          disabled={Object.keys(d4Assignments).length === 0 || d4RerollUsed || currentD4Roll !== null}
                          className="font-heading"
                        >
                          <Dices className="h-4 w-4 mr-2" />
                          {d4RerollUsed ? "d4 ritirato" : "Ritira un d4 assegnato"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
                      <div>
                        <span className="font-heading">d4 corrente:</span>{" "}
                        <strong className="text-primary">
                          {currentD4Roll !== null ? currentD4Roll : "nessuno"}
                        </strong>
                      </div>

                      <div className="font-script italic text-xs text-ink-faded">
                        Residue da assegnare: {remainingD4Targets.length}
                      </div>
                    </div>

                    {remainingD4Targets.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ABILITIES.filter((a) => a.key !== d6Choice && !(a.key in d4Assignments)).map((a) => (
                          <Button
                            key={a.key}
                            type="button"
                            variant="outline"
                            disabled={currentD4Roll === null}
                            onClick={() => assignCurrentD4ToAbility(a.key)}
                            className="font-heading"
                          >
                            Assegna a {a.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {Object.keys(d4Assignments).length > 0 && (
                      <div className="space-y-1">
                        <p className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                          d4 già assegnati
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                          {ABILITIES.filter((a) => a.key in d4Assignments).map((a) => {
                            const isSelected = selectedD4RerollTarget === a.key;
                            return (
                              <button
                                key={a.key}
                                type="button"
                                onClick={() => {
                                  if (d4RerollUsed || currentD4Roll !== null) return;
                                  setSelectedD4RerollTarget(a.key);
                                }}
                                className={`rounded-md border px-3 py-2 text-left transition ${
                                  isSelected
                                    ? "border-primary ring-1 ring-primary/40 bg-primary/5"
                                    : "border-border/50 bg-background/40"
                                }`}
                                disabled={d4RerollUsed || currentD4Roll !== null}
                              >
                                <span className="font-heading">{a.label}</span>: {" "}
                                <span className="text-primary font-display">
                                  +{d4Assignments[a.key]}
                                </span>
                                {isSelected && (
                                  <span className="block text-[11px] font-script italic text-ink-faded">
                                    Selezionato per il reroll
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {bonusesAssigned && (
                  <p className="font-script italic text-xs text-ink-faded">
                    Puoi ritirare il <strong>d6</strong> una sola volta e <strong>un solo d4</strong>{" "}
                    già assegnato, scegliendo quale sostituire.
                  </p>
                )}
              </div>
            </div>
          )}

          {currentStep === "usa-magia" && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Il personaggio è un utilizzatore di magia?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={isMagicUser === true ? "default" : "outline"}
                  className="font-heading h-12"
                  onClick={() => setIsMagicUser(true)}
                >
                  Sì, utilizza la magia
                </Button>
                <Button
                  type="button"
                  variant={isMagicUser === false ? "default" : "outline"}
                  className="font-heading h-12"
                  onClick={() => setIsMagicUser(false)}
                >
                  No, non utilizza la magia
                </Button>
              </div>
              <p className="font-script italic text-xs text-ink-faded">
                Se scegli “Sì”, il flusso continua alle scuole di magia. Se scegli “No”, lo step
                magia verrà saltato e nello step abilità avrai <strong>45 punti</strong> invece di <strong>30</strong>.
              </p>
            </div>
          )}

          {currentStep === "magia" && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Distribuisci <strong>{MAGIC_POINT_TOTAL} punti</strong> tra le dieci scuole di magia,
                con <strong>minimo {MAGIC_POINT_MIN}</strong> e <strong>massimo {MAGIC_POINT_MAX}</strong> per scuola.
              </p>

              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <span className="font-heading text-sm">
                  Distribuiti: <strong>{magicPointsAssigned}</strong> / {MAGIC_POINT_TOTAL}
                </span>
                <span
                  className={`font-heading text-sm ${
                    remainingMagicPoints === 0
                      ? "text-primary"
                      : remainingMagicPoints < 0
                      ? "text-destructive"
                      : "text-ink-faded"
                  }`}
                >
                  Rimanenti: {remainingMagicPoints}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {MAGIC_SCHOOLS.map((school) => (
                  <div
                    key={school}
                    className="bg-parchment-deep/20 border border-border/60 rounded-lg p-3 text-center"
                  >
                    <div className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                      {school}
                    </div>
                    <Input
                      type="number"
                      min={MAGIC_POINT_MIN}
                      max={MAGIC_POINT_MAX}
                      value={magic[school] ?? 0}
                      onChange={(e) => setMagicScore(school, e.target.value)}
                      className="bg-transparent border-0 text-center font-display text-xl h-9 px-0 focus-visible:ring-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === "abilita" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="font-script italic text-sm text-ink-faded">
                  Aggiungi le abilità apprese all'inizio e distribuisci <strong>{skillPointTotal} punti abilità</strong> totali,
                  con <strong>minimo {SKILL_POINT_MIN}</strong> e <strong>massimo {SKILL_POINT_MAX}</strong> per ogni abilità.
                </p>
                <Button variant="outline" size="sm" onClick={addSkill} className="font-heading">
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi
                </Button>
              </div>

              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <span className="font-heading text-sm">
                  Distribuiti: <strong>{totalSkillPointsAssigned}</strong> / {skillPointTotal}
                </span>
                <span
                  className={`font-heading text-sm ${
                    remainingSkillPoints === 0
                      ? "text-primary"
                      : remainingSkillPoints < 0
                      ? "text-destructive"
                      : "text-ink-faded"
                  }`}
                >
                  Rimanenti: {remainingSkillPoints}
                </span>
              </div>

              {skills.length === 0 ? (
                <p className="font-script italic text-ink-faded text-sm text-center py-6">
                  Nessuna abilità ancora. Aggiungile e distribuisci tutti i punti disponibili.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {skills.map((s) => (
                    <div
                      key={s.id}
                      className="bg-parchment-deep/20 border border-border/60 rounded-lg p-2 flex items-center gap-2"
                    >
                      <Input
                        value={s.name}
                        onChange={(e) => updateSkill(s.id, { name: e.target.value })}
                        className="bg-transparent border-0 px-2 h-8 focus-visible:ring-0 font-script flex-1"
                      />
                      <Input
                        type="number"
                        min={SKILL_POINT_MIN}
                        max={SKILL_POINT_MAX}
                        value={s.grade}
                        onChange={(e) =>
                          updateSkill(s.id, {
                            grade: Math.max(SKILL_POINT_MIN, Math.min(SKILL_POINT_MAX, Number(e.target.value) || SKILL_POINT_MIN)),
                          })
                        }
                        className="bg-transparent border border-border/60 text-center w-16 h-8 px-0 focus-visible:ring-0 font-display"
                      />
                      <button
                        onClick={() => removeSkill(s.id)}
                        className="text-destructive p-1"
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === "soldi" && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Imposta il denaro iniziale del personaggio.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {COIN_TYPES.map((c) => (
                  <div
                    key={c.key}
                    className="bg-parchment-deep/20 border border-border/60 rounded-lg p-3 text-center"
                  >
                    <div className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                      {c.label}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={coins[c.key] ?? 0}
                      onChange={(e) => setCoin(c.key, e.target.value)}
                      className="bg-transparent border-0 text-center font-display text-xl h-9 px-0 focus-visible:ring-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === "punti-fortuna" && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Indica i Punti Fortuna iniziali del personaggio.
              </p>
              <div className="max-w-xs mx-auto bg-parchment-deep/20 border border-border/60 rounded-lg p-4 text-center">
                <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                  Punti Fortuna
                </Label>
                <Input
                  value={fortuna}
                  onChange={(e) => setFortuna(e.target.value)}
                  className="bg-transparent border-0 text-center font-display h-10 px-0 focus-visible:ring-0"
                  style={{ fontSize: "22px" }}
                  placeholder="0"
                />
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                <p className="font-heading text-primary mb-1">Riepilogo</p>
                <ul className="font-script text-ink-faded space-y-0.5">
                  <li>Nome: <strong className="text-ink">{name || "—"}</strong></li>
                  <li>Utilizzatore di magia: {isMagicUser === null ? "—" : isMagicUser ? "Sì" : "No"}</li>
                  <li>Caratteristiche: base {totalBaseSum} pt + bonus dadi (totale {ABILITIES.reduce((acc, a) => acc + (finalAbilities[a.key] || 0), 0)})</li>
                  <li>Scuole di magia attive: {MAGIC_SCHOOLS.filter((s) => (magic[s] ?? 0) > 0).length} · punti distribuiti {magicPointsAssigned}/{MAGIC_POINT_TOTAL}</li>
                  <li>Abilità apprese: {skills.length} · punti distribuiti {totalSkillPointsAssigned}/{skillPointTotal}</li>
                  <li>Soldi: {coins.oro} oro · {coins.argento} arg · {coins.rame} rame</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={handleCancel} disabled={submitting}>
            Annulla
          </Button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
            )}
            {stepIndex < visibleSteps.length - 1 ? (
              <Button onClick={handleNext} disabled={submitting}>
                Avanti <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={submitting} className="font-heading">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" /> Forgia eroe
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
