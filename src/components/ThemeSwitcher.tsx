import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuColorRadioItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCENT_OPTIONS, STYLE_OPTIONS, useTheme } from "@/hooks/useTheme";

export const ThemeSwitcher = () => {
  const { style, accent, setStyle, setAccent } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="font-heading" aria-label="Stile e colore">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-heading text-xs uppercase tracking-wider">
          Stile
        </DropdownMenuLabel>

        <DropdownMenuRadioGroup value={style} onValueChange={setStyle}>
          {STYLE_OPTIONS.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value} className="font-heading">
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="font-heading text-xs uppercase tracking-wider">
          Colore
        </DropdownMenuLabel>

        <DropdownMenuRadioGroup value={accent} onValueChange={setAccent}>
          {ACCENT_OPTIONS.map((a) => (
            <DropdownMenuColorRadioItem
              key={a.value}
              value={a.value}
              color={a.preview}
              label={a.label}
            />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};