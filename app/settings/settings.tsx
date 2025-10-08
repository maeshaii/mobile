import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import NavBar from '../(tabs)/navbar';
import { getAlumniProfile, getUserInfo, putAlumniProfile } from '../../services/api';

const civilStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed'];
const employmentStatusOptions = ['Regular', 'Contractual', 'Casual', 'Probationary', 'Unemployed'];
const sectorOptions = ['Private', 'Government', 'NGO', 'Self‑Employed', 'Others'];

export default function SettingsPage() {
  const [open, setOpen] = useState({
    personal: false,
    employment: false,
    password: false,
  });

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
  });

  // Password state
  const [newPassword, setNewPassword] = useState('');

  const toggle = (key: keyof typeof open) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Close dropdown when collapsing
      if (!next[key]) setOpenDropdown(null);
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
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
    secureTextEntry?: boolean;
  }) => (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="#9ca3af"
      />
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
      } catch (e) {
        // Keep defaults
      }
    })();
  }, []);

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
      try { const SecureStore = require('expo-secure-store'); SecureStore.setItemAsync('user', JSON.stringify(merged)); } catch {}
      Alert.alert('Saved', 'Personal details updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to update details');
    }
  };

  const onSaveEmployment = () => {
    Alert.alert('Saved', 'Employment details updated.');
  };

  const onSavePassword = () => {
    if (!newPassword.trim()) return Alert.alert('Error', 'Please enter a password');
    Alert.alert('Saved', 'Password updated.');
    setNewPassword('');
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
          <TouchableOpacity style={styles.cardHeader} onPress={() => toggle('employment')}>
            <Text style={styles.cardHeaderText}>Employment Details</Text>
            <FontAwesome name={open.employment ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
          </TouchableOpacity>

          {open.employment && (
            <View style={styles.cardBody}>
              <Text style={styles.sectionNote}>First employment after graduation</Text>
              
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

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={onSaveEmployment} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggle('employment')} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
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
              <LabeledInput
                label="Enter Password :"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="••••••••"
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={onSavePassword} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggle('password')} style={styles.cancelButton}>
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
});