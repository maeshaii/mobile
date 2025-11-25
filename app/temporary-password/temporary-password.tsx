import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  TextInput,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import PasswordVisibilityIcon from '../../components/PasswordVisibilityIcon';
import { validatePassword } from '../../utils/passwordValidator';
import { useAlert } from '../../contexts/AlertContext';

export default function TemporaryPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();
  const { tempPassword, userName, first } = params as any;
  const [copied, setCopied] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCopyPassword = async () => {
    try {
      await Clipboard.setString(tempPassword as string);
      setCopied(true);
      showAlert({
        title: 'Copied!',
        message: 'Temporary password copied to clipboard',
        type: 'success',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to copy password',
        type: 'error',
      });
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login/login');
  };

  const passwordValidation = useMemo(() => {
    return validatePassword(newPassword || '');
  }, [newPassword]);

  const isFormValid = useMemo(() => {
    return oldPassword.trim().length > 0 && 
           newPassword.trim().length > 0 && 
           confirmPassword.trim().length > 0;
  }, [oldPassword, newPassword, confirmPassword]);

  const handlePasswordSubmit = () => {
    if (newPassword && !passwordValidation.isValid) {
      const missing = passwordValidation.missingRequirements;
      showAlert({
        title: 'Password Requirements Missing',
        message: `Please add the following:\n• ${missing.join('\n• ')}`,
        type: 'warning',
      });
    }
  };

  const onConfirmFirstLogin = async () => {
    setError('');
    setSuccess('');
    
    if (!passwordValidation.isValid) {
      const missing = passwordValidation.missingRequirements;
      showAlert({
        title: 'Password Requirements Missing',
        message: `Please add the following:\n• ${missing.join('\n• ')}`,
        type: 'warning',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please ensure both password fields match.',
        type: 'error',
      });
      return;
    }

    if (!oldPassword) {
      showAlert({
        title: 'Required Field',
        message: 'Please enter your old password.',
        type: 'warning',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { changePassword, Storage } = await import('../../services/api');
      const resp = await changePassword(oldPassword, newPassword);
      if (resp.success) {
        // Clear the must_change_password flag since password has been changed
        await Storage.deleteItem('must_change_password');
        setSuccess('Password changed. Please login again.');
        setTimeout(() => {
          setIsLoading(false);
          handleGoToLogin();
        }, 1000);
      } else {
        setIsLoading(false);
        setError(resp.message || 'Failed to change password');
      }
    } catch (e: any) {
      setIsLoading(false);
      setError('Network error. Please try again.');
    }
  };

  if (first) {
    return (
      <View style={styles.gradientBackground}>
        <SafeAreaView style={styles.firstTimeContainer}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Central Card */}
            <View style={styles.centralCard}>
              {/* Header with Back Button and Title */}
              <View style={styles.cardHeader}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.firstTimeTitle}>First Time Log In</Text>
              </View>
              
              <Text style={styles.subtitle}>Please change your temporary password to continue.</Text>
              
              <Text style={styles.label}>Old Password</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.input}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  secureTextEntry={!showOld}
                  editable={!isLoading}
                  placeholder="Enter your old password"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowOld((s) => !s)}>
                  <PasswordVisibilityIcon show={showOld} size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                  onSubmitEditing={handlePasswordSubmit}
                  editable={!isLoading}
                  placeholder="Enter your new password"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNew((s) => !s)}>
                  <PasswordVisibilityIcon show={showNew} size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.requirementText}>
                Must be 16+ chars with upper, lower, number, and symbol.
              </Text>
              {newPassword.length > 0 && (
                <Text style={styles.strengthText}>
                  Strength: {passwordValidation.message}
                </Text>
              )}
              
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  onSubmitEditing={onConfirmFirstLogin}
                  editable={!isLoading}
                  placeholder="Confirm your new password"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirm((s) => !s)}
                >
                  <PasswordVisibilityIcon show={showConfirm} size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
              
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {success ? (
                <Text style={styles.successText}>{success}</Text>
              ) : null}
              
              <TouchableOpacity 
                style={[
                  styles.confirmButton, 
                  (isLoading || !isFormValid) && styles.confirmButtonDisabled
                ]} 
                onPress={onConfirmFirstLogin}
                disabled={isLoading || !isFormValid}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmButtonText}>Changing Password...</Text>
                  </>
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/images/ctu.jpg')}
      style={styles.background}
      blurRadius={3}
    >
      <View style={styles.overlay} />
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>
                Temporary Password Generated
              </Text>
            </View>
            <>
              <Text style={styles.subtitle}>
                Hello {userName || 'User'}, your temporary password has been generated
                successfully.
              </Text>
                <View style={styles.passwordContainer}>
                  <Text style={styles.passwordLabel}>Your Temporary Password:</Text>
                  <View style={styles.passwordBox}>
                    <Text style={styles.passwordText}>{tempPassword}</Text>
                    <TouchableOpacity
                      style={[styles.copyButton, copied && styles.copyButtonCopied]}
                      onPress={handleCopyPassword}
                    >
                      <Text style={styles.copyButtonText}>
                        {copied ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.instructionsContainer}>
                  <Text style={styles.instructionsTitle}>Important Instructions:</Text>
                  <Text style={styles.instructionText}>• Use this password to log in to your account</Text>
                  <Text style={styles.instructionText}>
                    • Change your password immediately after logging in
                  </Text>
                  <Text style={styles.instructionText}>
                    • This password is temporary and should not be shared
                  </Text>
                </View>
              <TouchableOpacity style={styles.loginButton} onPress={handleGoToLogin}>
                <Text style={styles.loginButtonText}>Go to Login</Text>
              </TouchableOpacity>
            </>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // First-time login styles
  gradientBackground: {
    flex: 1,
    backgroundColor: '#003366',
  },
  firstTimeContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  centralCard: {
    backgroundColor: '#1a4d7a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  firstTimeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 45, 98, 0.5)',
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 24,
    opacity: 0.9,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingRight: 48,
  },
  requirementText: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 4,
    marginBottom: 8,
    opacity: 0.9,
  },
  strengthText: {
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '500',
  },
  errorText: {
    color: '#ffb3b3',
    marginBottom: 8,
    fontSize: 14,
  },
  successText: {
    color: '#b2f2bb',
    marginBottom: 8,
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003366',
  },
  passwordContainer: {
    marginBottom: 24,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  passwordBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  passwordText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 2,
  },
  copyButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  copyButtonCopied: {
    backgroundColor: '#28a745',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  inputWithIcon: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: 4,
  },
  eyeText: {
    fontSize: 16,
    color: '#333',
  },
  instructionText: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 4,
    opacity: 0.9,
    lineHeight: 16,
  },
  loginButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
});