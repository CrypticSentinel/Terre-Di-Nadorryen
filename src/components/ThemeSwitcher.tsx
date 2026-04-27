import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCENT_OPTIONS, STYLE_OPTIONS, useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export const ThemeSwitcher = () => {
  const { style, accent, setStyle, setAccent } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="font-heading" aria-label="Stile e colore">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-heading text-xs uppercase tracking-wider">Stile</DropdownMenuLabel>
        <div className="px-2 pb-2 grid grid-cols-3 gap-1">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-heading transition-colors",
                style === s.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-heading text-xs uppercase tracking-wider">Colore</DropdownMenuLabel>
        <div className="px-2 pb-2 flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAccent(a.value)}
              title={a.label}
              aria-label={a.label}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                accent === a.value ? "border-foreground scale-110" : "border-transparent hover:scale-105",
              )}
              style={{ background: a.preview }}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
