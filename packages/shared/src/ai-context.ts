/**
 * US IA-LAB-01 — le **contexte** envoyé au modèle, et rien d'autre.
 *
 * ── Ce que ce fichier est vraiment ───────────────────────────────────────────────────────────────
 * C'est la **minimisation du RGPD écrite en code** (`docs/product/ia-integration-analyse.md` §5).
 * Tout ce qui sort de l'appareil vers un fournisseur tiers passe par ici, et par ici seulement. Le
 * type `AiSnapshot` est donc une **liste blanche** : ce qui n'y figure pas ne peut pas partir.
 *
 * Trois choses en sont volontairement absentes, et doivent le rester :
 *   - **toute identité** — ni nom, ni e-mail, ni identifiant, ni date de naissance (l'âge suffit) ;
 *   - **tout texte libre** — notes de séance, notes d'exercice, journal de douleur : ce sont les
 *     champs où une personne écrit ce qu'elle ne dirait à personne d'autre ;
 *   - **tout journal brut** — on envoie des agrégats sur une fenêtre, jamais la ligne à ligne, et
 *     jamais de trace GPS (une trace de course, c'est une adresse de domicile).
 *
 * 🔴 **Et si le fournisseur est un palier gratuit, il peut s'entraîner dessus** (§7.2). Le labo ne
 * doit donc tourner que sur des données factices — c'est le rôle de
 * `supabase/scripts/ia-purge-et-dataset.sql`.
 *
 * ── Pourquoi une brique pure ─────────────────────────────────────────────────────────────────────
 * Parce qu'on doit pouvoir **lire, en test, exactement ce qui part**. Une construction de contexte
 * noyée dans un écran ne se relit pas ; ici, un test suffit à prouver qu'un nom n'y entre pas.
 */

/**
 * Fenêtre de comparaison : les 28 derniers jours contre les 28 précédents.
 *
 * 🔴 **Sans elle, le contexte ne porte aucune tendance** — et c'est le défaut qu'a révélé la
 * première recette du 16/09/2026. Un agrégat unique sur 90 jours donne « allure moyenne 5:32/km »,
 * « 2 400 kcal/jour », « développé couché 82,5 kg » : trois nombres justes dont **aucun** ne permet
 * de voir une stagnation, une chute ou une dégradation. On demandait au modèle de trouver des
 * tendances en ne lui montrant que des moyennes.
 *
 * 28 jours parce que c'est la plus courte fenêtre qui lisse les variations hebdomadaires (une
 * semaine de décharge, un week-end sans journal) tout en restant assez serrée pour qu'un
 * changement de 3 semaines y soit encore visible.
 */
export const AI_TREND_WINDOW_DAYS = 28;

/**
 * Une même mesure sur les deux fenêtres. `null` quand la période ne porte pas assez de données —
 * jamais 0, qui se lirait comme « il n'a rien fait » au lieu de « on ne sait pas ».
 */
export type AiTrend = { recent: number | null; previous: number | null };

/** Profil, réduit à ce qui change une recommandation d'entraînement ou de nutrition. */
export type AiSnapshotProfile = {
  /** Les trois valeurs de `profiles.sex` en base. `unspecified` est un choix, pas une absence. */
  sex: 'female' | 'male' | 'unspecified' | null;
  /** L'**âge**, jamais la date de naissance : un identifiant direct en moins. */
  ageYears: number | null;
  heightCm: number | null;
  activePillars: readonly string[];
  nutritionObjective: string | null;
  targetKcal: number | null;
  targetProteinG: number | null;
};

/** Poids : les deux bornes de la fenêtre et le nombre de pesées. Jamais la courbe complète. */
export type AiSnapshotWeight = {
  firstKg: number;
  lastKg: number;
  count: number;
  firstDate: string;
  lastDate: string;
  /**
   * 🔴 Sans elle, un plateau est indétectable. Les deux bornes disent « 82 → 78 kg », c'est-à-dire
   * une perte — alors que la perte peut s'être **arrêtée** il y a un mois. Deux moyennes de fenêtre
   * proches le disent ; deux bornes éloignées ne le diront jamais.
   */
  weightTrend: AiTrend;
};

