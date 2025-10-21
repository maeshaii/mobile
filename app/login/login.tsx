import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { loginUser, clearAllTokens, checkUserTrackerStatus } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [ctuId, setCtuId] = useState('');
  const [password, setPassword] = useState(''); // CHANGED: Now uses password like web
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!ctuId.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setLoading(true);
    
    // Clear any existing tokens before login attempt
    await clearAllTokens();
    
    try {
      // UNIFIED: Call the same API endpoint as web frontend
      const data = await loginUser(ctuId.trim(), password.trim());
      
      if (data.success && data.user && data.user.account_type) {
        if (data.must_change_password) {
          // Navigate to first-time change password screen
          router.replace({ pathname: '/temporary-password/temporary-password', params: { first: '1' } as any });
          // The mobile change form lives in temporary-password route; we will handle there
          return;
        }
        // Check account type (SAME LOGIC AS WEB)
        if (data.user.account_type.user) {
          // Alumni user - check tracker status then redirect
          try {
            const tracker = await checkUserTrackerStatus();
            // If not answered, navigate with a flag so home can show reminder modal
            if (!tracker?.has_submitted) {
              router.replace({ pathname: '/homepage/home', params: { trackerReminder: '1' } as any });
            } else {
              router.replace('/homepage/home');
            }
          } catch {
            router.replace('/homepage/home');
          }
        } else if (data.user.account_type.ojt) {
          // OJT user - redirect to home (same as alumni)
          router.replace('/homepage/home');
        } else if (data.user.account_type.admin) {
          setError('Admin accounts cannot access mobile app');
        } else if (data.user.account_type.coordinator) {
          setError('Coordinator accounts cannot access mobile app');
        } else {
          setError('Account type not supported on mobile');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (e: any) {
      // UNIFIED: Same error handling as web frontend
      if (e.response?.status === 401) {
        setError('Invalid CTU ID or password');
      } else if (e.response?.status === 400) {
        setError('Please check your input format');
      } else {
        setError('Network error. Please check your connection and try again');
      }
      console.error('Login error:', e);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    if (error) setError('');
  };



  return (
    <ImageBackground
      source={require('../../assets/images/ctu.jpg')}
      style={styles.background}
      blurRadius={3}
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.innerContent}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Technologist</Text>
          <Text style={styles.tagline}>Connect & Collaborate</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>CTU ID</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Enter your CTU ID"
              placeholderTextColor="#ddd"
              value={ctuId}
              onChangeText={(text) => {
                setCtuId(text);
                clearError();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {/* CHANGED: Password field instead of birthdate */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={[styles.input, error && styles.inputError]}
                placeholder="Enter your password"
                placeholderTextColor="#ddd"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearError();
                }}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShow((s) => !s)}>
                <Ionicons name={show ? 'eye-off' : 'eye'} size={24} color="black" />
              </TouchableOpacity>
            </View>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1e3a8a" size="small" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => router.push('/forgot-password/forgot-password')}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  innerContent: {
    width: '80%',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  tagline: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 30,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWithIcon: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: {
    color: '#333',
    fontSize: 16,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarIconText: {
    fontSize: 20,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorContainer: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderWidth: 1,
    borderColor: '#e74c3c',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  forgotPasswordButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#fff',
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
  signupText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  signupLink: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#1e3a8a',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: 'white',
  },
}); 