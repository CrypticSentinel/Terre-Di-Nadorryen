import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dices, RotateCw, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

interface DiceGroup {
  id: string;
  count: number;
  sides: number;
}

interface RolledDie {
  sides: number;
  value: number;
}

interface RollResult {
  expression: string;
  dice: RolledDie[];
  modifier: number;
  total: number;
}

const formatExpression = (groups: DiceGroup[], modifier: number) => {
  const parts = groups
    .filter((g) => g.count > 0)
    .map((g) => `${g.count}d${g.sides}`);
  let expr = parts.join(" + ") || "—";
  if (modifier !== 0) expr += ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`;
  return expr;
};

export const DiceRoller = () => {
  const [groups, setGroups] = useState<DiceGroup[]>([
    { id: crypto.randomUUID(), count: 1, sides: 20 },
  ]);
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [bonusRoll, setBonusRoll] = useState<{ value: number; total: number } | null>(null);
  const [bonusRolling, setBonusRolling] = useState(false);

  const expression = useMemo(() => formatExpression(groups, modifier), [groups, modifier]);

  const updateGroup = (id: string, patch: Partial<DiceGroup>) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const addGroup = () =>
    setGroups((prev) => [...prev, { id: crypto.randomUUID(), count: 1, sides: 6 }]);
  const removeGroup = (id: string) =>
    setGroups((prev) => (prev.length > 1 ? prev.filter((g) => g.id !== id) : prev));

  const performRoll = () => {
    const active = groups.filter((g) => g.count > 0);
    if (active.length === 0) {
      toast.error("Aggiungi almeno un dado");
      return;
    }
    setRolling(true);
    setBonusRoll(null);
    setTimeout(() => {
      const dice: RolledDie[] = [];
      for (const g of active) {
        const c = Math.min(50, Math.max(1, Math.floor(g.count)));
        for (let i = 0; i < c; i++) {
          dice.push({ sides: g.sides, value: Math.floor(Math.random() * g.sides) + 1 });
        }
      }
      const sum = dice.reduce((acc, d) => acc + d.value, 0);
      const total = sum + modifier;
      const result: RollResult = { expression, dice, modifier, total };
      setLastResult(result);
      setRolling(false);

      // Regola speciale: 1d20 singolo
      const isSingleD20 = active.length === 1 && active[0].count === 1 && active[0].sides === 20;
      if (isSingleD20) {
        const v = dice[0].value;
        if (v === 1) {
          toast.error("💀 Fallimento critico!");
        } else if (v === 20) {
          toast.success("✨ 20 Naturale, ritira e ricordati di aggiungere 1 Punto Esperienza");
        } else {
          toast(`🎲 d20 → ${v}${modifier ? ` (totale ${total})` : ""}`);
        }
      } else {
        toast(`🎲 ${expression} → ${total}`);
      }
    }, 500);
  };

  const rollBonusD20 = () => {
    if (!lastResult) return;
    setBonusRolling(true);
    setTimeout(() => {
      const v = Math.floor(Math.random() * 20) + 1;
      setBonusRoll({ value: v, total: lastResult.total + v });
      setBonusRolling(false);
      toast(`🎲 Ritiro d20 → ${v} · totale cumulato ${lastResult.total + v}`);
    }, 400);
  };

  const showBonusButton =
    lastResult &&
    lastResult.dice.length === 1 &&
    lastResult.dice[0].sides === 20 &&
    lastResult.dice[0].value === 20;

  return (
    <div className="parchment-panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Dices className="h-5 w-5 text-primary" />
        <h3 className="font-heading text-lg">Tiri di dado</h3>
      </div>

      {/* Gruppi di dadi */}
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={50}
              value={g.count}
              onChange={(e) =>
                updateGroup(g.id, { count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })
              }
              className="w-16 h-9 text-center font-display"
              aria-label="Numero di dadi"
            />
            <span className="font-script text-ink-faded">d</span>
            <select
              value={g.sides}
              onChange={(e) => updateGroup(g.id, { sides: Number(e.target.value) })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm font-display"
              aria-label="Tipo di dado"
            >
              {DIE_SIDES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {groups.length > 1 && (
              <button
                onClick={() => removeGroup(g.id)}
                className="text-destructive hover:opacity-80"
                aria-label="Rimuovi gruppo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addGroup} className="font-heading">
          <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi dado
        </Button>
      </div>

      {/* Modificatore fisso */}
      <div className="flex items-center gap-2">
        <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded">
          Modificatore
        </Label>
        <Input
          type="number"
          value={modifier}
          onChange={(e) => setModifier(Math.floor(Number(e.target.value) || 0))}
          className="w-20 h-9 text-center font-display"
        />
      </div>

      {/* Anteprima formula */}
      <div className="text-center font-script italic text-sm text-ink-faded">
        Formula: <strong className="not-italic font-heading text-foreground">{expression}</strong>
      </div>

      <Button onClick={performRoll} disabled={rolling} className="w-full font-heading">
        <Dices className="h-4 w-4 mr-1" />
        {rolling ? "Tiro in corso..." : "Tira"}
      </Button>

      {/* Risultato */}
      {lastResult && (
        <div
          className={`text-center py-4 rounded border border-border bg-parchment-deep/30 ${
            rolling ? "animate-roll-die" : "animate-fade-up"
          }`}
        >
          <div className="font-script text-xs text-ink-faded uppercase tracking-wider">
            {lastResult.expression}
          </div>
          <div className="font-display text-4xl gold-text">{lastResult.total}</div>
          <div className="font-script text-xs text-ink-faded mt-1 break-words px-2">
            {lastResult.dice.map((d, i) => (
              <span key={i}>
                {i > 0 && " + "}
                <span title={`d${d.sides}`}>{d.value}</span>
              </span>
            ))}
            {lastResult.modifier !== 0 && (
              <>
                {" "}
                {lastResult.modifier > 0 ? "+" : "−"} {Math.abs(lastResult.modifier)}
              </>
            )}
          </div>

          {showBonusButton && (
            <div className="mt-3 space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={rollBonusD20}
                disabled={bonusRolling || !!bonusRoll}
                className="font-heading"
              >
                <RotateCw className="h-3.5 w-3.5 mr-1" />
                {bonusRoll ? "Ritirato" : "Ritira d20 e somma"}
              </Button>
              {bonusRoll && (
                <div className="font-script text-sm">
                  Ritiro: <strong className="font-display text-primary">{bonusRoll.value}</strong> ·
                  Totale cumulato:{" "}
                  <strong className="font-display gold-text">{bonusRoll.total}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