export type AiSnapshotStrength = {
  sessions: number;
  totalVolumeKg: number;
  avgSessionMinutes: number | null;
  byMuscle: readonly { muscle: string; sets: number; volumeKg: number }[];
  /**
   * 🔴 Les groupes musculaires **sans une seule série** sur la période.
   *
   * ── Pourquoi ça ne contredit PAS R5 (« une section absente est omise, jamais mise à zéro ») ─────
   * R5 parle d'un **pilier que la personne ne suit pas** : y écrire « 0 sortie » ferait conclure à
   * l'inactivité au lieu du désintérêt. Ici c'est l'inverse. La musculation EST suivie, et la
   * taxonomie des groupes est **fermée et connue** (`MUSCLE_GROUPS`, six entrées) : un groupe à zéro
   * n'est pas une donnée manquante, c'est un fait — et souvent le plus intéressant de tous.
   *
   * ── Ce qui a rendu ce champ nécessaire (recette du 17/09/2026) ──────────────────────────────────
   * À la question « quel est mon angle mort ? », le modèle a répondu par le déficit calorique — une
   * bonne analyse, mais pas la réponse. Le vrai angle mort (zéro série d'épaules, de bras et de
   * gainage en 120 jours) lui était **inatteignable** : on ne lui montrait que `back, chest, legs`,
   * sans jamais lui dire que la liste en compte six. L'absence n'est pas une donnée tant qu'on ne la
   * nomme pas.
   */
  untrainedMuscles: readonly string[];
  /** Les séries les plus lourdes par exercice — la trace de progression la plus lisible. */
  topSets: readonly { exercise: string; weightKg: number; reps: number }[];
  /**
   * Charge max par exercice sur les deux fenêtres. C'est **ici** que se voit une stagnation : deux
   * valeurs identiques disent « bloqué depuis un mois », ce qu'un seul maximum ne dira jamais.
   */
  progression: readonly { exercise: string; recentMaxKg: number; previousMaxKg: number | null }[];
};

export type AiSnapshotRunning = {
  runs: number;
  totalKm: number;
  totalMinutes: number;
  avgPaceSPerKm: number | null;
  longestKm: number;
  /** Allure **pondérée par la distance** (et non moyenne des allures) sur les deux fenêtres. */
  paceTrend: AiTrend;
};

export type AiSnapshotNutrition = {
  daysLogged: number;
  avgKcal: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
  kcalTrend: AiTrend;
  proteinTrend: AiTrend;
};

export type AiSnapshotActivity = { type: string; sessions: number; minutes: number };

export type AiSnapshotWellbeing = {
  daysLogged: number;
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  /** US LABO-01 — durée de la nuit précédente, saisie. En minutes, `null` si jamais renseignée. */
  avgSleepMinutes: number | null;
  energyTrend: AiTrend;
  stressTrend: AiTrend;
  sleepTrend: AiTrend;
};

export type AiSnapshotSteps = { daysLogged: number; avgSteps: number; stepsTrend: AiTrend };

export type AiSnapshot = {
  windowDays: number;
  /** Jour de génération (`YYYY-MM-DD`) : sans lui, « cette semaine » n'a pas de sens pour le modèle. */
  generatedOn: string;
  /** Durée de chacune des deux fenêtres de comparaison (`AI_TREND_WINDOW_DAYS`). */
  trendWindowDays: number;
  profile: AiSnapshotProfile;
  weight: AiSnapshotWeight | null;
  strength: AiSnapshotStrength | null;
  running: AiSnapshotRunning | null;
  nutrition: AiSnapshotNutrition | null;
  activities: readonly AiSnapshotActivity[];
  wellbeing: AiSnapshotWellbeing | null;
  steps: AiSnapshotSteps | null;
};

