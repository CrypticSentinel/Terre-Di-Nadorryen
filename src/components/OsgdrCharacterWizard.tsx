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

const STEP_LABELS = [
  "Anagrafica",
  "Caratteristiche",
  "Magia",
  "Abilità",
  "Soldi",
  "Punti Fortuna",
];

// Tira NdM
function rollDice(count: number, sides: number) {
  let total = 0;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = 1 + Math.floor(Math.random() * sides);
    rolls.push(r);
    total += r;
  }
  return { total, rolls };
}

export const OsgdrCharacterWizard = ({ open, onCancel, onComplete, submitting }: Props) => {
  const [step, setStep] = useState(0);

  // Step 0 — Anagrafica base
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");

  // Step 1 — Caratteristiche
  // Base 48 + 5d4 + 1d6 punti distribuibili tra 6 caratteristiche (parten 8 ciascuna)
  const [bonusPool, setBonusPool] = useState<number | null>(null);
  const [bonusRollDetail, setBonusRollDetail] = useState<string>("");
  const [abilities, setAbilities] = useState<Record<string, number>>({
    for: 8, des: 8, cos: 8, vol: 8, pro: 8, emp: 8,
  });

  // Step 2 — Magia
  const [magic, setMagic] = useState<Record<string, number>>(
    Object.fromEntries(MAGIC_SCHOOLS.map((s) => [s, 0])),
  );

  // Step 3 — Abilità apprese
  const [skills, setSkills] = useState<OsgdrSkill[]>([]);

  // Step 4 — Soldi
  const [coins, setCoins] = useState<Record<string, number>>({ oro: 0, argento: 0, rame: 0 });

  // Step 5 — Punti Fortuna
  const [fortuna, setFortuna] = useState<string>("");

  const minBaseSum = ABILITIES.length * 8; // 48
  const totalAbilitySum = useMemo(
    () => ABILITIES.reduce((acc, a) => acc + (Number(abilities[a.key]) || 0), 0),
    [abilities],
  );
  const maxAbilitySum = bonusPool === null ? null : minBaseSum + bonusPool;
  const remainingAbilityPoints =
    maxAbilitySum === null ? null : maxAbilitySum - totalAbilitySum;

  const tiraBonus = () => {
    const d4 = rollDice(5, 4);
    const d6 = rollDice(1, 6);
    const tot = d4.total + d6.total;
    setBonusPool(tot);
    setBonusRollDetail(
      `5d4 [${d4.rolls.join(", ")}] = ${d4.total} · 1d6 [${d6.rolls[0]}] = ${d6.total} → +${tot}`,
    );
    // Reset abilities a base 8
    setAbilities({ for: 8, des: 8, cos: 8, vol: 8, pro: 8, emp: 8 });
  };

  const setAbility = (key: string, raw: string) => {
    const n = Math.max(8, Math.min(20, Number(raw) || 0));
    const next = { ...abilities, [key]: n };
    if (maxAbilitySum !== null) {
      const sum = ABILITIES.reduce((acc, a) => acc + (Number(next[a.key]) || 0), 0);
      if (sum > maxAbilitySum) {
        toast.error(`Hai superato il totale di ${maxAbilitySum} punti.`);
        return;
      }
    }
    setAbilities(next);
  };

  const setMagicScore = (school: string, raw: string) => {
    const n = Math.max(0, Math.min(99, Number(raw) || 0));
    setMagic({ ...magic, [school]: n });
  };

  const setCoin = (key: string, raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    setCoins({ ...coins, [key]: n });
  };

  const addSkill = () =>
    setSkills([...skills, { id: crypto.randomUUID(), name: "Nuova abilità", grade: 1 }]);
  const updateSkill = (id: string, patch: Partial<OsgdrSkill>) =>
    setSkills(skills.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSkill = (id: string) =>
    setSkills(skills.filter((s) => s.id !== id));

  const canGoNext = (() => {
    switch (step) {
      case 0:
        return name.trim().length > 0;
      case 1:
        // Deve aver tirato i bonus e usato esattamente i punti
        return bonusPool !== null && remainingAbilityPoints === 0;
      default:
        return true;
    }
  })();

  const handleNext = () => {
    if (!canGoNext) {
      if (step === 0) toast.error("Inserisci un nome per il personaggio.");
      else if (step === 1 && bonusPool === null) toast.error("Tira i dadi per ottenere i punti bonus.");
      else if (step === 1 && remainingAbilityPoints !== 0)
        toast.error(`Devi distribuire esattamente i punti rimanenti (${remainingAbilityPoints} ancora).`);
      return;
    }
    setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleFinish = async () => {
    const sheet: OsgdrSheet = {
      ...EMPTY_OSGDR_SHEET,
      ferite: { ...EMPTY_OSGDR_SHEET.ferite },
      equipment: { ...EMPTY_OSGDR_SHEET.equipment },
      abilities: {
        for: abilities.for, des: abilities.des, cos: abilities.cos,
        vol: abilities.vol, pro: abilities.pro, emp: abilities.emp,
      } as any,
      magic: { ...magic } as any,
      coins: { ...coins } as any,
      fortuna: fortuna.trim(),
      skills,
    };
    await onComplete({ name: name.trim(), concept: concept.trim(), sheet });
  };

  if (!open) return null;

  const progress = ((step + 1) / STEP_LABELS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-elegant max-w-3xl w-full my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl gold-text">Forgia un nuovo eroe</h2>
            <span className="text-xs font-heading uppercase tracking-wider text-ink-faded">
              Step {step + 1} / {STEP_LABELS.length} · {STEP_LABELS[step]}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
          {step === 0 && (
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

          {step === 1 && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Le caratteristiche partono da <strong>8</strong> ciascuna (totale base{" "}
                <strong>{minBaseSum}</strong>). Tira <strong>5d4 + 1d6</strong> per ottenere i
                punti bonus da distribuire (max 20 per caratteristica).
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={tiraBonus} variant="outline" className="font-heading">
                  <Dices className="h-4 w-4 mr-2" />
                  {bonusPool === null ? "Tira 5d4 + 1d6" : "Ritira"}
                </Button>
                {bonusPool !== null && (
                  <div className="text-sm">
                    <div className="font-heading">
                      Punti bonus: <span className="text-primary">+{bonusPool}</span>
                    </div>
                    <div className="font-script italic text-xs text-ink-faded">{bonusRollDetail}</div>
                  </div>
                )}
              </div>

              {bonusPool !== null && (
                <>
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <span className="font-heading text-sm">
                      Distribuiti: <strong>{totalAbilitySum}</strong> / {maxAbilitySum}
                    </span>
                    <span
                      className={`font-heading text-sm ${
                        remainingAbilityPoints === 0
                          ? "text-primary"
                          : remainingAbilityPoints! < 0
                          ? "text-destructive"
                          : "text-ink-faded"
                      }`}
                    >
                      Rimanenti: {remainingAbilityPoints}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ABILITIES.map((a) => {
                      const v = abilities[a.key] ?? 8;
                      const mod = abilityModifier(v);
                      return (
                        <div
                          key={a.key}
                          className="bg-parchment-deep/20 border border-border/60 rounded-lg p-3 text-center"
                        >
                          <div className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                            {a.label}
                          </div>
                          <Input
                            type="number"
                            min={8}
                            max={20}
                            value={v}
                            onChange={(e) => setAbility(a.key, e.target.value)}
                            className="bg-transparent border-0 text-center font-display h-10 px-0 focus-visible:ring-0"
                            style={{ fontSize: "20px" }}
                          />
                          <div className="font-script text-primary text-lg">
                            {formatModifier(mod)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="font-script italic text-sm text-ink-faded">
                Imposta il punteggio iniziale per ciascuna delle dieci scuole di magia (0 se il
                personaggio non la pratica).
              </p>
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
                      min={0}
                      max={99}
                      value={magic[school] ?? 0}
                      onChange={(e) => setMagicScore(school, e.target.value)}
                      className="bg-transparent border-0 text-center font-display text-xl h-9 px-0 focus-visible:ring-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-script italic text-sm text-ink-faded">
                  Aggiungi le abilità apprese all'inizio (puoi sempre aggiornarle dalla scheda).
                </p>
                <Button variant="outline" size="sm" onClick={addSkill} className="font-heading">
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi
                </Button>
              </div>
              {skills.length === 0 ? (
                <p className="font-script italic text-ink-faded text-sm text-center py-6">
                  Nessuna abilità ancora. Puoi saltare e aggiungerle in seguito.
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
                        min={0}
                        max={20}
                        value={s.grade}
                        onChange={(e) =>
                          updateSkill(s.id, {
                            grade: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
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

          {step === 4 && (
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

          {step === 5 && (
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
                  <li>Caratteristiche: totale {totalAbilitySum} pt</li>
                  <li>Scuole di magia attive: {MAGIC_SCHOOLS.filter((s) => (magic[s] ?? 0) > 0).length}</li>
                  <li>Abilità apprese: {skills.length}</li>
                  <li>Soldi: {coins.oro} oro · {coins.argento} arg · {coins.rame} rame</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Annulla
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
            )}
            {step < STEP_LABELS.length - 1 ? (
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
