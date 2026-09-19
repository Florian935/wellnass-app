/**
 * US NARR-01 — le résumé du dossier, demandé à la main et vérifié avant affichage.
 *
 * ── Trois choses que ce composant tient ───────────────────────────────────────────────────────
 * 1. **Rien ne part sans un geste.** Aucun appel à l'ouverture de l'écran : le quota Gemini est
 *    partagé par tout le projet, et un résumé que personne n'a demandé n'en vaut pas la peine.
 * 2. **Le refus se dit.** Quand le garde-fou rejette un texte parce qu'il cite un chiffre absent du
 *    dossier, on l'écrit. Masquer l'échec derrière un « réessayer » empêcherait d'en voir la
 *    fréquence — or c'est exactement ce qu'on veut mesurer avant d'ouvrir cette surface.
 * 3. **Le dossier reste roi.** Ce bloc s'ajoute au-dessus des pistes ; il ne remplace rien, et la
 *    ligne de limite le redit à l'écran.
 *
 * Monté avec une `key` par dossier (côté panneau) : changer de question remet donc l'état à zéro,
 * sans `setState` dans un effet — un résumé qui survivrait au changement de dossier parlerait d'un
 * autre constat.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NarrationDossier } from '@wellness/shared';

import { narrateDossier, type NarrationOutcome } from '@/lib/ai/narrate';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { dossier: NarrationDossier };

export function LabNarration({ dossier }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<NarrationOutcome | null>(null);

  const run = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome(await narrateDossier(dossier, i18n.language.startsWith('fr') ? 'fr' : 'en'));
    } catch {
      // Une exception non prévue reste un échec de résumé, pas un écran cassé : le dossier, lui,
      // est déjà affiché et n'a besoin de personne.
      setOutcome({ ok: false, code: 'failed' });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Le message d'échec, par code.
   *
   * Seuls les deux verdicts du garde-fou ont un texte à eux ; tous les autres codes sont ceux de la
   * fonction Edge et **réutilisent les messages d'IA-LAB-01** (`aiLab.errors.<code>`). En écrire des
   * seconds ici ferait deux phrases pour une même panne, qui divergeraient à la première retouche.
   */
  const failure = (code: Exclude<NarrationOutcome, { ok: true }>['code']): string => {
    if (code === 'rejected') return t('lab.why.narrate.rejected');
    if (code === 'invalid') return t('lab.why.narrate.invalid');
    return t(`aiLab.errors.${code}`);
  };

  return (
    <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {outcome === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy }}
          testID="lab-narrate"
          disabled={busy}
          onPress={() => void run()}
          style={[styles.action, { borderColor: colors.text }]}
        >
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={colors.text} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                {t('lab.why.narrate.loading')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.actionLabel, { color: colors.text }]}>
              {t('lab.why.narrate.cta')}
            </Text>
          )}
        </Pressable>
      ) : outcome.ok ? (
        <View accessibilityLiveRegion="polite" style={styles.result}>
          <Text style={[styles.summary, { color: colors.text }]}>{outcome.text}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('lab.why.narrate.source')}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('lab.why.narrate.limit')}
          </Text>
        </View>
      ) : (
        <Text
          accessibilityLiveRegion="polite"
          testID="lab-narrate-error"
          style={[styles.meta, { color: colors.textMuted }]}
        >
          {failure(outcome.code)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 },
  action: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  result: { gap: 6 },
  summary: { fontFamily: fontFamily.body, fontSize: 14.5, lineHeight: 20 },
  meta: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 15 },
});
