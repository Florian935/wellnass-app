/**
 * US LABO-02 — l'onglet Croiser : tous les liens entre tes piliers, à un seul endroit.
 *
 * ── Ce que l'onglet dit, dans cet ordre ─────────────────────────────────────────────────────────
 *  1. une phrase : où on en est (un garde-fou d'abord, sinon ce qui est à régler, sinon ça tient) ;
 *  2. les liens rangés par **état** — garde-fou, à régler, ça tient, à découvrir. Un garde-fou n'est
 *     jamais masqué ni relégué (LABO-01 R3) ;
 *  3. la semaine réelle, pilier par pilier (ex-onglet Semaine) ;
 *  4. ce que l'écran n'est pas : des liens trouvés dans tes données, pas des preuves.
 *
 * La zone touchée sur la carte des disques filtre la liste ; « Tout voir » la rend entière.
 * Décision H : un pilier désactivé ne produit ni lien ni reproche — seulement, une fois, une ligne
 * discrète et masquable qui dit ce qu'il croiserait (Q4, 30/09/2026).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  CROSS_LINK_STATES,
  summarizeCrossLinks,
  type CrossLink,
  type CrossLinkAction,
  type CrossLinkState,
  type CrossLinkZone,
  type LabKnowledgeCard,
  type LabWeek,
} from '@wellness/shared';

import { CrossLinkCard } from './CrossLinkCard';
import { LabWeekOverview } from './LabWeekOverview';
import { LinkLens } from './LinkLens';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  links: readonly CrossLink[];
  learning: readonly LabKnowledgeCard[];
  week: LabWeek;
  zone: CrossLinkZone | null;
  zoneLabel: string | null;
  onClearZone: () => void;
  /** Ids des **propositions** « prêtes » / déjà appliquées (pas des liens : voir `lab.tsx`). */
  staged: readonly string[];
  applied: readonly string[];
  onOpenLink: (link: CrossLink) => void;
  onAction: (link: CrossLink, action: CrossLinkAction) => void;
  onOpenLearn: () => void;
  /** La ligne des piliers non activés (Q4), `null` si rien à dire ou masquée. */
  otherPillars: string | null;
  onHideOther: () => void;
};

/** Le geste principal d'un lien est-il dans cette liste de propositions ? */
function isIn(ids: readonly string[], link: CrossLink): boolean {
  const primary = link.actions[0];
  return primary !== undefined && primary.type === 'proposal' && ids.includes(primary.proposal.id);
}

const LEARNING_LENS = {
  shortNightPace: ['sleep', 'running'],
  heavyLegsPace: ['strength', 'running'],
  carbsPace: ['nutrition', 'running'],
} as const;

