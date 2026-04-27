import { useState, type CSSProperties, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiText } from "@/hooks/useUiText";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EditableUiTextProps {
  /** Chiave globale univoca (es. "header.title") */
  textKey: string;
  /** Testo predefinito mostrato se non c'è override */
  defaultText: string;
  className?: string;
  as?: "span" | "div" | "label" | "h1" | "h2" | "h3" | "h4" | "p";
  children?: ReactNode;
}

/**
 * Etichetta UI globale modificabile dall'admin (impersonante admin).
 * Tutti gli altri utenti la vedono come testo statico.
 */
export const EditableUiText = ({
  textKey,
  defaultText,
  className,
  as = "span",
  children,
}: EditableUiTextProps) => {
  const { overrides, setOverride } = useUiText();
  const { isAdmin } = useAuth();
  const override = overrides[textKey];
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState<string>(override?.text ?? defaultText);
  const [draftSize, setDraftSize] = useState<string>(override?.size ? String(override.size) : "");
  const [saving, setSaving] = useState(false);

  const Tag = as as any;
  const text = override?.text && override.text.trim() ? override.text : defaultText;
  const style: CSSProperties = override?.size ? { fontSize: `${override.size}px`, lineHeight: 1.15 } : {};

  const openEditor = () => {
    setDraftText(override?.text ?? defaultText);
    setDraftSize(override?.size ? String(override.size) : "");
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const sizeNum = Number(draftSize);
      const payload = {
        text: draftText.trim() && draftText.trim() !== defaultText ? draftText.trim() : null,
        size: Number.isFinite(sizeNum) && sizeNum > 0 ? Math.round(sizeNum) : null,
      };
      if (payload.text == null && payload.size == null) {
        await setOverride(textKey, null);
      } else {
        await setOverride(textKey, payload);
      }
      toast.success("Testo aggiornato");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Errore aggiornamento testo");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await setOverride(textKey, null);
      toast.success("Testo ripristinato");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Errore ripristino testo");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Tag className={className} style={style}>
        {text}
        {children}
      </Tag>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group/edit-ui max-w-full align-baseline">
      <Tag className={cn(className, "min-w-0")} style={style}>
        {text}
        {children}
      </Tag>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={openEditor}
            className="opacity-0 group-hover/edit-ui:opacity-100 focus:opacity-100 transition-opacity text-primary hover:text-primary/80 shrink-0"
            title="Modifica testo (admin)"
            aria-label="Modifica testo UI"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="start">
          <div className="space-y-1">
            <Label className="font-heading text-xs uppercase tracking-wider">Testo</Label>
            <Input
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={defaultText}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="font-heading text-xs uppercase tracking-wider">Dimensione (px)</Label>
            <Input
              type="number"
              min={8}
              max={96}
              value={draftSize}
              onChange={(e) => setDraftSize(e.target.value)}
              placeholder="auto"
            />
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving} className="font-heading">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Ripristina
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="font-heading">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salva"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
};
