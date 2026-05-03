import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { NoteRecord } from './types';

interface CharacterNotesPanelProps {
  notes: NoteRecord[];
  canCreate: boolean;
  noteTitle: string;
  noteContent: string;
  noteDate: string;
  submitting?: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSubmit: () => void;
  onDelete: (id: string) => void;
}

export function CharacterNotesPanel({
  notes,
  canCreate,
  noteTitle,
  noteContent,
  noteDate,
  submitting = false,
  onTitleChange,
  onContentChange,
  onDateChange,
  onSubmit,
  onDelete,
}: CharacterNotesPanelProps) {
  return (
    <section className="parchment-panel p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl gold-text">Annotazioni di sessione</h3>
          <p className="text-sm text-ink-faded">Memorie, eventi e sviluppi importanti del personaggio.</p>
        </div>
      </div>

      {canCreate ? (
        <div className="mb-6 space-y-3 border-b border-border/40 pb-5">
          <div>
            <Label htmlFor="noteTitle" className="font-heading text-xs uppercase tracking-wider text-ink-faded">
              Titolo
            </Label>
            <Input id="noteTitle" value={noteTitle} onChange={(event) => onTitleChange(event.target.value)} className="mt-1" />
          </div>

          <div>
            <Label htmlFor="noteDate" className="font-heading text-xs uppercase tracking-wider text-ink-faded">
              Data sessione
            </Label>
            <Input id="noteDate" type="date" value={noteDate} onChange={(event) => onDateChange(event.target.value)} className="mt-1" />
          </div>

          <div>
            <Label htmlFor="noteContent" className="font-heading text-xs uppercase tracking-wider text-ink-faded">
              Contenuto
            </Label>
            <Textarea
              id="noteContent"
              value={noteContent}
              onChange={(event) => onContentChange(event.target.value)}
              rows={5}
              className="mt-1 font-script"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={onSubmit} disabled={submitting} className="font-heading">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Aggiungi nota
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-ink-faded">Nessuna annotazione presente.</p>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="rounded-lg border border-border/50 bg-background/40 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-heading text-base text-ink">{note.title}</h4>
                  <p className="text-xs uppercase tracking-wider text-ink-faded">
                    {note.session_date || 'Data non indicata'}
                  </p>
                </div>
                {canCreate ? (
                  <Button variant="ghost" size="icon" onClick={() => onDelete(note.id)} aria-label={`Elimina nota ${note.title}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap font-script text-sm text-ink-faded">{note.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
