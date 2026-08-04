import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addDays,
  aisleToggleAction,
  AISLE_ORDER,
  formatDayFull,
  formatShoppingListText,
  localDateFromDayKey,
  localDayKey,
  startOfWeek,
  type ShoppingAisle,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  generateShoppingList,
  regenerateShoppingList,
  toggleAisle,
  toggleShoppingItem,
  useActiveShoppingList,
  useShoppingListItems,
  type ShoppingItem,
} from '@/data/repositories/shopping-list-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Liste de courses d'une semaine planifiée (US REPAS-01, roadmap 4.28 + 4.29).
 *
 * La liste est **figée à la génération** (décision D5) : elle ne bouge pas pendant qu'on est au
 * rayon, et les cases cochées survivent à la fermeture de l'app. La régénérer est un geste
 * explicite, qui **annonce** la perte des cases cochées avant de la provoquer.
 */
export default function ShoppingListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ week?: string }>();

  // Semaine passée en paramètre ; repli sur la semaine courante si la route est ouverte nue
  // (lien direct, restauration d'état) plutôt que d'afficher un écran vide inexplicable.
  const weekStart = useMemo(
    () => params.week ?? localDayKey(startOfWeek(new Date())),
    [params.week],
  );

  const { list } = useActiveShoppingList(weekStart);
  const { items } = useShoppingListItems(list?.id ?? null);
  const [busy, setBusy] = useState(false);

  const weekLabel = useMemo(() => {
    const start = localDateFromDayKey(weekStart);
    const end = addDays(start, 6);
    return t('mealPlan.week.range', {
      from: `${start.getDate()}/${start.getMonth() + 1}`,
      to: `${end.getDate()}/${end.getMonth() + 1}`,
    });
  }, [weekStart, t]);

  /**
   * Groupes de rayons dans l'ordre du parcours de magasin. Les articles arrivent déjà triés par
   * `order_index`, qui matérialise ce tri à la génération : on ne le recalcule pas, on le respecte.
   */
  const aisles = useMemo(() => {
    const byAisle = new Map<ShoppingAisle, ShoppingItem[]>();
    for (const item of items) {
      const list = byAisle.get(item.category);
      if (list) list.push(item);
      else byAisle.set(item.category, [item]);
    }
    return AISLE_ORDER.filter((a) => byAisle.has(a)).map((a) => ({
      category: a,
      items: byAisle.get(a)!,
    }));
  }, [items]);

  const formatQuantity = (item: ShoppingItem): string | null => {
    if (item.quantityG === null) {
      return item.unquantifiedCount > 0 ? t('mealPlan.shopping.noQuantity') : null;
    }
    const base = t('mealPlan.shopping.quantity', { grams: item.quantityG });
    return item.unquantifiedCount > 0
      ? `${base} ${t('mealPlan.shopping.plusUnquantified', { count: item.unquantifiedCount })}`
      : base;
  };

  const onGenerate = async () => {
    setBusy(true);
    try {
      await generateShoppingList(weekStart);
    } finally {
      setBusy(false);
    }
  };

  /** Régénérer perd les cases cochées : on l'annonce AVANT (critère de recette 16). */
  const onRegenerate = () => {
    const checkedCount = items.filter((i) => i.checked).length;
    Alert.alert(
      t('mealPlan.shopping.regenerate.title'),
      checkedCount > 0
        ? t('mealPlan.shopping.regenerate.bodyChecked', { count: checkedCount })
        : t('mealPlan.shopping.regenerate.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mealPlan.shopping.regenerate.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void regenerateShoppingList(weekStart).finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  /**
   * Tap sur un en-tête de rayon (décision D13). Cocher — y compris compléter un rayon
   * partiellement coché — se fait sans confirmation ; seul le **dé-cochage** d'un rayon entier est
   * confirmé, car il efface un travail de magasin qu'on ne peut pas reconstituer de mémoire.
   */
  const onToggleAisle = (category: ShoppingAisle, aisleItems: readonly ShoppingItem[]) => {
    if (!list) return;
    const action = aisleToggleAction(aisleItems.map((i) => i.checked));

    if (action === 'uncheck-all') {
      Alert.alert(
        t('mealPlan.shopping.aisle.uncheckTitle'),
        t('mealPlan.shopping.aisle.uncheckBody', {
          count: aisleItems.length,
          aisle: t(`food.categories.${category}`),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('mealPlan.shopping.aisle.uncheckConfirm'),
            style: 'destructive',
            onPress: () => void toggleAisle(list.id, category, false),
          },
        ],
      );
      return;
    }
    void toggleAisle(list.id, category, true);
  };

  const onShare = async () => {
    const text = formatShoppingListText({
      // `formatDayFull` et non `toLocaleDateString` : la date du projet est JJ/MM/AAAA, indépendante
      // de la locale du système — un `'fr-FR'` en dur aurait aussi été une chaîne non traduisible.
      title: t('mealPlan.shopping.shareTitle', { date: formatDayFull(localDayKey(new Date())) }),
      subtitle: weekLabel,
      groups: aisles.map((a) => ({
        label: t(`food.categories.${a.category}`),
        lines: a.items.map((i) => ({ name: i.name, quantity: formatQuantity(i) })),
      })),
    });
    try {
      await Share.share({ message: text });
    } catch {
      // Partage annulé ou indisponible : rien à signaler, et surtout pas de spinner bloqué.
    }
  };

  // Aucune liste générée pour cette semaine.
  if (!list) {
    return (
      <Screen>
        <ScreenHeader title={t('mealPlan.shopping.title')} subtitle={weekLabel} />
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('mealPlan.shopping.empty.title')}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('mealPlan.shopping.empty.message')}
          </Text>
          <Button
            label={t('mealPlan.shopping.generate')}
            onPress={() => void onGenerate()}
            loading={busy}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('mealPlan.shopping.title')} subtitle={weekLabel} />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            {t('mealPlan.shopping.summary', {
              meals: list.plannedCount,
              items: items.length,
            })}
          </Text>
          {/* R12 : la liste dit ce qu'elle ne sait pas, au lieu de sous-estimer en silence. */}
          {list.unresolvedCount > 0 && (
            <Text style={[styles.summaryWarn, { color: colors.warnText }]}>
              {t('mealPlan.shopping.unresolved', { count: list.unresolvedCount })}
            </Text>
          )}
        </View>

        {items.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('mealPlan.shopping.noItems')}
          </Text>
        )}

        {aisles.map((aisle) => {
          const checkedCount = aisle.items.filter((i) => i.checked).length;
          return (
            <View key={aisle.category}>
              <Pressable
                onPress={() => onToggleAisle(aisle.category, aisle.items)}
                accessibilityRole="button"
                accessibilityLabel={t('mealPlan.shopping.aisle.a11y', {
                  aisle: t(`food.categories.${aisle.category}`),
                  checked: checkedCount,
                  total: aisle.items.length,
                })}
                style={[styles.aisleHeader, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.aisleLabel, { color: colors.accent }]}>
                  {t(`food.categories.${aisle.category}`)}
                </Text>
                <Text style={[styles.aisleCount, { color: colors.textMuted }]}>
                  {checkedCount}/{aisle.items.length}
                </Text>
              </Pressable>

              {aisle.items.map((item) => {
                const quantity = formatQuantity(item);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => void toggleShoppingItem(item.id, !item.checked)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                    accessibilityLabel={
                      quantity ? `${item.name}, ${quantity}` : item.name
                    }
                    style={styles.item}
                  >
                    <View
                      style={[
                        styles.box,
                        {
                          borderColor: item.checked ? colors.success : colors.borderStrong,
                          backgroundColor: item.checked ? colors.success : 'transparent',
                        },
                      ]}
                    >
                      {item.checked && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                    </View>
                    <View style={styles.itemTexts}>
                      <Text
                        style={[
                          styles.itemName,
                          {
                            color: item.checked ? colors.textMuted : colors.text,
                            textDecorationLine: item.checked ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </View>
                    {quantity && (
                      <Text
                        style={[
                          styles.itemQuantity,
                          { color: item.checked ? colors.textMuted : colors.text },
                        ]}
                      >
                        {quantity}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {items.length > 0 && (
          <Button label={t('mealPlan.shopping.share')} onPress={() => void onShare()} />
        )}
        <Button
          label={t('mealPlan.shopping.regenerate.action')}
          variant="ghost"
          onPress={onRegenerate}
          loading={busy}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 32, gap: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, textAlign: 'center' },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  summary: { borderWidth: 1, borderRadius: 12, padding: 11, gap: 3, marginBottom: 6 },
  summaryTitle: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  summaryWarn: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  aisleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: 4,
    marginTop: 14,
    marginBottom: 4,
  },
  aisleLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  aisleCount: { fontFamily: fontFamily.body, fontSize: 11.5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTexts: { flex: 1 },
  itemName: { fontFamily: fontFamily.body, fontSize: 14.5 },
  itemQuantity: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});
