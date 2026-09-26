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
 * petit-déjeuner à 20 h serait redevenu un parcours à corriger, exactement le défaut que R2.6 avait
 * réglé. On supprime la répétition, pas le raccourci.
 *
 * Sorti de `app/(tabs)/nutrition.tsx` par NUTRI-UX03 (la page d'un jour passé en a besoin). Le mode
 * « carte autonome » (`dense = false`) n'avait plus d'appelant depuis NUTRI-UX02 : il n'a pas suivi.
 */

import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { addDays, localDateFromDayKey, localDayKey } from '@wellness/shared';
import { MealGlyph } from '@/components/nutrition/CategoryGlyph';
import { copyMeal, type JournalEntry } from '@/data/repositories/journal-repository';
import { saveMealAsTemplate } from '@/data/repositories/meal-template-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  mealKey: string;
  mealLabel: string;
  day: string;
  entries: JournalEntry[];
  /** Total calorique du jour, pour la part que ce repas représente. 0 = pas de barre. */
  dayKcal?: number;
  /** Ajout d'un aliment. Absent pour la section « Autres » (récupération seule). */
  onAdd?: () => void;
  onDeleteEntry: (e: JournalEntry) => void;
  onSelectEntry: (e: JournalEntry) => void;
  onEditEntry: (e: JournalEntry) => void;
};

export function MealSection({
  mealKey,
  mealLabel,
  day,
  entries,
  dayKcal = 0,
  onAdd,
  onDeleteEntry,
  onSelectEntry,
  onEditEntry,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const mealKcal = entries.reduce((s, e) => s + e.kcal, 0);
  // Menu du repas (copier / enregistrer comme modèle) : replié par défaut. Deux actions
  // secondaires n'ont pas à occuper l'en-tête de chacun des 3 à 6 repas de la journée.
  const [menuOpen, setMenuOpen] = useState(false);

  const copyFromYesterday = () => {
    void copyMeal(localDayKey(addDays(localDateFromDayKey(day), -1)), mealKey, day)
      .then((n) => {
        if (n === 0) Alert.alert(mealLabel, t('journal.nothingYesterday'));
      })
      .catch(() => undefined);
  };

  const saveAsTemplate = () => {
    const items = entries.map((e) => ({
      foodId: e.foodId,
      name: e.name,
      quantityG: e.quantityG,
      kcal: e.kcal,
      proteinG: e.proteinG,
      carbsG: e.carbsG,
      fatG: e.fatG,
    }));
    void saveMealAsTemplate(mealLabel, items)
      .then(() => Alert.alert(t('journal.templateSaved'), mealLabel))
      // 🔴 Ici l'alerte est une CONFIRMATION : la taire sur échec est le comportement voulu —
      // annoncer « modèle enregistré » alors que l'écriture a échoué serait pire que se taire.
      .catch(() => undefined);
  };

  /*
   * Passe 2 — un repas vide est une **section discrète**, pas un cadre pointillé.
   *
   * Le cadre pointillé a été conçu pour une liste de cartes, où il se lit comme « une carte encore
   * vide ». Posé au milieu d'une carte unique, entre des repas pleins, il coupe la lecture et se lit
   * comme un bouton d'action — c'est le « Snack » relevé en recette du 20/09.
   */
  if (entries.length === 0 && onAdd) {
    return (
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`${mealLabel} · ${t('journal.addFood')}`}
        style={[styles.mealHead, styles.mealSection, { borderTopColor: colors.border }]}
      >
        <MealGlyph mealKey={mealKey} />
        <Text style={[styles.mealName, { color: colors.textMuted }]} numberOfLines={1}>
          {mealLabel}
        </Text>
        <Text style={[styles.mealEmptyAdd, { color: colors.accent }]}>+ {t('journal.add')}</Text>
      </Pressable>
    );
  }

  // US NUTRI-UX02 — la part du jour que pèse ce repas. C'est NUTR-16 (« répartition par repas »,
  // livrée mais rangée dans l'écran Stats) rendue là où la décision se prend, sans nouvel écran :
  // « mon dîner pèse un tiers de ma journée » se lit d'un coup d'œil, pas dans un rapport hebdo.
  const mealShare = dayKcal > 0 ? Math.round((mealKcal / dayKcal) * 100) : null;

  return (
    <View style={[styles.mealSection, { borderTopColor: colors.border }]}>
      <View style={styles.mealHead}>
        <MealGlyph mealKey={mealKey} />
        <Text style={[styles.mealName, { color: colors.text }]} numberOfLines={1}>
          {mealLabel}
        </Text>
        <Text style={[styles.mealKcal, { color: colors.textMuted }]}>
          {mealKcal}
          <Text style={styles.mealKcalUnit}> {t('nutrition.kcal')}</Text>
        </Text>
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
        {entries.length > 0 ? (
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

      {mealShare != null && entries.length > 0 ? (
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

      {menuOpen ? (
        <View style={[styles.mealMenu, { backgroundColor: colors.track, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              copyFromYesterday();
            }}
            style={[styles.mealMenuChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.mealMenuLabel, { color: colors.text }]}>{t('journal.copyYesterday')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              saveAsTemplate();
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
    </View>
  );
}

const styles = StyleSheet.create({
  mealSection: { borderTopWidth: 1 },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
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
  mealEmptyAdd: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  mealShareRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingBottom: 9 },
  mealShareTrack: { flex: 1, height: 4, borderRadius: 3, overflow: 'hidden' },
  mealShareFill: { height: '100%', borderRadius: 3 },
  mealSharePct: { fontFamily: fontFamily.mono, fontSize: 10.5, width: 34, textAlign: 'right' },
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
