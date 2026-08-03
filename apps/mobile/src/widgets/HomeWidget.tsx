/**
 * US LAUNCHER-01 — widget de l'écran d'accueil Android (launcher), pas un widget in-app.
 *
 * Toutes les valeurs affichées arrivent déjà résolues (texte traduit, D4) — ce composant ne fait
 * que peindre. Rendu en `FlexWidget`/`TextWidget` de `react-native-android-widget` (image
 * RemoteViews), pas des composants RN standards (7 primitives seulement, cf. spec §1).
 *
 * Accessibilité (spec §6) : `accessibilityLabel` posé sur la racine couvre tout le widget d'un
 * seul bloc lu par TalkBack — la librairie le supporte nativement (`ClickActionProps`), le risque
 * initialement soulevé dans la spec est donc levé.
 */

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HomeWidgetTexts } from './home-widget-texts';

const CARD_BG = '#1c130c';
const CARD_ACCENT = '#dd6e40';
const CARD_TEXT = '#f4ecdd';
const CARD_MUTED = '#c9b79a';

export function HomeWidget({ texts }: { texts: HomeWidgetTexts }) {
  if (texts.authState === 'no-session') {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        accessibilityLabel={`${texts.noSessionText}. ${texts.openCta}`}
        style={{
          height: 'match_parent',
          width: 'match_parent',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: CARD_BG,
          padding: 16,
        }}
      >
        <TextWidget
          text={texts.noSessionText}
          style={{ fontSize: 13, color: CARD_MUTED, textAlign: 'center' }}
        />
        <TextWidget
          text={texts.openCta}
          style={{ fontSize: 12, color: CARD_ACCENT, textAlign: 'center', marginTop: 6 }}
        />
      </FlexWidget>
    );
  }

  const a11ySentences = [`${texts.streakLabel}: ${texts.streakValue}.`];
  if (texts.sessionText !== null) {
    a11ySentences.push(
      `${texts.todayLabel}: ${texts.sessionText}${texts.sessionSubtitle ? ` (${texts.sessionSubtitle})` : ''}.`,
    );
  }
  if (texts.kcalValue !== null) {
    a11ySentences.push(`${texts.kcalLabel}: ${texts.kcalValue}.`);
  }

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={a11ySentences.join(' ')}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-around',
        backgroundColor: CARD_BG,
        padding: 14,
      }}
    >
      <WidgetRow label={texts.streakLabel} value={texts.streakValue} />
      {texts.sessionText !== null && (
        <WidgetRow label={texts.todayLabel} value={texts.sessionText} sub={texts.sessionSubtitle} />
      )}
      {texts.kcalValue !== null && <WidgetRow label={texts.kcalLabel} value={texts.kcalValue} />}
    </FlexWidget>
  );
}

function WidgetRow({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <FlexWidget style={{ flexDirection: 'column' }}>
      <TextWidget text={label.toUpperCase()} style={{ fontSize: 10, color: CARD_MUTED, letterSpacing: 0.5 }} />
      <TextWidget text={value} style={{ fontSize: 17, color: CARD_TEXT, fontWeight: 'bold' }} />
      {sub != null && <TextWidget text={sub} style={{ fontSize: 11, color: CARD_MUTED }} />}
    </FlexWidget>
  );
}
