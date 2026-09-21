/**
 * US PARTAGE-01 — la carte partageable elle-même (course ou séance).
 *
 * ── Une seule vue, deux usages ────────────────────────────────────────────────────────────────────
 * Ce composant est à la fois **l'aperçu à l'écran** et **la source de la capture**. Tout est
 * dimensionné **proportionnellement à `size`** : dessinée à 320 dp elle sert d'aperçu, capturée à
 * 1080 px elle donne l'image partagée, sans deuxième mise en page à maintenir.
 *
 * ── Le tracé est du SVG, pas une capture de carte (décision D5) ──────────────────────────────────
 * `RouteMap` repose sur **MapLibre natif**, et capturer une vue native de carte donne une image
 * **noire ou vide**. Le tracé est donc reprojeté par `projectTrack` (@wellness/shared, 21 tests).
 * Bénéfice collatéral : aucune tuile à télécharger, donc **aucune clé MapTiler et aucun réseau**.
 *
 * ── Ce que la carte ne montre JAMAIS (décision D7) ───────────────────────────────────────────────
 * Ni poids, ni mensuration, ni indicateur de bien-être. Ce sont des données de santé, et une image
 * partie sur un réseau public ne se rattrape pas. Uniquement de l'activité.
 */

import { createContext, forwardRef, useContext } from 'react';
import { StyleSheet, Text, View, type TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  formatDayFull,
  isDrawableTrack,
  projectTrack,
  sampleTrack,
  SHARE_CARD_SIZE,
  trackPath,
  type SessionHeat,
  type ShareCardVariant,
  type TrackPoint,
} from '@wellness/shared';

import { BodyMapCanvas } from '@/components/body/BodyMapCanvas';
import { heatColor } from '@/components/workout/immersive/theme';
import { fontFamily } from '@/theme/fonts';

/**
 * Charte de la carte — direction **`proposed`** de la maquette
 * ([design/partage01-carte-partageable/](../../../../../design/partage01-carte-partageable/),
 * 30/07/2026), retenue contre la direction `existing` (bordeaux `#6b0028` + doré `#c9a96e`).
 *
 * ── Pourquoi avoir abandonné le bordeaux ──────────────────────────────────────────────────────────
 * Ce n'est **pas** un correctif d'accessibilité : les deux directions passaient AA sur le texte.
 * C'est une mise en cohérence. Le bordeaux ne renvoyait à rien de visible dans l'app, alors que
 * l'image, elle, circule **hors** de l'app : reprendre les couleurs du produit est ce qui le rend
 * reconnaissable quand quelqu'un tombe dessus sur Instagram.
 *
 * Ces valeurs sont **volontairement recopiées** du thème sombre plutôt que lues via `useTheme()` :
 * la carte doit rendre **à l'identique quel que soit le thème actif** de l'utilisateur — une carte
 * claire chez l'un et sombre chez l'autre ne serait plus une identité. Le lien avec la palette est
 * donc intentionnel mais figé.
 *
 * Contrastes vérifiés contre `CARD_BG` : texte 15,58 · secondaire 9,34 · accent 5,56 (AA ≥ 4,5).
 */
const CARD_BG = '#1c130c'; // = fond du thème sombre (#1c150e), à un cheveu
const CARD_ACCENT = '#dd6e40'; // = accent du thème sombre
const CARD_TEXT = '#f4ecdd'; // = text du thème sombre
const CARD_MUTED = '#c9b79a'; // = textMuted du thème sombre

/**
 * Cadre des records (tokens `--sc-recbg` / `--sc-recln` de la maquette) : l'accent à 14 % de fond et
 * 34 % de trait. Détache le bloc sans introduire une cinquième couleur.
 */
const RECORDS_BG = 'rgba(221,110,64,0.14)';
const RECORDS_BORDER = 'rgba(221,110,64,0.34)';

/** Nom affiché en pied de carte (décision D2 : discret, mais présent). */
const BRAND = 'Wellness';

