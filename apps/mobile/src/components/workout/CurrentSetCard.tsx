import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SetType, WorkoutDisplayLevel } from '@wellness/shared';
import { workoutFieldVisibility } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useUnits } from '@/hooks/useUnits';
import type { Palette } from '@/theme/colors';

/**
 * Types de série exposés dans le sélecteur (C2). `warmup` est traité à part
 * (raccourci 🔥) et `superset` n'est plus un choix de ce sélecteur depuis la
 * recette C3 (20/07/2026, retour Florian « pas intuitif ») : la liaison
 * superset passe désormais par une action dédiée nommant le partenaire
 * (voir bloc « Superset » plus bas), pas par un type abstrait à toggler
 * séparément des deux côtés.
 */
const TYPE_CHIPS: SetType[] = ['normal', 'dropset', 'failure', 'duration', 'bodyweight'];

/**
 * État de la liaison superset de la série courante, dérivé par le parent.
 * `'linkable'` : l'exercice n'est lié à aucun partenaire pour l'instant, mais
 * d'autres exercices sont disponibles dans la séance (choix libre via
 * dialogue — révision 20/07/2026, remplace l'ancienne contrainte d'adjacence).
 */
export type SupersetLinkState =
  | { status: 'linkable' }
  | { status: 'linked'; partnerName: string }
  | { status: 'orphaned' }
  | null;

/** Valeurs de RPE proposées (échelle 1-10). */
const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type CurrentSetCardProps = {
  exerciseName: string;
  /** Rang de la série dans l'exercice (1-based). */
  currentIndex: number;
  totalSets: number;
  /** Ligne « dernière fois » déjà formatée, ou `null` pour la masquer. */
  lastPerfLabel: string | null;
  /**
   * Ligne de suggestion de progression (C3), déjà entièrement formatée par le
   * parent (le parent choisit le texte i18n selon `ProgressionSuggestion.kind`
   * et formate l'unité — cette carte reste une simple présentation). `null`/
   * absente = aucune suggestion à afficher. Optionnelle : tant que `workout.tsx`
   * (Task 11, hors périmètre C3-Task9) ne la calcule pas encore, elle reste
   * masquée sans casser l'appelant existant.
   */
  suggestionLabel?: string | null;
  /**
   * Note de l'exercice (C3, persistée par exercice — hors périmètre de la
   * série). `undefined` = non câblée par le parent (champ masqué, cf. Task 11) ;
   * `null`/`''` = câblée mais vide (champ visible, contrairement au RPE qui est
   * masqué par défaut).
   */
  note?: string | null;
  onChangeNote?: (value: string) => void;
  onBlurNote?: () => void;
  /**
   * État de la liaison superset de la série courante (C3, revu 20/07/2026) :
   * `'linkable'` = un exercice adjacent a une série au même rang, pas encore
   * liée → propose l'action « Lier » ; `'linked'` = déjà liée à un partenaire
   * nommé → propose « Délier » ; `'orphaned'` = marquée superset mais plus de
   * partenaire adjacent (ex. après une réorganisation) → repos redevenu
   * normal, affiché explicitement plutôt que silencieusement. `null`/absente
   * = rien à afficher (pas de voisin éligible, type non-superset).
   */
  supersetLink?: SupersetLinkState;
  /** Ouvre le dialogue de choix du partenaire (n'importe quel exercice de la séance). */
  onRequestLinkSuperset?: () => void;
  onUnlinkSuperset?: () => void;
  /** Type de la série courante ; pilote la saisie adaptée et le sélecteur. */
  setType: SetType;
  onSetType: (t: SetType) => void;
  repsValue: string;
  onChangeReps: (value: string) => void;
  weightValue: string;
  weightSymbol: string;
  weightPlaceholder: string;
  onChangeWeight: (value: string) => void;
  /** Incrément (kg) appliqué à la charge sous-jacente via les steppers. */
  onStepWeight: (deltaKg: number) => void;
  /** Charge planifiée (snapshot du plan, kg) ou `null` si séance libre. */
  plannedWeightKg: number | null;
  /** Durée affichée « m:ss » (série de type `duration`). */
  durationValue: string;
  onChangeDuration: (value: string) => void;
  /** Incrément (s) appliqué à la durée via les steppers. */
  onStepDuration: (deltaSeconds: number) => void;
  /** RPE de la série (1-10) ou `null`. Persisté immédiatement par le parent. */
  rpe: number | null;
  onSetRpe: (rpe: number | null) => void;
  restSeconds: number;
  /** Incrément (s) appliqué au repos de l'exercice via le mini stepper. */
  onStepRest: (deltaSeconds: number) => void;
  /** Fixe la durée de repos de l'exercice (saisie manuelle en secondes). */
  onSetRest: (seconds: number) => void;
  onValidate: () => void;
  colors: Palette;
  /** Niveau d'affichage de l'utilisateur (MUSC-F13) : pilote la densité des suppléments. */
  level: WorkoutDisplayLevel;
};

