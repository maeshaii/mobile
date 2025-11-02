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

const civilStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed'];
const employmentStatusOptions = ['Full Time', 'Part Time', 'Unemployed'];
const sectorOptions = ['Private', 'Government', 'Unemployed'];

export default function SettingsPage() {
  const [open, setOpen] = useState({
    personal: false,
    employment: false,
    password: false,
  });

  // Load open state from AsyncStorage on component mount
  useEffect(() => {
    const loadOpenState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('settingsOpenState');
        if (savedState) {
          setOpen(JSON.parse(savedState));
        }
      } catch (error) {
        console.error('Error loading open state:', error);
      }
    };
    loadOpenState();
  }, []);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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

  // Employment form state
  const [employment, setEmployment] = useState({
    org_name: '',
    date_hired: '',
    position: '',
    employment_status: '',
    company_address: '',
    sector: '',
    employment_duration_current: '',
    salary_current: '',
    scope_current: '',
    company_email: '',
    company_contact: '',
    contact_person: '',
    position_alt: '',
    job_alignment_status: '',
    job_alignment_category: '',
    job_alignment_title: '',
    job_alignment_suggested_program: '',
    job_alignment_original_program: '',
    self_employed: false,
    high_position: false,
    absorbed: false,
    awards_recognition_current: '',
    supporting_document_current: '',
    supporting_document_awards_recognition: '',
    unemployment_reason: '',
    created_at: '',
    updated_at: ''
  });

  // Employment status check
  const [isEmployed, setIsEmployed] = useState<boolean | null>(null);
  const [isEditingEmployment, setIsEditingEmployment] = useState(false);

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
      // Close dropdown when collapsing
      if (!next[key]) setOpenDropdown(null);
      
      // Save to AsyncStorage
      AsyncStorage.setItem('settingsOpenState', JSON.stringify(next));
      
      return next;
    });
  };

  // Form components
  const LabeledInput = ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType,
    secureTextEntry,
    showPassword,
    onTogglePassword,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
    secureTextEntry?: boolean;
    showPassword?: boolean;
    onTogglePassword?: () => void;
  }) => (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={secureTextEntry ? styles.passwordInputContainer : undefined}>
        <TextInput
          style={[styles.input, secureTextEntry && styles.passwordInput]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          placeholderTextColor="#9ca3af"
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
  );

  const DropDown = ({
    label,
    value,
    options,
    id,
    onSelect,
  }: {
    label: string;
    value: string;
    options: string[];
    id: string;
    onSelect: (value: string) => void;
  }) => (
    <View style={[styles.formGroup, { position: 'relative', zIndex: openDropdown === id ? 20 : 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setOpenDropdown(openDropdown === id ? null : id)}
      >
        <Text style={{ color: value ? '#111827' : '#9ca3af' }}>{value || 'Select'}</Text>
        <FontAwesome name="chevron-down" size={14} color="#111827" />
      </TouchableOpacity>

      {openDropdown === id && (
        <View style={styles.dropdownList}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.dropdownItem}
              onPress={() => {
                onSelect(option);
                setOpenDropdown(null);
              }}
            >
              <Text style={{ color: '#111827' }}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  useEffect(() => {
    (async () => {
      try {
        const me = await getUserInfo();
        const uid = me?.id || me?.user_id;
        if (!uid) return;
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
        // Keep defaults
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
        setEmployment({
          org_name: data.organization_name || '',
          date_hired: data.date_hired || '',
          position: data.position || '',
          employment_status: data.employment_status || '',
          company_address: data.company_address || '',
          sector: data.sector || '',
          employment_duration_current: data.employment_duration_current || '',
          salary_current: data.salary_current || '',
          scope_current: data.scope_current || '',
          company_email: data.company_email || '',
          company_contact: data.company_contact || '',
          contact_person: data.contact_person || '',
          position_alt: data.position_alt || '',
          job_alignment_status: data.job_alignment_status || '',
          job_alignment_category: data.job_alignment_category || '',
          job_alignment_title: data.job_alignment_title || '',
          job_alignment_suggested_program: data.job_alignment_suggested_program || '',
          job_alignment_original_program: data.job_alignment_original_program || '',
          self_employed: data.self_employed || false,
          high_position: data.high_position || false,
          absorbed: data.absorbed || false,
          awards_recognition_current: data.awards_recognition_current || '',
          supporting_document_current: data.supporting_document_current || '',
          supporting_document_awards_recognition: data.supporting_document_awards_recognition || '',
          unemployment_reason: data.unemployment_reason || '',
          created_at: data.created_at || '',
          updated_at: data.updated_at || ''
        });
        
        // Determine if user is employed based on data
        const hasEmploymentData = data.organization_name && data.organization_name.trim() !== '';
        const isUnemployed = data.sector === 'Unemployed' || data.employment_status === 'Unemployed';
        
        if (hasEmploymentData && !isUnemployed) {
          setIsEmployed(true);
        } else if (isUnemployed) {
          setIsEmployed(false);
        } else {
          // No employment data and not explicitly unemployed - show question
          setIsEmployed(null);
        }
        
        console.log('hasEmploymentData:', hasEmploymentData);
        console.log('isUnemployed:', isUnemployed);
        console.log('Final isEmployed:', isEmployed);
      }
    } catch (error) {
      console.error('Error loading employment data:', error);
      setIsEmployed(null);
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

  const onSaveEmployment = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const userId = user.user_id || user.id;
      const accessToken = await AsyncStorage.getItem('accessToken');
      
      let employmentData;
      
      if (isEmployed === false) {
        // If unemployed, clear employment details and set status to unemployed
        employmentData = {
          organization_name: '',
          date_hired: '',
          position: '',
          employment_status: 'Unemployed',
          company_address: '',
          sector: 'Unemployed',
          employment_duration_current: '',
          salary_current: '',
          scope_current: '',
          company_email: '',
          company_contact: '',
          contact_person: '',
          position_alt: '',
          job_alignment_status: '',
          job_alignment_category: '',
          job_alignment_title: '',
          job_alignment_suggested_program: '',
          job_alignment_original_program: '',
          self_employed: false,
          high_position: false,
          absorbed: false,
          awards_recognition_current: '',
          supporting_document_current: '',
          supporting_document_awards_recognition: '',
          unemployment_reason: '',
          created_at: '',
          updated_at: ''
        };
      } else {
        // If employed, send the employment data
        employmentData = {
          organization_name: employment.org_name,
          date_hired: employment.date_hired,
          position: employment.position,
          employment_status: employment.employment_status,
          company_address: employment.company_address,
          sector: employment.sector,
          employment_duration_current: employment.employment_duration_current,
          salary_current: employment.salary_current,
          scope_current: employment.scope_current,
          company_email: employment.company_email,
          company_contact: employment.company_contact,
          contact_person: employment.contact_person,
          position_alt: employment.position_alt,
          job_alignment_status: employment.job_alignment_status,
          job_alignment_category: employment.job_alignment_category,
          job_alignment_title: employment.job_alignment_title,
          job_alignment_suggested_program: employment.job_alignment_suggested_program,
          job_alignment_original_program: employment.job_alignment_original_program,
          self_employed: employment.self_employed,
          high_position: employment.high_position,
          absorbed: employment.absorbed,
          awards_recognition_current: employment.awards_recognition_current,
          supporting_document_current: employment.supporting_document_current,
          supporting_document_awards_recognition: employment.supporting_document_awards_recognition,
          unemployment_reason: employment.unemployment_reason,
          created_at: employment.created_at,
          updated_at: employment.updated_at
        };
      }
      
      const response = await fetch(`${API_BASE_URL}/api/alumni/employment/${userId}/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employmentData)
      });

      if (response.ok) {
        Alert.alert('Success', 'Employment details updated successfully!');
        setIsEditingEmployment(false);
        toggle('employment');
        // Refresh employment data
        await loadEmploymentData(userId);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', `Failed to update employment details: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating employment details:', error);
      Alert.alert('Error', 'Failed to update employment details');
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

  return (
    <View style={styles.container}>
      <NavBar />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Settings</Text>
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
              />
              <LabeledInput
                label="Last Name :"
                value={personal.last_name}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, last_name: text }))}
              />
              <LabeledInput
                label="Middle Name :"
                value={personal.middle_name}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, middle_name: text }))}
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
              />
              <LabeledInput
                label="Email :"
                value={personal.email}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
              />
              <LabeledInput
                label="Address :"
                value={personal.address}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, address: text }))}
              />
              <LabeledInput
                label="Social Media :"
                value={personal.social_media}
                onChangeText={(text) => setPersonal(prev => ({ ...prev, social_media: text }))}
                placeholder="e.g., facebook.com/you"
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

        {/* Employment Details card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => toggle('employment')}>
              <Text style={styles.cardHeaderText}>Employment Details</Text>
              <FontAwesome name={open.employment ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
            </TouchableOpacity>
            {!isEditingEmployment && isEmployed !== null && (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setIsEditingEmployment(true)}
              >
                <Text style={styles.editButtonText}>EDIT</Text>
              </TouchableOpacity>
            )}
          </View>

          {open.employment && (
            <View style={styles.cardBody}>
              <Text style={styles.sectionNote}>First employment after graduation</Text>
              
              {/* Employment Status Check */}
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.label, { marginBottom: 10, fontWeight: 'bold' }]}>
                  Are you still employed?
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.employmentStatusButton,
                      isEmployed === true && styles.employmentStatusButtonActive
                    ]}
                    onPress={() => setIsEmployed(true)}
                  >
                    <Text style={[
                      styles.employmentStatusButtonText,
                      isEmployed === true && styles.employmentStatusButtonTextActive
                    ]}>
                      Yes, I am employed
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.employmentStatusButton,
                      isEmployed === false && styles.employmentStatusButtonActive
                    ]}
                    onPress={() => setIsEmployed(false)}
                  >
                    <Text style={[
                      styles.employmentStatusButtonText,
                      isEmployed === false && styles.employmentStatusButtonTextActive
                    ]}>
                      No, I am unemployed
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Employment Details Form - Show if there's employment data or user is employed */}
              {isEmployed !== null && (
                <>
              <LabeledInput
                label="Name of Organization :"
                value={employment.org_name}
                onChangeText={(text) => setEmployment(prev => ({ ...prev, org_name: text }))}
              />
              <LabeledInput
                label="Date Hired :"
                value={employment.date_hired}
                onChangeText={(text) => setEmployment(prev => ({ ...prev, date_hired: text }))}
                placeholder="MM/DD/YYYY"
              />
              <LabeledInput
                label="Position :"
                value={employment.position}
                onChangeText={(text) => setEmployment(prev => ({ ...prev, position: text }))}
              />
              <DropDown
                id="emp_status"
                label="Status of employment :"
                value={employment.employment_status}
                options={employmentStatusOptions}
                onSelect={(value) => setEmployment(prev => ({ ...prev, employment_status: value }))}
              />
              <LabeledInput
                label="Company Address :"
                value={employment.company_address}
                onChangeText={(text) => setEmployment(prev => ({ ...prev, company_address: text }))}
              />
              <DropDown
                id="sector"
                label="Sector :"
                value={employment.sector}
                options={sectorOptions}
                onSelect={(value) => setEmployment(prev => ({ ...prev, sector: value }))}
              />
                </>
              )}


              {/* Unemployed Status Display */}
              {isEmployed === false && (
                <View style={styles.unemployedStatusContainer}>
                  <Text style={styles.unemployedStatusTitle}>
                    Employment Status: Unemployed
                  </Text>
                  <Text style={styles.unemployedStatusText}>
                    Your employment details have been cleared. You can update your status anytime.
                  </Text>
                </View>
              )}

              {(isEmployed !== null && isEditingEmployment) && (
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={onSaveEmployment} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setIsEditingEmployment(false);
                  toggle('employment');
                }} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
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
              />

              <LabeledInput
                label="New Password :"
                value={passwordData.new_password}
                onChangeText={(text) => setPasswordData({ ...passwordData, new_password: text })}
                secureTextEntry
                placeholder="Enter your new password"
                showPassword={showNewPassword}
                onTogglePassword={() => setShowNewPassword(!showNewPassword)}
              />

              <LabeledInput
                label="Confirm New Password :"
                value={passwordData.confirm_password}
                onChangeText={(text) => setPasswordData({ ...passwordData, confirm_password: text })}
                secureTextEntry
                placeholder="Confirm your new password"
                showPassword={showConfirmPassword}
                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
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
    paddingVertical: 20,
    paddingTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827' 
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
  editButton: {
    backgroundColor: '#174f84',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 10,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
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
  employmentStatusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#174f84',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  employmentStatusButtonActive: {
    backgroundColor: '#174f84',
  },
  employmentStatusButtonText: {
    color: '#174f84',
    fontWeight: '600',
    fontSize: 14,
  },
  employmentStatusButtonTextActive: {
    color: '#fff',
  },
  unemployedStatusContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    marginVertical: 10,
  },
  unemployedStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  unemployedStatusText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});