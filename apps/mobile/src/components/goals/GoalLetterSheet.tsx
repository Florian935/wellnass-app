/**
 * US LETTRE-01 — la feuille d'ouverture du mot écrit à son futur soi.
 *
 * ── Ce que cette feuille garantit ─────────────────────────────────────────────────────────────
 * Elle est **le seul endroit** où le texte de la lettre apparaît (R2). Ni la carte, ni une liste,
 * ni une notification ne le rendent : une lettre qu'on croise tous les jours ne veut plus rien dire.
 *
 * Le texte est affiché **tel quel** (R6) : aucune mise en forme, aucune reformulation, aucune
 * analyse — et rien n'est jamais envoyé à un service tiers (R7). C'est la parole de l'utilisateur.
 *
 * L'édition n'est proposée que **tant que l'objectif est en cours** (D4) : une lettre n'est pas un
 * contrat, et bloquer la correction ferait perdre des mots à la première faute de frappe. Vider le
 * texte **supprime** la lettre (cas limite §6) — le repository s'en charge, pas cet écran.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  formatDayFull,
  letterAgeDays,
  LETTER_MAX_LENGTH,
  shouldShowCounter,
  truncateLetter,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { setGoalLetter, type GoalWithProgress } from '@/data/repositories/goal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Au-delà de ce nombre de jours, l'ancienneté se dit en mois : « il y a 94 jours » ne parle pas. */
const AGE_MONTH_FROM_DAYS = 30;

/**
 * Ancienneté en toutes lettres (R4). Exportée pour être testée sans monter la feuille.
 * Les jours sont **pleins** : une lettre écrite ce matin dit « moins d'un jour », pas « il y a 0 ».
 */
export function formatLetterAge(t: TFunction, days: number): string {
  if (days <= 0) return t('goals.letter.ageToday');
  if (days < AGE_MONTH_FROM_DAYS) return t('goals.letter.ageDays', { count: days });
  return t('goals.letter.ageMonths', { count: Math.floor(days / AGE_MONTH_FROM_DAYS) });
}

type Props = {
  /** `null` = rien à ouvrir : la feuille reste fermée. */
  goal: GoalWithProgress | null;
  onClose: () => void;
};

export function GoalLetterSheet({ goal, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const visible = goal !== null && goal.letterText !== null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('goals.letter.close')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        {/*
          Monté à l'ouverture, avec une `key` par objectif : c'est ce qui remet l'édition à zéro
          entre deux lettres. Sans cela, rouvrir la feuille sur un autre objectif afficherait le
          brouillon du précédent — même patron que `GoalFormSheet`.
        */}
        {visible && goal !== null && <LetterBody key={goal.id} goal={goal} onClose={onClose} />}
      </View>
    </Modal>
  );
}

function LetterBody({ goal, onClose }: { goal: GoalWithProgress; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.letterText ?? '');
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  // Un geste qui écrit sans gestion d'erreur laisse croire que c'est enregistré (leçon CONF-06).
  const [error, setError] = useState<string | null>(null);

  const days = letterAgeDays(goal.letterWrittenAt, new Date());
  const editable = goal.progress.status === 'active';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setGoalLetter(goal.id, draft);
      // Texte vidé : la lettre disparaît (§6). On le DIT avant de refermer — voir l'enveloppe
      // s'évaporer sans un mot laisserait croire à une perte accidentelle.
      if (draft.trim().length === 0) {
        setDeleted(true);
        setEditing(false);
        return;
      }
      onClose();
    } catch {
      // Le brouillon reste à l'écran : perdre le texte de quelqu'un parce que l'écriture a échoué
      // serait la pire issue possible pour cette fonctionnalité-là.
      setError(t('goals.letter.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>{t('goals.letter.title')}</Text>

      {deleted ? (
        <Text style={[styles.deleted, { color: colors.textMuted }]}>
          {t('goals.letter.deleted')}
        </Text>
      ) : (
        <>
          {/* L'ancienneté précède le texte : c'est l'ordre visuel, et donc l'ordre de TalkBack. */}
          {days !== null && (
            <Text style={[styles.meta, { color: colors.textMuted }]} maxFontSizeMultiplier={1.4}>
              {t('goals.letter.written', {
                date: formatDayFull(goal.letterWrittenAt),
                age: formatLetterAge(t, days),
              })}
            </Text>
          )}

          {editing ? (
            <>
              <TextInput
                value={draft}
                onChangeText={(next) => setDraft(truncateLetter(next))}
                multiline
                maxLength={LETTER_MAX_LENGTH}
                placeholder={t('goals.letter.field.placeholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('goals.letter.field.label')}
                maxFontSizeMultiplier={1.4}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
              {shouldShowCounter(draft.length) && (
                <Text
                  style={[styles.counter, { color: colors.textMuted }]}
                  accessibilityLiveRegion="polite"
                >
                  {t('goals.letter.counter', { chars: draft.length, max: LETTER_MAX_LENGTH })}
                </Text>
              )}
              {error !== null && (
                <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
                  {error}
                </Text>
              )}
              <Button label={t('goals.letter.save')} onPress={() => void save()} loading={saving} />
            </>
          ) : (
            <Text style={[styles.body, { color: colors.text }]} maxFontSizeMultiplier={1.6}>
              {goal.letterText}
            </Text>
          )}
        </>
      )}

      {!editing && !deleted && editable && (
        <Button label={t('goals.letter.edit')} onPress={() => setEditing(true)} variant="ghost" />
      )}
      <Button label={t('goals.letter.close')} onPress={onClose} variant="ghost" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '85%' },
  content: { padding: 20, gap: 12 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  meta: { fontFamily: fontFamily.body, fontSize: 13 },
  // Le texte de l'utilisateur : plus grand que le reste, interligne large. C'est lui qu'on vient lire.
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  deleted: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 140,
    textAlignVertical: 'top',
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  counter: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'right' },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
