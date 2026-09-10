/**
 * US MUSCU-UX01 — la **barre d'action collante** de l'écran de séance.
 *
 * ── Le défaut qu'elle corrige ────────────────────────────────────────────────────────────────────
 * `CurrentSetCard` empilait onze blocs — nom, rang, note, cinq chips de type, échauffement,
 * superset, dernière fois, suggestion, reps, charge, prévu et écart, réglage de repos, RPE — et
 * **finissait** par « Valider la série ». Environ 560 px au niveau détaillé, sur un écran utile de
 * 700 à 760 : le geste répété 30 à 40 fois par séance était le dernier de la pile, sous le pli. Et
 * dès qu'on saisissait les reps, le clavier le recouvrait (`adjustResize`, aucun
 * `KeyboardAvoidingView`).
 *
 * Ici, la saisie et la validation sont **fixées en bas**, au-dessus du clavier. Le reste — le
 * contexte — remonte dans la zone scrollable.
 *
 * ── Règle R4-1 : le niveau d'affichage ne touche JAMAIS cette barre ──────────────────────────────
 * `simplified`, `normal` et `detailed` pilotent la zone scrollable, rien d'autre. C'est ce qui rend
 * le changement de niveau sans risque : quel que soit le réglage, le geste est au même endroit,
 * avec la même forme. Un utilisateur qui bascule en « Détaillée » ne perd pas ses repères moteurs.
 *
 * ── Règle R4 : deux champs, des unités qui suivent le type de série ─────────────────────────────
 * La disposition ne change pas ; ce sont les unités qui changent, et le second champ devient
 * facultatif quand le type le permet (bordure pointillée) :
 *
 *   normal · dropset · failure · warmup → reps × charge (kg)
 *   duration                            → durée (m:ss) × lest (optionnel)
 *   bodyweight                          → reps × lest (optionnel)
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SetType } from '@wellness/shared';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';

/** Un champ de la barre : ce qu'il vaut, ce qu'il mesure, comment on l'incrémente. */
type FieldSpec = {
  value: string;
  /** Libellé court sous la valeur (REPS, KG, DURÉE, LEST). */
  unit: string;
  onChange: (value: string) => void;
  onStep: (delta: number) => void;
  /** Incrément d'un appui sur − / +. */
  step: number;
  keyboardType: 'number-pad' | 'decimal-pad' | 'default';
  /** Champ facultatif : bordure pointillée, valeur vide admise. */
  optional?: boolean;
  a11yLabel: string;
};

type Props = {
  exerciseName: string;
  currentIndex: number;
  totalSets: number;
  setType: SetType;
  repsValue: string;
  onChangeReps: (value: string) => void;
  onStepReps: (delta: number) => void;
  weightValue: string;
  weightSymbol: string;
  onChangeWeight: (value: string) => void;
  onStepWeight: (deltaKg: number) => void;
  durationValue: string;
  onChangeDuration: (value: string) => void;
  onStepDuration: (deltaSeconds: number) => void;
  onValidate: () => void;
  /** Vrai quand la validation enchaîne sur le partenaire de superset, sans repos (règle R4-2). */
  chainsToSuperset: boolean;
  colors: Palette;
};

