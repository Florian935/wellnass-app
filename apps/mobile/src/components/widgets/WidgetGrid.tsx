/**
 * Grille de widgets multi-formes (vrai quadrillage 2 colonnes), partagée par les 3 hubs.
 *
 * Chaque widget est **positionné par coordonnées de grille** (`col`, `row`) + empreinte dérivée
 * de sa forme (`sizeSpan` : small 1×1, wide 2×1, large 2×2). Case unité = ½ largeur d'écran
 * (hauteur de ligne = largeur de colonne). Placement libre (trous autorisés).
 *
 * - **Affichage** : widgets visibles positionnés en absolu selon leur case.
 * - **Édition** : `SortableWidgetGrid` (glisser-déposer aimanté à la case, appui long ~0,7 s).
 *
 * Consomme `useScreenLayout(screen)` ; chaque hub fournit son `renderWidget`.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  compactLayout,
  GRID_COLS,
  type WidgetId,
  type WidgetScreen,
  type WidgetSize,
} from '@wellness/shared';
import { SortableWidgetGrid } from '@/components/widgets/SortableWidgetGrid';
import { cellRect, gridHeight } from '@/components/widgets/grid-geometry';
import { useScreenLayout } from '@/data/repositories/widget-layout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { StaggerIn } from '@/components/motion/StaggerIn';
import { WidgetIdentityProvider } from '@/components/widgets/widget-identity';

/** Gouttière entre cases (px). */
export const GRID_GAP = 12;

export function WidgetGrid({
  screen,
  editing,
  renderWidget,
  onDragActiveChange,
  isActive,
  sizeFor,
}: {
  screen: WidgetScreen;
  editing: boolean;
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
  onDragActiveChange?: (active: boolean) => void;
  /**
   * Prédicat d'**activité** d'un widget conditionnel (défaut : toujours actif). Un widget inactif
   * (ex. `deficit-volume` sans alerte, qui rendrait `null`) est **exclu de la grille** au lieu de
   * réserver une cellule vide (sinon : un « trou » dans la disposition). Appliqué en affichage ET
   * en édition — un widget absent n'a pas à être positionné/déplacé ; il réapparaît quand il redevient actif.
   */
  isActive?: (id: WidgetId) => boolean;
  /**
   * **Forme effective** d'un widget à l'affichage (US ACCUEIL-04), quand son contenu impose une
   * hauteur que la forme stockée ne peut pas tenir.
   *
   * Le cas qui l'a rendue nécessaire : `real-life` vaut `row` par défaut parce qu'il n'affiche
   * qu'une ligne **hors période** — mais pendant une période, la carte porte une échéance, des
   * objectifs et deux boutons, qui ne tiennent pas dans une bande. Sans cette surcharge, il
   * fallait choisir entre une cellule remplie à 26 % onze mois par an et une carte tronquée le
   * douzième.
   *
   * ⚠️ **Ne s'applique qu'à l'affichage, jamais à l'édition** : en mode édition, l'utilisateur
   * manipule sa préférence, et voir la forme changer sous son doigt serait incompréhensible. La
   * disposition enregistrée n'est donc pas réécrite — le widget retrouve sa forme de lui-même
   * quand son état revient à la normale.
   */
  sizeFor?: (id: WidgetId, stored: WidgetSize) => WidgetSize;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { layout, toggleVisible, cycleSize, moveToCell } = useScreenLayout(screen);
  const [width, setWidth] = useState(0);

  const rendered = (editing ? layout.widgets : layout.widgets.filter((w) => w.visible)).filter(
    (w) => (isActive ? isActive(w.id) : true),
  );
  const colW = width > 0 ? (width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS : 0;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (rendered.length === 0 && !editing) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        {t('home.customize.empty')}
      </Text>
    );
  }

  if (editing) {
    return (
      <View onLayout={onLayout}>
        {colW > 0 ? (
          <SortableWidgetGrid
            items={rendered}
            colW={colW}
            gap={GRID_GAP}
            renderWidget={renderWidget}
            onMoveToCell={moveToCell}
            onToggleVisible={toggleVisible}
            onCycleSize={cycleSize}
            onDragActiveChange={onDragActiveChange}
          />
        ) : null}
      </View>
    );
  }

  // Affichage : positions absolues dérivées de (col, row). On **recompacte les widgets
  // visibles** pour qu'un widget masqué ne laisse pas de trou (sa case n'est pas rendue).
  //
  // La forme effective est appliquée AVANT la compaction, et c'est ce qui rend la surcharge sûre :
  // agrandir une cellule peut créer un chevauchement, que `compactLayout` résout exactement comme
  // il résout ceux d'un changement de forme en édition. Sans cet ordre, une carte agrandie
  // recouvrirait sa voisine.
  const effective = sizeFor
    ? rendered.map((w) => {
        const size = sizeFor(w.id, w.size);
        return size === w.size ? w : { ...w, size };
      })
    : rendered;
  const positioned = compactLayout(effective);
  return (
    <View onLayout={onLayout} style={{ height: gridHeight(positioned, colW, GRID_GAP) }}>
      {colW > 0
        ? positioned.map((w, index) => {
            const r = cellRect(w, colW, GRID_GAP);
            return (
              // MOTION-01 (S2) : les cartes arrivent décalées de 40 ms au lieu de surgir ensemble.
              // L'œil suit une composition au lieu de recevoir un mur. Le décalage est plafonné à
              // six cartes par `staggerDelay` — au-delà il cesserait d'être une élégance pour
              // devenir une attente, au moment précis du premier contact du matin.
              //
              // L'animation ne joue **qu'au montage** des cellules, c'est-à-dire une fois par
              // ouverture de l'écran : réagencer ou redimensionner un widget garde la même clé,
              // donc ne remonte rien et ne rejoue rien.
              <StaggerIn
                key={w.id}
                index={index}
                style={{
                  position: 'absolute',
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                  borderRadius: 22,
                  overflow: 'hidden',
                }}
              >
                <WidgetIdentityProvider id={w.id}>
                  {renderWidget(w.id, w.size)}
                </WidgetIdentityProvider>
              </StaggerIn>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
