/**
 * « Ta journée » — le journal d'un jour, pour l'onglet Aujourd'hui et pour la page d'un jour passé
 * (US NUTRI-UX03 ; carte unique de NUTRI-UX02 R4).
 *
 * Une carte, les repas en sections, la section « Autres » (entrées orphelines, sans ajout), l'eau en
 * une ligne. Le détail d'une entrée, sa suppression et l'enregistrement d'un repas type vivent ici :
 * ce sont les mêmes gestes sur les deux écrans.
 *
 * Ce qui diffère selon le jour :
 *  - **aujourd'hui** : « Comme hier » sur un repas vide (R4), les repas prévus avec « J'ai mangé ça »
 *    (R6), « Copier toute la journée d'hier » au pied d'une journée vide ;
 *  - **un jour passé** : « Aujourd'hui » sur chaque repas rempli configuré (R10). Pas sur « Autres » :
 *    la copie irait dans un repas qui n'existe plus.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PlannedMealEntry } from '@wellness/shared';
import { HydrationCard } from '@/components/nutrition/HydrationCard';
import { SaveTemplateSheet } from '@/components/nutrition/SaveTemplateSheet';
import {
  moveEntry,
  reassignEntryMeal,
  removeEntry,
  type JournalEntry,
} from '@/data/repositories/journal-repository';
import { saveMealAsTemplate } from '@/data/repositories/meal-template-repository';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import type { MealOption } from '@/hooks/useMealList';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { EntryDetailModal } from './EntryDetailModal';
import { MealSection } from './MealSection';

type Props = {
  day: string;
  entries: JournalEntry[];
  mealList: MealOption[];
  onAdd: (mealKey: string) => void;
  /** Aujourd'hui — les entrées de la veille, pour « Comme hier ». */
  yesterdayEntries?: JournalEntry[];
  onLikeYesterday?: (mealKey: string) => void;
  /** Aujourd'hui — pied « Copier toute la journée d'hier », quand la journée est vide. */
  onCopyYesterday?: () => void;
  /** Aujourd'hui — les repas prévus non portés au journal. */
  planned?: readonly PlannedMealEntry[];
  onEatPlanned?: (entry: PlannedMealEntry) => void;
  /** Jour passé — reprendre un repas sur aujourd'hui. */
  onRedoToday?: (mealKey: string) => void;
  redoneMeals?: ReadonlySet<string>;
  /** Libellé TalkBack de « Aujourd'hui » ; `done` = le repas vient d'être repris. */
  redoA11y?: (mealLabel: string, done: boolean) => string;
};

