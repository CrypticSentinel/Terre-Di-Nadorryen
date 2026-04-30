import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings2, Type, Check, X } from "lucide-react";

export interface LabelOverride {
  text?: string;
  size?: number;
}

interface EditableLabelProps {
  defaultText: string;
  override?: LabelOverride;
  onChange?: (override: LabelOverride | undefined) => void;
  canCustomize?: boolean;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export const EditableLabel = ({
  defaultText,
  override,
  onChange,
  canCustomize = false,
  className = "",
  as = "span",
}: EditableLabelProps) => {
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState(override?.text ?? defaultText);
  const [draftSize, setDraftSize] = useState<string>(override?.size ? String(override.size) : "");
  const elementId = useId();

  const resolvedText = useMemo(() => override?.text?.trim() || defaultText, [override?.text, defaultText]);
  const resolvedStyle = useMemo(
    () => (override?.size ? { fontSize: `${override.size}px` } : undefined),
    [override?.size],
  );

  const Tag = as as any;

  const resetDraft = () => {
    setDraftText(override?.text ?? defaultText);
    setDraftSize(override?.size ? String(override.size) : "");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) resetDraft();
  };

  const handleSave = () => {
    const nextText = draftText.trim();
    const nextSize = Number(draftSize);
    const normalized: LabelOverride = {};

    if (nextText && nextText !== defaultText) normalized.text = nextText;
    if (!Number.isNaN(nextSize) && nextSize > 0) normalized.size = nextSize;

    onChange?.(Object.keys(normalized).length ? normalized : undefined);
    setOpen(false);
  };

  const handleReset = () => {
    setDraftText(defaultText);
    setDraftSize("");
    onChange?.(undefined);
    setOpen(false);
  };

  return (
    <div className="group flex w-full items-start justify-between gap-2 sm:items-center">
      <Tag id={elementId} className={className} style={resolvedStyle}>
        {resolvedText}
      </Tag>

      {canCustomize && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 opacity-100 transition-opacity sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={`Modifica etichetta ${resolvedText}`}
              aria-labelledby={elementId}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display gold-text">Modifica etichetta</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${elementId}-text`} className="font-heading flex items-center gap-2">
                  <Type className="h-4 w-4" /> Testo
                </Label>
                <Input
                  id={`${elementId}-text`}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="min-h-11"
                  placeholder={defaultText}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${elementId}-size`} className="font-heading">Dimensione font</Label>
                <Input
                  id={`${elementId}-size`}
                  type="number"
                  inputMode="numeric"
                  min="10"
                  max="40"
                  step="1"
                  value={draftSize}
                  onChange={(e) => setDraftSize(e.target.value)}
                  className="min-h-11"
                  placeholder="Automatico"
                />
                <p className="text-xs italic text-muted-foreground">
                  Lascia vuoto per usare la dimensione predefinita.
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={handleReset}>
                <X className="mr-2 h-4 w-4" /> Ripristina
              </Button>
              <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={handleSave}>
                <Check className="mr-2 h-4 w-4" /> Salva
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
