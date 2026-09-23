/**
 * Un champ de saisie de séance qui laisse **taper** la valeur qu'on veut dire — MUSCU-FIX02, passe 2.
 *
 * ── Le défaut qu'il corrige ─────────────────────────────────────────────────────────────────────
 * Les champs de séance sont contrôlés : chaque frappe est parsée, stockée, puis ré-affichée depuis
 * la valeur stockée. Or une saisie **en cours** n'est pas encore un nombre : « 82, » se parse en
 * rien (`parseNumberLoose` exige un chiffre après le séparateur), le champ se vidait, et taper
 * « 136,5 » donnait au mieux « 1365 ». Une décimale était donc impossible à saisir.
 *
 * Le champ garde ici le **texte tapé** tant qu'il dit la même valeur que ce qui est stocké
 * (`sameValue`). Dès que la valeur change d'ailleurs — un appui sur − / +, la série suivante —
 * c'est la valeur stockée qui s'affiche à nouveau. Rien ne change pour le parent : il reçoit
 * toujours le texte brut à chaque frappe.
 */

import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Le texte tapé et le texte affiché disent-ils la même valeur ? Voir `sameNumber`. */
  sameValue?: (typed: string, shown: string) => boolean;
};

/** Lit un nombre en cours de saisie : virgule ou point, séparateur final toléré (« 82, »). */
function readNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.').replace(/\.$/, '');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Même nombre, à l'arrondi d'affichage près : le champ affiche une décimale, donc « 82,25 » tapé et
 * « 82.3 » ré-affiché disent la même charge.
 */
export function sameNumber(typed: string, shown: string): boolean {
  const a = readNumber(typed);
  const b = readNumber(shown);
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= 0.05 + 1e-9;
}

/** Lit une durée « m:ss » ou en secondes, comme `parseMmSs` de l'écran de séance. */
function readSeconds(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (trimmed.includes(':')) {
    const [m = '', s = ''] = trimmed.split(':');
    return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
  }
  const n = parseInt(trimmed, 10);
  return Number.isNaN(n) ? null : n;
}

/** Même durée — « 1:3 » tapé et « 1:03 » ré-affiché le sont, comme « 90 » et « 1:30 ». */
export function sameDuration(typed: string, shown: string): boolean {
  return readSeconds(typed) === readSeconds(shown);
}

export function DraftNumberInput({
  value,
  onChangeText,
  sameValue = sameNumber,
  onBlur,
  ...rest
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null && sameValue(draft, value) ? draft : value;

  return (
    <TextInput
      {...rest}
      value={shown}
      onChangeText={(text) => {
        setDraft(text);
        onChangeText(text);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
