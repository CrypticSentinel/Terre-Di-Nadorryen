import { useState, type CSSProperties, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LabelOverride {
  text?: string;
  size?: number; // font-size in px
}

interface EditableLabelProps {
  /** Default text shown when no override is set */
  defaultText: string;
  /** Current override (if any) */
  override?: LabelOverride;
  /** Called when admin saves changes */
  onChange: (next: LabelOverride | undefined) => void;
  /** Whether admin editing is enabled */
  canCustomize: boolean;
  className?: string;
  as?: "span" | "div" | "label" | "h1" | "h2" | "h3" | "h4";
  /** Render extra children inline (e.g. asterisks) */
  children?: ReactNode;
}

/**
 * Renders a piece of label text. If `canCustomize` is true (admin), a small
 * pencil button appears on hover that opens a popover where the admin can
 * change both the displayed text and its font-size.
 *
 * The `override` is meant to be persisted by the parent (e.g. inside
 * `custom_fields` of a character) so the customisation is shared with all
 * users that view the same record.
 */
export const EditableLabel = ({
  defaultText,
  override,
  onChange,
  canCustomize,
  className,
  as = "span",
  children,
}: EditableLabelProps) => {
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState(override?.text ?? defaultText);
  const [draftSize, setDraftSize] = useState<string>(
    override?.size ? String(override.size) : "",
  );

  const Tag = as as any;
  const text = override?.text?.trim() ? override.text : defaultText;
  const style: CSSProperties = override?.size ? { fontSize: `${override.size}px`, lineHeight: 1.15 } : {};

  const openEditor = () => {
    setDraftText(override?.text ?? defaultText);
    setDraftSize(override?.size ? String(override.size) : "");
    setOpen(true);
  };

  const save = () => {
    const sizeNum = Number(draftSize);
    const next: LabelOverride = {};
    if (draftText.trim() && draftText.trim() !== defaultText) next.text = draftText.trim();
    if (Number.isFinite(sizeNum) && sizeNum > 0) next.size = Math.round(sizeNum);
    onChange(Object.keys(next).length ? next : undefined);
    setOpen(false);
  };

  const reset = () => {
    onChange(undefined);
    setOpen(false);
  };

  if (!canCustomize) {
    return (
      <Tag className={className} style={style}>
        {text}
        {children}
      </Tag>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group/edit max-w-full">
      <Tag className={cn(className, "min-w-0")} style={style}>
        {text}
        {children}
      </Tag>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={openEditor}
            className="opacity-0 group-hover/edit:opacity-100 focus:opacity-100 transition-opacity text-primary hover:text-primary/80 shrink-0"
            title="Personalizza testo e dimensione (admin)"
            aria-label="Personalizza etichetta"
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
            <Label className="font-heading text-xs uppercase tracking-wider">
              Dimensione (px)
            </Label>
            <Input
              type="number"
              min={8}
              max={96}
              value={draftSize}
              onChange={(e) => setDraftSize(e.target.value)}
              placeholder="auto"
            />
            <p className="text-[11px] font-script italic text-ink-faded">
              Lascia vuoto per usare la dimensione predefinita.
            </p>
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={reset} className="font-heading">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Ripristina
            </Button>
            <Button size="sm" onClick={save} className="font-heading">
              Salva
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
};
