/**
 * Un repas du journal, en **section** de la carte « Ta journée » (US NUTRI-UX02, R4).
 *
 * ── Ce que coûtait une carte par repas ───────────────────────────────────────────────────────────
 * Cinq cartes de ~150 px pour quatre lignes d'aliments — soit ~750 px de défilement, deux écrans de
 * pouce, dont l'essentiel est du contenant. Et la même phrase « + Ajouter un aliment » répétée cinq
 * fois, qui n'apprend rien la cinquième fois.
 *
 * La section n'a ni fond, ni bordure, ni bouton texte ; elle garde son en-tête, son menu, et **tout**
 * le comportement des lignes (balayage éditer/supprimer, appui détail). Le parent porte la carte.
 *
 * 🔴 Le `+` par repas est **conservé**, en icône dans l'en-tête. Le supprimer aurait forcé à passer
 * par la feuille, qui déduit le repas de l'heure courante (R2.6 de NUTRI-UX01) : noter son
 * petit-déjeuner à 20 h serait redevenu un parcours à corriger. On supprime la répétition, pas le
 * raccourci.
 *
 * ── US NUTRI-UX03 ────────────────────────────────────────────────────────────────────────────────
 *  - **« Comme hier »** sur un repas **vide** (R4). « Copier d'hier » vivait dans le ⋯, qui n'existe
 *    que sur un repas rempli : introuvable là où il servait, il doublait un repas plein. Il quitte
 *    le menu, qui ne garde qu'« Enregistrer comme repas type » (nom saisi, R5).
 *  - Les **repas prévus** du jour sous leur repas, avec « J'ai mangé ça » (R6).
 *  - Sur la page d'un jour passé, **« Aujourd'hui »** reprend ce repas sur aujourd'hui (R10).
 *  - Un repas vide n'est plus un seul bouton : « Comme hier » et « + Ajouter » y cohabitent, et
 *    chacun doit rester atteignable par TalkBack.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PlannedMealEntry } from '@wellness/shared';
import { MealGlyph } from '@/components/nutrition/CategoryGlyph';
import type { JournalEntry } from '@/data/repositories/journal-repository';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  mealKey: string;
  mealLabel: string;
  entries: JournalEntry[];
  /** Total calorique du jour, pour la part que ce repas représente. 0 = pas de barre. */
  dayKcal?: number;
  /** Ajout d'un aliment. Absent pour la section « Autres » (récupération seule). */
  onAdd?: () => void;
  onDeleteEntry: (e: JournalEntry) => void;
  onSelectEntry: (e: JournalEntry) => void;
  onEditEntry: (e: JournalEntry) => void;
  /** Menu ⋯ : « Enregistrer comme repas type ». Absent = pas de menu. */
  onSaveTemplate?: () => void;
  /** R4 — la veille a ce repas : « Comme hier » sur le repas vide. */
  likeYesterday?: { kcal: number; onPress: () => void };
  /** R6 — les entrées du planning de ce repas, non encore portées au journal. */
  planned?: readonly PlannedMealEntry[];
  onEatPlanned?: (entry: PlannedMealEntry) => void;
  /** R10 — page d'un jour passé : reprendre ce repas sur aujourd'hui. */
  redoToday?: { done: boolean; a11y: string; onPress: () => void };
};

