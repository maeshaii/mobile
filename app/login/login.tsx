import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { loginUser, clearAllTokens, checkUserTrackerStatus } from '../../services/api';
import { useRouter } from 'expo-router';
import { useUser } from '../../contexts/UserContext';
import PasswordVisibilityIcon from '../../components/PasswordVisibilityIcon';

export default function LoginScreen() {
  const [ctuId, setCtuId] = useState('');
  const [password, setPassword] = useState(''); // CHANGED: Now uses password like web
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login: contextLogin, refreshUser, setUserAndAuth } = useUser();

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
      
      console.log('[Login] Login response data:', {
        success: data.success,
        hasUser: !!data.user,
        hasAccountType: !!data.user?.account_type,
        mustChangePassword: data.must_change_password,
        userId: data.user?.id
      });
      
      if (data.success && data.user && data.user.account_type) {
        // Persist first-time login flag so NavigationGuard and dashboards can react consistently
        try {
          const { Storage } = await import('../../services/api');
          if (data.must_change_password) {
            await Storage.setItem('must_change_password', 'true');
          } else {
            // Clear any stale flag if backend no longer requires password change
            await Storage.deleteItem('must_change_password');
          }
        } catch (storageError) {
          console.warn('[Login] Failed to persist must_change_password flag:', storageError);
        }

        // 🔒 CRITICAL FIX: Invalidate AuthService session cache and update UserContext
        // This ensures the session is properly initialized after tokens are saved
        console.log('[Login] 🔄 Invalidating session cache and updating user context...');
        const AuthService = (await import('../../services/authService')).default;
        // Small delay to ensure storage writes are fully complete
        await new Promise(resolve => setTimeout(resolve, 100));
        await AuthService.getInstance().invalidateSessionCache();
        
        // Check if this is first-time login BEFORE setting auth state
        // This ensures NavigationGuard can see the flag immediately
        if (data.must_change_password) {
          console.log('[Login] 🎯 First-time login detected - navigating directly to password change');
          // Set auth state first
          setUserAndAuth(data.user, true);
          // Small delay to ensure state propagation
          await new Promise(resolve => setTimeout(resolve, 50));
          // Navigate immediately to password change screen
          router.replace({ pathname: '/temporary-password/temporary-password', params: { first: '1' } as any });
          return;
        }
        
        // Directly set user and auth state to avoid race conditions
        // This ensures NavigationGuard sees the updated state immediately
        setUserAndAuth(data.user, true);
        console.log('[Login] ✅ User and auth state set directly');
        
        // Also refresh to ensure everything is in sync
        await refreshUser();
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
          // OJT user - redirect to OJT dashboard
          router.replace('/ojt/ojtpage');
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
    <View style={styles.background}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.formContainer}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.technologistText}>Technologist</Text>
            <Text style={styles.tagline}>Connect & Collaborate with your community</Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>CTU ID</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Enter your CTU ID"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={ctuId}
              onChangeText={(text) => {
                setCtuId(text);
                clearError();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, error && styles.inputError]}
                placeholder="Enter your password"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
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
                <PasswordVisibilityIcon show={show} size={20} color="#ffffff" />
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
                <ActivityIndicator color="#003366" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#003366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: '#1a4d7a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 8,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  technologistText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 10,
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: 4,
  },
  inputError: {
    borderColor: '#e74c3c',
    borderWidth: 1,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003366',
  },
  forgotPasswordButton: {
    marginTop: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#ffffff',
  },
}); 