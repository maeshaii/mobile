import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NavBar from '../(tabs)/_navbar';
import { getUserInfo } from '../../services/api';


const civilStatusOptions = ['Single', 'Married', 'Divorced'];

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    civil_status: '',
    age: '',
    birthdate: '',
    contact_number: '',
    social: '',
    email: '',
    password: '',
    address: '',
  });
  const [showCivilStatus, setShowCivilStatus] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getUserInfo();
        setForm({
          first_name: user?.f_name || '',
          last_name: user?.l_name || '',
          middle_name: user?.m_name || '',
          civil_status: user?.civil_status || '',
          age: user?.age ? String(user.age) : '',
          birthdate: user?.birthdate || '',
          contact_number: user?.contact_number || '',
          social: user?.social || '',
          email: user?.email || '',
          password: '',
          address: user?.address || '',
        });
      } catch (e) {
        // fallback: keep empty
      }
    };
    fetchUser();
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // TODO: Implement save logic (API call)
    Alert.alert('Saved!', 'Your personal details have been updated.');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <NavBar />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <View style={styles.formCard}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>First Name :</Text>
            <TextInput style={styles.input} value={form.first_name} onChangeText={t => handleChange('first_name', t)} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Last Name :</Text>
            <TextInput style={styles.input} value={form.last_name} onChangeText={t => handleChange('last_name', t)} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Middle Name :</Text>
            <TextInput style={styles.input} value={form.middle_name} onChangeText={t => handleChange('middle_name', t)} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Civil Status :</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShowCivilStatus(!showCivilStatus)}>
              <Text style={{ color: form.civil_status ? '#222' : '#aaa' }}>{form.civil_status || 'Select'}</Text>
              <FontAwesome name="chevron-down" size={16} color="#222" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            {showCivilStatus && (
              <View style={styles.dropdownList}>
                {civilStatusOptions.map(option => (
                  <TouchableOpacity key={option} style={styles.dropdownItem} onPress={() => { handleChange('civil_status', option); setShowCivilStatus(false); }}>
                    <Text style={{ color: '#222' }}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Age :</Text>
            <TextInput style={styles.input} value={form.age} onChangeText={t => handleChange('age', t)} keyboardType="numeric" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Birthdate :</Text>
            <TextInput style={styles.input} value={form.birthdate} onChangeText={t => handleChange('birthdate', t)} placeholder="00/00/0000" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Contact Number :</Text>
            <TextInput style={styles.input} value={form.contact_number} onChangeText={t => handleChange('contact_number', t)} placeholder="+63" keyboardType="phone-pad" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Social :</Text>
            <TextInput style={styles.input} value={form.social} onChangeText={t => handleChange('social', t)} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email :</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={t => handleChange('email', t)} keyboardType="email-address" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Password :</Text>
            <TextInput style={styles.input} value={form.password} onChangeText={t => handleChange('password', t)} secureTextEntry />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Address :</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={t => handleChange('address', t)} />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 16,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#222',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: '#eee',
    marginTop: 2,
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginTop: 2,
    position: 'absolute',
    width: '100%',
    zIndex: 10,
    left: 0,
    top: 44,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dropdownItem: {
    padding: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  saveBtn: {
    backgroundColor: '#174f84',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelBtn: {
    borderColor: '#174f84',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    color: '#174f84',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
