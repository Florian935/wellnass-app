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

  // Carré, borné pour rester entièrement visible même sur un petit écran.
  const cardSize = Math.min(width - 48, 340);

  const share = async () => {
    setBusy(true);
    setError(null);
    const result = await shareCardImage(cardRef, data.kind, data.startedAtMs, t);
    setBusy(false);

    if ('error' in result) {
      setError(
        result.error === 'unavailable' ? t('share.errorUnavailable') : t('share.errorFailed'),
      );
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('share.close')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{t('share.previewTitle')}</Text>

        <View style={styles.cardWrap} accessible accessibilityLabel={accessibilityLabel}>
          {/* `visible &&` : la carte n'est montée qu'à l'ouverture — inutile de garder un SVG de
              400 points en mémoire tant que la feuille est fermée. */}
          {visible && <ShareCard ref={cardRef} data={data} size={cardSize} />}
        </View>

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
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13, alignSelf: 'flex-start' },
});