export type ShareCardData =
  | {
      kind: 'run';
      /** Points GPS décodés. Vide ou dégénéré → carte sans tracé. */
      points: TrackPoint[];
      startedAtMs: number;
      /** Chiffres **déjà formatés** dans les unités de l'utilisateur. */
      stats: { distance: string; duration: string; pace: string };
    }
  | {
      kind: 'workout';
      startedAtMs: number;
      stats: { exercises: number; sets: number; volume: string; duration: string };
      /** Libellés des records battus. Vide → aucune section records (pas de section vide). */
      records: string[];
      /**
       * Chaleur par muscle de la séance (US MUSCU-UX03, §5.13). Optionnelle : sans elle, la carte
       * reste **exactement** celle d'avant. Avec elle, le corps travaillé devient l'image — ce que
       * trois chiffres ne racontent pas.
       *
       * ⚠️ Aucune donnée de santé n'entre ici : ni poids du corps, ni nutrition, ni douleur. Une
       * carte partagée sort de l'app ; ce qui s'y trouve doit pouvoir être vu par n'importe qui.
       */
      heat?: SessionHeat;
    };

type Props = {
  data: ShareCardData;
  /** Côté de la carte en points logiques. La capture demande 1080 px indépendamment. */
  size: number;
  /**
   * US PARTAGE-02 — `full` (défaut) est **strictement** la carte de PARTAGE-01 ; `transparent`
   * retire le fond et pose un halo sous chaque texte. PARTAGE-01 est en recette : aucun de ses
   * critères ne doit bouger, et un test de garde le vérifie.
   */
  variant?: ShareCardVariant;
};

/**
 * `forwardRef` : `captureRef` a besoin d'une référence sur la **vue racine** de la carte.
 */
/**
 * US PARTAGE-02 — la variante courante, partagée par tous les sous-composants de la carte.
 *
 * Un contexte plutôt que des props : `RunBody`, `WorkoutBody` et `Stat` n'ont aucune raison de
 * connaître la variante, ils ont seulement besoin que **leur texte** soit lisible. Faire descendre
 * un drapeau à travers quatre composants pour ça aurait pollué quatre signatures.
 */
const VariantContext = createContext<ShareCardVariant>('full');

/**
 * 🔴 **Le seul vrai point dur de cette US** (spec R5/R6).
 *
 * Sur fond opaque, le contraste est **vérifié et connu** : texte 15,58 · secondaire 9,34 · accent
 * 5,56 contre `CARD_BG`. Sur fond **transparent**, il devient **inconnaissable** — l'arrière-plan
 * est la photo de l'utilisateur, elle peut être blanche, claire, chargée.
 *
 * Chaque texte porte donc **sa propre lisibilité** : un halo sombre diffus, dont le rayon suit la
 * taille du texte. C'est la solution de tous les incrustateurs de story, et la seule qui tienne
 * sans connaître le fond. **Pas une plaque de fond** (spec D2) : elle annulerait l'intérêt même de
 * la transparence.
 */
const HALO_COLOR = 'rgba(12,8,4,0.55)';

function CardText({ style, ...rest }: TextProps) {
  const variant = useContext(VariantContext);
  if (variant !== 'transparent') return <Text style={style} {...rest} />;
  const flat = StyleSheet.flatten(style) as { fontSize?: number } | undefined;
  const radius = Math.max(4, Math.round((flat?.fontSize ?? 16) * 0.22));
  return (
    <Text
      style={[
        style,
        { textShadowColor: HALO_COLOR, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: radius },
      ]}
      {...rest}
    />
  );
}