/** Arrondi à une décimale, sans `.0` inutile — le contexte se lit, et chaque caractère est payé. */
function num(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Allure en `m:ss/km`. `null` quand la distance est nulle : une allure inventée serait un faux. */
export function formatPace(secondsPerKm: number | null): string | null {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return null;
  const total = Math.round(secondsPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

/**
 * Rend une tendance en une ligne factuelle : les deux valeurs, et l'écart en pourcentage.
 *
 * ⚠️ **Aucune interprétation ici.** Le pourcentage est de l'arithmétique sur deux nombres qu'on a
 * déjà ; écrire « tu manques de protéines » serait décider à la place du modèle ce qu'on lui
 * demande justement de trouver. Le seul mot qualitatif est « stable », et il est calculé (écart
 * sous 3 %), pas jugé.
 *
 * `null` si l'une des deux fenêtres manque : une comparaison à moitié vide est pire qu'absente,
 * parce qu'elle se lit quand même.
 */
function trendLine(label: string, trend: AiTrend, unit: string): string | null {
  const { recent, previous } = trend;
  if (recent === null || previous === null) return null;
  const delta = previous === 0 ? null : ((recent - previous) / Math.abs(previous)) * 100;
  const qualifier =
    delta === null
      ? ''
      : Math.abs(delta) < 3
        ? ' — stable'
        : ` — ${delta > 0 ? '+' : ''}${num(delta)} %`;
  return `${label} ${num(recent)}${unit} contre ${num(previous)}${unit}${qualifier}`;
}

/**
 * Sérialise l'instantané en un bloc de texte compact.
 *
 * **Une section absente est omise, jamais mise à zéro.** « Course : 0 sortie » et « la course n'est
 * pas suivie » sont deux situations différentes, et un modèle à qui l'on montre des zéros conclut à
 * l'inactivité — puis recommande de s'y mettre, pour un pilier que la personne a désactivé.
 */
export function buildAiContext(snapshot: AiSnapshot): string {
  const lines: string[] = [];

  const win = snapshot.trendWindowDays;

  lines.push(`Période analysée : ${snapshot.windowDays} derniers jours (au ${snapshot.generatedOn}).`);

  const p = snapshot.profile;
  const profileBits: string[] = [];
  if (p.sex) profileBits.push(`sexe ${p.sex}`);
  if (p.ageYears !== null) profileBits.push(`${p.ageYears} ans`);
  if (p.heightCm !== null) profileBits.push(`${num(p.heightCm)} cm`);
  if (p.activePillars.length > 0) profileBits.push(`piliers suivis : ${p.activePillars.join(', ')}`);
  if (p.nutritionObjective) profileBits.push(`objectif : ${p.nutritionObjective}`);
  if (p.targetKcal !== null) profileBits.push(`cible ${p.targetKcal} kcal/jour`);
  if (p.targetProteinG !== null) profileBits.push(`cible ${p.targetProteinG} g de protéines/jour`);
  if (profileBits.length > 0) lines.push(`PROFIL — ${profileBits.join(' · ')}.`);

  if (snapshot.weight) {
    const w = snapshot.weight;
    const delta = w.lastKg - w.firstKg;
    const sign = delta > 0 ? '+' : '';
    lines.push(
      `POIDS — ${num(w.firstKg)} kg le ${w.firstDate} → ${num(w.lastKg)} kg le ${w.lastDate} ` +
        `(${sign}${num(delta)} kg sur ${w.count} pesées).`,
    );
  }

  if (snapshot.strength) {
    const s = snapshot.strength;
    const head =
      `MUSCULATION — ${s.sessions} séances, volume total ${num(s.totalVolumeKg)} kg` +
      (s.avgSessionMinutes !== null ? `, ${num(s.avgSessionMinutes)} min en moyenne` : '') +
      '.';
    lines.push(head);
    if (s.byMuscle.length > 0) {
      const detail = s.byMuscle
        .map((m) => `${m.muscle} ${m.sets} séries / ${num(m.volumeKg)} kg`)
        .join(' · ');
      lines.push(`  Par groupe : ${detail}.`);
    }
    if (s.topSets.length > 0) {
      const detail = s.topSets
        .map((t) => `${t.exercise} ${num(t.weightKg)} kg × ${t.reps}`)
        .join(' · ');
      lines.push(`  Meilleures séries : ${detail}.`);
    }
    if (s.untrainedMuscles.length > 0) {
      lines.push(`  Aucune série sur : ${s.untrainedMuscles.join(', ')}.`);
    }
    if (s.progression.length > 0) {
      const detail = s.progression
        .map((pr) =>
          pr.previousMaxKg === null
            ? `${pr.exercise} ${num(pr.recentMaxKg)} kg (rien avant)`
            : `${pr.exercise} ${num(pr.recentMaxKg)} kg contre ${num(pr.previousMaxKg)} kg`,
        )
        .join(' · ');
      lines.push(`  Charge max, ${win} derniers jours contre les ${win} précédents : ${detail}.`);
    }
  }

  if (snapshot.running) {
    const r = snapshot.running;
    const pace = formatPace(r.avgPaceSPerKm);
    lines.push(
      `COURSE — ${r.runs} sorties, ${num(r.totalKm)} km, ${num(r.totalMinutes)} min` +
        (pace ? `, allure moyenne ${pace}` : '') +
        `, plus longue ${num(r.longestKm)} km.`,
    );
  }

  if (snapshot.nutrition) {
    const n = snapshot.nutrition;
    lines.push(
      `NUTRITION — ${n.daysLogged} jours journalisés, moyenne ${n.avgKcal} kcal ` +
        `(${num(n.avgProteinG)} g protéines · ${num(n.avgCarbsG)} g glucides · ${num(n.avgFatG)} g lipides).`,
    );
  }

  if (snapshot.activities.length > 0) {
    const detail = snapshot.activities
      .map((a) => `${a.type} ${a.sessions}× / ${num(a.minutes)} min`)
      .join(' · ');
    lines.push(`AUTRES ACTIVITÉS — ${detail}.`);
  }

  if (snapshot.steps) {
    lines.push(
      `PAS — ${snapshot.steps.avgSteps} pas/jour en moyenne sur ${snapshot.steps.daysLogged} jours.`,
    );
  }

  if (snapshot.wellbeing) {
    const w = snapshot.wellbeing;
    const bits: string[] = [];
    if (w.avgMood !== null) bits.push(`humeur ${num(w.avgMood)}/5`);
    if (w.avgEnergy !== null) bits.push(`énergie ${num(w.avgEnergy)}/5`);
    if (w.avgStress !== null) bits.push(`stress ${num(w.avgStress)}/5`);
    if (w.avgSleepMinutes !== null) bits.push(`sommeil ${num(w.avgSleepMinutes / 60)} h/nuit`);
    if (bits.length > 0) {
      lines.push(`BIEN-ÊTRE — ${bits.join(' · ')} sur ${w.daysLogged} jours renseignés.`);
    }
  }

  // ── TENDANCES ────────────────────────────────────────────────────────────────────────────────
  // Rassemblées en fin de bloc plutôt que dispersées dans chaque pilier : une stagnation ne se lit
  // qu'en comparant, et mettre les comparaisons côte à côte est ce qui rend un croisement possible.
  const trends = [
    snapshot.weight ? trendLine('poids', snapshot.weight.weightTrend, ' kg') : null,
    snapshot.nutrition ? trendLine('calories', snapshot.nutrition.kcalTrend, ' kcal/j') : null,
    snapshot.nutrition ? trendLine('protéines', snapshot.nutrition.proteinTrend, ' g/j') : null,
    snapshot.running ? trendLine('allure', snapshot.running.paceTrend, ' s/km') : null,
    snapshot.wellbeing ? trendLine('énergie', snapshot.wellbeing.energyTrend, '/5') : null,
    snapshot.wellbeing ? trendLine('stress', snapshot.wellbeing.stressTrend, '/5') : null,
    snapshot.wellbeing ? trendLine('sommeil', snapshot.wellbeing.sleepTrend, ' min/nuit') : null,
    snapshot.steps ? trendLine('pas', snapshot.steps.stepsTrend, '/j') : null,
  ].filter((line): line is string => line !== null);

  if (trends.length > 0) {
    lines.push(`TENDANCES — ${win} derniers jours contre les ${win} précédents :`);
    for (const line of trends) lines.push(`  ${line}.`);
  }

  return lines.join('\n');
}

/**
 * Les questions proposées dans le labo. Ce sont des **clés i18n**, pas des phrases : le libellé
 * affiché est traduit côté app, et c'est lui qui part au modèle (pour qu'il réponde dans la langue
 * de la personne).
 *
 * Elles couvrent les trois usages que l'analyse distingue : le bilan routinier (§1 usage 1), la
 * cause (« pourquoi »), et le conseil d'expert (§1 usage 2). Le but du labo est de voir **où ça
 * casse** — donc `blindSpot` est là exprès : c'est la question dont on sait qu'elle invite le modèle
 * à inventer, et sa réponse dit tout de sa fiabilité.
 */
export const AI_LAB_QUESTIONS = [
  'weeklyReview',
  'whyStalling',
  'nutritionCheck',
  'nextWeek',
  'crossPillar',
  'blindSpot',
] as const;
export type AiLabQuestion = (typeof AI_LAB_QUESTIONS)[number];
