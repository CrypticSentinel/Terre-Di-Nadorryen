import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dices,
  RotateCw,
  Trash2,
  Plus,
  History,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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

export interface DiceRollRow {
  id: string;
  campaign_id: string;
  character_id: string | null;
  character_name: string | null;
  user_id: string;
  user_display_name: string | null;
  expression: string;
  dice: RolledDie[];
  modifier: number;
  total: number;
  message: string | null;
  created_at: string;
}

interface DiceRollerProps {
  campaignId?: string;
  characterId?: string;
  characterName?: string;
  variant?: "panel" | "embedded";
  onClose?: () => void;
  penaltyReminder?: string;
  penaltyTotal?: number;
}

const formatExpression = (groups: DiceGroup[], modifier: number) => {
  const parts = groups
    .filter((g) => g.count > 0)
    .map((g) => `${g.count}d${g.sides}`);

  let expr = parts.join(" + ") || "—";
  if (modifier !== 0) expr += ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`;
  return expr;
};

const formatPenaltyNote = (penaltyTotal?: number) => {
  if (!penaltyTotal || penaltyTotal <= 0) return null;
  return `Ricorda malus: -${penaltyTotal} (Ferite + Penalità Aggiuntive + Fatica)`;
};

const formatRollSummary = (row: DiceRollRow) => {
  const actor = row.character_name || row.user_display_name || "Anonimo";
  const player =
    row.character_name && row.user_display_name
      ? ` · giocatore: ${row.user_display_name}`
      : "";

  const detail = row.message?.trim()
    ? row.message
    : `${row.expression} → ${row.total}`;

  return `🎲 ${actor}: ${detail}${player}`;
};

export const DiceRoller = ({
  campaignId,
  characterId,
  characterName,
  variant = "panel",
  onClose,
  penaltyReminder,
  penaltyTotal,
}: DiceRollerProps) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<DiceGroup[]>([
    { id: crypto.randomUUID(), count: 1, sides: 20 },
  ]);
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [pendingBonusD20, setPendingBonusD20] = useState(false);
  const [history, setHistory] = useState<DiceRollRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const expression = useMemo(() => formatExpression(groups, modifier), [groups, modifier]);

  useEffect(() => {
    if (!campaignId) return;

    let cancelled = false;
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      const { data, error } = await supabase
        .from("dice_rolls")
        .select("*")
        .eq("campaign_id", campaignId)
        .gte("created_at", fifteenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (!error && data) {
        const rows = data as unknown as DiceRollRow[];
        setHistory(rows);
        for (const r of rows) seenIdsRef.current.add(r.id);
      }
    })();

    const channel = supabase
      .channel(`dice-rolls-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dice_rolls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const row = payload.new as unknown as DiceRollRow;
          if (seenIdsRef.current.has(row.id)) return;

          seenIdsRef.current.add(row.id);
          setHistory((prev) => [row, ...prev].slice(0, 200));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "dice_rolls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id) return;

          seenIdsRef.current.delete(oldRow.id);
          setHistory((prev) => prev.filter((r) => r.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [campaignId, user?.id]);

  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateGroup = (id: string, patch: Partial<DiceGroup>) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const addGroup = () =>
    setGroups((prev) => [...prev, { id: crypto.randomUUID(), count: 1, sides: 6 }]);

  const removeGroup = (id: string) =>
    setGroups((prev) => (prev.length > 1 ? prev.filter((g) => g.id !== id) : prev));

      const publishRoll = async (params: {
    expression: string;
    dice: RolledDie[];
    modifier: number;
    total: number;
    message: string;
  }) => {
    if (!campaignId || !user) return;

    let userName: string | null = null;

    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      userName = prof?.display_name ?? null;
    } catch {}

    const penaltyNote = formatPenaltyNote(penaltyTotal);
    const finalMessage = penaltyNote
      ? `${params.message} · ${penaltyNote}`
      : params.message;

    const insertRow = {
      campaign_id: campaignId,
      character_id: characterId ?? null,
      character_name: characterName ?? null,
      user_id: user.id,
      user_display_name: userName,
      expression: params.expression,
      dice: params.dice as any,
      modifier: params.modifier,
      total: params.total,
      message: finalMessage,
    };

    const { data, error } = await supabase
      .from("dice_rolls")
      .insert(insertRow)
      .select()
      .single();

    if (!error && data) {
      const row = data as unknown as DiceRollRow;
      seenIdsRef.current.add(row.id);
      setHistory((prev) => [row, ...prev].slice(0, 200));
    }
  };

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
          dice.push({
            sides: g.sides,
            value: Math.floor(Math.random() * g.sides) + 1,
          });
        }
      }

      const sum = dice.reduce((acc, d) => acc + d.value, 0);
      const total = sum + modifier;
      const result: RollResult = { expression, dice, modifier, total };

      setLastResult(result);
      setRolling(false);
      setPendingBonusD20(false);

      const isSingleD20 =
        active.length === 1 && active[0].count === 1 && active[0].sides === 20;

      let message = "";

