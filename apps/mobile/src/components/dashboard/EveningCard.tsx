/**
 * US PRISME-01 — la carte « Ta journée » de l'accueil, dès 18 h (spec §3, §4, DD11).
 *
 * ── Ce que la carte tient ─────────────────────────────────────────────────────────────────────
 * 1. **Les faits s'affichent toujours**, sans IA : séances et sorties du jour, assiette, semaine en
 *    cours, ce qui est prévu demain. Ils sont rendus **depuis le dossier lui-même** : ce que la carte
 *    montre est exactement ce qui partirait chez le fournisseur (R4).
 * 2. **« Prisme raconte » n'apparaît que si Prisme est visible** (DD7) **et qu'aucune humeur basse
 *    n'est en cours** (R12) : un texte neutre à côté d'un signal de détresse serait déplacé.
 * 3. **Une journée sans séance ni repas n'a pas de carte** (R12) — la semaine et demain ne suffisent
 *    pas à faire une journée.
 *
 * Zone 1 de l'accueil, fixe, hors plafond de widgets (ADR-007, amendement du 09/09/2026).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { buildEveningDossier, eveningFingerprint, hasEveningFacts } from '@wellness/shared';

import { PrismeTell } from '@/components/prisme/PrismeTell';
import { useEveningFacts } from '@/hooks/useEveningFacts';
import { usePrismeVisibility } from '@/hooks/usePrismeVisibility';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function EveningCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { facts, todayKey, lowMood, isLoading } = useEveningFacts();
  const { visible } = usePrismeVisibility();

  if (isLoading || !hasEveningFacts(facts)) return null;

  const dossier = buildEveningDossier(facts, (key, params) => t(key, params));

  return (
    <View testID="evening-card" style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('prisme.evening.title')}
      </Text>
      {/* Le rang dans la clé : deux séances identiques donnent deux faits identiques. */}
      {dossier.facts.map((fact, index) => (
        <View key={`${index}-${fact.label}`} style={styles.fact} accessible accessibilityLabel={`${fact.label} : ${fact.detail}`}>
          <Text style={[styles.label, { color: colors.text }]}>{fact.label}</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>{fact.detail}</Text>
        </View>
      ))}
      {visible && !lowMood ? (
        <PrismeTell
          dossier={dossier}
          usage="evening"
          storeKey={`evening:${todayKey}`}
          fingerprint={eveningFingerprint(facts)}
          testID="evening-prisme"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18 },
  fact: { gap: 2 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  detail: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
