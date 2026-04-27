// Identificatori canonici dei regolamenti supportati con form dedicato.
// Confrontiamo per nome (case-insensitive) per evitare di hardcodare l'UUID.

export const OPEN_SOURCE_GDR_NAME = "Open Source GDR";

export function isOpenSourceGdr(rulesetName?: string | null) {
  if (!rulesetName) return false;
  return rulesetName.trim().toLowerCase() === OPEN_SOURCE_GDR_NAME.toLowerCase();
}

// Modificatore D&D-style per punteggio caratteristica (1-20+)
export function abilityModifier(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Danno base di un incantesimo in base al grado nella scuola di magia.
 * Riferimento: https://crypticsentinel.github.io/Open-Source-GDR/Magia%20Libera/13%20-%20Tabella%20danni
 *  1-2 → +1, 3-4 → +2, 5-6 → +3, ..., 19-20 → +10
 */
export function magicBaseDamage(grade: number): number {
  if (!Number.isFinite(grade) || grade <= 0) return 0;
  const capped = Math.min(20, Math.max(1, Math.floor(grade)));
  return Math.ceil(capped / 2);
}
