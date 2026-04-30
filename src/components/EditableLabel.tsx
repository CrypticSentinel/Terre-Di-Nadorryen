import { useState, type CSSProperties, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LabelOverride {
  text?: string;
  size?: number;
}

interface EditableLabelProps {
  defaultText: string;
  override?: LabelOverride;
  onChange: (next: LabelOverride | undefined) => void;
  canCustomize: boolean;
  className?: string;
  as?: "span" | "div" | "label" | "h1" | "h2" | "h3" | "h4";
  children?: ReactNode;
}

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

  const style: CSSProperties = override?.size
    ? { fontSize: `${override.size}px`, lineHeight: 1.15 }
    : {};

  const syncDraftFromProps = () => {
    setDraftText(override?.text ?? defaultText);
    setDraftSize(override?.size ? String(override.size) : "");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      syncDraftFromProps();
    } else {
      syncDraftFromProps();
    }
    setOpen(nextOpen);
  };

  const save = () => {
    const sizeNum = Number(draftSize);
    const next: LabelOverride = {};

    if (draftText.trim() && draftText.trim() !== defaultText) {
      next.text = draftText.trim();
    }

    if (Number.isFinite(sizeNum) && sizeNum > 0) {
      next.size = Math.round(sizeNum);
    }

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
    <span className="group/edit inline-flex max-w-full items-center gap-1 align-middle">
      <Tag className={cn(className, "min-w-0")} style={style}>
        {text}
        {children}
      </Tag>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              "text-primary transition-colors hover:bg-primary/10 hover:text-primary/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "opacity-100 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover/edit:opacity-100 sm:focus:opacity-100"
            )}
            title="Personalizza etichetta"
            aria-label={`Personalizza etichetta ${defaultText}`}
            aria-expanded={open}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[min(22rem,calc(100vw-2rem))] space-y-3"
          align="start"
          sideOffset={8}
        >
          <div className="space-y-1">
            <Label className="font-heading text-xs uppercase tracking-wider">
              Testo
            </Label>
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

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              className="font-heading"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Ripristina
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={save}
              className="font-heading"
            >
              Salva
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
};