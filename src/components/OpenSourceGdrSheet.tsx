import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Plus, Trash2, Sparkles } from "lucide-react";

export const EMPTY_OSGDR_SHEET = {
  abilities: { for: 0, agi: 0, int: 0, per: 0, con: 0, wil: 0 },
  magic: {},
  ferite: { current: 0, max: 0 },
  equipment: { weapons: "", armor: "", notes: "" },
  note: "",
  skills: [],
};

export function normalizeOsgdrSheet(value: any) {
  return {
    ...EMPTY_OSGDR_SHEET,
    ...(value ?? {}),
    abilities: { ...EMPTY_OSGDR_SHEET.abilities, ...(value?.abilities ?? {}) },
    ferite: { ...EMPTY_OSGDR_SHEET.ferite, ...(value?.ferite ?? {}) },
    equipment: { ...EMPTY_OSGDR_SHEET.equipment, ...(value?.equipment ?? {}) },
    skills: Array.isArray(value?.skills) ? value.skills : [],
    magic: value?.magic && typeof value.magic === "object" ? value.magic : {},
  };
}

export type OsgdrSheet = typeof EMPTY_OSGDR_SHEET;
export type LabelOverride = { text?: string; size?: number };

export function OpenSourceGdrSheet({
  value,
  onChange,
  canEdit,
  labelOverrides,
  canCustomizeLabels,
  onLabelOverrideChange,
  assignedUserId,
  onAssignedUserIdChange,
}: any) {
  const sheet = useMemo(() => normalizeOsgdrSheet(value), [value]);
  const abilityKeys = Object.keys(sheet.abilities);
  const hasSkills = Array.isArray(sheet.skills) && sheet.skills.length > 0;

  const setSheet = (patch: any) => onChange({ ...sheet, ...patch });
  const setAbility = (key: string, raw: string) => setSheet({ abilities: { ...sheet.abilities, [key]: Number(raw) || 0 } });
  const setMagic = (key: string, raw: string) => setSheet({ magic: { ...sheet.magic, [key]: Number(raw) || 0 } });

  const addSkill = () => setSheet({ skills: [...sheet.skills, "Nuova abilità"] });
  const updateSkill = (idx: number, raw: string) => setSheet({ skills: sheet.skills.map((s: string, i: number) => (i === idx ? raw : s)) });
  const removeSkill = (idx: number) => setSheet({ skills: sheet.skills.filter((_: string, i: number) => i !== idx) });

  return (
    <section className="osgdr-sheet space-y-4 w-full max-w-full overflow-x-hidden">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="parchment-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg gold-text">Caratteristiche</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {abilityKeys.map((k) => (
              <div key={k} className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                <Label className="text-xs uppercase tracking-wider text-foreground/80">{k.toUpperCase()}</Label>
                {canEdit ? (
                  <Input value={sheet.abilities[k]} onChange={(e) => setAbility(k, e.target.value)} className="min-h-11 w-full text-base" inputMode="numeric" />
                ) : (
                  <div className="font-heading text-lg">{sheet.abilities[k]}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="parchment-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg gold-text">Ferite e magia</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                <Label className="text-xs uppercase tracking-wider text-foreground/80">Ferite attuali</Label>
                {canEdit ? <Input value={sheet.ferite.current} onChange={(e) => setSheet({ ferite: { ...sheet.ferite, current: Number(e.target.value) || 0 } })} className="min-h-11 w-full text-base" inputMode="numeric" /> : <div className="font-heading text-lg">{sheet.ferite.current}</div>}
              </div>
              <div className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                <Label className="text-xs uppercase tracking-wider text-foreground/80">Ferite max</Label>
                {canEdit ? <Input value={sheet.ferite.max} onChange={(e) => setSheet({ ferite: { ...sheet.ferite, max: Number(e.target.value) || 0 } })} className="min-h-11 w-full text-base" inputMode="numeric" /> : <div className="font-heading text-lg">{sheet.ferite.max}</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.keys(sheet.magic || {}).length === 0 && canEdit && (
                <Button variant="outline" className="min-h-11 w-full" onClick={() => setSheet({ magic: { arcane: 0, divine: 0, primal: 0 } })}>
                  Inizializza magia
                </Button>
              )}
              {Object.entries(sheet.magic || {}).map(([k, v]: any) => (
                <div key={k} className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                  <Label className="text-xs uppercase tracking-wider text-foreground/80">{k}</Label>
                  {canEdit ? <Input value={v} onChange={(e) => setMagic(k, e.target.value)} className="min-h-11 w-full text-base" inputMode="numeric" /> : <div className="font-heading text-lg">{v}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="parchment-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-display text-lg gold-text">Equipaggiamento</h3>
            <Badge variant="outline" className="ml-auto text-xs">Scheda mobile</Badge>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-foreground/80">Armi</Label>
              {canEdit ? <Textarea value={sheet.equipment.weapons} onChange={(e) => setSheet({ equipment: { ...sheet.equipment, weapons: e.target.value } })} className="min-h-24 w-full text-base" /> : <p className="whitespace-pre-wrap font-script">{sheet.equipment.weapons}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-foreground/80">Armatura</Label>
              {canEdit ? <Textarea value={sheet.equipment.armor} onChange={(e) => setSheet({ equipment: { ...sheet.equipment, armor: e.target.value } })} className="min-h-24 w-full text-base" /> : <p className="whitespace-pre-wrap font-script">{sheet.equipment.armor}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-foreground/80">Note</Label>
              {canEdit ? <Textarea value={sheet.equipment.notes} onChange={(e) => setSheet({ equipment: { ...sheet.equipment, notes: e.target.value } })} className="min-h-24 w-full text-base" /> : <p className="whitespace-pre-wrap font-script">{sheet.equipment.notes}</p>}
            </div>
          </div>
        </div>

        <div className="parchment-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display text-lg gold-text">Abilità</h3>
            {canEdit && <Button variant="outline" size="sm" className="min-h-11" onClick={addSkill}><Plus className="h-4 w-4 mr-1" />Aggiungi</Button>}
          </div>
          <div className="space-y-2">
            {hasSkills ? sheet.skills.map((s: string, i: number) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center">
                {canEdit ? <Input value={s} onChange={(e) => updateSkill(i, e.target.value)} className="min-h-11 w-full" /> : <div className="flex-1 font-script">{s}</div>}
                {canEdit && <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => removeSkill(i)} aria-label="Rimuovi abilità"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            )) : <p className="py-4 text-sm italic text-muted-foreground">Nessuna abilità inserita.</p>}
          </div>
        </div>
      </div>

      <div className="parchment-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2 flex-col sm:flex-row sm:items-center">
          <h3 className="font-display text-lg gold-text">Assegnazione</h3>
          {assignedUserId && <Badge variant="outline" className="text-xs">Assegnata</Badge>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wider text-foreground/80">User ID assegnato</Label>
            {canEdit ? (
              <Input
                value={assignedUserId ?? ""}
                onChange={(e) => onAssignedUserIdChange?.(e.target.value || undefined)}
                className="min-h-11 w-full text-base"
                placeholder="ID utente"
              />
            ) : (
              <div className="font-script">{assignedUserId ?? "Non assegnata"}</div>
            )}
          </div>
          {canEdit && (
            <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => onAssignedUserIdChange?.(undefined)}>
              Sgancia
            </Button>
          )}
        </div>
      </div>

      <div className="parchment-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg gold-text">Note finali</h3>
          {canCustomizeLabels && <Badge variant="outline" className="text-xs">Label custom</Badge>}
        </div>
        <div className="space-y-2">
          <Textarea
            value={sheet.note ?? ""}
            onChange={(e) => setSheet({ note: e.target.value })}
            className="min-h-28 w-full text-base"
            placeholder="Annotazioni libere, descrizioni, richiami di regole..."
          />
        </div>
      </div>
    </section>
  );
}
