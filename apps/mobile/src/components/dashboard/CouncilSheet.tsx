/**
 * US CONS-01 — le Conseil : les deux issues d'une contradiction, chiffrées.
 *
 * ── Ce que cet écran ajoute, et ce qu'il ne touche pas ────────────────────────────────────────
 * Il **n'ajoute aucune écriture** : les deux boutons du bas sont ceux de la carte de GUID-01, avec
 * les mêmes conséquences. Ce qui change, c'est qu'on sait enfin ce qu'elles coûtent — calories,
 * poids à huit semaines, protéines, force avec sa fourchette, et les tensions que chaque voie crée.
 *
 * ── Deux refus assumés ───────────────────────────────────────────────────────────────────────
 * 1. **Aucun chrono, aucune allure** : la maquette du 13/09 en affichait (« 19:35–20:10 »), mais
 *    aucun calcul validé du dépôt ne relie une dose à un temps de course. L'écran le dit.
 * 2. **Pas de troisième voie** : composer un compromis intermédiaire supposerait de savoir pondérer
 *    deux intentions. L'app constate, chiffre, et laisse trancher.
 *
 * Le corps n'est monté qu'à l'ouverture : c'est lui qui interroge la base, et l'accueil n'a pas à
 * payer ces requêtes pour un panneau que personne n'a encore ouvert.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildCouncil,
  councilNumbers,
  LAB_PROJECTION_WEEKS,
  type Council,
  type CouncilOption,
  type GoalConflict,
  type NarrationDossier,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { LabNarration } from '@/components/lab/LabNarration';
import { useLabComposer } from '@/data/repositories/lab-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  conflict: GoalConflict;
  onKeepMainGoal: () => void;
  onKeepPillarGoal: () => void;
  onClose: () => void;
};

export function CouncilSheet({ visible, conflict, onKeepMainGoal, onKeepPillarGoal, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {visible ? (
          <CouncilBody
            conflict={conflict}
            onKeepMainGoal={onKeepMainGoal}
            onKeepPillarGoal={onKeepPillarGoal}
            onClose={onClose}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function CouncilBody({
  conflict,
  onKeepMainGoal,
  onKeepPillarGoal,
  onClose,
}: Omit<Props, 'visible'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { context, isLoading } = useLabComposer();
  const { settings } = useSettings();

  const council = isLoading ? null : buildCouncil(conflict, context);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{t('council.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('council.subtitle')}</Text>

      {council === null ? (
        /*
          Pas assez de données pour chiffrer (ni poids, ni dépense de référence), ou base encore en
          chargement. On le DIT plutôt que de masquer le lien depuis l'accueil : vérifier la
          condition là-bas obligerait l'écran d'accueil à charger tout le contexte du Labo pour un
          panneau que personne n'a ouvert.
        */
        <Text style={[styles.text, { color: colors.textMuted }]}>{t('council.notEnough')}</Text>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('council.voices')}</Text>
          {council.voices.map((voice) => (
            <View
              key={voice.pillar}
              testID={`council-voice-${voice.pillar}`}
              style={[styles.voice, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.voicePillar, { color: colors.textMuted }]}>
                {t(`pillars.${voice.pillar}`)}
              </Text>
              <Text style={[styles.text, { color: colors.text }]}>
                {t(`council.voice.${voice.id}`, voice.values)}
              </Text>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t('council.options')}
          </Text>
          <Text style={[styles.text, { color: colors.textMuted }]}>
            {t('council.horizon', { weeks: LAB_PROJECTION_WEEKS })}
          </Text>

          {council.options.map((option) => (
            <OptionBlock key={option.id} option={option} />
          ))}

          <Text style={[styles.note, { color: colors.textMuted }]}>{t('council.noPace')}</Text>

          {/* US NARR-01 réutilisée telle quelle, garde-fou compris : le modèle raconte, il ne calcule pas. */}
          {settings?.aiConsentAt != null ? (
            <LabNarration dossier={councilDossier(council, t)} />
          ) : null}
        </>
      )}

      <View style={styles.actions}>
        <Button label={t('goalConflict.keepMainGoal')} onPress={() => { onKeepMainGoal(); onClose(); }} />
        <Button
          label={t('goalConflict.keepPillarGoal')}
          variant="ghost"
          onPress={() => { onKeepPillarGoal(); onClose(); }}
        />
        <Button label={t('common.close')} variant="ghost" onPress={onClose} />
      </View>
    </ScrollView>
  );
}

