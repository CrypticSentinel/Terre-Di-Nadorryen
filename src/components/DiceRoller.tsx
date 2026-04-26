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
  cumulativeTotal?: number;
  bonusRolls?: number[];
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
  // Quando true, il prossimo tiro è un "ritira d20" che si somma all'ultimo
  const [pendingBonusD20, setPendingBonusD20] = useState(false);

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
      setPendingBonusD20(false);

      // Regola speciale: 1d20 singolo
      const isSingleD20 = active.length === 1 && active[0].count === 1 && active[0].sides === 20;
      if (isSingleD20) {
        const v = dice[0].value;
        if (v === 1) {
          toast.error("💀 Fallimento critico!");
        } else if (v === 20) {
          toast.success("✨ 20 Naturale, ritira e ricordati di aggiungere 1 Punto Esperienza");
          setPendingBonusD20(true);
        } else {
          toast(`🎲 d20 → ${v}${modifier ? ` (totale ${total})` : ""}`);
        }
      } else {
        toast(`🎲 ${expression} → ${total}`);
      }
    }, 500);
  };

  const performBonusD20 = () => {
    if (!lastResult) return;
    setRolling(true);
    setTimeout(() => {
      const v = Math.floor(Math.random() * 20) + 1;
      const previousCumulative = lastResult.cumulativeTotal ?? lastResult.total;
      const newCumulative = previousCumulative + v;
      const bonusRolls = [...(lastResult.bonusRolls ?? []), v];
      const updated: RollResult = {
        ...lastResult,
        bonusRolls,
        cumulativeTotal: newCumulative,
      };
      setLastResult(updated);
      setRolling(false);

      if (v === 20) {
        toast.success(`✨ Ancora 20! Ritira di nuovo · cumulato ${newCumulative}`);
        setPendingBonusD20(true);
      } else if (v === 1) {
        toast.error(`💀 Ritiro = 1 · cumulato ${newCumulative}`);
        setPendingBonusD20(false);
      } else {
        toast(`🎲 Ritiro d20 → ${v} · cumulato ${newCumulative}`);
        setPendingBonusD20(false);
      }
    }, 400);
  };

  const displayedTotal = lastResult?.cumulativeTotal ?? lastResult?.total ?? 0;

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
              className="w-14 h-9 text-center font-display px-1"
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
                className="text-destructive hover:opacity-80 ml-auto"
                aria-label="Rimuovi gruppo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addGroup} className="font-heading w-full">
          <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi dado
        </Button>
      </div>

      {/* Modificatore fisso (compatto, non esce dal riquadro) */}
      <div className="flex items-center gap-2">
        <Label className="font-heading text-xs uppercase tracking-wider text-ink-faded shrink-0">
          Mod.
        </Label>
        <Input
          type="number"
          value={modifier}
          onChange={(e) => setModifier(Math.floor(Number(e.target.value) || 0))}
          className="w-16 h-9 text-center font-display px-1"
        />
      </div>

      {/* Anteprima formula */}
      <div className="text-center font-script italic text-sm text-ink-faded break-all">
        Formula: <strong className="not-italic font-heading text-foreground">{expression}</strong>
      </div>

      {/* Tasto principale: Tira oppure Ritira d20 (sostituisce Tira) */}
      {pendingBonusD20 ? (
        <Button
          onClick={performBonusD20}
          disabled={rolling}
          className="w-full font-heading"
          variant="default"
        >
          <RotateCw className="h-4 w-4 mr-1" />
          {rolling ? "Tiro in corso..." : "Ritira d20 e somma al totale"}
        </Button>
      ) : (
        <Button onClick={performRoll} disabled={rolling} className="w-full font-heading">
          <Dices className="h-4 w-4 mr-1" />
          {rolling ? "Tiro in corso..." : "Tira"}
        </Button>
      )}

      {/* Risultato */}
      {lastResult && (
        <div
          className={`text-center py-4 rounded border border-border bg-parchment-deep/30 ${
            rolling ? "animate-roll-die" : "animate-fade-up"
          }`}
        >
          <div className="font-script text-xs text-ink-faded uppercase tracking-wider">
            {lastResult.expression}
            {lastResult.bonusRolls && lastResult.bonusRolls.length > 0 && (
              <> + {lastResult.bonusRolls.map((b) => `d20`).join(" + ")}</>
            )}
          </div>
          <div className="font-display text-4xl gold-text">{displayedTotal}</div>
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
            {lastResult.bonusRolls && lastResult.bonusRolls.length > 0 && (
              <>
                {" + "}
                {lastResult.bonusRolls.map((b, i) => (
                  <span key={`b${i}`}>
                    {i > 0 && " + "}
                    <span className="text-primary font-semibold">{b}</span>
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
