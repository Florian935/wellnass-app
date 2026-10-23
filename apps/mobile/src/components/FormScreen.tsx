import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from '@/components/keyboard';
import { useTheme } from '@/theme/useTheme';

type FormScreenProps = {
  children: ReactNode;
  edges?: readonly Edge[];
};

/**
 * Écran de formulaire : fond thémé, safe area et gestion du clavier.
 *
 * Le clavier passe par la règle commune (US CLAV-01) : `KeyboardAvoidingView` en `'height'`
 * calculait son décalage sur un cadre relatif à son parent, et restait court de la hauteur de
 * l'en-tête natif (inscription, mot de passe oublié, saisie d'activité). L'arête basse, quand elle
 * est demandée, est rendue par le conteneur (`safeAreaBottom`) : clavier fermé, rien ne change ;
 * clavier ouvert, pas d'inset en plus du clavier.
 */
export function FormScreen({ children, edges = ['top', 'bottom'] }: FormScreenProps) {
  const { colors } = useTheme();
  const bottom = edges.includes('bottom');
  return (
    <SafeAreaView
      edges={edges.filter((edge) => edge !== 'bottom')}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <KeyboardAwareScrollView
        safeAreaBottom={bottom}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24, gap: 16, flexGrow: 1 },
});
