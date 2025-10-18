import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Alert,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function TemporaryPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { tempPassword, userName, first } = params as any;
  const [copied, setCopied] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCopyPassword = async () => {
    try {
      await Clipboard.setString(tempPassword as string);
      setCopied(true);
      Alert.alert('Copied!', 'Temporary password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy password');
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login/login');
  };

  const strength = useMemo(() => {
    const val = newPassword || '';
    let score = 0;
    if (val.length >= 16) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    return score;
  }, [newPassword]);

  const onConfirmFirstLogin = async () => {
    setError('');
    setSuccess('');
    if (strength < 5 || newPassword !== confirmPassword) {
      setError('Use a strong password and ensure both new passwords match.');
      return;
    }
    try {
      const { changePassword } = await import('../../services/api');
      const resp = await changePassword(oldPassword, newPassword);
      if (resp.success) {
        setSuccess('Password changed. Please login again.');
        setTimeout(() => handleGoToLogin(), 800);
      } else {
        setError(resp.message || 'Failed to change password');
      }
    } catch (e: any) {
      setError('Network error. Please try again.');
    }
  };

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
                {first ? 'First Time Log In' : 'Temporary Password Generated'}
              </Text>
            </View>
            {first ? (
              <>
                <Text style={styles.subtitle}>Please change your password to continue.</Text>
                <Text style={styles.instructionsTitle}>Old Password</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={styles.modalInput as any}
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry={!showOld}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowOld((s) => !s)}>
                    <Ionicons name={showOld ? 'eye-off' : 'eye'} size={24} color="black" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.instructionsTitle}>New Password</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={styles.modalInput as any}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNew}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNew((s) => !s)}>
                    <Ionicons name={showNew ? 'eye-off' : 'eye'} size={24} color="black" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.instructionsTitle}>Confirm Password</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={styles.modalInput as any}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirm((s) => !s)}
                  >
                    <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={24} color="black" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.instructionText}>
                  Must be 16+ chars with upper, lower, number, and symbol.
                </Text>
                {error ? <Text style={{ color: '#ffb3b3', marginBottom: 8 }}>{error}</Text> : null}
                {success ? (
                  <Text style={{ color: '#b2f2bb', marginBottom: 8 }}>{success}</Text>
                ) : null}
                <TouchableOpacity style={styles.loginButton} onPress={onConfirmFirstLogin}>
                  <Text style={styles.loginButtonText}>Confirm</Text>
                </TouchableOpacity>
              </>
            ) : (
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
            )}
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
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
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
    lineHeight: 20,
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
    right: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
});
