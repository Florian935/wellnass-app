/**
 * La barre chargée — US MUSCU-UX03, spec §5.5.
 *
 * Ce que l'utilisateur doit **mettre de chaque côté**, dessiné à l'échelle. Utile à chaque série
 * (on ne calcule plus de tête) et lisible d'un coup d'œil : c'est aussi ce qui rend visible
 * l'ajout d'un disque quand on monte la charge.
 *
 * Les couleurs sont celles des disques de compétition (rouge 25, bleu 20, jaune 15, vert 10,
 * blanc 5…), atténuées pour tenir sur le fond sombre de la séance : c'est un repère que tout
 * pratiquant a déjà dans l'œil, il aurait été absurde d'en inventer un autre.
 *
 * ⚠️ **Le calcul se fait dans l'unité affichée.** En livres, ce sont les disques américains
 * (45, 35, 25, 10, 5, 2,5 lb) et une barre de 45 lb : convertir des kilos en livres à l'affichage
 * aurait proposé « 11,02 lb » de chaque côté, ce que personne ne peut charger.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  computePlates,
  DEFAULT_BAR_LB,
  kgToLb,
  unitSymbol,
  type PlateLoad,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';

/** Couleur et gabarit d'un disque, par masse. Hauteur = diamètre perçu, largeur = épaisseur. */
const PLATE_STYLE: Record<number, { color: string; height: number; width: number }> = {
  45: { color: '#9e2f26', height: 104, width: 13 },
  35: { color: '#3f5b73', height: 96, width: 12 },
  25: { color: '#9e2f26', height: 104, width: 13 },
  20: { color: '#3f5b73', height: 104, width: 12 },
  15: { color: '#b08a2e', height: 90, width: 10 },
  10: { color: '#5c6e3f', height: 78, width: 9 },
  5: { color: '#d9cdb8', height: 58, width: 8 },
  2.5: { color: '#7a2a22', height: 44, width: 6 },
  1.25: { color: '#8d877d', height: 36, width: 5 },
};

const FALLBACK_PLATE = { color: '#8d877d', height: 40, width: 6 };

type Props = {
  /** Charge totale de la série, en kilos (l'unité de stockage). */
  totalKg: number | null;
  /** Poids de la barre réglé par l'utilisateur, en kilos. */
  barKg: number;
  /** Vrai si l'utilisateur affiche des livres : disques et barre américains. */
  imperial: boolean;
  colors: Palette;
};

/**
 * Ce qu'il y a sur la barre, en mots — partagé avec l'écran de série en cours (MUSCU-FIX02,
 * passe 2), qui le rappelle pendant l'effort sans redessiner la barre.
 */
export function describeLoad({
  totalKg,
  barKg,
  imperial,
  t,
  language,
}: {
  totalKg: number | null;
  barKg: number;
  imperial: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  language: string;
}): { load: PlateLoad; label: string; remainderLabel: string | null } {
  const total = totalKg === null ? null : imperial ? Math.round(kgToLb(totalKg) * 10) / 10 : totalKg;
  const bar = imperial ? DEFAULT_BAR_LB : barKg;
  const load = computePlates({ total, bar, unit: imperial ? 'lb' : 'kg' });

  const nf = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  const format = (value: number) => nf.format(value);

  // L'unité est celle du **calcul**, pas celle du stockage : en livres, on charge des disques
  // américains sur une barre de 45 lb, et écrire « kg » ici rendrait le libellé faux.
  const unit = unitSymbol[imperial ? 'imperial' : 'metric'].weight;

  const label = load.barOnly
    ? t('immersive.bar.barOnly', { bar: format(bar), unit })
    : t('immersive.bar.perSide', {
        plates: load.perSide.map(format).join(' + '),
        bar: format(bar),
        unit,
      });
  const remainderLabel =
    load.remainder > 0
      ? t('immersive.bar.remainder', { weight: format(load.remainder), unit })
      : null;
  return { load, label, remainderLabel };
}

export function BarbellLoad({ totalKg, barKg, imperial, colors }: Props) {
  const { t, i18n } = useTranslation();
  const { load, label, remainderLabel } = describeLoad({
    totalKg,
    barKg,
    imperial,
    t,
    language: i18n.language,
  });

  const plate = (mass: number, index: number, side: 'left' | 'right') => {
    const shape = PLATE_STYLE[mass] ?? FALLBACK_PLATE;
    return (
      <View
        key={`${side}-${index}-${mass}`}
        style={[styles.plate, { width: shape.width, height: shape.height, backgroundColor: shape.color }]}
      />
    );
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={remainderLabel ? `${label}. ${remainderLabel}` : label}
      style={styles.wrap}
    >
      <View style={styles.bar}>
        <View style={[styles.sleeve, { backgroundColor: colors.textMuted }]} />
        {/* Les plus lourds **au plus près de la barre** : le dessin correspond à ce qu'on voit
            devant un rack, donc l'ordre est inversé du côté gauche. */}
        <View style={styles.side}>
          {[...load.perSide].reverse().map((mass, index) => plate(mass, index, 'left'))}
        </View>
        <View style={[styles.collar, { backgroundColor: colors.textMuted }]} />
        <View style={[styles.shaft, { backgroundColor: colors.textMuted }]} />
        <View style={[styles.collar, { backgroundColor: colors.textMuted }]} />
        <View style={styles.side}>{load.perSide.map((mass, index) => plate(mass, index, 'right'))}</View>
        <View style={[styles.sleeve, { backgroundColor: colors.textMuted }]} />
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
        {remainderLabel ? `${label} · ${remainderLabel}` : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  bar: { height: 110, flexDirection: 'row', alignItems: 'center' },
  sleeve: { width: 14, height: 12, borderRadius: 3, opacity: 0.8 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  collar: { width: 6, height: 20, borderRadius: 2, opacity: 0.9 },
  shaft: { flex: 1, height: 6, borderRadius: 3, opacity: 0.75 },
  plate: { borderRadius: 4 },
  label: { fontFamily: fontFamily.mono, fontSize: 11.5, textAlign: 'center' },
});
