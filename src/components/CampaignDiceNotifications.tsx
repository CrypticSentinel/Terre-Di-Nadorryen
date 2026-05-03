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
                  <div className="w-[min(92vw,56rem)] rounded-2xl border-2 border-primary/35 bg-parchment-deep/95 px-6 py-5 text-foreground shadow-2xl backdrop-blur-md">
                    <div className="font-heading text-sm uppercase tracking-[0.24em] text-primary/80">
                      Lancio di dado
                    </div>

                    <div className="mt-2 font-display text-3xl gold-text sm:text-4xl">
                      {summary.actor}
                    </div>

                    {summary.player && (
                      <div className="mt-1 font-script text-base italic text-ink-faded sm:text-lg">
                        Giocatore: {summary.player}
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-border/60 bg-background/50 px-4 py-4 font-script text-lg leading-relaxed text-foreground sm:text-xl">
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