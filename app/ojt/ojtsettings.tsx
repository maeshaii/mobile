import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NavBar from '../(tabs)/navbar';
import { getAlumniProfile, getUserInfo, putAlumniProfile, API_BASE_URL, changePassword } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PasswordVisibilityIcon from '../../components/PasswordVisibilityIcon';
import { validatePassword } from '../../utils/passwordValidator';

// Platform-specific storage utility
const isWeb = Platform.OS === 'web';

const Storage = {
  setItem: async (key: string, value: string) => {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string) => {
    if (isWeb) {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  deleteItem: async (key: string) => {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

const civilStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];

// Form components - defined outside to prevent recreation on each render
const LabeledInput = React.memo(({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  showPassword,
  onTogglePassword,
  styles,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  styles: any;
  editable?: boolean;
}) => (
  <View style={styles.formGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={secureTextEntry ? styles.passwordInputContainer : undefined}>
        <TextInput
          style={[styles.input, secureTextEntry && styles.passwordInput, !editable && styles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          placeholderTextColor="#9ca3af"
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize={keyboardType === 'email-address' || secureTextEntry ? 'none' : 'words'}
          editable={editable}
        />
      {secureTextEntry && onTogglePassword && (
        <TouchableOpacity 
          style={styles.passwordToggle}
          onPress={onTogglePassword}
        >
          <PasswordVisibilityIcon 
            show={showPassword || false} 
            size={18} 
            color="#0f172a" 
          />
        </TouchableOpacity>
      )}
    </View>
  </View>
));

LabeledInput.displayName = 'LabeledInput';

export default function OJTSettingsPage() {
  const router = useRouter();
  const [open, setOpen] = useState({
    personal: false,
    employment: false,
    password: false,
  });

  // Load open state from AsyncStorage on component mount
  useEffect(() => {
    const loadOpenState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('ojtSettingsOpenState');
        if (savedState) {
          setOpen(JSON.parse(savedState));
        }
      } catch (error) {
        console.error('Error loading open state:', error);
      }
    };
    loadOpenState();
  }, []);

  // Personal form state
  const [personal, setPersonal] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    civil_status: '',
    contact_number: '',
    email: '',
    address: '',
    social_media: '',
    home_address: '',
  });

  // Employment form state (view-only for OJT)
  const [employment, setEmployment] = useState({
    organization_name: '',
    company_address: '',
    company_email: '',
    company_contact: '',
    contact_person: '',
    position_alt: '',
    ojt_start_date: '',
  });

  // Account type and employment data check
  const [accountType, setAccountType] = useState<string>('');
  const [hasJobInDB, setHasJobInDB] = useState<boolean | null>(null);

  // Password state
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const toggle = (key: keyof typeof open) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Save to AsyncStorage
      AsyncStorage.setItem('ojtSettingsOpenState', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await getUserInfo();
        const uid = me?.id || me?.user_id;
        if (!uid) return;
        
        // Check account type
        const isOJT = me?.account_type?.ojt || me?.role === 'ojt' || me?.user_type === 'ojt';
        setAccountType(isOJT ? 'ojt' : 'alumni');
        
        const profile = await getAlumniProfile(uid);
        setPersonal({
          first_name: profile?.f_name || me?.f_name || '',
          last_name: profile?.l_name || me?.l_name || '',
          middle_name: profile?.m_name || me?.m_name || '',
          civil_status: profile?.civil_status || '',
          contact_number: profile?.contact_number || '',
          email: profile?.email || '',
          address: profile?.address || '',
          social_media: profile?.social_media || '',
          home_address: profile?.home_address || '',
        });
        
        // Load employment data
        await loadEmploymentData(uid);
      } catch (e) {
        console.error('Error loading user data:', e);
      }
    })();
  }, []);

  const loadEmploymentData = async (userId: number) => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/alumni/employment/${userId}/`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // For OJT accounts: use has_employment_data
        if (accountType === 'ojt') {
          const hasEmploymentData = data.has_employment_data || (data.organization_name && data.organization_name.trim() !== '');
          setHasJobInDB(hasEmploymentData);
        }
        
        // Set OJT-specific employment fields (view-only)
        setEmployment({
          organization_name: data.organization_name || '',
          company_address: data.company_address || '',
          company_email: data.company_email || '',
          company_contact: data.company_contact || '',
          contact_person: data.contact_person || '',
          position_alt: data.position_alt || '',
          ojt_start_date: data.ojt_start_date || '',
        });
      }
    } catch (error) {
      console.error('Error loading employment data:', error);
      setHasJobInDB(null);
    }
  };

  const onSavePersonal = async () => {
    try {
      const me = await getUserInfo();
      const uid = me?.id || me?.user_id;
      if (!uid) return Alert.alert('Error', 'User not found');
      await putAlumniProfile(uid, {
        f_name: personal.first_name,
        m_name: personal.middle_name,
        l_name: personal.last_name,
        civil_status: personal.civil_status,
        contact_number: personal.contact_number,
        email: personal.email,
        address: personal.address,
        home_address: personal.home_address,
        social_media: personal.social_media,
      });
      // Update local storage mirror of user similar to web
      const merged = {
        ...(me || {}),
        f_name: personal.first_name,
        m_name: personal.middle_name,
        l_name: personal.last_name,
        profile: { ...(me?.profile || {}) },
        civil_status: personal.civil_status,
        contact_number: personal.contact_number,
        email: personal.email,
        address: personal.address,
        home_address: personal.home_address,
        social_media: personal.social_media,
      } as any;
      try { await Storage.setItem('user', JSON.stringify(merged)); } catch {}
      Alert.alert('Saved', 'Personal details updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to update details');
    }
  };

  const onSavePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password) {
      setPasswordError('All fields are required.');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match.');
      return;
    }

    const validation = validatePassword(passwordData.new_password);
    if (!validation.isValid) {
      const missing = validation.missingRequirements;
      setPasswordError(`Password requirements missing: ${missing.join(', ')}`);
      return;
    }

    setIsChangingPassword(true);
    try {
      const resp = await changePassword(passwordData.old_password, passwordData.new_password);
      
      if (resp.success) {
        setPasswordSuccess('Password changed successfully!');
        setPasswordData({
          old_password: '',
          new_password: '',
          confirm_password: ''
        });
        // Auto-hide success message after 3 seconds
        setTimeout(() => setPasswordSuccess(''), 3000);
        // Close the password section after successful change
        setTimeout(() => toggle('password'), 3500);
      } else {
        setPasswordError(resp.message || 'Failed to change password.');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      setPasswordError('An error occurred while changing password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const DropDown = ({
    label,
    value,
    options,
    id,
    onSelect,
    editable = true,
  }: {
    label: string;
    value: string;
    options: string[];
    id: string;
    onSelect: (value: string) => void;
    editable?: boolean;
  }) => {
    const [openDropdown, setOpenDropdown] = useState(false);
    
    return (
      <View style={[styles.formGroup, { position: 'relative', zIndex: openDropdown ? 20 : 1 }]}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={[styles.dropdown, !editable && styles.inputDisabled]}
          onPress={() => editable && setOpenDropdown(!openDropdown)}
          disabled={!editable}
        >
          <Text style={{ color: value ? '#111827' : '#9ca3af' }}>{value || 'Select'}</Text>
          {editable && <FontAwesome name="chevron-down" size={14} color="#111827" />}
        </TouchableOpacity>

        {openDropdown && editable && (
          <View style={styles.dropdownList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(option);
                  setOpenDropdown(false);
                }}
              >
                <Text style={{ color: '#111827' }}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <NavBar />
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OJT Settings</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Personal Details card */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardHeader} onPress={() => toggle('personal')}>
            <Text style={styles.cardHeaderText}>Personal Details</Text>
            <FontAwesome name={open.personal ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
          </TouchableOpacity>

          {open.personal && (
            <View style={styles.cardBody}>
              <LabeledInput
                label="First Name :"
                value={personal.first_name}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, first_name: text }))}
                styles={styles}
              />
              <LabeledInput
                label="Last Name :"
                value={personal.last_name}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, last_name: text }))}
                styles={styles}
              />
              <LabeledInput
                label="Middle Name :"
                value={personal.middle_name}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, middle_name: text }))}
                styles={styles}
              />
              <DropDown
                id="civil"
                label="Civil Status :"
                value={personal.civil_status}
                options={civilStatusOptions}
                onSelect={(value) => setPersonal(prev => ({ ...prev, civil_status: value }))}
              />
              <LabeledInput
                label="Contact Number :"
                value={personal.contact_number}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, contact_number: text }))}
                placeholder="+63"
                keyboardType="phone-pad"
                styles={styles}
              />
              <LabeledInput
                label="Email :"
                value={personal.email}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                styles={styles}
              />
              <LabeledInput
                label="Address :"
                value={personal.address}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, address: text }))}
                styles={styles}
              />
              <LabeledInput
                label="Home Address :"
                value={personal.home_address}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, home_address: text }))}
                styles={styles}
              />
              <LabeledInput
                label="Social Media :"
                value={personal.social_media}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, social_media: text }))}
                placeholder="e.g., facebook.com/you"
                styles={styles}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={onSavePersonal} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggle('personal')} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Employment Details card - View-only for OJT */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardHeader} onPress={() => toggle('employment')}>
            <Text style={styles.cardHeaderText}>Employment Details</Text>
            <FontAwesome name={open.employment ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
          </TouchableOpacity>

          {open.employment && (
            <View style={styles.cardBody}>
              <Text style={styles.sectionNote}>OJT employment information (view-only)</Text>
              
              {/* OJT Account: Display only specified fields (view-only, no edit) */}
              {accountType === 'ojt' && (hasJobInDB === true || hasJobInDB === false) && (
                <>
                  <LabeledInput
                    label="Company :"
                    value={employment.organization_name}
                    onChangeText={() => {}}
                    styles={styles}
                    editable={false}
                  />
                  <LabeledInput
                    label="Company Address :"
                    value={employment.company_address}
                    onChangeText={() => {}}
                    styles={styles}
                    editable={false}
                  />
                  <LabeledInput
                    label="Company Email :"
                    value={employment.company_email}
                    onChangeText={() => {}}
                    keyboardType="email-address"
                    styles={styles}
                    editable={false}
                  />
                  <LabeledInput
                    label="Company Contact :"
                    value={employment.company_contact}
                    onChangeText={() => {}}
                    keyboardType="phone-pad"
                    styles={styles}
                    editable={false}
                  />
                  <LabeledInput
                    label="Contact Person Name :"
                    value={employment.contact_person}
                    onChangeText={() => {}}
                    styles={styles}
                    editable={false}
                  />
                  <LabeledInput
                    label="Contact Person Position :"
                    value={employment.position_alt}
                    onChangeText={() => {}}
                    styles={styles}
                    editable={false}
                  />
                  <LabeledInput
                    label="Start Date :"
                    value={employment.ojt_start_date}
                    onChangeText={() => {}}
                    placeholder="YYYY-MM-DD"
                    styles={styles}
                    editable={false}
                  />
                </>
              )}
              
              {hasJobInDB === null && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#1e3a8a" />
                  <Text style={styles.loadingText}>Loading employment data...</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Change Password card */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardHeader} onPress={() => toggle('password')}>
            <Text style={styles.cardHeaderText}>Change Password</Text>
            <FontAwesome name={open.password ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
          </TouchableOpacity>

          {open.password && (
            <View style={styles.cardBody}>
              <Text style={styles.sectionNote}>
                Password must be at least 16 characters with uppercase, lowercase, number, and special character.
              </Text>

              {passwordError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{passwordError}</Text>
                </View>
              ) : null}

              {passwordSuccess ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>{passwordSuccess}</Text>
                </View>
              ) : null}

              <LabeledInput
                label="Current Password :"
                value={passwordData.old_password}
                onChangeText={(text) => setPasswordData({ ...passwordData, old_password: text })}
                secureTextEntry
                placeholder="Enter your current password"
                showPassword={showOldPassword}
                onTogglePassword={() => setShowOldPassword(!showOldPassword)}
                styles={styles}
              />

              <LabeledInput
                label="New Password :"
                value={passwordData.new_password}
                onChangeText={(text) => setPasswordData({ ...passwordData, new_password: text })}
                secureTextEntry
                placeholder="Enter your new password"
                showPassword={showNewPassword}
                onTogglePassword={() => setShowNewPassword(!showNewPassword)}
                styles={styles}
              />

              <LabeledInput
                label="Confirm New Password :"
                value={passwordData.confirm_password}
                onChangeText={(text) => setPasswordData({ ...passwordData, confirm_password: text })}
                secureTextEntry
                placeholder="Confirm your new password"
                showPassword={showConfirmPassword}
                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                styles={styles}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  onPress={onSavePassword} 
                  style={[styles.saveButton, isChangingPassword && styles.buttonDisabled]}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Change Password</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    toggle('password');
                    setPasswordData({
                      old_password: '',
                      new_password: '',
                      confirm_password: ''
                    });
                    setPasswordError('');
                    setPasswordSuccess('');
                  }} 
                  style={styles.cancelButton}
                  disabled={isChangingPassword}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f3f4f6' 
  },
  headerBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 32,
    paddingTop: 32,
    paddingBottom: 20,
    marginTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonPlaceholder: {
    width: 36,
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: { 
    padding: 12, 
    paddingBottom: 20 
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderText: { 
    fontWeight: '700', 
    color: '#111827', 
    fontSize: 15 
  },
  cardBody: { 
    borderTopWidth: StyleSheet.hairlineWidth, 
    borderTopColor: '#eef2f7', 
    padding: 14 
  },
  sectionNote: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  formGroup: { 
    marginBottom: 12 
  },
  label: { 
    fontSize: 12, 
    color: '#111827', 
    marginBottom: 6, 
    fontWeight: '600' 
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
    flex: 1,
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  passwordInput: {
    backgroundColor: '#ffffff',
  },
  passwordInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordToggle: {
    position: 'absolute',
    right: 8,
    padding: 4,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  successContainer: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successText: {
    color: '#16a34a',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'space-between',
  },
  dropdownList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 64, // under label + input
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 30,
  },
  dropdownItem: { 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderBottomWidth: StyleSheet.hairlineWidth, 
    borderBottomColor: '#f3f4f6' 
  },
  buttonRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 16 
  },
  saveButton: { 
    backgroundColor: '#1e40af', 
    paddingVertical: 10, 
    paddingHorizontal: 22, 
    borderRadius: 8, 
    flex: 0.48 
  },
  saveButtonText: { 
    color: '#fff', 
    fontWeight: '700', 
    textAlign: 'center' 
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    flex: 0.48,
  },
  cancelButtonText: { 
    color: '#111827', 
    fontWeight: '700', 
    textAlign: 'center' 
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 14,
  },
});