export function LabCrossPanel(props: Props) {
  const { links, learning, week, zone, zoneLabel, staged, applied } = props;
  const { t } = useTranslation();
  const { colors } = useTheme();

  const summary = summarizeCrossLinks(links);
  const visible = zone === null ? links : links.filter((l) => l.zone === zone);
  // Compte neuf : tout est « à découvrir », hormis les objectifs, lisibles dès l'inscription.
  const known = links.filter((l) => l.id !== 'goals');
  const onlyDiscover = known.length > 0 && known.every((l) => l.state === 'discover');

  const lead =
    summary.guard > 0
      ? t('lab.cross.leadGuard')
      : summary.adjust > 0
        ? t('lab.cross.leadAdjust', { count: summary.adjust })
        : onlyDiscover
          ? t('lab.cross.leadDiscover')
          : t('lab.cross.leadHolds');
  const sub = onlyDiscover ? t('lab.cross.subDiscover') : t('lab.cross.sub', { count: summary.total });

  const chips: { key: CrossLinkState; label: string; tone: string; dashed: boolean }[] = [];
  if (summary.guard > 0) chips.push({ key: 'guard', label: t('lab.cross.chips.guard', { count: summary.guard }), tone: colors.danger, dashed: false });
  if (summary.adjust > 0) chips.push({ key: 'adjust', label: t('lab.cross.chips.adjust', { count: summary.adjust }), tone: colors.amber, dashed: false });
  if (summary.holds > 0) chips.push({ key: 'holds', label: t('lab.cross.chips.holds', { count: summary.holds }), tone: colors.pillarLab, dashed: false });
  if (summary.discover > 0) chips.push({ key: 'discover', label: t('lab.cross.chips.discover', { count: summary.discover }), tone: colors.textMuted, dashed: true });

  const readyCount = staged.length;
  const meta = (state: CrossLinkState) =>
    state === 'guard'
      ? t('lab.cross.meta.guard')
      : state === 'adjust'
        ? readyCount > 0
          ? t('lab.cross.meta.ready', { count: readyCount })
          : t('lab.cross.meta.adjust')
        : state === 'discover'
          ? t('lab.cross.meta.discover')
          : '';

  const showLearning = zone === null || zone === 'centre' || zone === 'mc' || zone === 'cn';

  return (
    <View style={styles.panel} testID="lab-cross-panel">
      <View style={styles.head}>
        <Text style={[styles.lead, { color: colors.text }]} accessibilityRole="header">
          {lead}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>{sub}</Text>
      </View>

      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <View key={c.key} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.chipDot, c.dashed ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.tone } : { backgroundColor: c.tone }]} />
              <Text style={[styles.chipText, { color: colors.text }]}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {zone !== null && zoneLabel !== null ? (
        <View style={[styles.zoneBar, { backgroundColor: colors.surfaceAlt }]} testID="lab-zone-filter">
          <Text style={[styles.zoneText, { color: colors.text }]}>{zoneLabel}</Text>
          <Pressable accessibilityRole="button" onPress={props.onClearZone} style={[styles.zoneButton, { borderColor: colors.pillarLab }]}>
            <Text style={[styles.zoneButtonText, { color: colors.pillarLab }]}>{t('lab.cross.showAll')}</Text>
          </Pressable>
        </View>
      ) : null}

      {CROSS_LINK_STATES.map((state) => {
        const items = visible.filter((l) => l.state === state);
        const learningItems = state === 'discover' && showLearning ? learning : [];
        if (items.length === 0 && learningItems.length === 0) return null;
        return (
          <View key={state} style={styles.section} testID={`lab-section-${state}`}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: colors.pillarLab }]}>{t(`lab.cross.sections.${state}`)}</Text>
              <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{meta(state)}</Text>
            </View>
            {items.map((link) => (
              <CrossLinkCard
                key={link.id}
                link={link}
                staged={isIn(staged, link)}
                applied={isIn(applied, link)}
                onOpenLink={props.onOpenLink}
                onAction={props.onAction}
              />
            ))}
            {learningItems.map((card) => {
              const cases = Number(card.values.cases ?? 0);
              const needed = Math.max(1, Number(card.values.needed ?? 1));
              const lens = LEARNING_LENS[card.kind as keyof typeof LEARNING_LENS] ?? ['sleep', 'running'];
              return (
                <Pressable
                  key={card.id}
                  testID={`lab-learning-${card.kind}`}
                  accessibilityRole="button"
                  onPress={props.onOpenLearn}
                  style={[styles.learning, { borderColor: colors.textMuted }]}
                >
                  <View style={styles.row}>
                    <LinkLens lens={lens} dashed />
                    <Text style={[styles.learningTitle, { color: colors.text }]}>{t(`lab.links.learning.${card.kind}`)}</Text>
                  </View>
                  <Text style={[styles.learningText, { color: colors.textMuted }]}>{t('lab.links.learning.missing', { cases, needed })}</Text>
                  <View style={styles.row}>
                    <View style={[styles.meter, { backgroundColor: colors.border }]}>
                      <View style={[styles.meterFill, { width: `${Math.round((Math.min(cases, needed) / needed) * 100)}%`, backgroundColor: colors.pillarLab }]} />
                    </View>
                    <Text style={[styles.meterText, { color: colors.textMuted }]}>{t('lab.links.learning.meter', { cases, needed })}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}

      {props.otherPillars !== null ? (
        <View style={[styles.other, { borderColor: colors.textMuted }]} testID="lab-other-pillars">
          <Text style={[styles.otherText, { color: colors.textMuted }]}>{props.otherPillars}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('lab.cross.hideOther')} onPress={props.onHideOther} hitSlop={8} style={styles.otherClose}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <LabWeekOverview week={week} />

      <Text style={[styles.honest, { color: colors.textMuted }]}>{t('lab.cross.honest')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 18 },
  head: { gap: 6 },
  lead: { fontFamily: fontFamily.displayBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  sub: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, minHeight: 28 },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  zoneBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 14, paddingVertical: 8, paddingLeft: 14, paddingRight: 8 },
  zoneText: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  zoneButton: { minHeight: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center' },
  zoneButtonText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  sectionTitle: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
  sectionMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  learning: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', padding: 14, gap: 10 },
  learningTitle: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19 },
  learningText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  meter: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  meterText: { fontFamily: fontFamily.monoBold, fontSize: 11 },
  other: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 12, paddingRight: 8 },
  otherText: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  otherClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  honest: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },
});
