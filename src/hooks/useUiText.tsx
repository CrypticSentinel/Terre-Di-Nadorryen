import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UiTextOverride {
  text?: string | null;
  size?: number | null;
}

interface UiTextContextValue {
  overrides: Record<string, UiTextOverride>;
  setOverride: (key: string, override: UiTextOverride | null) => Promise<void>;
  loading: boolean;
}

const UiTextContext = createContext<UiTextContextValue | undefined>(undefined);

/**
 * Provider globale per i testi della UI. I valori sono persistiti nella tabella
 * `ui_text_overrides` (modificabili solo dall'admin via RLS) e propagati in
 * realtime a tutti i client.
 */
export const UiTextProvider = ({ children }: { children: ReactNode }) => {
  const [overrides, setOverrides] = useState<Record<string, UiTextOverride>>({});
  const [loading, setLoading] = useState(true);
  // teniamo traccia degli aggiornamenti ottimistici per non sovrascriverli
  // con dati realtime stantii
  const localStampsRef = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("ui_text_overrides")
      .select("key, text, size");
    if (!error && data) {
      const map: Record<string, UiTextOverride> = {};
      for (const row of data as { key: string; text: string | null; size: number | null }[]) {
        map[row.key] = { text: row.text, size: row.size };
      }
      setOverrides(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("ui-text-overrides")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ui_text_overrides" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const key = (payload.old as any)?.key as string | undefined;
            if (!key) return;
            setOverrides((prev) => {
              const { [key]: _omit, ...rest } = prev;
              return rest;
            });
          } else {
            const row = payload.new as { key: string; text: string | null; size: number | null };
            if (!row?.key) return;
            setOverrides((prev) => ({
              ...prev,
              [row.key]: { text: row.text, size: row.size },
            }));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setOverride = useCallback(async (key: string, override: UiTextOverride | null) => {
    localStampsRef.current[key] = Date.now();
    if (!override || (override.text == null && override.size == null)) {
      // ottimistico
      setOverrides((prev) => {
        const { [key]: _omit, ...rest } = prev;
        return rest;
      });
      const { error } = await supabase.from("ui_text_overrides").delete().eq("key", key);
      if (error) throw error;
      return;
    }
    const row = {
      key,
      text: override.text ?? null,
      size: override.size ?? null,
    };
    setOverrides((prev) => ({ ...prev, [key]: { text: row.text, size: row.size } }));
    const { error } = await supabase
      .from("ui_text_overrides")
      .upsert(row, { onConflict: "key" });
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({ overrides, setOverride, loading }),
    [overrides, setOverride, loading],
  );

  return <UiTextContext.Provider value={value}>{children}</UiTextContext.Provider>;
};

export const useUiText = () => {
  const ctx = useContext(UiTextContext);
  if (!ctx) throw new Error("useUiText must be used within UiTextProvider");
  return ctx;
};