export function SetActionBar({
  exerciseName,
  currentIndex,
  totalSets,
  setType,
  repsValue,
  onChangeReps,
  onStepReps,
  weightValue,
  weightSymbol,
  onChangeWeight,
  onStepWeight,
  durationValue,
  onChangeDuration,
  onStepDuration,
  onValidate,
  chainsToSuperset,
  colors,
}: Props) {
  const { t } = useTranslation();

  const isDuration = setType === 'duration';
  // « Lest » et non « charge » : sur ces types, le poids du corps porte l'effort et le champ ne
  // reçoit qu'un complément — souvent rien du tout.
  const isAssisted = setType === 'duration' || setType === 'bodyweight';

  const primary: FieldSpec = isDuration
    ? {
        value: durationValue,
        unit: t('workout.durationLabel'),
        onChange: onChangeDuration,
        onStep: onStepDuration,
        step: 5,
        keyboardType: 'default', // « m:ss » n'est pas saisissable au pavé numérique
        a11yLabel: t('workout.durationLabel'),
      }
    : {
        value: repsValue,
        unit: t('workout.reps'),
        onChange: onChangeReps,
        onStep: onStepReps,
        step: 1,
        keyboardType: 'number-pad',
        a11yLabel: t('workout.reps'),
      };

  const secondary: FieldSpec = {
    value: weightValue,
    unit: isAssisted ? t('workout.addedWeightLabel') : weightSymbol,
    onChange: onChangeWeight,
    onStep: onStepWeight,
    step: 2.5,
    keyboardType: 'decimal-pad',
    optional: isAssisted,
    a11yLabel: isAssisted ? t('workout.addedWeightLabel') : t('workout.weight'),
  };

  const renderField = (field: FieldSpec) => (
    <View
      style={[
        styles.field,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderStyle: field.optional ? 'dashed' : 'solid',
        },
      ]}
    >
      <StepButton
        icon="remove"
        colors={colors}
        label={t('workout.stepDown', { field: field.a11yLabel })}
        onPress={() => {
          hapticSelect();
          field.onStep(-field.step);
        }}
      />
      <View style={styles.fieldCore}>
        <TextInput
          value={field.value}
          onChangeText={field.onChange}
          keyboardType={field.keyboardType}
          accessibilityLabel={field.a11yLabel}
          placeholder={field.optional ? '—' : undefined}
          placeholderTextColor={colors.textMuted}
          style={[styles.fieldInput, { color: colors.text }]}
          // Le clavier ne doit pas fermer la barre : elle est ce qui reste atteignable.
          blurOnSubmit={false}
        />
        <Text style={[styles.fieldUnit, { color: colors.textMuted }]} numberOfLines={1}>
          {field.unit.toUpperCase()}
        </Text>
      </View>
      <StepButton
        icon="add"
        colors={colors}
        label={t('workout.stepUp', { field: field.a11yLabel })}
        onPress={() => {
          hapticSelect();
          field.onStep(field.step);
        }}
      />
    </View>
  );

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.borderStrong },
      ]}
    >
      {/* Le contexte vit ici, pas au-dessus : c'est ce qui rend la bascule superset lisible sans
          rien déplacer — le libellé change, le bouton reste sous le pouce. */}
      <View style={styles.contextRow}>
        <Text style={[styles.contextName, { color: colors.text }]} numberOfLines={1}>
          {exerciseName}
        </Text>
        <Text style={[styles.contextSet, { color: colors.textMuted }]}>
          {t('workout.setProgress', { current: currentIndex, total: totalSets })}
        </Text>
      </View>

      <View style={styles.fields}>
        {renderField(primary)}
        {renderField(secondary)}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onValidate}
        style={({ pressed }) => [
          styles.validate,
          { backgroundColor: colors.accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.validateLabel, { color: colors.accentText }]}>
          {chainsToSuperset ? t('workout.validateAndChain') : t('workout.validateSet')}
        </Text>
      </Pressable>
    </View>
  );
}

/** Bouton rond « − / + ». 38 × 44 : la hauteur tient la cible tactile, la largeur laisse la valeur. */
function StepButton({
  icon,
  onPress,
  colors,
  label,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  colors: Palette;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepBtn,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={17} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    // Décolle la barre du contenu qui défile dessous.
    shadowColor: '#33291f',
    shadowOpacity: 0.07,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  contextName: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  contextSet: { fontFamily: fontFamily.body, fontSize: 12 },
  fields: { flexDirection: 'row', gap: 10 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
  },
  fieldCore: { flex: 1, alignItems: 'center' },
  fieldInput: {
    fontFamily: fontFamily.monoBold,
    fontSize: 20,
    lineHeight: 24,
    padding: 0,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  fieldUnit: { fontFamily: fontFamily.bodySemi, fontSize: 9, letterSpacing: 0.5 },
  stepBtn: {
    width: 38,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validate: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateLabel: { fontFamily: fontFamily.bodyBold, fontSize: 17 },
  pressed: { opacity: 0.8 },
});
