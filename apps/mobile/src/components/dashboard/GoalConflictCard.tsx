/**
 * « Tes deux objectifs se contredisent » — US GUID-01, volet E.
 *
 * ── Le plus petit morceau démontrable du différenciateur ────────────────────────────────────────
 * Le dépôt porte **quatre** notions d'objectif sans aucun pont : `profiles.main_goal`,
 * `nutrition_profiles.objective`, `runner_profiles.objective` et les objectifs personnels d'OBJ-01.
 * On pouvait déclarer « Prise de masse » au global et « Sèche » en nutrition — deux écrans, deux
 * réglages, aucun mot. La décision de cadrage H dit « les piliers se parlent » : voilà la première
 * fois qu'ils le font sur les intentions, et pas seulement sur les chiffres.
 *
 * ── Explicable ET contestable ───────────────────────────────────────────────────────────────────
 * Deux exigences, toutes deux du principe transverse d'IDEAS (25/07/2026), et aucune n'est
 * décorative :
 *  - « Pourquoi je te dis ça » déplie le raisonnement — une carte qui affirme sans montrer se fait
 *    croire ou ignorer, jamais discuter ;
 *  - « Cette règle ne me correspond pas » la fait taire durablement. Sans cette sortie, la seule
 *    façon d'échapper à une règle jugée hors sujet serait de changer un réglage qu'on avait
 *    volontairement mis là.
 *
 * ── Deux actions de poids égal ──────────────────────────────────────────────────────────────────
 * Ni l'objectif global ni le réglage du pilier n'est « le bon » : l'app constate une tension, elle
 * n'arbitre pas. Un bouton plein contre un bouton fantôme aurait désigné un gagnant sans le dire.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GoalConflict } from '@wellness/shared';
import { Button } from '@/components/Button';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  conflict: GoalConflict;
  /** Garder l'objectif principal : c'est le réglage du pilier qui s'aligne. */
  onKeepMainGoal: () => void;
  /** Garder le réglage du pilier : c'est l'objectif principal qui s'aligne. */
  onKeepPillarGoal: () => void;
  onDismissRule: () => void;
  /**
   * US CONS-01 — ouvre le Conseil, qui chiffre les deux issues ci-dessous. Absent quand la règle
   * n'est pas chiffrable (voir `buildCouncil`) : la carte reste alors celle de GUID-01.
   */
  onOpenCouncil?: () => void;
};

/** `goal.muscle` → `goalConflict.values.goal.muscle`. Le moteur rend des identifiants, pas du texte. */
function labelKey(token: string): string {
  return `goalConflict.values.${token}`;
}

export function GoalConflictCard({
  conflict,
  onKeepMainGoal,
  onKeepPillarGoal,
  onDismissRule,
  onOpenCouncil,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [explained, setExplained] = useState(false);

  const left = t(labelKey(conflict.left));
  const right = t(labelKey(conflict.right));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('goalConflict.title')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t(`goalConflict.rules.${conflict.rule}.body`, { left, right })}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: explained }}
        onPress={() => setExplained((v) => !v)}
        hitSlop={6}
        style={styles.whyRow}
      >
        <Text style={[styles.why, { color: colors.accent }]}>
          {explained ? '▾ ' : '▸ '}
          {t('goalConflict.why')}
        </Text>
      </Pressable>
      {explained ? (
        <Text style={[styles.whyBody, { color: colors.textMuted }]}>
          {t(`goalConflict.rules.${conflict.rule}.why`)}
        </Text>
      ) : null}

      {/*
        US CONS-01 — le lien vers les chiffres se place AVANT les deux boutons : on lit ce que coûte
        chaque issue, puis on choisit. L'ordre inverse aurait fait décorer un choix déjà fait.
      */}
      {onOpenCouncil !== undefined ? (
        <Pressable
          accessibilityRole="button"
          testID="council-open"
          onPress={onOpenCouncil}
          hitSlop={6}
          style={styles.councilRow}
        >
          <Text style={[styles.why, { color: colors.accent }]}>{t('council.open')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label={t('goalConflict.keepMainGoal')} onPress={onKeepMainGoal} />
        </View>
        <View style={styles.action}>
          <Button label={t('goalConflict.keepPillarGoal')} onPress={onKeepPillarGoal} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onDismissRule}
        style={styles.dismiss}
        hitSlop={8}
      >
        <Text style={[styles.dismissLabel, { color: colors.textMuted }]}>
          {t('goalConflict.dismiss')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 18, padding: 15, gap: 7 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 16.5, letterSpacing: -0.3, lineHeight: 22 },
  body: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  whyRow: { paddingVertical: 4 },
  councilRow: { minHeight: 44, justifyContent: 'center' },
  why: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  whyBody: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 4 },
  action: { flex: 1 },
  // Cible tactile confortable : c'est une sortie, elle ne doit pas être plus dure à viser que les
  // deux boutons au-dessus (WCAG 2.5.8, exigence reprise de CONF-07).
  dismiss: { minHeight: 44, justifyContent: 'center' },
  dismissLabel: { fontFamily: fontFamily.body, fontSize: 12.5, textDecorationLine: 'underline' },
});