if (isSingleD20) {
  const v = dice[0].value;

  if (v === 1) {
    message = "💀 Fallimento critico!";
  } else if (v === 20) {
    message = "✨ 20 Naturale, ritira e ricordati di aggiungere 1 PE";
    setPendingBonusD20(true);
  } else {
    message = `🎲 d20 → ${v}${modifier ? ` (totale ${total})` : ""}`;
  }
} else {
  message = `🎲 ${expression} → ${total}`;
}

      publishRoll({ expression, dice, modifier, total, message });
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

      let message = "";

if (v === 20) {
  message = `✨ Ancora 20! Ritira di nuovo · cumulato ${newCumulative}`;
  setPendingBonusD20(true);
} else if (v === 1) {
  message = `💀 Ritiro = 1 · cumulato ${newCumulative}`;
  setPendingBonusD20(false);
} else {
  message = `🎲 Ritiro d20 → ${v} · cumulato ${newCumulative}`;
  setPendingBonusD20(false);
}

      const dice: RolledDie[] = [{ sides: 20, value: v }];

      publishRoll({
        expression: "+1d20 (ritiro)",
        dice,
        modifier: 0,
        total: v,
        message,
      });
    }, 400);
  };

  const displayedTotal = lastResult?.cumulativeTotal ?? lastResult?.total ?? 0;

  const containerClass =
    variant === "embedded"
      ? "space-y-4"
      : "parchment-panel p-4 sm:p-5 space-y-4";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2">
        <Dices className="h-5 w-5 text-primary" />
        <h3 className="flex-1 font-heading text-lg">Tiri di dado</h3>

        {campaignId && (
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className={cn(
              "rounded-md p-1.5 text-ink-faded transition-colors hover:text-primary",
              historyOpen && "bg-primary/10 text-primary"
            )}
            title="Cronologia tiri"
            aria-label="Cronologia tiri"
          >
            <History className="h-4 w-4" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-faded transition-colors hover:text-foreground"
            title="Chiudi"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={50}
              value={g.count}
              onChange={(e) =>
                updateGroup(g.id, {
                  count: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                })
              }
              className="h-9 w-14 px-1 text-center font-display"
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
                type="button"
                onClick={() => removeGroup(g.id)}
                className="ml-auto p-1 text-destructive hover:opacity-80"
                aria-label="Rimuovi gruppo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addGroup} className="w-full font-heading">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Aggiungi dado
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Label className="shrink-0 font-heading text-xs uppercase tracking-wider text-ink-faded">
          Mod.
        </Label>
        <Input
          type="number"
          value={modifier}
          onChange={(e) => setModifier(Math.floor(Number(e.target.value) || 0))}
          className="h-9 w-16 px-1 text-center font-display"
        />
      </div>

      <div className="break-all text-center font-script text-sm italic text-ink-faded">
        Formula:{" "}
        <strong className="font-heading not-italic text-foreground">{expression}</strong>
      </div>

      {pendingBonusD20 ? (
        <Button onClick={performBonusD20} disabled={rolling} className="w-full font-heading">
          <RotateCw className="mr-1 h-4 w-4" />
          {rolling ? "Tiro in corso..." : "Ritira d20 e somma al totale"}
        </Button>
      ) : (
        <Button onClick={performRoll} disabled={rolling} className="w-full font-heading">
          <Dices className="mr-1 h-4 w-4" />
          {rolling ? "Tiro in corso..." : "Tira"}
        </Button>
      )}

            {lastResult && (
        <div
          className={`rounded border border-border bg-parchment-deep/30 py-3 text-center ${
            rolling ? "animate-roll-die" : "animate-fade-up"
          }`}
        >
          <div className="font-script text-xs uppercase tracking-wider text-ink-faded">
            {lastResult.expression}
            {lastResult.bonusRolls && lastResult.bonusRolls.length > 0 && (
              <> + {lastResult.bonusRolls.map(() => `d20`).join(" + ")}</>
            )}
          </div>

          <div className="font-display text-3xl gold-text sm:text-4xl">{displayedTotal}</div>

          <div className="mt-1 break-words px-2 font-script text-xs text-ink-faded">
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
                    <span className="font-semibold text-primary">{b}</span>
                  </span>
                ))}
              </>
            )}
          </div>

          {typeof penaltyTotal === "number" && penaltyTotal > 0 && (
            <div className="mt-3 border-t border-border/50 px-3 pt-2 text-center">
              <div className="font-script text-[11px] italic text-ink-faded">
                {penaltyReminder || "Ricorda: sottrai Penalità Ferite + Penalità Aggiuntive + Fatica"}
              </div>
              <div className="mt-1 font-heading text-xs text-destructive">
                Malus da sottrarre: -{penaltyTotal}
              </div>
            </div>
          )}
        </div>
      )}

      {campaignId && historyOpen && (
        <div className="border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-heading text-sm uppercase tracking-wider text-ink-faded">
              Cronologia (15 gg)
            </h4>
            <span className="font-script text-xs italic text-ink-faded">
              {history.length} tiri
            </span>
          </div>

          {history.length === 0 ? (
            <p className="py-4 text-center font-script text-xs italic text-ink-faded">
              Nessun tiro recente.
            </p>
          ) : (
            <ScrollArea className="max-h-64 pr-2">
              <ul className="space-y-1.5">
                {history.map((row) => (
                  <li
                    key={row.id}
                    className="rounded border border-border/50 bg-parchment-deep/20 px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-heading">
                        {row.character_name || row.user_display_name || "Anonimo"}
                      </span>
                      <span className="shrink-0 font-script text-[10px] italic text-ink-faded">
                        {new Date(row.created_at).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="font-script text-ink-faded">
                      {row.expression} →{" "}
                      <strong className="not-italic text-primary">{row.total}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
};

interface DockProps {
  campaignId?: string;
  characterId?: string;
  characterName?: string;
  penaltyReminder?: string;
  penaltyTotal?: number;
}

export const DiceRollerDock = (props: DockProps) => {
  const [open, setOpen] = useState(false);

  const closeDock = () => setOpen(false);
  const openDock = () => setOpen(true);

  return (
    <>
      <button
        type="button"
        onClick={openDock}
        className={cn(
          "fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl",
          open && "pointer-events-none opacity-0"
        )}
        aria-label="Apri tiri di dado"
      >
        <Dices className="h-5 w-5" />
        <span className="font-heading text-sm">Tiri di dado</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Chiudi pannello tiri di dado"
            className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-[2px]"
            onClick={closeDock}
          />

          <div className="absolute inset-x-3 bottom-3 top-16 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:top-auto sm:w-[28rem]">
            <div className="flex h-full max-h-[calc(100vh-5rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Dices className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-heading text-base leading-none">Tiri di dado</p>
                    <p className="mt-1 font-script text-xs italic text-ink-faded">
                      Pannello rapido della campagna
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDock}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-faded transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Chiudi"
                  title="Chiudi"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <DiceRoller {...props} variant="embedded" onClose={closeDock} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { ChevronUp, ChevronDown };