import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { acceptConsent, AUTH_BASE_URL, fetchCurrentUser, forgotPassword, getAppConfig, getConsentStatus, getErrorMessage, login, resetPassword, saveToken, sendOtp, unwrap, verifyOtp, verifyResetOtp } from '../lib/api';

WebBrowser.maybeCompleteAuthSession();

const emptyOtp = ['', '', '', '', '', ''];
const maskEmail = (value = '') => {
  const [local = '', domain = ''] = String(value).trim().split('@');
  if (!local || !domain) return value;
  return `${local[0]}${'*'.repeat(Math.max(4, local.length - 1))}@${domain}`;
};

export default function Login() {
  const router = useRouter();
  const otpInputRef = useRef(null);
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState(emptyOtp);
  const [loading, setLoading] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [appConfig, setAppConfig] = useState(null);
  const [resendSeconds, setResendSeconds] = useState(45);

  const yearbookName = appConfig?.yearbook_name || 'Sinag-Bughaw Digital Yearbook';
  const brandName = (yearbookName.replace(/\s*Digital Yearbook/i, '') || 'Sinag-Bughaw').toUpperCase();
  const schoolName = appConfig?.school_name || 'NU Lipa';
  const otpCode = otp.join('');
  const isOtpStep = step === 'otp' || step === 'resetOtp';

  useEffect(() => {
    let active = true;

    getAppConfig()
      .then((response) => {
        if (active) setAppConfig(unwrap(response));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (step !== 'otp' && step !== 'resetOtp') return undefined;
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds, step]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const data = await login(email.trim(), password);
      if (data?.access_token || data?.token) {
        await fetchCurrentUser();
        const consent = await getConsentStatus().catch(() => ({ accepted: true }));
        if (consent?.accepted === false) {
          setShowConsent(true);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/(tabs)/home');
        }
        return;
      }
      if (data?.requires_otp) {
        setStep('otp');
        setResendSeconds(45);
        setOtp(emptyOtp);
        setTimeout(() => otpInputRef.current?.focus?.(), 150);
        return;
      }
      Alert.alert('Login failed', data?.message || 'Unable to sign in.');
    } catch (error) {
      Alert.alert('Login failed', getErrorMessage(error, 'Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      // Wake up Render backend first (free tier spins down after inactivity)
      await fetch(`${AUTH_BASE_URL}/api/app-config`).catch(() => {});

      const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/sso/callback`
        : Linking.createURL('/sso/callback');
      const authUrl = `${AUTH_BASE_URL}/app/auth/google/redirect?client=mobile&redirect_uri=${encodeURIComponent(redirectUri)}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = authUrl;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== 'success' || !result.url) return;

      const parsed = Linking.parse(result.url);
      const token = parsed.queryParams?.token;
      const error = parsed.queryParams?.error;

      if (error || !token || Array.isArray(token)) {
        throw new Error('Google sign-in failed. Please try again.');
      }

      await saveToken(token);
      await fetchCurrentUser();
      const consent = await getConsentStatus().catch(() => ({ accepted: true }));
      if (consent?.accepted === false) {
        setShowConsent(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home');
      }
    } catch (error) {
      Alert.alert('Google sign-in failed', getErrorMessage(error, 'Unable to sign in with Google.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, emptyOtp.length);
    setOtp(emptyOtp.map((_, index) => digits[index] || ''));
  };

  const handleVerifyOtp = async () => {
    const code = otpCode;
    if (code.length !== 6) {
      Alert.alert('Incomplete code', 'Please enter all 6 OTP digits.');
      return;
    }

    try {
      setLoading(true);
      await verifyOtp(email.trim(), code);
      await fetchCurrentUser();
      const consent = await getConsentStatus().catch(() => ({ accepted: true }));
      if (consent?.accepted === false) {
        setShowConsent(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home');
      }
    } catch (error) {
      setOtp(emptyOtp);
      otpInputRef.current?.focus?.();
      Alert.alert('Verification failed', getErrorMessage(error, 'Invalid or expired OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptConsent = async () => {
    if (!consentChecked) {
      Alert.alert('Consent required', 'Please confirm that you understand and accept the privacy policy.');
      return;
    }

    try {
      setLoading(true);
      await acceptConsent('1.0');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Consent failed', getErrorMessage(error, 'Unable to save your consent.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setLoading(true);
      await sendOtp(email.trim());
      setOtp(emptyOtp);
      setResendSeconds(45);
      Alert.alert('OTP sent', 'A new code has been sent to your email.');
    } catch (error) {
      Alert.alert('Resend failed', getErrorMessage(error, 'Unable to resend OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const startPasswordReset = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your email address first.');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(email.trim());
      setOtp(emptyOtp);
      setResetToken('');
      setStep('resetOtp');
      setResendSeconds(45);
      setTimeout(() => otpInputRef.current?.focus?.(), 150);
      Alert.alert('Reset code sent', 'Check your email for the reset OTP.');
    } catch (error) {
      Alert.alert('Reset failed', getErrorMessage(error, 'Unable to send reset OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyPasswordResetOtp = async () => {
    const code = otpCode;
    if (code.length !== 6) {
      Alert.alert('Incomplete code', 'Please enter all 6 OTP digits.');
      return;
    }

    try {
      setLoading(true);
      const response = await verifyResetOtp(email.trim(), code);
      const token = response?.reset_token || response?.data?.reset_token || '';
      if (!token) {
        throw new Error('Reset token was not returned. Please request a new code.');
      }
      setResetToken(token);
      setStep('resetPassword');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setOtp(emptyOtp);
      otpInputRef.current?.focus?.();
      Alert.alert('Verification failed', getErrorMessage(error, 'Invalid or expired reset OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password mismatch', 'New password and confirmation must match.');
      return;
    }

    try {
      setLoading(true);
      await resetPassword({
        email: email.trim(),
        reset_token: resetToken,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setStep('form');
      setPassword('');
      setOtp(emptyOtp);
      setResetToken('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password updated', 'You can now sign in with your new password.');
    } catch (error) {
      Alert.alert('Reset failed', getErrorMessage(error, 'Unable to reset your password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: 'Login' }} />
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.scrollContent, isOtpStep && styles.otpScrollContent]} showsVerticalScrollIndicator={false}>
          {isOtpStep ? (
            <TouchableOpacity style={styles.otpBackButton} onPress={() => setStep('form')} activeOpacity={0.82}>
              <View style={styles.otpBackCircle}>
                <FontAwesome name="chevron-left" size={12} color="#1B2A4A" />
              </View>
              <Text style={styles.otpBackText}>Back</Text>
            </TouchableOpacity>
          ) : null}

          <View style={[styles.header, isOtpStep && styles.otpHeader]}>
            <View style={[styles.iconContainer, isOtpStep && styles.otpIconContainer]}>
              {isOtpStep ? (
                <FontAwesome name="envelope-open-o" size={20} color="#F5A623" />
              ) : (
                <Image source={require('../assets/images/nuicon.svg')} style={styles.logoMark} contentFit="contain" />
              )}
            </View>
            <Text style={[styles.title, isOtpStep && styles.otpTitle]}>{showConsent ? 'Privacy Agreement' : isOtpStep ? 'Check Your Email' : step === 'resetPassword' ? 'Create New Password' : 'Welcome Back'}</Text>
            {isOtpStep ? (
              <View style={styles.otpSubtitleWrap}>
                <Text style={styles.otpSubtitle}>{step === 'resetOtp' ? 'We sent a password reset code to:' : 'We sent a 6-digit verification code to:'}</Text>
                <Text style={styles.otpMaskedEmail}>{maskEmail(email)}</Text>
              </View>
            ) : (
              <Text style={styles.subtitle}>
                {showConsent
                  ? 'Review and accept the privacy notice to continue.'
                  : step === 'resetPassword'
                    ? `Choose a new password for your ${brandName} account.`
                    : `Sign in to your ${brandName} account.`}
              </Text>
            )}
          </View>

          {showConsent ? (
            <View style={styles.consentCard}>
              <Text style={styles.consentTitle}>Data Privacy Act of 2012</Text>
              <Text style={styles.consentText}>
                {schoolName} may process your name, photograph, course, academic details, and uploaded content for the {yearbookName}. Your data is stored securely and used only for yearbook platform features.
              </Text>
              <TouchableOpacity style={styles.checkRow} onPress={() => setConsentChecked((value) => !value)}>
                <FontAwesome name={consentChecked ? 'check-square' : 'square-o'} size={20} color="#1d2b4b" />
                <Text style={styles.checkText}>I have read and accept the Privacy Policy.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleAcceptConsent} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Saving...' : 'I Accept and Continue'}</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'form' ? (
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <View style={styles.inputWrapper}>
                  <FontAwesome name="envelope-o" size={18} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="you@nu-lipa.edu.ph" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#C7C7CC" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.inputWrapper}>
                  <FontAwesome name="key" size={18} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#C7C7CC" />
                </View>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Sending OTP...' : 'Sign In'}</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
                <FontAwesome name="google" size={17} color="#3f51b5" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.textButton} onPress={startPasswordReset} disabled={loading}>
                <Text style={styles.footerLink}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'resetPassword' ? (
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>NEW PASSWORD</Text>
                <View style={styles.inputWrapper}>
                  <FontAwesome name="key" size={18} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNewPassword} placeholderTextColor="#C7C7CC" />
                  <TouchableOpacity
                    style={styles.passwordEyeButton}
                    onPress={() => setShowNewPassword((visible) => !visible)}
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    <FontAwesome name={showNewPassword ? 'eye-slash' : 'eye'} size={18} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={styles.inputWrapper}>
                  <FontAwesome name="lock" size={18} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} placeholderTextColor="#C7C7CC" />
                  <TouchableOpacity
                    style={styles.passwordEyeButton}
                    onPress={() => setShowConfirmPassword((visible) => !visible)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    <FontAwesome name={showConfirmPassword ? 'eye-slash' : 'eye'} size={18} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.button} onPress={submitPasswordReset} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Reset Password'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.textButton} onPress={() => setStep('form')}>
                <Text style={styles.footerLink}>Back to login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.formCard, styles.otpFormCard]}>
              <Text style={styles.otpSectionLabel}>Enter Verification Code</Text>
              <TouchableOpacity style={styles.otpRow} activeOpacity={0.9} onPress={() => otpInputRef.current?.focus?.()}>
                <TextInput
                  ref={otpInputRef}
                  style={styles.otpHiddenInput}
                  value={otpCode}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  selectTextOnFocus
                  caretHidden={false}
                />
                {emptyOtp.map((_, index) => {
                  const digit = otp[index];
                  const active = otpCode.length === index || (index === emptyOtp.length - 1 && otpCode.length === emptyOtp.length);
                  return (
                    <View key={index} style={[styles.otpBox, digit ? styles.otpInputFilled : null, active ? styles.otpBoxActive : null]}>
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  );
                })}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.otpVerifyButton]} onPress={step === 'resetOtp' ? verifyPasswordResetOtp : handleVerifyOtp} disabled={loading}>
                <Text style={[styles.buttonText, styles.otpVerifyButtonText]}>{loading ? 'Verifying...' : step === 'resetOtp' ? 'Verify Reset Code' : 'Verify & Sign In  ✓'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.otpResendCard, resendSeconds > 0 && styles.secondaryButtonDisabled]} onPress={step === 'resetOtp' ? startPasswordReset : handleResend} disabled={loading || resendSeconds > 0}>
                <Text style={styles.otpResendMuted}>Didn&apos;t receive the code?</Text>
                <Text style={styles.secondaryButtonText}>{resendSeconds > 0 ? `Resend available in ${resendSeconds}s` : 'Resend Code'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.textButton} onPress={() => setStep('form')}>
                <Text style={styles.otpWrongEmail}>Wrong email? <Text style={styles.footerLink}>Go back</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {!showConsent && step === 'form' && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don&apos;t have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.footerLink}>Register</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7fe' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 42, paddingBottom: 40 },
  otpScrollContent: { minHeight: '100%', justifyContent: 'flex-start', paddingTop: 118, paddingBottom: 56 },
  header: { alignItems: 'center', marginBottom: 24 },
  otpHeader: { alignItems: 'flex-start', width: '100%', maxWidth: 360, alignSelf: 'center', marginBottom: 22 },
  brandKicker: { color: '#fdb813', backgroundColor: '#1d2b4b', overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 18 },
  iconContainer: { width: 78, height: 78, backgroundColor: '#eef2ff', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  otpIconContainer: { width: 44, height: 44, backgroundColor: '#1B2A4A', borderColor: '#1B2A4A', borderRadius: 13, marginBottom: 18, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3 },
  logoMark: { width: 48, height: 48 },
  title: { fontSize: 28, fontWeight: '900', color: '#1d2b4b', marginBottom: 8, textAlign: 'center' },
  otpTitle: { fontSize: 26, color: '#1B2A4A', textAlign: 'left', marginBottom: 8, letterSpacing: -0.2 },
  subtitle: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
  otpSubtitleWrap: { gap: 4 },
  otpSubtitle: { color: '#8E9AB6', fontSize: 13, lineHeight: 18 },
  otpMaskedEmail: { color: '#2746B8', fontSize: 13, fontWeight: '900' },
  otpBackButton: { position: 'absolute', left: 24, top: 28, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 5 },
  otpBackCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  otpBackText: { color: '#8E9AB6', fontSize: 13, fontWeight: '700' },
  form: { flex: 1 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 },
  otpFormCard: { width: '100%', maxWidth: 360, alignSelf: 'center', padding: 0, borderWidth: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  inputGroup: { marginBottom: 22 },
  label: { fontSize: 12, fontWeight: '700', color: '#8E8E93', marginBottom: 8, letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, minHeight: 58, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E' },
  passwordEyeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  button: { minHeight: 58, backgroundColor: '#1d2b4b', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buttonText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  otpVerifyButton: { backgroundColor: '#F5A623', borderRadius: 14, minHeight: 52, marginTop: 2, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 3 },
  otpVerifyButtonText: { color: '#1B2A4A', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 54, backgroundColor: '#FFFFFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#1d2b4b' },
  secondaryButtonDisabled: { opacity: 0.5 },
  secondaryButtonText: { color: '#1d2b4b', fontWeight: 'bold' },
  textButton: { alignItems: 'center', padding: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  googleButton: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  googleButtonText: { color: '#1d2b4b', fontSize: 14, fontWeight: '900' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 34 },
  footerText: { fontSize: 14, color: '#8E8E93', marginRight: 4 },
  footerLink: { fontSize: 14, fontWeight: 'bold', color: '#1d2b4b' },
  otpSectionLabel: { textAlign: 'center', color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 22, position: 'relative' },
  otpHiddenInput: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
  otpBox: { width: 40, height: 46, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#F5A623', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  otpBoxActive: { borderColor: '#F5A623', shadowColor: '#F5A623', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 5, elevation: 2 },
  otpDigit: { fontSize: 17, fontWeight: '900', color: '#1B2A4A' },
  otpInputFilled: { borderColor: '#F5A623', backgroundColor: '#FFFFFF' },
  otpResendCard: { minHeight: 66, backgroundColor: '#FFFFFF', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 18, borderWidth: 1, borderColor: '#e7ecf5' },
  otpResendMuted: { color: '#8E9AB6', fontSize: 12, marginBottom: 6 },
  otpWrongEmail: { color: '#8E9AB6', fontSize: 12 },
  consentCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  consentTitle: { color: '#1d2b4b', fontSize: 17, fontWeight: 'bold', marginBottom: 10 },
  consentText: { color: '#4A4A4A', fontSize: 14, lineHeight: 22 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  checkText: { flex: 1, marginLeft: 10, color: '#1C1C1E', fontSize: 13, lineHeight: 19 },
});