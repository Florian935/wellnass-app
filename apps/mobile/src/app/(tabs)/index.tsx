import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={[styles.hello, { color: colors.textMuted }]}>{t('home.greeting')}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t('common.appName')}</Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            hitSlop={10}
            style={StyleSheet.flatten([
              styles.iconBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ])}
          >
            <Ionicons name="person-circle-outline" size={26} color={colors.text} />
          </Pressable>
        </Link>
      </View>

      <EmptyState
        icon="sparkles-outline"
        title={t('home.empty.title')}
        message={t('home.empty.message')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
