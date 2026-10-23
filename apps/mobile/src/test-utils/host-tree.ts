/**
 * Lecture de l'arbre **hôte** rendu — pour les tests qui vérifient une disposition (US CLAV-01).
 *
 * RNTL v14 ne rend plus que l'arbre hôte et a retiré `UNSAFE_getByType` : on ne peut plus demander
 * « le `KeyboardAvoidingView` de cet écran ». On lit donc ce que l'écran **écrit** — un padding, des
 * arêtes de safe area — en parcourant `toJSON()`.
 *
 * ⚠️ Rangé dans `src/test-utils/` et non dans un `__tests__/` : Jest y verrait une suite vide.
 */

import { StyleSheet, type ViewStyle } from 'react-native';

export type HostNode = {
  type: string;
  props: Record<string, unknown>;
  children: (HostNode | string)[] | null;
};

/** Tous les nœuds hôtes de l'arbre, en profondeur d'abord (ordre du document). */
export function hostNodes(json: unknown): HostNode[] {
  const out: HostNode[] = [];
  const walk = (node: unknown) => {
    if (node == null || typeof node === 'string') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const host = node as HostNode;
    out.push(host);
    host.children?.forEach(walk);
  };
  walk(json);
  return out;
}

/** Le style aplati d'un nœud hôte. */
export function flatStyle(node: HostNode): ViewStyle {
  return (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;
}

/** Les nœuds dont le style porte un `paddingBottom` numérique non nul. */
export function nodesWithBottomPadding(json: unknown): { node: HostNode; paddingBottom: number }[] {
  return hostNodes(json)
    .map((node) => ({ node, paddingBottom: flatStyle(node).paddingBottom }))
    .filter(
      (e): e is { node: HostNode; paddingBottom: number } =>
        typeof e.paddingBottom === 'number' && e.paddingBottom > 0,
    );
}

/**
 * Le `SafeAreaView` pose-t-il son arête basse ? Le natif reçoit `edges` sous forme d'objet
 * (`{ top: 'additive', bottom: 'off', … }`) : une arête absente vaut `'off'`.
 */
export function hasBottomEdge(node: HostNode): boolean {
  const edges = node.props.edges as Record<string, string> | string[] | undefined;
  if (edges == null) return true; // défaut de react-native-safe-area-context : toutes les arêtes
  if (Array.isArray(edges)) return edges.includes('bottom');
  return edges.bottom != null && edges.bottom !== 'off';
}
