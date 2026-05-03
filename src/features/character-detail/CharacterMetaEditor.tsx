import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CharacterMetaEditorProps {
  canEdit: boolean;
  name: string;
  concept: string;
  onNameChange: (value: string) => void;
  onConceptChange: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
  ownerName?: string | null;
}

export function CharacterMetaEditor({
  canEdit,
  name,
  concept,
  onNameChange,
  onConceptChange,
  onSave,
  saving = false,
  ownerName,
}: CharacterMetaEditorProps) {
  if (!canEdit) {
    return (
      <div className="mb-5 flex flex-col gap-2">
        <h2 className="font-display text-2xl gold-text sm:text-3xl">{name}</h2>
        {concept ? <p className="font-script italic text-ink-faded">{concept}</p> : null}
        {ownerName ? <p className="text-sm text-ink-faded">Proprietario: {ownerName}</p> : null}
      </div>
    );
  }

  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="h-auto rounded-none border-0 border-b border-border bg-transparent px-0 py-1 font-display text-2xl gold-text focus-visible:border-primary focus-visible:ring-0 sm:text-3xl"
        />
        <Input
          value={concept}
          onChange={(event) => onConceptChange(event.target.value)}
          placeholder="Concetto, origine, tratto distintivo..."
          className="mt-2 h-auto rounded-none border-0 border-b border-border/70 bg-transparent px-0 py-1 font-script italic text-ink-faded focus-visible:border-primary focus-visible:ring-0"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button onClick={onSave} disabled={saving} className="font-heading">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvataggio...' : 'Salva scheda'}
        </Button>
      </div>
    </div>
  );
}
