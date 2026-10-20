import React, { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { acceptConsent, AUTH_BASE_URL, fetchCurrentUser, getErrorMessage, register, saveToken, sendOtp, verifyOtp, verifyStudent } from '../lib/api';
import { colors, layout, radii } from './webTheme';

WebBrowser.maybeCompleteAuthSession();

const SCHOOLS = [
  { key: 'SACE', courses: ['Bachelor of Science in Architecture', 'Bachelor of Science in Civil Engineering', 'Bachelor of Science in Computer Science', 'Bachelor of Science in Information Technology', 'Bachelor of Multimedia Arts'] },
  { key: 'SAHS', courses: ['Bachelor of Science in Nursing', 'Bachelor of Science in Medical Technology', 'Bachelor of Science in Psychology'] },
  { key: 'SABM', courses: ['Bachelor of Science in Accountancy', 'Bachelor of Science in Business Administration - Financial Management', 'Bachelor of Science in Business Administration - Marketing Management', 'Bachelor of Science in Tourism Management'] },
  { key: 'SGS', courses: ['Master in Management'] },
  { key: 'SHS', courses: ['ABM', 'STEM', 'HUMSS'] },
];

const COURSES = SCHOOLS.flatMap((school) => school.courses);
const CURRENT_YEAR = new Date().getFullYear();
const BATCH_YEARS = Array.from({ length: CURRENT_YEAR + 5 - 1990 + 1 }, (_, index) => String(CURRENT_YEAR + 5 - index));

export default function Register() {
  const router = useRouter();
  const [screen, setScreen] = useState('register');
  const [step, setStep] = useState(1);
  const [picker, setPicker] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    student_id: '',
    email: '',
    course: '',
    graduation_year: '',
    password: '',
    password_confirmation: '',
  });
  const [verifyState, setVerifyState] = useState('idle');
  const [verifiedStudent, setVerifiedStudent] = useState(null);
  const [otp, setOtp] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const intent = verifyState === 'found' ? 'graduate' : 'browse';
  const canContinue = useMemo(() => {
    if (step === 1) return form.first_name.trim() && form.last_name.trim() && form.student_id.trim();
    if (step === 2) return form.email.trim() && form.course && form.graduation_year;
    return form.password.length >= 8 && form.password_confirmation.length >= 8 && consentChecked;
  }, [consentChecked, form, step]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (['first_name', 'last_name', 'student_id'].includes(field)) {
      setVerifyState('idle');
      setVerifiedStudent(null);
    }
  };

  const handleVerifyStudent = async () => {
    if (!canContinue) return;
    try {
      setVerifyState('loading');
      const payload = await verifyStudent({
        student_no: form.student_id.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });

      if (payload?.found) {
        setVerifyState('found');
        setVerifiedStudent(payload.student);
        setForm((current) => ({
          ...current,
          email: current.email || payload.student?.email || '',
          course: current.course || payload.student?.course || '',
          graduation_year: current.graduation_year || String(payload.student?.graduation_year || ''),
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setVerifyState('not_found');
        setVerifiedStudent(null);
      }
    } catch (error) {
      setVerifyState('idle');
      Alert.alert('Verification failed', getErrorMessage(error, 'Unable to verify student record.'));
    }
  };

  const validate = () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.student_id.trim()) return 'Identity details are required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!form.course) return 'Course is required.';
    if (!form.graduation_year) return 'Batch year is required.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.password_confirmation) return 'Passwords do not match.';
    if (!consentChecked) return 'Privacy consent is required.';
    return '';
  };

  const handleRegister = async () => {
    const message = validate();
    if (message) {
      Alert.alert('Check your form', message);
      return;
    }

    try {
      setLoading(true);
      const data = await register({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        student_id: form.student_id.trim(),
        email: form.email.trim(),
        graduation_year: Number(form.graduation_year),
        batch: form.graduation_year,
        account_status: 'student',
        intent,
        consent_accepted: true,
        terms_accepted: true,
      });
      if (data?.requires_approval || data?.requires_otp === false) {
        Alert.alert(
          'Pending approval',
          data?.message || 'Your account is pending admin approval. You can sign in after an administrator approves it.',
        );
        router.replace('/login');
        return;
      }
      await sendOtp(form.email.trim());
      setScreen('otp');
      setOtp('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Registration failed', getErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setLoading(true);
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
      if (error || !token || Array.isArray(token)) throw new Error('Google sign-up failed. Please try again.');

      await saveToken(token);
      await fetchCurrentUser();
      await acceptConsent('1.0').catch(() => {});
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Google sign-up failed', getErrorMessage(error, 'Unable to continue with Google.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Incomplete code', 'Please enter the 6-digit OTP.');
      return;
    }
    try {
      setLoading(true);
      await verifyOtp(form.email.trim(), otp);
      await acceptConsent('1.0').catch(() => {});
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Verification failed', getErrorMessage(error, 'Invalid or expired OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (screen === 'otp') {
      setScreen('register');
      return;
    }
    if (step > 1) setStep((current) => current - 1);
    else router.back();
  };

  const selectOption = (value) => {
    if (picker === 'course') updateField('course', value);
    if (picker === 'batch') updateField('graduation_year', value);
    setPicker(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: 'Register' }} />
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <FontAwesome name="chevron-left" size={15} color={colors.navy} />
          </TouchableOpacity>
          <Text style={styles.stepText}>{screen === 'otp' ? 'Verification' : `Step ${step} of 3`}</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.header}>
          <Image source={require('../assets/images/nuicon.svg')} style={styles.logoMark} contentFit="contain" />
          <Text style={styles.title}>{screen === 'otp' ? 'Verify Your Email' : step === 1 ? 'Identity' : step === 2 ? 'Account Setup' : 'Security'}</Text>
          <Text style={styles.subtitle}>
            {screen === 'otp' ? `Enter the code sent to ${form.email}.` : 'Create your Sinag-Bughaw mobile account.'}
          </Text>
        </View>

        {screen === 'otp' ? (
          <OtpPanel email={form.email} otp={otp} setOtp={setOtp} onVerify={handleVerifyOtp} loading={loading} />
        ) : (
          <View style={styles.panel}>
            {step === 1 ? (
              <>
                <Field label="FIRST NAME" value={form.first_name} onChangeText={(value) => updateField('first_name', value)} placeholder="Juan" />
                <Field label="LAST NAME" value={form.last_name} onChangeText={(value) => updateField('last_name', value)} placeholder="Dela Cruz" />
                <Field label="STUDENT ID" value={form.student_id} onChangeText={(value) => updateField('student_id', value)} placeholder="2021-00123" />
                <TouchableOpacity style={[styles.button, !canContinue && styles.buttonDisabled]} onPress={handleVerifyStudent} disabled={!canContinue || verifyState === 'loading'}>
                  <Text style={styles.buttonText}>{verifyState === 'loading' ? 'Checking...' : 'Verify Yearbook Record'}</Text>
                </TouchableOpacity>
                {verifiedStudent ? <Text style={styles.matchText}>{verifiedStudent.first_name} {verifiedStudent.last_name} - {verifiedStudent.course}</Text> : null}
              </>
            ) : step === 2 ? (
              <>
                <Field label="EMAIL ADDRESS" value={form.email} onChangeText={(value) => updateField('email', value)} placeholder="student@nu-lipa.edu.ph" keyboardType="email-address" autoCapitalize="none" />
                <PickerField label="COURSE / PROGRAM" value={form.course} placeholder="Select course" onPress={() => setPicker('course')} />
                <PickerField label="BATCH YEAR" value={form.graduation_year} placeholder="Select batch year" onPress={() => setPicker('batch')} />
              </>
            ) : (
              <>
                <PasswordField label="PASSWORD" value={form.password} onChangeText={(value) => updateField('password', value)} visible={showPassword} setVisible={setShowPassword} placeholder="At least 8 characters" />
                <PasswordField label="CONFIRM PASSWORD" value={form.password_confirmation} onChangeText={(value) => updateField('password_confirmation', value)} visible={showConfirm} setVisible={setShowConfirm} placeholder="Re-enter password" />
                <TouchableOpacity style={styles.checkRow} onPress={() => setConsentChecked((value) => !value)}>
                  <FontAwesome name={consentChecked ? 'check-square' : 'square-o'} size={20} color={colors.navy} />
                  <Text style={styles.checkText}>I accept the Privacy Policy under RA 10173.</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {screen === 'register' ? (
          <View style={styles.footerActions}>
            {step < 3 ? (
              <TouchableOpacity style={[styles.button, !canContinue && styles.buttonDisabled]} onPress={() => setStep((current) => current + 1)} disabled={!canContinue}>
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.primaryActionGroup}>
                <TouchableOpacity style={[styles.button, (!canContinue || loading) && styles.buttonDisabled]} onPress={handleRegister} disabled={!canContinue || loading}>
                  <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create My Account'}</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignup} disabled={loading}>
              <FontAwesome name="google" size={17} color="#3f51b5" />
              <Text style={styles.googleButtonText}>Sign up with Google</Text>
            </TouchableOpacity>
            <Text style={styles.googleConsentText}>By continuing with Google, you accept the Privacy Policy.</Text>
            <TouchableOpacity style={styles.textButton} onPress={() => router.push('/login')}>
              <Text style={styles.footerLink}>Already have an account? Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <PickerSheet
          visible={!!picker}
          title={picker === 'course' ? 'Course / Program' : 'Batch Year'}
          data={picker === 'course' ? COURSES : BATCH_YEARS}
          selected={picker === 'course' ? form.course : form.graduation_year}
          onSelect={selectOption}
          onClose={() => setPicker(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.placeholder} {...props} />
    </View>
  );
}

function PasswordField({ label, visible, setVisible, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordWrap}>
        <TextInput style={styles.passwordInput} secureTextEntry={!visible} placeholderTextColor={colors.placeholder} {...props} />
        <TouchableOpacity style={styles.eyeButton} onPress={() => setVisible((current) => !current)}>
          <FontAwesome name={visible ? 'eye-slash' : 'eye'} size={17} color={colors.placeholder} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PickerField({ label, value, placeholder, onPress }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selector} onPress={onPress}>
        <Text style={[styles.selectorText, !value && styles.placeholderText]} numberOfLines={1}>{value || placeholder}</Text>
        <FontAwesome name="chevron-down" size={13} color={colors.placeholder} />
      </TouchableOpacity>
    </View>
  );
}

function PickerSheet({ visible, title, data, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            style={styles.optionList}
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <TouchableOpacity style={[styles.optionRow, active && styles.optionActive]} onPress={() => onSelect(item)}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{item}</Text>
                  {active ? <FontAwesome name="check" size={14} color={colors.gold} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function OtpPanel({ email, otp, setOtp, onVerify, loading }) {
  const [seconds, setSeconds] = useState(45);

  React.useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const resend = async () => {
    if (seconds > 0) return;
    await sendOtp(email.trim());
    setSeconds(45);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>VERIFICATION CODE</Text>
      <TextInput style={styles.otpInput} placeholder="123456" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onVerify} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify and Continue'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryButton, seconds > 0 && styles.secondaryDisabled]} onPress={resend} disabled={seconds > 0}>
        <Text style={styles.secondaryButtonText}>{seconds > 0 ? `Resend in 0:${String(seconds).padStart(2, '0')}` : 'Resend Code'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: { height: layout.topBarHeight, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: layout.minTouch, height: layout.minTouch, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backButtonPlaceholder: { width: layout.minTouch, height: layout.minTouch },
  stepText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  header: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  logoMark: { width: 48, height: 48, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: colors.navy, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  panel: { paddingHorizontal: 20, flex: 1 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '900', color: colors.muted, marginBottom: 7, letterSpacing: 0.5 },
  input: { height: layout.fieldHeight, borderRadius: radii.control, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontSize: 15, color: colors.navy },
  passwordWrap: { height: layout.fieldHeight, borderRadius: radii.control, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, height: '100%', paddingHorizontal: 14, fontSize: 15, color: colors.navy },
  eyeButton: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  selector: { height: layout.fieldHeight, borderRadius: radii.control, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText: { flex: 1, color: colors.navy, fontSize: 15, marginRight: 10 },
  placeholderText: { color: colors.placeholder },
  checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  checkText: { flex: 1, marginLeft: 10, color: colors.navy, fontSize: 13, lineHeight: 19 },
  footerActions: { paddingHorizontal: 20, paddingBottom: 18, gap: 10 },
  primaryActionGroup: { gap: 10 },
  button: { height: layout.buttonHeight, borderRadius: radii.control, backgroundColor: colors.navy, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  secondaryButton: { height: layout.buttonHeight, borderRadius: radii.control, borderWidth: 1, borderColor: colors.navy, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  secondaryDisabled: { opacity: 0.5 },
  secondaryButtonText: { color: colors.navy, fontWeight: '900' },
  googleButton: { height: layout.buttonHeight, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  googleButtonText: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  googleConsentText: { color: colors.muted, fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: -4 },
  textButton: { alignItems: 'center', paddingVertical: 8 },
  footerLink: { fontSize: 14, fontWeight: '900', color: colors.navy },
  matchText: { color: colors.success, fontSize: 12, fontWeight: '800', marginTop: 10 },
  otpInput: { height: 56, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.border, borderRadius: radii.control, textAlign: 'center', fontSize: 22, fontWeight: '900', color: colors.navy, letterSpacing: 8 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { maxHeight: '72%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  grabber: { width: 42, height: 5, borderRadius: 999, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  optionList: { maxHeight: 420 },
  optionRow: { minHeight: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 7, backgroundColor: '#F9FAFB' },
  optionActive: { backgroundColor: colors.navy },
  optionText: { flex: 1, color: colors.navy, fontSize: 14, fontWeight: '800' },
  optionTextActive: { color: '#FFFFFF' },
});
