/**
 * Les trois onglets du hub Bien-être — US BIEN-02.
 *
 * Même règle que les trois autres hubs (`hub-section.ts`, `run-hub-section.ts`,
 * `nutrition-section.ts`) : un paramètre de route valide (lien entrant), puis le dernier onglet choisi
 * pendant la vie de l'app, puis Aujourd'hui. Rien ne change d'onglet de force.
 *
 *  - **Aujourd'hui** — la forme du jour, ce que l'état change à la séance et à l'assiette, les deux
 *    check-ins, les suivis (douleurs, cycle, pas, poids) ;
 *  - **Journal** — le mois en couleurs par indicateur, les jours, ce que les piliers ont fait ;
 *  - **Ce qui compte** — ce qui pèse sur ton bien-être (intra-pilier), et l'écho du lien du Labo.
 */

export const WELLBEING_SECTIONS = ['today', 'journal', 'insights'] as const;
export type WellbeingSection = (typeof WELLBEING_SECTIONS)[number];

export function isWellbeingSection(value: unknown): value is WellbeingSection {
  return typeof value === 'string' && (WELLBEING_SECTIONS as readonly string[]).includes(value);
}

export function resolveWellbeingSection(input: { param: unknown; remembered: WellbeingSection | null }): WellbeingSection {
  if (isWellbeingSection(input.param)) return input.param;
  return input.remembered ?? 'today';
}
