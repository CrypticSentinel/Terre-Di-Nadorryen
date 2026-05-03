import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DiceRollRow {
  id: string;
  campaign_id: string;
  character_id: string | null;
  character_name: string | null;
  user_id: string;
  user_display_name: string | null;
  expression: string;
  total: number;
  message: string | null;
  created_at: string;
}

const formatRollSummary = (row: DiceRollRow) => {
  const actor = row.character_name || row.user_display_name || "Anonimo";
  const player =
    row.character_name && row.user_display_name
      ? row.user_display_name
      : null;

  const detail = row.message?.trim()
    ? row.message
    : `${row.expression} → ${row.total}`;

  return { actor, player, detail };
};

export const CampaignDiceNotifications = () => {
  const { user } = useAuth();
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    (async () => {
      const { data, error } = await supabase
        .from("campaign_members")
        .select("campaign_id")
        .eq("user_id", user.id);

      if (!mounted || error || !data) return;

      const campaignIds = [...new Set(data.map((row) => row.campaign_id).filter(Boolean))];

      for (const campaignId of campaignIds) {
        const channel = supabase
          .channel(`global-dice-rolls-${campaignId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "dice_rolls",
              filter: `campaign_id=eq.${campaignId}`,
            },
                                    (payload) => {
              const row = payload.new as DiceRollRow;
              if (seenIdsRef.current.has(row.id)) return;

              seenIdsRef.current.add(row.id);

              const summary = formatRollSummary(row);

              toast.custom(
                () => (
                  <div className="w-[min(90vw,42rem)] rounded-xl border border-primary/30 bg-parchment-deep/95 px-5 py-4 text-foreground shadow-xl backdrop-blur-md">
                    <div className="font-heading text-xs uppercase tracking-[0.2em] text-primary/80">
                      Lancio di dado
                    </div>

                    <div className="mt-2 font-display text-2xl gold-text sm:text-3xl">
                      {summary.actor}
                    </div>

                    {summary.player && (
                      <div className="mt-1 font-script text-sm italic text-ink-faded sm:text-base">
                        Giocatore: {summary.player}
                      </div>
                    )}

                    <div className="mt-3 rounded-lg border border-border/60 bg-background/45 px-4 py-3 font-script text-base leading-relaxed text-foreground sm:text-lg">
                      {summary.detail}
                    </div>
                  </div>
                ),
                {
                  duration: 10000,
                }
              );
            }
          )
          .subscribe();

        channels.push(channel);
      }
    })();

    return () => {
      mounted = false;
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user]);

  return null;
};

export default CampaignDiceNotifications;