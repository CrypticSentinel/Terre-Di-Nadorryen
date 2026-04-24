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
