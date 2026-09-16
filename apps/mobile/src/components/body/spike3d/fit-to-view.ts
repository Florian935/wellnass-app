/**
 * Spike 3D — cadrage d'un modèle dans la vue de la caméra. **Code jetable.**
 *
 * Calcul pur, volontairement sorti du moteur : c'est de l'arithmétique, elle n'a rien à faire dans
 * un fichier qui ne tourne que dans une WebView et qu'aucun test ne peut atteindre.
 */

type Boite = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

type Camera = {
  /** Champ de vision **vertical**, en degrés. */
  fov: number;
  /** Distance de la caméra au plan du sujet. */
  distance: number;
  /** Hauteur de l'œil : c'est là que le regard porte, pas à `y = 0`. */
  y: number;
};

export type Ajustement = {
  scale: number;
  position: { x: number; y: number; z: number };
};

/** Part de la hauteur visible que le corps doit occuper — le reste est la marge. */
const REMPLISSAGE = 0.82;

export function fitToView(boite: Boite, camera: Camera): Ajustement {
  const centre = {
    x: (boite.min.x + boite.max.x) / 2,
    y: (boite.min.y + boite.max.y) / 2,
    z: (boite.min.z + boite.max.z) / 2,
  };
  const hauteur = boite.max.y - boite.min.y;

  // Hauteur réellement visible à cette distance, plutôt qu'une constante en dur : si la caméra
  // bouge, le cadrage suit au lieu de mentir.
  const hauteurVisible = 2 * camera.distance * Math.tan((camera.fov * Math.PI) / 360);
  const scale = hauteur > 0 ? (hauteurVisible * REMPLISSAGE) / hauteur : 1;

  // 🔴 Le décalage est **mis à l'échelle lui aussi**. La transformation locale de three est
  // `T · R · S` : la géométrie est mise à l'échelle autour de l'origine de l'objet PUIS translatée.
  // Soustraire le centre non mis à l'échelle laisse un résidu de `centre × (échelle − 1)` — c'est
  // ce résidu qui faisait sortir la tête du cadre le 16/09/2026.
  return {
    scale,
    position: {
      x: -centre.x * scale,
      // On vise la hauteur du regard, pas `y = 0` : sinon le corps est décentré de tout le décalage
      // vertical de la caméra.
      y: camera.y - centre.y * scale,
      z: -centre.z * scale,
    },
  };
}
