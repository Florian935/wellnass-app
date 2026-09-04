/**
 * Sélecteur d'heure `HH:MM` en **pur JS** — US HORAIRE-01 (roadmap 2.4).
 *
 * ── Pourquoi pas un date-picker natif ───────────────────────────────────────────────────────────
 * Le dépôt n'a **aucune** dépendance de date-picker, et `settings.tsx` a déjà résolu le même besoin
 * en pur JS (`HourStepper`, US NUTR-F1). Ajouter `@react-native-community/datetimepicker` pour un
 * seul champ imposerait un module natif de plus à un build dont la publication est déjà le chemin
 * critique — pour une valeur que deux paires de boutons rendent aussi bien.
 *
 * ── Ce qui change par rapport à `HourStepper` ───────────────────────────────────────────────────
 * Les **minutes**. Une échéance de rappel se règle à l'heure ronde (« vers 20 h ») ; une séance
 * commence à 18 h 30. Le pas de 5 minutes est un compromis assumé : assez fin pour coller à un
 * créneau réel, assez grossier pour ne pas demander douze appuis.
 *
 * Les deux steppers **bouclent** (23 → 0, 55 → 00) : c'est ce qui évite un cul-de-sac quand on
 * dépasse la valeur voulue, sans avoir à écrire de bornes.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Pas des minutes, en minutes. */
export const MINUTE_STEP = 5;

/** Formate en `HH:MM` — le format stocké, et celui affiché. */
export const formatTime = (hour: number, minute: number): string =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/**
 * Découpe un `HH:MM` ou `HH:MM:SS` en `{ hour, minute }`.
 *
 * Une valeur absente ou illisible retombe sur **18 h 00** plutôt que sur minuit : c'est l'heure de
 * séance la plus plausible, et proposer 00 h 00 par défaut obligerait presque tout le monde à
 * remonter de 18 crans.
 */
export function parseTime(value: string | null): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? '');
  if (match === null) return { hour: 18, minute: 0 };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return { hour: 18, minute: 0 };
  // Aligne sur le pas : une valeur venue d'un autre appareil peut être à 18 h 07.
  return { hour, minute: Math.round(minute / MINUTE_STEP) * MINUTE_STEP % 60 };
}

type Props = {
  /** Heure courante, `HH:MM` / `HH:MM:SS`, ou `null` (retombe sur 18 h 00). */
  value: string | null;
  onChange: (next: string) => void;
};

export function TimeStepper({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { hour, minute } = parseTime(value);

  const set = (h: number, m: number) => onChange(formatTime(h, m));

  return (
    <View style={styles.row}>
      <Unit
        label={t('planning.hours')}
        display={String(hour).padStart(2, '0')}
        onDecrease={() => set((hour + 23) % 24, minute)}
        onIncrease={() => set((hour + 1) % 24, minute)}
        decreaseLabel={t('planning.decreaseHour')}
        increaseLabel={t('planning.increaseHour')}
      />
      <Text style={[styles.colon, { color: colors.text }]}>:</Text>
      <Unit
        label={t('planning.minutes')}
        display={String(minute).padStart(2, '0')}
        onDecrease={() => set(hour, (minute + 60 - MINUTE_STEP) % 60)}
        onIncrease={() => set(hour, (minute + MINUTE_STEP) % 60)}
        decreaseLabel={t('planning.decreaseMinute')}
        increaseLabel={t('planning.increaseMinute')}
      />
    </View>
  );
}

/** Une colonne − / valeur / + . Boutons **étiquetés** : sans libellé, ils s'annoncent « − ». */
function Unit({
  label,
  display,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
}: {
  label: string;
  display: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.unit}>
      <Text style={[styles.unitLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.stepper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Pressable
          onPress={onDecrease}
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          hitSlop={8}
          style={styles.btn}
        >
          <Text style={[styles.sign, { color: colors.accent }]}>−</Text>
        </Pressable>
        <Text style={[styles.val, { color: colors.text, borderColor: colors.border }]}>{display}</Text>
        <Pressable
          onPress={onIncrease}
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          hitSlop={8}
          style={styles.btn}
        >
          <Text style={[styles.sign, { color: colors.accent }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  unit: { alignItems: 'center' },
  unitLabel: { fontFamily: fontFamily.body, fontSize: 11, marginBottom: 4 },
  colon: { fontFamily: fontFamily.bodySemi, fontSize: 20, marginBottom: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10 },
  // 44 dp : cible tactile minimale (CONF-07, WCAG AA).
  btn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sign: { fontFamily: fontFamily.bodySemi, fontSize: 20 },
  val: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 17,
    minWidth: 46,
    textAlign: 'center',
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
});
