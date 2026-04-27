import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dices, RotateCw, Trash2, Plus, History, X, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
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
  /** Se passato, i tiri vengono pubblicati e sincronizzati con la campagna */
  campaignId?: string;
  characterId?: string;
  characterName?: string;
  /** Variante visiva: "panel" (sidebar/desktop), "embedded" (dentro un altro container) */
  variant?: "panel" | "embedded";
  /** Mostra il pulsante per chiudere/ridurre (usato dal dock mobile) */
  onClose?: () => void;
}

const formatExpression = (groups: DiceGroup[], modifier: number) => {
  const parts = groups
    .filter((g) => g.count > 0)
    .map((g) => `${g.count}d${g.sides}`);
  let expr = parts.join(" + ") || "—";
  if (modifier !== 0) expr += ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`;
  return expr;
};

const formatRollSummary = (row: DiceRollRow) => {
  const who = row.character_name || row.user_display_name || "Anonimo";
  return `🎲 ${who}: ${row.expression} → ${row.total}`;
};

export const DiceRoller = ({
  campaignId,
  characterId,
  characterName,
  variant = "panel",
  onClose,
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

  // Carica cronologia + realtime dei tiri della campagna
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
        { event: "INSERT", schema: "public", table: "dice_rolls", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.new as unknown as DiceRollRow;
          if (seenIdsRef.current.has(row.id)) return;
          seenIdsRef.current.add(row.id);
          setHistory((prev) => [row, ...prev].slice(0, 200));
          // Mostra a tutti i partecipanti (compreso chi ha tirato? sì,
          // ma sopprimiamo se è già lo stesso user che ha appena tirato e
          // quindi ha visto il toast locale): per evitare doppioni mostriamo
          // solo se non è lo user corrente.
          if (row.user_id !== user?.id) {
            toast(formatRollSummary(row));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "dice_rolls", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id) return;
          seenIdsRef.current.delete(oldRow.id);
          setHistory((prev) => prev.filter((r) => r.id !== oldRow.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [campaignId, user?.id]);

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
    // Recupera display name dell'utente (best-effort, una sola volta cache lato Supabase)
    let userName: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      userName = prof?.display_name ?? null;
    } catch { /* noop */ }

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
      message: params.message,
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
          dice.push({ sides: g.sides, value: Math.floor(Math.random() * g.sides) + 1 });
        }
      }
      const sum = dice.reduce((acc, d) => acc + d.value, 0);
      const total = sum + modifier;
      const result: RollResult = { expression, dice, modifier, total };
      setLastResult(result);
      setRolling(false);
      setPendingBonusD20(false);

      // Toast locale
      const isSingleD20 = active.length === 1 && active[0].count === 1 && active[0].sides === 20;
      let message = "";
      if (isSingleD20) {
        const v = dice[0].value;
        if (v === 1) {
          message = "💀 Fallimento critico!";
          toast.error(message);
        } else if (v === 20) {
          message = "✨ 20 Naturale, ritira e ricordati di aggiungere 1 PE";
          toast.success(message);
          setPendingBonusD20(true);
        } else {
          message = `🎲 d20 → ${v}${modifier ? ` (totale ${total})` : ""}`;
          toast(message);
        }
      } else {
        message = `🎲 ${expression} → ${total}`;
        toast(message);
      }

      // Pubblica per tutti i partecipanti
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
        toast.success(message);
        setPendingBonusD20(true);
      } else if (v === 1) {
        message = `💀 Ritiro = 1 · cumulato ${newCumulative}`;
        toast.error(message);
        setPendingBonusD20(false);
      } else {
        message = `🎲 Ritiro d20 → ${v} · cumulato ${newCumulative}`;
        toast(message);
        setPendingBonusD20(false);
      }

      // Pubblica il bonus come tiro a sé
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

  const containerClass = variant === "embedded"
    ? "space-y-4"
    : "parchment-panel p-4 sm:p-5 space-y-4";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2">
        <Dices className="h-5 w-5 text-primary" />
        <h3 className="font-heading text-lg flex-1">Tiri di dado</h3>
        {campaignId && (
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className={cn(
              "p-1.5 rounded-md text-ink-faded hover:text-primary transition-colors",
              historyOpen && "text-primary bg-primary/10",
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
            className="p-1.5 rounded-md text-ink-faded hover:text-foreground transition-colors"
            title="Chiudi"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {groups.length > 1 && (
              <button
                onClick={() => removeGroup(g.id)}
                className="text-destructive hover:opacity-80 ml-auto p-1"
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

      {/* Modificatore */}
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

      <div className="text-center font-script italic text-sm text-ink-faded break-all">
        Formula: <strong className="not-italic font-heading text-foreground">{expression}</strong>
      </div>

      {pendingBonusD20 ? (
        <Button onClick={performBonusD20} disabled={rolling} className="w-full font-heading">
          <RotateCw className="h-4 w-4 mr-1" />
          {rolling ? "Tiro in corso..." : "Ritira d20 e somma al totale"}
        </Button>
      ) : (
        <Button onClick={performRoll} disabled={rolling} className="w-full font-heading">
          <Dices className="h-4 w-4 mr-1" />
          {rolling ? "Tiro in corso..." : "Tira"}
        </Button>
      )}

      {lastResult && (
        <div
          className={`text-center py-3 rounded border border-border bg-parchment-deep/30 ${
            rolling ? "animate-roll-die" : "animate-fade-up"
          }`}
        >
          <div className="font-script text-xs text-ink-faded uppercase tracking-wider">
            {lastResult.expression}
            {lastResult.bonusRolls && lastResult.bonusRolls.length > 0 && (
              <> + {lastResult.bonusRolls.map(() => `d20`).join(" + ")}</>
            )}
          </div>
          <div className="font-display text-3xl sm:text-4xl gold-text">{displayedTotal}</div>
          <div className="font-script text-xs text-ink-faded mt-1 break-words px-2">
            {lastResult.dice.map((d, i) => (
              <span key={i}>
                {i > 0 && " + "}
                <span title={`d${d.sides}`}>{d.value}</span>
              </span>
            ))}
            {lastResult.modifier !== 0 && (
              <> {lastResult.modifier > 0 ? "+" : "−"} {Math.abs(lastResult.modifier)}</>
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

      {/* Cronologia */}
      {campaignId && historyOpen && (
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-heading text-sm uppercase tracking-wider text-ink-faded">
              Cronologia (15 gg)
            </h4>
            <span className="text-xs font-script italic text-ink-faded">{history.length} tiri</span>
          </div>
          {history.length === 0 ? (
            <p className="font-script italic text-xs text-ink-faded text-center py-4">
              Nessun tiro recente.
            </p>
          ) : (
            <ScrollArea className="max-h-64 pr-2">
              <ul className="space-y-1.5">
                {history.map((row) => (
                  <li
                    key={row.id}
                    className="text-xs bg-parchment-deep/20 border border-border/50 rounded px-2 py-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-heading truncate">
                        {row.character_name || row.user_display_name || "Anonimo"}
                      </span>
                      <span className="font-script italic text-[10px] text-ink-faded shrink-0">
                        {new Date(row.created_at).toLocaleString("it-IT", {
                          day: "2-digit", month: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="font-script text-ink-faded">
                      {row.expression} →{" "}
                      <strong className="text-primary not-italic">{row.total}</strong>
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

/**
 * Wrapper responsive del DiceRoller usato nelle pagine di scheda:
 * - desktop: pannello sticky in sidebar
 * - mobile: FAB in basso a sinistra che si espande a tutto schermo
 */
interface DockProps {
  campaignId?: string;
  characterId?: string;
  characterName?: string;
}

export const DiceRollerDock = (props: DockProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return (
      <div className="lg:sticky lg:top-20">
        <DiceRoller {...props} />
      </div>
    );
  }

  return (
    <>
      {/* FAB in basso a sinistra */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Apri tiri di dado"
        >
          <Dices className="h-6 w-6" />
        </button>
      )}

      {/* Popup espanso a tutto schermo */}
      {open && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Dices className="h-5 w-5 text-primary" />
              <span className="font-heading text-lg">Tiri di dado</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-md text-ink-faded hover:text-foreground"
                aria-label="Riduci"
                title="Riduci"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-md text-ink-faded hover:text-foreground"
                aria-label="Chiudi"
                title="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <DiceRoller {...props} variant="embedded" />
          </div>
        </div>
      )}
    </>
  );
};

// Re-export icons usati altrove se servono
export { ChevronUp };
