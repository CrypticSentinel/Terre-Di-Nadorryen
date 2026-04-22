import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dices } from "lucide-react";
import { toast } from "sonner";

const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

export const DiceRoller = () => {
  const [lastRoll, setLastRoll] = useState<{ sides: number; value: number } | null>(null);
  const [rolling, setRolling] = useState(false);

  const roll = (sides: number) => {
    setRolling(true);
    const value = Math.floor(Math.random() * sides) + 1;
    setTimeout(() => {
      setLastRoll({ sides, value });
      setRolling(false);
      const isCrit = sides === 20 && value === 20;
      const isFumble = sides === 20 && value === 1;
      if (isCrit) toast.success(`🎉 Critico naturale! d${sides} → ${value}`);
      else if (isFumble) toast.error(`💀 Fallimento critico! d${sides} → ${value}`);
      else toast(`🎲 d${sides} → ${value}`);
    }, 600);
  };

  return (
    <div className="parchment-panel p-5">
      <div className="flex items-center gap-2 mb-3">
        <Dices className="h-5 w-5 text-primary" />
        <h3 className="font-heading text-lg">Tiri di dado</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {DIE_SIDES.map((s) => (
          <Button
            key={s}
            variant="outline"
            size="sm"
            onClick={() => roll(s)}
            disabled={rolling}
            className="font-heading min-w-[3.5rem]"
          >
            d{s}
          </Button>
        ))}
      </div>

      {lastRoll && (
        <div className={`text-center py-4 rounded border border-border bg-parchment-deep/30 ${rolling ? "animate-roll-die" : "animate-fade-up"}`}>
          <div className="font-script text-xs text-ink-faded uppercase tracking-wider">Ultimo tiro</div>
          <div className="font-display text-4xl gold-text">{lastRoll.value}</div>
          <div className="font-script text-xs text-ink-faded">d{lastRoll.sides}</div>
        </div>
      )}
    </div>
  );
};
