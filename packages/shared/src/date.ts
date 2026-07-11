/** Clé de jour local AAAA-MM-JJ (pour agréger séances/courses UTC et journées nutrition/poids locales). */
export function localDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
