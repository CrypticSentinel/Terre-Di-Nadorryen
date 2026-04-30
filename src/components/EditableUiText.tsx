import { useEffect, useId, useState } from "react";
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
import { Settings2, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface EditableUiTextProps {
  textKey: string;
  defaultText: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export const EditableUiText = ({
  textKey,
  defaultText,
  className = "",
  as = "span",
}: EditableUiTextProps) => {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultText);
  const [savedText, setSavedText] = useState(defaultText);
  const labelId = useId();
  const inputId = `${labelId}-input`;
  const Tag = as as any;

  useEffect(() => {
    setValue(savedText);
  }, [savedText]);

  const handleSave = () => {
    const next = value.trim() || defaultText;
    setSavedText(next);
    setOpen(false);
  };

  const handleReset = () => {
    setValue(defaultText);
    setSavedText(defaultText);
    setOpen(false);
  };

  return (
    <span className="group inline-flex max-w-full items-center gap-2 align-middle">
      <Tag id={labelId} className={className}>
        {savedText}
      </Tag>

      {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 opacity-100 transition-opacity sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={`Modifica testo interfaccia ${savedText}`}
              aria-labelledby={labelId}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display gold-text">Modifica testo UI</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                Chiave: <strong>{textKey}</strong>
              </div>

              <div className="space-y-2">
                <Label htmlFor={inputId} className="font-heading">
                  Testo visualizzato
                </Label>
                <Input
                  id={inputId}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="min-h-11"
                  placeholder={defaultText}
                />
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
    </span>
  );
};
