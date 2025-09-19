import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NavBar from '../(tabs)/navbar';
import { getUserInfo } from '../../services/api';

const civilStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed'];
const employmentStatusOptions = ['Regular', 'Contractual', 'Casual', 'Probationary', 'Unemployed'];
const sectorOptions = ['Private', 'Government', 'NGO', 'Self‑Employed', 'Others'];

type Positions = { personal?: number; employment?: number; password?: number };

export default function SettingsPage() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [open, setOpen] = useState<{ personal: boolean; employment: boolean; password: boolean }>({
    personal: false,
    employment: false,
    password: false,
  });
  const [cardY, setCardY] = useState<Positions>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Personal form
  const [personal, setPersonal] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    civil_status: '',
    contact_number: '',
    email: '',
    address: '',
  });

  // Employment form
  const [employment, setEmployment] = useState({
    org_name: '',
    date_hired: '',
    position: '',
    employment_status: '',
    company_address: '',
    sector: '',
  });

  // Change password (mock per your UI — single field)
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const user = await getUserInfo();
        setPersonal({
          first_name: user?.f_name || '',
          last_name: user?.l_name || '',
          middle_name: user?.m_name || '',
          civil_status: user?.civil_status || '',
          contact_number: user?.contact_number || '',
          email: user?.email || '',
          address: user?.address || '',
        });
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const toggle = (key: keyof typeof open) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // close dropdown when collapsing
      if (!next[key]) setOpenDropdown(null);
      return next;
    });

    // scroll to the card when opening
    const y = key === 'personal' ? cardY.personal : key === 'employment' ? cardY.employment : cardY.password;
    if (y != null) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }), 10);
    }
  };

  const rememberY =
    (name: keyof Positions) =>
    (e: LayoutChangeEvent) =>
      setCardY((p) => ({ ...p, [name]: e.nativeEvent.layout.y }));

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
    onChangeText: (t: string) => void;
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
    onSelect: (v: string) => void;
  }) => (
    <View style={[styles.formGroup, { position: 'relative', zIndex: openDropdown === id ? 20 : 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        activeOpacity={0.8}
        onPress={() => setOpenDropdown((d) => (d === id ? null : id))}
      >
        <Text style={{ color: value ? '#111827' : '#9ca3af' }}>{value || 'Select'}</Text>
        <FontAwesome name="chevron-down" size={14} color="#111827" />
      </TouchableOpacity>

      {openDropdown === id && (
        <View style={styles.dropdownList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.dropdownItem}
              onPress={() => {
                onSelect(opt);
                setOpenDropdown(null);
              }}
            >
              <Text style={{ color: '#111827' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const onSavePersonal = () => {
    // TODO: hook to your update profile API
    Alert.alert('Saved', 'Personal details updated.');
  };
  const onSaveEmployment = () => {
    // TODO: hook to your employment API endpoint
    Alert.alert('Saved', 'Employment details updated.');
  };
  const onSavePassword = () => {
    // TODO: integrate with changePassword(old,new) if needed
    if (!newPassword.trim()) return Alert.alert('Enter a password');
    Alert.alert('Saved', 'Password updated.');
    setNewPassword('');
  };

  return (
    <View style={styles.container}>
      <NavBar />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        {/* Personal Details card (accordion) */}
        <View onLayout={rememberY('personal')} style={styles.card}>
          <TouchableOpacity style={styles.cardHeader} activeOpacity={0.8} onPress={() => toggle('personal')}>
            <Text style={styles.cardHeaderText}>Personal Details</Text>
            <FontAwesome name={open.personal ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
          </TouchableOpacity>

          {open.personal && (
            <View style={styles.cardBody}>
              <LabeledInput
                label="First Name :"
                value={personal.first_name}
                onChangeText={(t) => setPersonal((p) => ({ ...p, first_name: t }))}
              />
              <LabeledInput
                label="Last Name :"
                value={personal.last_name}
                onChangeText={(t) => setPersonal((p) => ({ ...p, last_name: t }))}
              />
              <LabeledInput
                label="Middle Name :"
                value={personal.middle_name}
                onChangeText={(t) => setPersonal((p) => ({ ...p, middle_name: t }))}
              />
              <DropDown
                id="civil"
                label="Civil Status :"
                value={personal.civil_status}
                options={civilStatusOptions}
                onSelect={(v) => setPersonal((p) => ({ ...p, civil_status: v }))}
              />
              <LabeledInput
                label="Contact Number :"
                value={personal.contact_number}
                onChangeText={(t) => setPersonal((p) => ({ ...p, contact_number: t }))}
                placeholder="+63"
                keyboardType="phone-pad"
              />
              <LabeledInput
                label="Email :"
                value={personal.email}
                onChangeText={(t) => setPersonal((p) => ({ ...p, email: t }))}
                keyboardType="email-address"
              />
              <LabeledInput
                label="Address :"
                value={personal.address}
                onChangeText={(t) => setPersonal((p) => ({ ...p, address: t }))}
              />

              <View style={styles.rowButtons}>
                <TouchableOpacity onPress={onSavePersonal} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggle('personal')} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Employment Details card (accordion) */}
        <View onLayout={rememberY('employment')} style={styles.card}>
          <TouchableOpacity style={styles.cardHeader} activeOpacity={0.8} onPress={() => toggle('employment')}>
            <Text style={styles.cardHeaderText}>Employment Details</Text>
            <FontAwesome name={open.employment ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
          </TouchableOpacity>

          {open.employment && (
            <View style={styles.cardBody}>
              <Text style={styles.caption}>First employment after graduation</Text>

              <LabeledInput
                label="Name of Organization :"
                value={employment.org_name}
                onChangeText={(t) => setEmployment((e) => ({ ...e, org_name: t }))}
              />
              <LabeledInput
                label="Date Hired :"
                value={employment.date_hired}
                onChangeText={(t) => setEmployment((e) => ({ ...e, date_hired: t }))}
                placeholder="MM/DD/YYYY"
              />
              <LabeledInput
                label="Position :"
                value={employment.position}
                onChangeText={(t) => setEmployment((e) => ({ ...e, position: t }))}
              />
              <DropDown
                id="emp_status"
                label="Status of employment :"
                value={employment.employment_status}
                options={employmentStatusOptions}
                onSelect={(v) => setEmployment((e) => ({ ...e, employment_status: v }))}
              />
              <LabeledInput
                label="Company Address :"
                value={employment.company_address}
                onChangeText={(t) => setEmployment((e) => ({ ...e, company_address: t }))}
              />
              <DropDown
                id="sector"
                label="Sector :"
                value={employment.sector}
                options={sectorOptions}
                onSelect={(v) => setEmployment((e) => ({ ...e, sector: v }))}
              />

              <View style={styles.rowButtons}>
                <TouchableOpacity onPress={onSaveEmployment} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggle('employment')} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Change Password card (accordion) */}
        <View onLayout={rememberY('password')} style={styles.card}>
          <TouchableOpacity style={styles.cardHeader} activeOpacity={0.8} onPress={() => toggle('password')}>
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
              <View style={styles.rowButtons}>
                <TouchableOpacity onPress={onSavePassword} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggle('password')} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  headerBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  scrollContent: { padding: 12, paddingBottom: 20 },

  // Collapsible cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    overflow: 'visible',
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderText: { fontWeight: '700', color: '#111827', fontSize: 15 },
  cardBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eef2f7', padding: 14 },

  caption: { color: '#6b7280', fontSize: 12, marginBottom: 10 },

  // Form
  formGroup: { marginBottom: 12 },
  label: { fontSize: 12, color: '#111827', marginBottom: 6, fontWeight: '600' },
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

  // Dropdown
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
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },

  // Buttons
  rowButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  primaryBtn: { backgroundColor: '#1e3a8a', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  secondaryBtnText: { color: '#111827', fontWeight: '700' },
});