export const ShareCard = forwardRef<View, Props>(function ShareCard({ data, size, variant = 'full' }, ref) {
  const { t } = useTranslation();

  // Toutes les dimensions dérivent de `size` : une seule mise en page pour l'aperçu et la capture.
  const pad = size * 0.075;
  const s = (ratio: number): number => Math.round(size * ratio);

  return (
    <VariantContext.Provider value={variant}>
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.card,
        {
          width: size,
          height: size,
          padding: pad,
          // `transparent` et non une couleur à alpha nul : c'est ce que `captureRef` sait traduire
          // en canal alpha dans le PNG.
          backgroundColor: variant === 'transparent' ? 'transparent' : CARD_BG,
        },
      ]}
    >
      <View style={styles.header}>
        <CardText
          style={[styles.title, { color: CARD_ACCENT, fontSize: s(0.042) }]}
          maxFontSizeMultiplier={1}
          numberOfLines={1}
        >
          {t(`share.${data.kind}.title`).toUpperCase()}
        </CardText>
        <CardText
          style={[styles.date, { color: CARD_MUTED, fontSize: s(0.032) }]}
          maxFontSizeMultiplier={1}
        >
          {formatDayFull(new Date(data.startedAtMs).toISOString())}
        </CardText>
      </View>

      <View style={styles.body}>
        {data.kind === 'run' ? (
          <RunBody points={data.points} size={size} />
        ) : (
          <WorkoutBody records={data.records} heat={data.heat} size={size} />
        )}
      </View>

      {/* Les chiffres : c'est le contenu, jamais une décoration. */}
      <View style={styles.stats}>
        {data.kind === 'run' ? (
          <>
            <Stat value={data.stats.distance} label={t('share.run.distance')} size={size} big />
            <Stat value={data.stats.duration} label={t('share.run.duration')} size={size} />
            <Stat value={data.stats.pace} label={t('share.run.pace')} size={size} />
          </>
        ) : (
          <>
            <Stat value={data.stats.volume} label={t('share.workout.volume')} size={size} big />
            <Stat
              value={String(data.stats.exercises)}
              label={t('share.workout.exercises')}
              size={size}
            />
            <Stat value={String(data.stats.sets)} label={t('share.workout.sets')} size={size} />
            <Stat value={data.stats.duration} label={t('share.workout.duration')} size={size} />
          </>
        )}
      </View>

      {/*
        `marginTop` proportionnel comme le reste de la carte : sans lui, la mention colle au
        libellé de la dernière statistique (« DURÉE ») et les deux se lisent comme une seule
        ligne — constaté en recette device du 31/07/2026, à l'aperçu comme à l'export.
      */}
      <CardText
        style={[styles.brand, { color: CARD_MUTED, fontSize: s(0.026), marginTop: s(0.028) }]}
        maxFontSizeMultiplier={1}
      >
        {BRAND}
      </CardText>
    </View>
    </VariantContext.Provider>
  );
});

