import type { TextStyle } from 'react-native';
import { fontFamily } from './fonts';

/**
 * Presets typographiques sémantiques. On applique une **famille** (qui porte déjà la graisse)
 * plutôt qu'un `fontWeight` — les polices custom sont livrées par graisse.
 */
export const typography = {
  display: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 22, letterSpacing: -0.5 },
  heading: { fontFamily: fontFamily.displaySemi, fontSize: 18, letterSpacing: -0.3 },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  button: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  caption: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  overline: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fontFamily.mono, fontSize: 14 },
} satisfies Record<string, TextStyle>;
