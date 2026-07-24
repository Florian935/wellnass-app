import { GoogleSignin } from '@react-native-google-signin/google-signin';

/** Configure le SDK Google Sign-In (Web Client ID = audience de l'idToken vérifié par Supabase). */
export function configureGoogleSignin(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  });
}

// Side-effect : configure au chargement (importé une fois depuis _layout.tsx).
configureGoogleSignin();