export function MealSection({
  mealKey,
  mealLabel,
  entries,
  dayKcal = 0,
  onAdd,
  onDeleteEntry,
  onSelectEntry,
  onEditEntry,
  onSaveTemplate,
  likeYesterday,
  planned = [],
  onEatPlanned,
  redoToday,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const kcal = useKcalFormat();
  const mealKcal = entries.reduce((s, e) => s + e.kcal, 0);
  // Menu du repas : replié par défaut. Une action secondaire n'a pas à occuper l'en-tête de chacun
  // des 3 à 6 repas de la journée.
  const [menuOpen, setMenuOpen] = useState(false);
  const empty = entries.length === 0;

  const plannedLines = planned.map((p) => (
    <View
      key={p.id}
      testID={`planned-${p.id}`}
      style={[styles.planned, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
    >
      <View style={styles.plannedTexts}>
        <Text style={[styles.plannedEyebrow, { color: colors.accent }]}>{t('nutritionHub.planned.eyebrow')}</Text>
        <Text style={[styles.plannedName, { color: colors.text }]} numberOfLines={2}>
          {p.label}
        </Text>
        <Text style={[styles.plannedMeta, { color: colors.textMuted }]}>
          {t('nutritionHub.planned.meta', { kcal: kcal(p.kcal) })}
        </Text>
      </View>
      {onEatPlanned ? (
        <Pressable
          onPress={() => onEatPlanned(p)}
          accessibilityRole="button"
          accessibilityLabel={t('nutritionHub.planned.eatA11y', { name: p.label, meal: mealLabel })}
          style={[styles.eat, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.eatLabel, { color: colors.accentText }]}>{t('nutritionHub.planned.eat')}</Text>
        </Pressable>
      ) : null}
    </View>
  ));

  /*
   * Un repas vide est une **ligne de section discrète** (passe 2 de NUTRI-UX02), pas un cadre
   * pointillé : posé au milieu d'une carte unique, un cadre se lit comme un bouton d'action.
   */
  if (empty && onAdd) {
    return (
      <View style={[styles.mealSection, { borderTopColor: colors.border }]}>
        <View style={styles.mealHead}>
          <MealGlyph mealKey={mealKey} />
          <Text style={[styles.mealName, { color: colors.textMuted }]} numberOfLines={1}>
            {mealLabel}
          </Text>
          {likeYesterday ? (
            <Pressable
              onPress={likeYesterday.onPress}
              accessibilityRole="button"
              accessibilityLabel={t('nutritionHub.likeYesterdayA11y', { meal: mealLabel, kcal: kcal(likeYesterday.kcal) })}
              // 34 px dessinés + 6 px de part et d'autre : la cible reste à 46 px (R13).
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={[styles.likeYesterday, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
            >
              <Ionicons name="refresh" size={13} color={colors.accent} />
              <Text style={[styles.likeYesterdayLabel, { color: colors.accent }]}>{t('nutritionHub.likeYesterday')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={`${mealLabel} · ${t('journal.addFood')}`}
            hitSlop={8}
            style={styles.emptyAdd}
          >
            <Text style={[styles.mealEmptyAdd, { color: colors.accent }]}>+ {t('journal.add')}</Text>
          </Pressable>
        </View>
        {plannedLines}
      </View>
    );
  }

  // US NUTRI-UX02 — la part du jour que pèse ce repas (NUTR-16 rendue là où la décision se prend).
  const mealShare = dayKcal > 0 ? Math.round((mealKcal / dayKcal) * 100) : null;

  return (
    <View style={[styles.mealSection, { borderTopColor: colors.border }]}>
      <View style={styles.mealHead}>
        <MealGlyph mealKey={mealKey} />
        <Text style={[styles.mealName, { color: empty ? colors.textMuted : colors.text }]} numberOfLines={1}>
          {mealLabel}
        </Text>
        {!empty ? (
          <Text style={[styles.mealKcal, { color: colors.textMuted }]}>
            {mealKcal}
            <Text style={styles.mealKcalUnit}> {t('nutrition.kcal')}</Text>
          </Text>
        ) : null}
        {redoToday && !empty ? (
          <Pressable
            onPress={redoToday.onPress}
            disabled={redoToday.done}
            accessibilityRole="button"
            accessibilityLabel={redoToday.a11y}
            accessibilityState={{ disabled: redoToday.done }}
            // 32 px dessinés + 6 px de part et d'autre : la cible reste à 44 px (R13).
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[styles.redo, { backgroundColor: colors.track }]}
          >
            <Ionicons name={redoToday.done ? 'checkmark' : 'refresh'} size={14} color={colors.accent} />
            <Text style={[styles.redoLabel, { color: colors.accent }]}>
              {redoToday.done ? t('nutritionHub.repeat.done') : t('nutritionHub.day.redoMeal')}
            </Text>
          </Pressable>
        ) : null}
        {onAdd ? (
          <Pressable
            onPress={onAdd}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${mealLabel} · ${t('journal.addFood')}`}
            style={[styles.mealMenuBtn, { backgroundColor: colors.track }]}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
          </Pressable>
        ) : null}
        {!empty && onSaveTemplate ? (
          <Pressable
            onPress={() => setMenuOpen((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: menuOpen }}
            accessibilityLabel={t('journal.mealMenu', { meal: mealLabel })}
            style={[styles.mealMenuBtn, { backgroundColor: colors.track }]}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {mealShare != null && !empty ? (
        <View
          style={styles.mealShareRow}
          accessible
          accessibilityLabel={t('journal.mealShareA11y', { meal: mealLabel, pct: mealShare })}
        >
          <View style={[styles.mealShareTrack, { backgroundColor: colors.track }]}>
            <View
              style={[styles.mealShareFill, { backgroundColor: colors.accent, width: `${Math.min(100, mealShare)}%` }]}
            />
          </View>
          <Text style={[styles.mealSharePct, { color: colors.textMuted }]}>{mealShare} %</Text>
        </View>
      ) : null}

      {menuOpen && onSaveTemplate ? (
        <View style={[styles.mealMenu, { backgroundColor: colors.track, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              onSaveTemplate();
            }}
            style={[styles.mealMenuChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.mealMenuLabel, { color: colors.text }]}>{t('journal.saveMeal')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.mealItems}>
        {entries.map((e) => (
          <ReanimatedSwipeable
            key={e.id}
            friction={2}
            rightThreshold={40}
            renderRightActions={() => (
              <View style={styles.swipeActions}>
                <Pressable
                  onPress={() => onEditEntry(e)}
                  style={[styles.swipeAction, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('journal.swipeEdit')}
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.swipeActionLabel}>{t('journal.swipeEdit')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteEntry(e)}
                  style={[styles.swipeAction, { backgroundColor: colors.danger }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('journal.delete')}
                >
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={styles.swipeActionLabel}>{t('journal.delete')}</Text>
                </Pressable>
              </View>
            )}
          >
            <Pressable
              onPress={() => onSelectEntry(e)}
              style={[styles.entry, { backgroundColor: colors.surface }]}
              accessibilityHint={t('journal.swipeHint')}
            >
              <View style={styles.entryMain}>
                <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>
                  {e.name}
                </Text>
                {e.quantityG != null ? (
                  <Text style={[styles.entryQty, { color: colors.textMuted }]}>{e.quantityG} g</Text>
                ) : null}
              </View>
              <Text style={[styles.entryKcal, { color: colors.textMuted }]}>
                {e.kcal} {t('nutrition.kcal')}
              </Text>
            </Pressable>
          </ReanimatedSwipeable>
        ))}
      </View>
      {plannedLines}
    </View>
  );
}

const styles = StyleSheet.create({
  mealSection: { borderTopWidth: 1 },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11, minHeight: 52 },
  mealName: { fontFamily: fontFamily.bodyBold, fontSize: 15, flex: 1 },
  mealKcal: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  mealKcalUnit: { fontFamily: fontFamily.mono, fontSize: 10 },
  mealMenuBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  mealMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mealMenuChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  mealMenuLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  mealItems: { paddingVertical: 4, paddingHorizontal: 4 },
  emptyAdd: { minHeight: 36, justifyContent: 'center' },
  mealEmptyAdd: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  likeYesterday: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  likeYesterdayLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  redo: { minHeight: 32, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  redoLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  mealShareRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingBottom: 9 },
  mealShareTrack: { flex: 1, height: 4, borderRadius: 3, overflow: 'hidden' },
  mealShareFill: { height: '100%', borderRadius: 3 },
  mealSharePct: { fontFamily: fontFamily.mono, fontSize: 10.5, width: 34, textAlign: 'right' },
  planned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 48,
    marginRight: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  plannedTexts: { flex: 1, gap: 2 },
  plannedEyebrow: { fontFamily: fontFamily.monoBold, fontSize: 9.5, letterSpacing: 1 },
  plannedName: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  plannedMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  eat: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  eatLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 12,
  },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch' },
  swipeAction: { justifyContent: 'center', alignItems: 'center', gap: 2, width: 76 },
  swipeActionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11, color: '#fff' },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  entryName: { fontFamily: fontFamily.body, fontSize: 13.5, flexShrink: 1 },
  entryQty: { fontFamily: fontFamily.mono, fontSize: 12 },
  entryKcal: { fontFamily: fontFamily.monoBold, fontSize: 12.5 },
});
