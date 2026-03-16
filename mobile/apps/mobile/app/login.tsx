/**
 * login.tsx — Auth screen (Sign in / Sign up) — R90 Navigator redesign.
 *
 * Design: navy theme, R-Lo mascot hero, Inter typography, accent tabs & inputs.
 * All auth logic preserved from the original.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { MascotImage } from '../components/ui/MascotImage';
import { Button } from '../components/ui/Button';

import { signInWithGoogle, signInWithApple } from '../lib/supabase';
import { bootstrapUser } from '../lib/api';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function LoginScreen() {
  const router = useRouter();
  const { login, register } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;

  const [mode,         setMode]         = useState<'signin' | 'signup'>('signin');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [focusedField,  setFocusedField]  = useState<'email' | 'password' | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading,  setAppleLoading]  = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        if (result.error !== 'cancelled') {
          setError(result.error ?? 'Google Sign-In failed.');
        }
        return;
      }
      // Bootstrap user row (idempotent — safe to call on every login)
      if (result.session?.access_token) {
        await bootstrapUser(result.session.access_token).catch(() => {});
      }
      router.replace('/(tabs)');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setAppleLoading(true);
    setError(null);
    try {
      const result = await signInWithApple();
      if (!result.ok) {
        if (result.error !== 'cancelled') {
          setError(result.error ?? 'Apple Sign-In failed.');
        }
        return;
      }
      if (result.session?.access_token) {
        await bootstrapUser(result.session.access_token).catch(() => {});
      }
      router.replace('/(tabs)');
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = mode === 'signin'
        ? await login(email.trim(), password)
        : await register(email.trim(), password);

      if (!result.ok) {
        setError(result.error ?? 'Authentication failed.');
        return;
      }

      // Permissions are handled by the OnboardingPlanOverlay (phase 'calendar')
      // Always go to /(tabs) — the overlay shows if phase === 'calendar'
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={[s.kav, { paddingHorizontal: 28 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Hero — R-Lo + branding (≈40% screen height) */}
        <View style={s.hero}>
          <MascotImage emotion="encourageant" size="md" />
          <Text style={[s.appName, { color: c.accent }]}>R90</Text>
          <Text style={[s.tagline, { color: c.textSub }]}>Sleep. Recover. Perform.</Text>
        </View>

        {/* Form (≈60% screen height) */}
        <View style={s.form}>
          {/* Mode tabs */}
          <View style={[s.tabs, { backgroundColor: c.surface }]}>
            {(['signin', 'signup'] as const).map(tab => (
              <Pressable
                key={tab}
                style={[s.tab, mode === tab && [s.tabActive, { backgroundColor: c.surface2 }]]}
                onPress={() => { setMode(tab); setError(null); }}
              >
                <Text style={[s.tabText, { color: mode === tab ? c.accent : c.textMuted }]}>
                  {tab === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Email input */}
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: c.surface2,
                borderColor:     focusedField === 'email' ? c.accent : c.borderSub,
                color:           c.text,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Password input */}
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: c.surface2,
                borderColor:     focusedField === 'password' ? c.accent : c.borderSub,
                color:           c.text,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={c.textMuted}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Submit */}
          <Button
            label={mode === 'signin' ? 'Sign in' : 'Create account'}
            onPress={() => { void handleSubmit(); }}
            variant="primary"
            fullWidth
            loading={loading}
          />

          {/* Divider */}
          <View style={s.divider}>
            <View style={[s.dividerLine, { backgroundColor: c.borderSub }]} />
            <Text style={[s.dividerText, { color: c.textMuted }]}>or</Text>
            <View style={[s.dividerLine, { backgroundColor: c.borderSub }]} />
          </View>

          {/* Google Sign-In */}
          <Pressable
            style={[s.googleBtn, { backgroundColor: c.surface2, borderColor: c.borderSub }]}
            onPress={() => { void handleGoogleSignIn(); }}
            disabled={googleLoading}
          >
            {googleLoading
              ? <ActivityIndicator size="small" color={c.textSub} />
              : (
                <>
                  <Text style={s.googleIcon}>G</Text>
                  <Text style={[s.googleLabel, { color: c.text }]}>Continue with Google</Text>
                </>
              )
            }
          </Pressable>

          {/* Apple Sign-In — iOS only */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={s.appleBtn}
              onPress={() => { void handleAppleSignIn(); }}
            />
          )}

          {/* Error message */}
          {error ? (
            <Text style={[s.errorText, { color: c.error }]}>{error}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  // Hero takes ~40% of vertical space
  hero: {
    flex:           2,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
  },
  appName: {
    fontSize:      48,
    fontWeight:    '900',
    letterSpacing: -2,
    marginTop:     8,
  },
  tagline: {
    fontSize:   16,
    fontWeight: '500',
  },
  // Form takes ~60% of vertical space
  form: {
    flex: 3,
    gap:  14,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius:  12,
    padding:       4,
    marginBottom:  8,
  },
  tab: {
    flex:            1,
    paddingVertical: 10,
    alignItems:      'center',
    borderRadius:    10,
  },
  tabActive: {},
  tabText: {
    fontSize:   14,
    fontWeight: '600',
  },
  input: {
    borderWidth:       1,
    borderRadius:      12,
    paddingVertical:   14,
    paddingHorizontal: 16,
    fontSize:          16,
  },
  errorText: {
    fontSize:  13,
    textAlign: 'center',
  },
  divider: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    marginVertical: 2,
  },
  dividerLine: {
    flex:   1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
  },
  googleBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               10,
    borderWidth:       1,
    borderRadius:      12,
    paddingVertical:   14,
    paddingHorizontal: 16,
    minHeight:         50,
  },
  googleIcon: {
    fontSize:   17,
    fontWeight: '700',
    color:      '#4285F4',
  },
  googleLabel: {
    fontSize:   16,
    fontWeight: '600',
  },
  appleBtn: {
    width:  '100%',
    height: 50,
  },
});
