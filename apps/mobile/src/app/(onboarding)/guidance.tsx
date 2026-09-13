/**
 * Onboarding — le régime de guidage (US GUID-01, volet C, décision D4).
 *
 * ── Cet écran en REMPLACE un autre, il n'en ajoute pas ───────────────────────────────────────────
 * Il prend la place exacte de « Niveau d'affichage » (`displayLevel.tsx`), à la même étape. Le
 * parcours garde le même nombre d'écrans : la décision de cadrage F (onboarding minimal, tout
 * skippable) est intacte.
 *
 * ── Pourquoi cet échange est le cœur de l'US ─────────────────────────────────────────────────────
 * « Niveau d'affichage » était un réglage d'interface déguisé en question de profil. Faute d'avoir
 * jamais demandé l'expérience du pratiquant, la muscu s'en servait comme **proxy** pour trier les
 * programmes suggérés (cf. l'en-tête de `SuggestedPrograms.tsx`) — « je veux voir peu
 * d'informations pendant ma séance » était lu comme « je débute ». Un powerlifter confirmé qui
 * aimait les écrans épurés recevait des programmes débutants.
 *
 * On demande donc ici un **vrai** signal, et la densité d'écran s'en déduit
 * (`displayLevelForRegime`). Elle reste réglable dans les réglages, où deux sélecteurs existent
 * déjà. Le niveau d'expérience, lui, a désormais sa propre colonne — demandée devant la
 * bibliothèque, là où la question a un objet visible (décision D6).
 *
 * ── L'axe : qui décide, pas combien de messages ──────────────────────────────────────────────────
 * Le piège, pour « à quel point l'app m'accompagne », est de graduer le VOLUME d'interventions. Le
 * mode « soutenu » devient alors le mode « l'app me harcèle », coupé en dix jours. Ici les trois
 * régimes envoient autant de messages ; ils n'envoient pas les mêmes. `guided` annonce des
 * décisions prises, `assisted` pose des questions, `autonomous` n'a plus de question à poser.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GUIDANCE_REGIMES,
  displayLevelForRegime,
  resolveActivePillars,
  type GuidanceRegime,
} from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { useSettings } from '@/data/repositories/settings-repository';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Étape suivante — variable, exactement comme l'écran qu'il remplace : le niveau d'activité ne
 * concerne que le calcul du TDEE, le demander à quelqu'un qui n'a pas activé la nutrition serait
 * imposer une question sans objet (décision H).
 */
const NEXT_WITH_NUTRITION = '/(onboarding)/activity';
const NEXT_WITHOUT_NUTRITION = '/(onboarding)/summary';

export default function OnboardingGuidance() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [regime, setRegime] = useState<GuidanceRegime | null>(null);
  const { settings } = useSettings();
  // Tant que les réglages ne sont pas chargés, `resolveActivePillars` suppose tout actif — on pose
  // donc la question par défaut plutôt que de la sauter par accident.
  const nutritionActive = resolveActivePillars(settings?.activePillars).includes('nutrition');
  const next = nutritionActive ? NEXT_WITH_NUTRITION : NEXT_WITHOUT_NUTRITION;

  const onContinue = async () => {
    // Rien n'est écrit sans choix : `null` veut dire « la question n'a pas eu de réponse », et
    // l'application affichera le repli COMME un repli (spec §2.1) au lieu de le faire passer pour
    // une décision. C'est la leçon des ~614 kcal du niveau d'activité (NUTRI-UX01, R1.3).
    if (regime) {
      await upsertProfile({
        guidanceRegime: regime,
        // La densité d'écran se déduit du régime — mais seulement ici, à l'écriture initiale.
        // Elle n'est jamais réécrite ensuite : personne ne doit voir son écran de séance changer
        // sans l'avoir demandé.
        workoutDisplayLevel: displayLevelForRegime(regime),
      });
    }
    router.push(next);
  };

  return (
    <OnboardingScaffold
      step={4}
      title={t('onboarding.guidance.title')}
      subtitle={t('onboarding.guidance.subtitle')}
      onSkip={() => router.push(next)}
      onContinue={onContinue}
    >
      <View style={styles.list}>
        {GUIDANCE_REGIMES.map((option) => {
          const selected = regime === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(`guidance.regimes.${option}.label`)} — ${t(
                `guidance.regimes.${option}.description`,
              )}`}
              onPress={() => setRegime(option)}
              style={[
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={styles.head}>
                <View style={styles.texts}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      {t(`guidance.regimes.${option}.label`)}
                    </Text>
                    {option === 'assisted' ? (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.badgeText, { color: colors.accentText }]}>
                          {t('guidance.recommended')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.description, { color: colors.textMuted }]}>
                    {t(`guidance.regimes.${option}.description`)}
                  </Text>
                </View>
                {selected ? (
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                ) : (
                  <View style={[styles.dot, { borderColor: colors.border, borderWidth: 1.5 }]} />
                )}
              </View>

              {/* L'aperçu vaut mieux qu'une définition : il montre la MÊME situation (une collision
                  de séances) formulée dans les trois régimes. C'est ce qui rend visible que l'axe
                  est « qui décide » et non « combien de messages ». */}
              <View
                style={[
                  styles.preview,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                  {t('guidance.previewLabel')}
                </Text>
                <Text style={[styles.previewText, { color: colors.text }]}>
                  {t(`guidance.regimes.${option}.preview`)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* La contrepartie du mode autonome, dite AVANT le choix et non découverte après. Un
          garde-fou caché serait une trahison du réglage, pas une protection. */}
      <View style={[styles.safety, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.safetyTitle, { color: colors.text }]}>
          {t('guidance.safety.title')}
        </Text>
        <Text style={[styles.safetyText, { color: colors.textMuted }]}>
          {t('guidance.safety.body')}
        </Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  option: {
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  texts: { flex: 1, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: fontFamily.bodySemi, fontSize: 10, letterSpacing: 0.4 },
  description: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  dot: { width: 20, height: 20, borderRadius: 10, marginTop: 2 },
  preview: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9, gap: 3 },
  previewLabel: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 0.8 },
  previewText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  safety: { borderRadius: 14, borderWidth: 1, padding: 13, gap: 4 },
  safetyTitle: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  safetyText: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
});