/** Un bloc par issue : ses chiffres, puis ce qu'elle tend. */
function OptionBlock({ option }: { option: CouncilOption }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { projection } = option;

  return (
    <View
      testID={`council-option-${option.id}`}
      style={[styles.option, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t(`goalConflict.${option.id}`)}
      </Text>

      {projection.kcalTarget !== null ? (
        <Text style={[styles.text, { color: colors.text }]}>
          {t('council.kcal', { value: projection.kcalTarget })}
        </Text>
      ) : null}

      <Text style={[styles.text, { color: colors.text }]}>
        {t('council.weight', { value: formatSigned(projection.weightChangeKg) })}
      </Text>

      {projection.proteinGPerDay !== null ? (
        <Text style={[styles.text, { color: colors.text }]}>
          {t('council.protein', { value: projection.proteinGPerDay })}
        </Text>
      ) : null}

      {projection.sbd !== null ? (
        <Text style={[styles.text, { color: colors.text }]}>
          {t('council.strength', {
            delta: formatSigned(projection.sbd.deltaKg),
            low: Math.round(projection.sbd.lowKg),
            high: Math.round(projection.sbd.highKg),
          })}
        </Text>
      ) : (
        <Text style={[styles.text, { color: colors.textMuted }]}>{t('council.noStrength')}</Text>
      )}

      {projection.crossings.length > 0 ? (
        <>
          <Text style={[styles.tensionTitle, { color: colors.textMuted }]}>
            {t('council.tensions')}
          </Text>
          {projection.crossings.map((crossing) => (
            <Text key={crossing.kind} style={[styles.text, { color: colors.textMuted }]}>
              {t(`lab.crossings.${crossing.kind}`, crossing.values)}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

/** « +2,4 » / « −1,8 » : le signe fait partie de l'information, surtout sur un poids. */
function formatSigned(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

/** Le Conseil en dossier, pour que NARR-01 le résume avec son garde-fou. */
function councilDossier(
  council: Council,
  t: (key: string, options?: Record<string, unknown>) => string,
): NarrationDossier {
  return {
    headline: t('council.title'),
    facts: council.options.map((option) => ({
      label: t(`goalConflict.${option.id}`),
      detail: [
        option.projection.kcalTarget === null
          ? null
          : t('council.kcal', { value: option.projection.kcalTarget }),
        t('council.weight', { value: formatSigned(option.projection.weightChangeKg) }),
        option.projection.proteinGPerDay === null
          ? null
          : t('council.protein', { value: option.projection.proteinGPerDay }),
      ]
        .filter((line): line is string => line !== null)
        .join(' · '),
      values: [],
    })),
    cleared: [],
    missing: [],
    experiment: null,
    // Les chiffres autorisés viennent du moteur : c'est la même liste que celle affichée.
  };
}

/** Exporté pour le test : la liste de référence du garde-fou, quand le modèle résume le Conseil. */
export function councilAllowedNumbers(council: Council): number[] {
  return councilNumbers(council);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '90%' },
  content: { padding: 20, gap: 10 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 8 },
  voice: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 2 },
  voicePillar: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' },
  option: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  optionTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  tensionTitle: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  text: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  note: { fontFamily: fontFamily.body, fontSize: 12, fontStyle: 'italic', lineHeight: 16, marginTop: 6 },
  actions: { gap: 8, marginTop: 12 },
});