/** Tracé de la course, ou rien du tout si le tracé n'est pas dessinable. */
function RunBody({ points, size }: { points: TrackPoint[]; size: number }) {
  const variant = useContext(VariantContext);
  // Pas de tracé exploitable (course manuelle, GPS bloqué) → on n'affiche RIEN plutôt qu'un artefact
  // d'un pixel. Les chiffres portent alors seuls la carte.
  if (!isDrawableTrack(points)) return null;

  // Le viewBox est en unités 1080 : la projection est calculée une fois pour toutes, et le SVG met à
  // l'échelle. C'est ce qui rend l'aperçu et la capture identiques au pixel près.
  const box = SHARE_CARD_SIZE;
  const projected = projectTrack(sampleTrack(points), {
    width: box,
    height: box * 0.62,
    padding: box * 0.06,
  });
  const d = trackPath(projected);
  const last = projected[projected.length - 1];

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${box} ${box * 0.62}`}>
      {/*
        Halo du tracé (US PARTAGE-02, R6) : le MÊME chemin dessiné dessous, plus épais et sombre.
        Sans lui, une polyligne terracotta posée sur une photo claire disparaît — et un tracé
        invisible vide la carte de ce qu'elle raconte.
      */}
      {variant === 'transparent' ? (
        <Path
          d={d}
          stroke={HALO_COLOR}
          strokeWidth={box * 0.024}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
      <Path
        d={d}
        stroke={CARD_ACCENT}
        strokeWidth={box * 0.011}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Point d'arrivée : repère de lecture du sens du parcours. */}
      {last !== undefined && (
        <Circle cx={last.x} cy={last.y} r={box * 0.016} fill={CARD_TEXT} />
      )}
    </Svg>
  );
}

/** Records battus, ou rien : une séance sans record n'affiche pas de section vide. */
function WorkoutBody({
  records,
  heat,
  size,
}: {
  records: string[];
  heat?: SessionHeat;
  size: number;
}) {
  const { t } = useTranslation();
  const s = (ratio: number): number => Math.round(size * ratio);

  const warmed = heat ? Object.values(heat).some((value) => (value ?? 0) > 0) : false;

  if (records.length === 0 && !warmed) return null;

  return (
    <View style={styles.workoutBody}>
      {warmed ? (
        <BodyMapCanvas
          full={[]}
          reduced={[]}
          heat={heat}
          heatColor={heatColor}
          height={s(0.34)}
          colors={{ neutral: 'rgba(244,236,221,0.14)', accent: CARD_ACCENT, caption: CARD_MUTED }}
          // Pas de légende « face / dos » sur une image carrée de 1080 px : l'espace sert aux
          // chiffres, et deux silhouettes côte à côte se lisent sans qu'on les nomme.
          frontLabel={null}
          backLabel={null}
          a11yLabel={t('share.workout.bodyA11y')}
        />
      ) : null}
      {records.length > 0 ? (
    <View
      style={[
        styles.records,
        {
          backgroundColor: RECORDS_BG,
          borderColor: RECORDS_BORDER,
          borderRadius: s(0.03),
          padding: s(0.03),
        },
      ]}
    >
      <CardText
        style={[styles.recordsTitle, { color: CARD_ACCENT, fontSize: s(0.034) }]}
        maxFontSizeMultiplier={1}
      >
        {t('share.workout.records')}
      </CardText>
      {/* Trois au maximum : au-delà, la carte devient une liste illisible. */}
      {records.slice(0, 3).map((record) => (
        <CardText
          key={record}
          style={[styles.recordLine, { color: CARD_TEXT, fontSize: s(0.038) }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1}
        >
          {record}
        </CardText>
      ))}
    </View>
      ) : null}
    </View>
  );
}

function Stat({
  value,
  label,
  size,
  big = false,
}: {
  value: string;
  label: string;
  size: number;
  big?: boolean;
}) {
  const s = (ratio: number): number => Math.round(size * ratio);
  return (
    <View style={styles.stat}>
      <CardText
        style={[styles.statValue, { color: CARD_TEXT, fontSize: s(big ? 0.082 : 0.05) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1}
      >
        {value}
      </CardText>
      <CardText
        style={[styles.statLabel, { color: CARD_MUTED, fontSize: s(0.024) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1}
      >
        {label.toUpperCase()}
      </CardText>
    </View>
  );
}

const styles = StyleSheet.create({
  workoutBody: { alignItems: 'center', gap: 14 },
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  header: { gap: 2 },
  title: { fontFamily: fontFamily.displayBold, letterSpacing: 1.5 },
  date: { fontFamily: fontFamily.body },
  body: { flex: 1, justifyContent: 'center' },
  // `borderWidth` fixe : c'est un trait, il ne doit pas grossir avec la carte (le rayon et le
  // rembourrage, eux, sont proportionnels à `size` — cf. l'aperçu à 320 dp).
  records: { gap: 4, borderWidth: 1 },
  recordsTitle: { fontFamily: fontFamily.bodySemi, letterSpacing: 1 },
  recordLine: { fontFamily: fontFamily.displayBold },
  stats: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' },
  stat: { gap: 1 },
  statValue: { fontFamily: fontFamily.displayBold },
  statLabel: { fontFamily: fontFamily.bodySemi, letterSpacing: 0.8 },
  brand: { fontFamily: fontFamily.bodySemi, letterSpacing: 1.2, textAlign: 'right' },
});
