import { Loader2, Save, Skull } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CharacterDestinyPanelProps {
  canManageDestiny: boolean;
  isDead: boolean;
  deathDescription: string;
  diedAt: string;
  saving?: boolean;
  onIsDeadChange: (value: boolean) => void;
  onDeathDescriptionChange: (value: string) => void;
  onDiedAtChange: (value: string) => void;
  onSave: () => void;
}

export function CharacterDestinyPanel({
  canManageDestiny,
  isDead,
  deathDescription,
  diedAt,
  saving = false,
  onIsDeadChange,
  onDeathDescriptionChange,
  onDiedAtChange,
  onSave,
}: CharacterDestinyPanelProps) {
  if (!canManageDestiny) return null;

  return (
    <section className="parchment-panel p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Skull className="h-5 w-5 text-primary" />
        <h3 className="font-display text-xl gold-text">Destino del personaggio</h3>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 p-3">
          <input type="checkbox" checked={isDead} onChange={(event) => onIsDeadChange(event.target.checked)} />
          <div>
            <p className="font-heading text-sm text-ink">Personaggio deceduto</p>
            <p className="text-xs text-ink-faded">Segna la scheda come conclusa e spostabile nel cimitero narrativo.</p>
          </div>
        </label>

        {isDead ? (
          <>
            <div>
              <Label htmlFor="destinyDate" className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                Data della morte
              </Label>
              <Input id="destinyDate" type="date" value={diedAt} onChange={(event) => onDiedAtChange(event.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="destinyDescription" className="font-heading text-xs uppercase tracking-wider text-ink-faded">
                Descrizione della morte
              </Label>
              <Textarea
                id="destinyDescription"
                value={deathDescription}
                onChange={(event) => onDeathDescriptionChange(event.target.value)}
                rows={5}
                placeholder="Racconta l'ultima impresa, la caduta o il sacrificio finale del personaggio."
                className="mt-1 font-script"
              />
            </div>
          </>
        ) : null}

        <div className="flex justify-end border-t border-border/40 pt-3">
          <Button size="sm" onClick={onSave} disabled={saving} className="font-heading" variant={isDead ? 'destructive' : 'default'}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 h-4 w-4" /> Salva destino</>}
          </Button>
        </div>
      </div>
    </section>
  );
}