/** Petit bouton rond « − / + » réutilisé par les steppers. */
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
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepBtn,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/**
 * Carte « série en cours » du flux guidé (C1 + enrichissements C2). Composant
 * présentational : l'état d'édition et les mutations (updateSet, repos) sont
 * gérés par le parent. Seul l'état d'ouverture du sélecteur RPE est local.
 */
export function CurrentSetCard({
  exerciseName,
  currentIndex,
  totalSets,
  lastPerfLabel,
  suggestionLabel,
  note,
  onChangeNote,
  onBlurNote,
  supersetLink,
  onRequestLinkSuperset,
  onUnlinkSuperset,
  setType,
  onSetType,
  repsValue,
  onChangeReps,
  weightValue,
  weightSymbol,
  weightPlaceholder,
  onChangeWeight,
  onStepWeight,
  plannedWeightKg,
  durationValue,
  onChangeDuration,
  onStepDuration,
  rpe,
  onSetRpe,
  restSeconds,
  onStepRest,
  onSetRest,
  onValidate,
  colors,
  level,
}: CurrentSetCardProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const vis = workoutFieldVisibility(level);

  // Sélecteur RPE : masqué par défaut (peu utilisé), déplié au tap sur « ＋ RPE ».
  const [rpeOpen, setRpeOpen] = useState(false);

  // Indicateur « ça défile » sur la rangée de types (recette Florian, 20/07/2026) :
  // fondu + chevron tant qu'il reste du contenu à droite, masqué en fin de scroll.
  const [typeContainerWidth, setTypeContainerWidth] = useState(0);
  const [typeContentWidth, setTypeContentWidth] = useState(0);
  const [typeScrollX, setTypeScrollX] = useState(0);
  const canScrollTypesRight =
    typeContentWidth > typeContainerWidth + 4 &&
    typeScrollX < typeContentWidth - typeContainerWidth - 4;

  // Types « au poids de corps » / « à la durée » → le champ charge devient un
  // lest optionnel (placeholder vide autorisé) ; sinon charge classique.
  const isLest = setType === 'duration' || setType === 'bodyweight';
  const isDuration = setType === 'duration';
  const warmupActive = setType === 'warmup';

  // Écart charge réalisée vs planifiée, calculé en unité d'affichage.
  const plannedDisplay = plannedWeightKg == null ? null : units.weightInputValue(plannedWeightKg);
  const realized = weightValue.trim() === '' ? null : Number(weightValue);
  const deltaRounded =
    plannedDisplay != null && realized != null && !Number.isNaN(realized)
      ? Math.round((realized - Number(plannedDisplay)) * 10) / 10
      : null;

  const renderChip = (type: SetType) => {
    const active = setType === type;
    return (
      <Pressable
        key={type}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => onSetType(type)}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: active ? colors.accent : colors.surfaceAlt },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.chipText, { color: active ? colors.accentText : colors.textMuted }]}>
          {t(`workout.setType.${type}`)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
      <Text style={[styles.exName, { color: colors.text }]}>{exerciseName}</Text>
      <Text style={[styles.progress, { color: colors.textMuted }]}>
        {t('workout.setProgress', { current: currentIndex, total: totalSets })}
      </Text>

      {/* Note d'exercice (C3) : visible dès que câblée par le parent, mais
          gatée par le niveau d'affichage (MUSC-F13 — réservée au niveau
          « detailed »). */}
      {vis.note && note !== undefined ? (
        <View style={[styles.noteRow, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={styles.noteIcon}>📝</Text>
          <TextInput
            value={note ?? ''}
            onChangeText={onChangeNote}
            onBlur={onBlurNote}
            placeholder={t('workout.exerciseNote.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.noteInput, { color: colors.text }]}
          />
        </View>
      ) : null}

      {/* Sélecteur de type : chips scrollables (fondu + chevron tant qu'il reste du
          contenu à droite) + raccourci 🔥 fixé à droite. Niveaux différents
          (MUSC-F13) : le conteneur n'est rendu que si au moins un des deux est
          visible ; chaque partie est ensuite gatée individuellement. */}
      {vis.typeSelector || vis.warmupShortcut ? (
        <View style={styles.typeRow}>
          {vis.typeSelector ? (
            <View style={styles.typeScrollWrap} onLayout={(e) => setTypeContainerWidth(e.nativeEvent.layout.width)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onContentSizeChange={(w) => setTypeContentWidth(w)}
                onScroll={(e) => setTypeScrollX(e.nativeEvent.contentOffset.x)}
                style={styles.typeScroll}
                contentContainerStyle={styles.typeScrollContent}
              >
                {TYPE_CHIPS.map(renderChip)}
              </ScrollView>
              {canScrollTypesRight ? (
                <LinearGradient
                  pointerEvents="none"
                  colors={['transparent', colors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.typeFade}
                >
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </LinearGradient>
              ) : null}
            </View>
          ) : null}
          {vis.warmupShortcut ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: warmupActive }}
              onPress={() => onSetType(warmupActive ? 'normal' : 'warmup')}
              style={({ pressed }) => [
                styles.chip,
                styles.warmupChip,
                { backgroundColor: warmupActive ? colors.accent : colors.surfaceAlt },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: warmupActive ? colors.accentText : colors.textMuted }]}>
                {`🔥 ${t('workout.warmupToggle')}`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Liaison superset (C3, revue 20/07/2026) : une action nommée plutôt qu'un
          type abstrait à toggler des deux côtés séparément. Réservée au niveau
          « detailed » (MUSC-F13). */}
      {vis.superset ? (
        supersetLink?.status === 'linkable' ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRequestLinkSuperset}
            style={({ pressed }) => [
              styles.supersetBtn,
              { borderColor: colors.accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.supersetLinkText, { color: colors.accent }]}>
              {`🔗 ${t('workout.superset.link')}`}
            </Text>
          </Pressable>
        ) : supersetLink?.status === 'linked' ? (
          <View style={styles.supersetRow}>
            <Text style={[styles.supersetLinkedText, { color: colors.accent }]}>
              {`🔗 ${t('workout.superset.linked', { name: supersetLink.partnerName })}`}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={6} onPress={onUnlinkSuperset}>
              <Text style={[styles.supersetUnlink, { color: colors.textMuted }]}>
                {t('workout.superset.remove')}
              </Text>
            </Pressable>
          </View>
        ) : supersetLink?.status === 'orphaned' ? (
          <View style={styles.supersetRow}>
            <Text style={[styles.supersetOrphanText, { color: colors.accent }]}>
              {`⚠️ ${t('workout.superset.orphaned')}`}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={6} onPress={onUnlinkSuperset}>
              <Text style={[styles.supersetUnlink, { color: colors.textMuted }]}>
                {t('workout.superset.remove')}
              </Text>
            </Pressable>
          </View>
        ) : null
      ) : null}

      {lastPerfLabel ? (
        <Text style={[styles.lastPerf, { color: colors.textMuted }]}>
          {t('workout.lastTime', { perf: lastPerfLabel })}
        </Text>
      ) : null}

      {/* Suggestion de progression (C3) : purement informative, jamais tappable
          (pas de Pressable) — le texte est déjà entièrement formaté par le parent.
          Visible à partir du niveau « normal » (MUSC-F13). */}
      {vis.suggestion && suggestionLabel ? (
        <Text style={[styles.suggestion, { color: colors.success }]}>{`💡 ${suggestionLabel}`}</Text>
      ) : null}

      <View style={styles.fields}>
        {isDuration ? (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('workout.durationLabel')}</Text>
            <View style={styles.weightRow}>
              <StepButton icon="remove" label="-5s" colors={colors} onPress={() => onStepDuration(-5)} />
              <TextInput
                value={durationValue}
                onChangeText={onChangeDuration}
                accessibilityLabel={t('workout.durationLabel')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  styles.weightInput,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                ]}
              />
              <StepButton icon="add" label="+5s" colors={colors} onPress={() => onStepDuration(5)} />
            </View>
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('workout.reps')}</Text>
            <TextInput
              value={repsValue}
              onChangeText={onChangeReps}
              keyboardType="number-pad"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {isLest ? `${t('workout.addedWeightLabel')} (${t('workout.optional')})` : `${t('workout.weight')} (${weightSymbol})`}
          </Text>
          <View style={styles.weightRow}>
            <StepButton icon="remove" label="-2.5" colors={colors} onPress={() => onStepWeight(-2.5)} />
            <TextInput
              value={weightValue}
              onChangeText={onChangeWeight}
              placeholder={isLest ? '' : weightPlaceholder}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                styles.weightInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
            />
            <StepButton icon="add" label="+2.5" colors={colors} onPress={() => onStepWeight(2.5)} />
          </View>

          {plannedDisplay != null ? (
            <View style={styles.plannedRow}>
              <Text style={[styles.planned, { color: colors.textMuted }]}>
                {t('workout.plannedWeight', { weight: `${plannedDisplay} ${weightSymbol}` })}
              </Text>
              {vis.delta && deltaRounded != null ? (
                deltaRounded === 0 ? (
                  <Text style={[styles.delta, { color: colors.textMuted, backgroundColor: colors.surfaceAlt }]}>=</Text>
                ) : deltaRounded > 0 ? (
                  <Text style={[styles.delta, { color: colors.success, backgroundColor: colors.surfaceAlt }]}>
                    {`▲ +${Math.abs(deltaRounded)}`}
                  </Text>
                ) : (
                  <Text style={[styles.delta, { color: colors.accent, backgroundColor: colors.surfaceAlt }]}>
                    {`▼ −${Math.abs(deltaRounded)}`}
                  </Text>
                )
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.restControl}>
        <Text style={[styles.restCaption, { color: colors.textMuted }]}>{t('workout.restTitle')}</Text>
        <StepButton icon="remove" label="-15s" colors={colors} onPress={() => onStepRest(-15)} />
        <View style={styles.restInputWrap}>
          <TextInput
            value={String(restSeconds)}
            onChangeText={(v) => {
              const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
              onSetRest(Number.isNaN(n) ? 0 : n);
            }}
            keyboardType="number-pad"
            accessibilityLabel={t('workout.restTitle')}
            style={[styles.restInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
          <Text style={[styles.restUnit, { color: colors.textMuted }]}>s</Text>
        </View>
        <StepButton icon="add" label="+15s" colors={colors} onPress={() => onStepRest(15)} />
      </View>

      {/* RPE par série (C2) : masqué derrière « ＋ RPE » ; déplié = sélection 1-10.
          Réservé au niveau « detailed » (MUSC-F13). */}
      {vis.rpe ? (
      <View style={styles.rpeBlock}>
        {rpeOpen ? (
          <View style={[styles.rpeOpen, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.rpeOpenLabel, { color: colors.textMuted }]}>{t('workout.rpeLabel')}</Text>
            <View style={styles.rpePills}>
              {RPE_VALUES.map((n) => {
                const active = rpe === n;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      onSetRpe(n);
                      setRpeOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.rpePill,
                      {
                        backgroundColor: active ? colors.accent : colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.rpePillText, { color: active ? colors.accentText : colors.textMuted }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : rpe != null ? (
          <View style={styles.rpeSetRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRpeOpen(true)}
              style={({ pressed }) => [styles.rpeChip, { backgroundColor: colors.surfaceAlt }, pressed && styles.pressed]}
            >
              <Text style={[styles.rpeChipText, { color: colors.accent }]}>{t('workout.rpeValue', { value: rpe })}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => onSetRpe(null)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={[styles.rpeClear, { color: colors.textMuted }]}>{t('workout.rpeClear')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setRpeOpen(true)}
            style={({ pressed }) => [styles.rpeAddBtn, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.rpeAddText, { color: colors.textMuted }]}>
              {t('workout.rpeAdd')} <Text style={styles.rpeAddOptional}>{`(${t('workout.optional')})`}</Text>
            </Text>
          </Pressable>
        )}
      </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onValidate}
        style={({ pressed }) => [styles.validate, { backgroundColor: colors.accent }, pressed && styles.pressed]}
      >
        <Text style={[styles.validateLabel, { color: colors.accentText }]}>{t('workout.validateSet')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 2, padding: 20, gap: 12 },
  exName: { fontFamily: fontFamily.displaySemi, fontSize: 22, letterSpacing: -0.4 },
  progress: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeScrollWrap: { flex: 1, position: 'relative' },
  typeScroll: { flex: 1 },
  typeScrollContent: { gap: 6, alignItems: 'center', paddingRight: 4 },
  // Fondu + chevron indiquant que la rangée défile encore vers la droite.
  typeFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  warmupChip: { flexShrink: 0 },
  lastPerf: { fontFamily: fontFamily.body, fontSize: 14 },
  suggestion: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  supersetBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 4,
  },
  supersetLinkText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  supersetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  supersetLinkedText: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  supersetOrphanText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, flexShrink: 1 },
  supersetUnlink: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  noteIcon: { fontSize: 12 },
  noteInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 12, padding: 0 },
  fields: { flexDirection: 'row', gap: 12, marginTop: 4 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  input: {
    fontFamily: fontFamily.body,
    fontSize: 18,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Padding horizontal réduit : les charges à virgule (ex. « 52.5 ») ne doivent pas
  // être tronquées dans un input étroit encadré par les deux steppers.
  weightInput: { flex: 1, paddingHorizontal: 4, minWidth: 0 },
  plannedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  planned: { fontFamily: fontFamily.body, fontSize: 12 },
  delta: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  restCaption: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  restInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restInput: {
    fontFamily: fontFamily.monoBold,
    fontSize: 16,
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  restUnit: { fontFamily: fontFamily.body, fontSize: 14 },
  rpeBlock: { alignItems: 'flex-start' },
  rpeAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  rpeAddText: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  rpeAddOptional: { fontFamily: fontFamily.body, fontSize: 12, opacity: 0.7 },
  rpeSetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rpeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  rpeChipText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  rpeClear: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  rpeOpen: { alignSelf: 'stretch', padding: 10, borderRadius: 12, gap: 8 },
  rpeOpenLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  rpePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rpePill: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpePillText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  validate: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  validateLabel: { fontFamily: fontFamily.bodyBold, fontSize: 17 },
  pressed: { opacity: 0.8 },
});
