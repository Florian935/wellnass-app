/**
 * US ACCUEIL-05 — **zone 4 de l'accueil** : le pied « la suite ».
 *
 * Trois lignes de texte, pas trois cartes. C'est le point important : l'accueil n'avait aucun
 * horizon au-delà de la journée, mais y répondre par de nouveaux widgets aurait regonflé le
 * registre que INSIGHTS-02 venait de ramener de 21 à 8. Du texte sur le fond de l'écran coûte
 * ~137 px et aucune place au plafond d'ADR-007.
 *
 * On y trouve, quand l'information existe :
 *  - les **trois prochaines occurrences planifiées**, tous piliers confondus (date + nom) ;
 *  - et les deux seuls liens de bas de page : le planning, et « Personnaliser » — qui **descend
 *    ici** depuis le coin haut-droit, où il occupait la place la plus précieuse de l'écran pour
 *    une action qu'on fait une fois.
 *
 * ⚠️ Aucune ligne n'est inventée : une section sans donnée ne s'affiche pas. Un pied de page qui
 * dirait « aucune séance à venir » serait plus long qu'utile.
 *
 * ── Pourquoi PAS l'objectif personnel, contrairement à la maquette ───────────────────────────────
 * La planche prévoyait une troisième ligne « Objectif −3 kg avant le 15/10 · 62 % ». Elle n'est pas
 * livrée, et c'est un choix, pas un oubli : un `PersonalGoal` ne porte **ni titre ni libellé** — il
 * porte `kind`, `targetValue`, `exerciseId` et `deadline`. La phrase lisible est composée par la
 * carte d'objectif de `/goals`. En écrire une seconde version ici créerait deux mises en forme du
 * même contenu, exactement la duplication qu'ADR-007 §3 proscrit (« construire des briques, pas
 * 180 variantes »). À reprendre le jour où ce libellé sera extrait en brique réutilisable.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDayFull } from '@wellness/shared';

import { useTodaySession } from '@/data/repositories/dashboard-repository';
import { useTodayRunSession } from '@/data/repositories/run-repository';
import { useUpcomingSessions } from '@/data/repositories/planned-session-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useTodayKey } from '@/hooks/useTodayKey';

/** Horizon du pied de page : une semaine. Au-delà, « la suite » cesse d'être actionnable. */
const HORIZON_DAYS = 7;
/** Nombre de lignes affichées. Trois : au-delà, ce n'est plus un pied de page, c'est le planning. */
const MAX_LINES = 3;

export function UpNext({ onCustomize }: { onCustomize: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();

  const { items: upcoming } = useUpcomingSessions(HORIZON_DAYS);
  // Appelés inconditionnellement (règle des hooks) : servent à savoir si l'écran a déjà quelque
  // chose à dire pour aujourd'hui, et donc s'il faut un état vide ici.
  const strengthToday = useTodaySession('strength');
  const { session: runToday } = useTodayRunSession();

  // Occurrences STRICTEMENT après aujourd'hui : ce qui est prévu aujourd'hui appartient à la
  // zone 1, le répéter ici serait du bruit.
  //
  // ⚠️ **Le statut doit être filtré ICI** (correctif du 10/09/2026). La première rédaction
  // affirmait qu'il l'était « déjà en amont » : c'est faux, `SELECT_PLANNED_BETWEEN` remonte
  // **tous** les statuts (`planned`, `done`, `skipped`) — c'est voulu, le planning en a besoin
  // pour peindre les séances faites. Sans ce filtre, le pied annoncerait comme « à venir » une
  // séance déjà faite ou explicitement sautée.
  const lines = upcoming
    .filter((s) => s.status === 'planned' && s.scheduledDate > todayKey)
    .sort(
      (a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) || a.orderIndex - b.orderIndex,
    )
    .slice(0, MAX_LINES)
    .map((s) =>
      t('home.upNext.session', {
        date: formatDayFull(s.scheduledDate),
        name: s.sessionName?.trim() || t('home.now.session.fallbackName'),
      }),
    );

  const hasToday = strengthToday.state === 'today-session' || runToday != null;

  return (
    <View style={styles.wrap}>
      {lines.length > 0 ? (
        <>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
            {t('home.upNext.eyebrow')}
          </Text>
          <View style={styles.lines}>
            {lines.map((line) => (
              <Text key={line} style={[styles.line, { color: colors.text }]} numberOfLines={2}>
                {line}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.links}>
        <Pressable
          onPress={() => router.push('/planning')}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.linkPrimary, { color: colors.accent }]}>
            {t('home.upNext.planning')}
          </Text>
        </Pressable>
        <Pressable onPress={onCustomize} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, { color: colors.textMuted }]}>
            {t('home.customize.edit')}
          </Text>
        </Pressable>
      </View>

      {/* Deux états vides distincts, et la nuance compte (correctif du 10/09/2026).
          « Rien de prévu cette semaine » affiché alors qu'une séance est prévue AUJOURD'HUI se lit
          comme une contradiction avec la carte du haut — c'est exactement ce qu'a relevé la
          recette. Quand il y a quelque chose aujourd'hui mais rien après, on dit « rien d'AUTRE ». */}
      {lines.length === 0 ? (
        <Text style={[styles.line, { color: colors.textMuted, marginTop: 8 }]}>
          {t(hasToday ? 'home.upNext.nothingElse' : 'home.upNext.empty')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 24, gap: 8 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lines: { gap: 6 },
  line: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  links: { flexDirection: 'row', gap: 18, marginTop: 4 },
  linkPrimary: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});
