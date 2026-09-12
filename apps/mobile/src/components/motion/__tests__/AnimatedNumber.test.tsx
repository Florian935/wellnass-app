import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { AnimatedNumber } from '../AnimatedNumber';

/**
 * On teste le **contrat**, pas la trajectoire : Jest ne fait pas tourner d'horloge Reanimated, et
 * vérifier des valeurs intermédiaires reviendrait à tester le framework. Ce qui compte ici est ce
 * que voit — et ce qu'entend — l'utilisateur une fois l'animation finie.
 *
 * Le chiffre visible se lit sur `defaultValue` : `getByDisplayValue` ne regarde que `value`, que ce
 * composant ne pose **jamais** (il figerait le contenu côté JS et annulerait la piste d'animation).
 */
async function valeurAffichee(element: ReactElement): Promise<string> {
  const { getByTestId } = await render(element);
  // `includeHiddenElements` est **nécessaire** et documente le comportement : le champ est
  // délibérément masqué aux lecteurs d'écran (c'est la vue parente qui porte le nom accessible),
  // et les requêtes RNTL ignorent par défaut ce qui est hors de l'arbre d'accessibilité.
  return getByTestId('nombre', { includeHiddenElements: true }).props.defaultValue as string;
}

describe('AnimatedNumber', () => {
  it('affiche la valeur d’arrivée formatée', async () => {
    // Espace fine insécable tous les trois chiffres : la typographie française, pas la virgule.
    await expect(valeurAffichee(<AnimatedNumber value={1715} testID="nombre" />)).resolves.toBe(
      '1 715',
    );
  });

  it('n’ajoute pas de séparateur sous le millier', async () => {
    await expect(valeurAffichee(<AnimatedNumber value={942} testID="nombre" />)).resolves.toBe(
      '942',
    );
  });

  it('groupe les grands nombres par tranches de trois', async () => {
    await expect(valeurAffichee(<AnimatedNumber value={1234567} testID="nombre" />)).resolves.toBe(
      '1 234 567',
    );
  });

  it('utilise la virgule décimale', async () => {
    await expect(
      valeurAffichee(<AnimatedNumber value={78.4} decimals={1} testID="nombre" />),
    ).resolves.toBe('78,4');
  });

  it('sait se passer du groupement', async () => {
    // Une année, un identifiant : tout ce qui est un nombre sans être une quantité.
    await expect(
      valeurAffichee(<AnimatedNumber value={2026} grouping={false} testID="nombre" />),
    ).resolves.toBe('2026');
  });

  it('affiche les négatifs avec leur signe', async () => {
    await expect(valeurAffichee(<AnimatedNumber value={-1250} testID="nombre" />)).resolves.toBe(
      '-1 250',
    );
  });

  it('retombe sur zéro pour une valeur non finie', async () => {
    // Une division par zéro en amont (objectif non renseigné) ne doit pas afficher « NaN ».
    await expect(valeurAffichee(<AnimatedNumber value={Number.NaN} testID="nombre" />)).resolves.toBe(
      '0',
    );
  });

  it('annonce la valeur d’arrivée, jamais les valeurs intermédiaires', async () => {
    const { getByLabelText } = await render(<AnimatedNumber value={1715} />);
    expect(getByLabelText('1 715')).toBeTruthy();
  });

  it('accepte un nom accessible complet', async () => {
    const { getByLabelText } = await render(
      <AnimatedNumber value={1715} accessibilityLabel="1 715 calories sur 2 250" />,
    );
    expect(getByLabelText('1 715 calories sur 2 250')).toBeTruthy();
  });

  it('masque le champ aux lecteurs d’écran', async () => {
    // Un lecteur d'écran ne doit annoncer ni un « champ de saisie », ni quarante valeurs
    // intermédiaires : c'est la `View` parente qui porte le nom accessible.
    const { getByTestId } = await render(<AnimatedNumber value={12} testID="nombre" />);
    const champ = getByTestId('nombre', { includeHiddenElements: true });
    expect(champ.props.accessibilityElementsHidden).toBe(true);
    expect(champ.props.editable).toBe(false);
  });
});
