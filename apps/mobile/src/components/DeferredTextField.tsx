/**
 * Champ de saisie qui n'enregistre **qu'à la sortie du champ** (US NUTRI-UX01, R6.1).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * Le profil nutritionnel branchait `onChangeText` directement sur `upsertNutritionProfile` :
 * taper « 2500 » produisait **quatre écritures** en base (2, 25, 250, 2500), chacune
 * re-synchronisée. Pire, la valeur affichée était relue depuis la base : effacer un champ de
 * macro écrivait un **0 affirmé** — et l'app distingue partout « nul » de « non renseigné ».
 *
 * Ici, la valeur vit **localement** pendant la frappe, et n'est remontée qu'au `blur`. La
 * resynchronisation externe n'a lieu que **hors focus** : sans cette garde, une écriture
 * concurrente (synchro PowerSync) remplacerait le texte sous le doigt de l'utilisateur.
 */

import { useEffect, useRef, useState } from 'react';
import type { TextInputProps } from 'react-native';
import { TextField } from '@/components/TextField';

type DeferredTextFieldProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  /** Valeur de référence (source de vérité), réappliquée quand le champ n'a pas le focus. */
  value: string;
  /** Appelé une seule fois, à la sortie du champ, si le texte a changé. */
  onCommit: (value: string) => void;
};

export function DeferredTextField({
  label,
  value,
  onCommit,
  onFocus,
  onBlur,
  ...inputProps
}: DeferredTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  // Suit la source de vérité **uniquement hors focus** : pendant la frappe, l'utilisateur est
  // maître du champ. C'est ce qui évite le curseur qui saute et le texte réécrit à mi-saisie.
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <TextField
      {...inputProps}
      label={label}
      value={draft}
      onChangeText={setDraft}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        // Rien à écrire si le texte n'a pas bougé : évite une écriture par simple passage.
        if (draft !== value) onCommit(draft);
        onBlur?.(e);
      }}
    />
  );
}
