/**
 * US PARTAGE-01 — aperçu avant partage (décision D4).
 *
 * ── Pourquoi un aperçu, et pas un partage direct ──────────────────────────────────────────────────
 * L'image part sur un réseau **public**. Un tracé illisible ou un chiffre tronqué ne doit pas se
 * découvrir *après* publication : un tap ouvre l'aperçu, un second partage. Le coût est un tap ; le
 * bénéfice est de ne jamais publier à l'aveugle.
 *
 * La carte affichée ici **est** celle qui sera capturée : même composant, même mise en page. Ce que
 * l'utilisateur voit est exactement ce qu'il envoie.
 */

import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ShareCard, type ShareCardData } from '@/components/share/ShareCard';
import type { ShareCardVariant } from '@wellness/shared';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { shareCardImage } from '@/lib/share-card-export';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  data: ShareCardData;
  /** Description chiffrée de la carte, pour TalkBack — une image est muette sans elle. */
  accessibilityLabel: string;
};

export function ShareCardSheet({ visible, onClose, data, accessibilityLabel }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * US PARTAGE-02 — la variante choisie. **Non persistée** (spec R4) : un réglage caché qui change
   * l'image qu'on envoie est une mauvaise surprise.
   *
   * La remise à zéro se fait à la **fermeture**, pas à l'ouverture : un `setState` synchrone dans
   * un effet déclenche une cascade de rendus (et le lint le refuse, à raison). Les deux chemins de
   * sortie — le fond et le partage réussi — passent par `close`.
   */
  const [variant, setVariant] = useState<ShareCardVariant>('full');
  const close = () => {
    setVariant('full');
    setError(null);
    onClose();
  };

  // Carré, borné pour rester entièrement visible même sur un petit écran.
  const cardSize = Math.min(width - 48, 340);

  const share = async () => {
    setBusy(true);
    setError(null);
    const result = await shareCardImage(cardRef, data.kind, data.startedAtMs, t, variant);
    setBusy(false);

    if ('error' in result) {
      setError(
        result.error === 'unavailable' ? t('share.errorUnavailable') : t('share.errorFailed'),
      );
      return;
    }
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('share.close')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{t('share.previewTitle')}</Text>

        {/* Le sélecteur de format (spec R1) — deux vrais boutons, état annoncé et pas seulement
            coloré. */}
        <View style={styles.variants}>
          {(['full', 'transparent'] as const).map((option) => {
            const selected = variant === option;
            return (
              <Pressable
                key={option}
                onPress={() => setVariant(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(`share.variant.${option}`)}
                style={[
                  styles.variant,
                  {
                    backgroundColor: selected ? colors.accent : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.variantLabel,
                    { color: selected ? colors.accentText : colors.text },
                  ]}
                >
                  {t(`share.variant.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.cardWrap,
            // 🔴 Le damier (spec R8) : la convention universelle de la transparence. Sans lui,
            // l'utilisateur croit que le fond sera celui de la feuille et s'étonne de recevoir une
            // image « vide ».
          ]}
          accessible
          accessibilityLabel={accessibilityLabel}
        >
          {variant === 'transparent' ? <Checkerboard size={cardSize} /> : null}
          {/* `visible &&` : la carte n'est montée qu'à l'ouverture — inutile de garder un SVG de
              400 points en mémoire tant que la feuille est fermée. */}
          {visible && <ShareCard ref={cardRef} data={data} size={cardSize} variant={variant} />}
          {variant === 'transparent' ? (
            <View style={styles.badge} pointerEvents="none">
              {/* Volontairement NON traduit : c'est un marqueur de convention, comme sur les
                  outils d'image. */}
              <Text style={styles.badgeText}>TRANSPARENT</Text>
            </View>
          ) : null}
        </View>

        {variant === 'transparent' ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('share.variant.transparentHint')}
          </Text>
        ) : null}

        {error !== null && (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Button label={t('share.cta')} onPress={share} loading={busy} />
      </View>
    </Modal>
  );
}

/**
 * Damier de transparence (spec R8) — la convention universelle, celle de tous les outils d'image.
 *
 * En SVG et non en `View` : React Native n'a ni `background-image` ni motif répété, et couvrir
 * 340 px de carrés de 16 px demanderait plus de 400 vues là où un `<Pattern>` n'en coûte qu'une.
 */
function Checkerboard({ size }: { size: number }) {
  const cell = 16;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="damier" width={cell * 2} height={cell * 2} patternUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={cell * 2} height={cell * 2} fill="#cfc6b6" />
          <Rect x={0} y={0} width={cell} height={cell} fill="#b7ac99" />
          <Rect x={cell} y={cell} width={cell} height={cell} fill="#b7ac99" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="url(#damier)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    alignItems: 'center',
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18, alignSelf: 'flex-start' },
  cardWrap: { borderRadius: 12, overflow: 'hidden' },
  variants: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  variant: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#33291f',
    backgroundColor: 'rgba(247,238,222,0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: '#33291f',
  },
  hint: { fontFamily: fontFamily.body, fontSize: 12, alignSelf: 'flex-start' },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13, alignSelf: 'flex-start' },
});