export function DayJournal({
  day,
  entries,
  mealList,
  onAdd,
  yesterdayEntries,
  onLikeYesterday,
  onCopyYesterday,
  planned = [],
  onEatPlanned,
  onRedoToday,
  redoneMeals,
  redoA11y,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const kcal = useKcalFormat();

  // Détail d'une entrée (4.34) : appui = consultation, balayage « Modifier » = édition directe.
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  // R5 — le repas dont on enregistre un repas type (nom obligatoire).
  const [templateMeal, setTemplateMeal] = useState<MealOption | null>(null);

  const dayKcal = entries.reduce((s, e) => s + e.kcal, 0);
  const configuredKeys = useMemo(() => new Set(mealList.map((m) => m.key)), [mealList]);
  // Entrées « orphelines » : leur repas n'existe plus dans la config. Surfacées dans « Autres ».
  const orphanEntries = entries.filter((e) => !configuredKeys.has(e.mealType));
  const templateEntries = templateMeal ? entries.filter((e) => e.mealType === templateMeal.key) : [];

  const yesterdayByMeal = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of yesterdayEntries ?? []) m.set(e.mealType, (m.get(e.mealType) ?? 0) + e.kcal);
    return m;
  }, [yesterdayEntries]);

  const onDeleteEntry = (entry: JournalEntry) => {
    Alert.alert(entry.name, t('journal.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('journal.delete'),
        style: 'destructive',
        // Écriture offline-first : sans `catch`, un échec remonterait en rejet non capturé.
        onPress: () => void removeEntry(entry.id).catch(() => undefined),
      },
    ]);
  };

  const saveTemplate = (name: string) => {
    const items = templateEntries.map((e) => ({
      foodId: e.foodId,
      name: e.name,
      quantityG: e.quantityG,
      kcal: e.kcal,
      proteinG: e.proteinG,
      carbsG: e.carbsG,
      fatG: e.fatG,
    }));
    setTemplateMeal(null);
    void saveMealAsTemplate(name, items)
      .then(() => Alert.alert(t('journal.templateSaved'), name))
      // 🔴 L'alerte est une CONFIRMATION : la taire sur échec est voulu — annoncer « enregistré »
      // alors que l'écriture a échoué serait pire que se taire.
      .catch(() => undefined);
  };

  // Réordonnancement (4.34) : les voisins se comptent DANS le repas, pas dans la journée.
  const detailSiblings = detailEntry ? entries.filter((e) => e.mealType === detailEntry.mealType) : [];
  const detailIdx = detailEntry ? detailSiblings.findIndex((e) => e.id === detailEntry.id) : -1;

  return (
    <>
      <View
        testID="day-journal"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.text }]}>{t('journal.dayCard.title')}</Text>
          {entries.length > 0 ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t('journal.dayCard.meta', { count: entries.length, kcal: dayKcal })}
            </Text>
          ) : null}
        </View>

        {mealList.map((m) => {
          const mealEntries = entries.filter((e) => e.mealType === m.key);
          const yesterdayKcal = yesterdayByMeal.get(m.key);
          return (
            <MealSection
              key={m.key}
              mealKey={m.key}
              mealLabel={m.label}
              dayKcal={dayKcal}
              entries={mealEntries}
              onAdd={() => onAdd(m.key)}
              onDeleteEntry={onDeleteEntry}
              onSelectEntry={(e) => {
                setDetailEntry(e);
                setDetailEditing(false);
              }}
              onEditEntry={(e) => {
                setDetailEntry(e);
                setDetailEditing(true);
              }}
              onSaveTemplate={() => setTemplateMeal(m)}
              likeYesterday={
                onLikeYesterday && mealEntries.length === 0 && yesterdayKcal != null
                  ? { kcal: yesterdayKcal, onPress: () => onLikeYesterday(m.key) }
                  : undefined
              }
              planned={planned.filter((p) => p.mealKey === m.key)}
              onEatPlanned={onEatPlanned}
              redoToday={
                onRedoToday && mealEntries.length > 0
                  ? {
                      done: redoneMeals?.has(m.key) ?? false,
                      a11y: redoA11y ? redoA11y(m.label, redoneMeals?.has(m.key) ?? false) : m.label,
                      onPress: () => onRedoToday(m.key),
                    }
                  : undefined
              }
            />
          );
        })}

        {/* Section « Autres » : entrées dont le repas n'existe plus. 🔴 Toujours **sans ajout** ni
            reprise : on ne crée rien dans un repas qui n'existe plus, on en sort par réaffectation. */}
        {orphanEntries.length > 0 ? (
          <MealSection
            key="__orphan__"
            mealKey="__orphan__"
            mealLabel={t('journal.meals.other')}
            dayKcal={dayKcal}
            entries={orphanEntries}
            onDeleteEntry={onDeleteEntry}
            onSelectEntry={(e) => {
              setDetailEntry(e);
              setDetailEditing(false);
            }}
            onEditEntry={(e) => {
              setDetailEntry(e);
              setDetailEditing(true);
            }}
          />
        ) : null}

        {onCopyYesterday ? (
          <Pressable
            onPress={onCopyYesterday}
            accessibilityRole="button"
            style={[styles.copyDay, { borderTopColor: colors.border }]}
          >
            <Ionicons name="copy-outline" size={16} color={colors.accent} />
            <Text style={[styles.copyDayLabel, { color: colors.accent }]}>{t('journal.copyDayYesterday')}</Text>
          </Pressable>
        ) : null}

        {/* R5.2 — l'eau : un tap, aucune saisie. En une ligne depuis NUTRI-UX02. */}
        <View style={[styles.hydration, { borderTopColor: colors.border }]}>
          <HydrationCard day={day} compact />
        </View>
      </View>

      <EntryDetailModal
        entry={detailEntry}
        startEditing={detailEditing}
        onClose={() => {
          setDetailEntry(null);
          setDetailEditing(false);
        }}
        onMoveUp={detailIdx > 0 ? () => void moveEntry(detailEntry!.id, 'up').catch(() => undefined) : undefined}
        onMoveDown={
          detailIdx >= 0 && detailIdx < detailSiblings.length - 1
            ? () => void moveEntry(detailEntry!.id, 'down').catch(() => undefined)
            : undefined
        }
        meals={mealList}
        onReassign={(entryId, mealKey) => {
          void reassignEntryMeal(entryId, mealKey).catch(() => undefined);
          setDetailEntry(null);
          setDetailEditing(false);
        }}
      />

      <SaveTemplateSheet
        meal={
          templateMeal
            ? {
                label: templateMeal.label,
                count: templateEntries.length,
                kcal: kcal(templateEntries.reduce((s, e) => s + e.kcal, 0)),
              }
            : null
        }
        onCancel={() => setTemplateMeal(null)}
        onSave={saveTemplate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 11 },
  title: { flex: 1, fontFamily: fontFamily.displayBold, fontSize: 17 },
  meta: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  copyDay: { minHeight: 48, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  copyDayLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  hydration: { borderTopWidth: 1 },
});
