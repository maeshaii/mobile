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
  Linking,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NavBar from '../(tabs)/navbar';
import { getAlumniProfile, getUserInfo, putAlumniProfile, API_BASE_URL, changePassword, getAccessToken, api } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PasswordVisibilityIcon from '../../components/PasswordVisibilityIcon';
import { validatePassword } from '../../utils/passwordValidator';
import * as ImagePicker from 'expo-image-picker';

// Utility function to format employment duration: "1_2_years" -> "1-2 years"
const formatEmploymentDuration = (duration: string | undefined | null): string => {
  if (!duration || typeof duration !== 'string') return duration || 'N/A';
  
  const durationMap: Record<string, string> = {
    'less_than_6_months': 'Less than 6 months',
    '6_months_1_year': '6 months – 1 year',
    '1_2_years': '1-2 years',
    '3_5_years': '3-5 years',
    'more_than_5_years': 'More than 5 years'
  };
  
  // Check if it's a known value
  if (durationMap[duration]) {
    return durationMap[duration];
  }
  
  // Fallback: Try to format unknown patterns
  let formatted = duration.trim();
  formatted = formatted.replace(/_/g, '-');
  formatted = formatted.replace(/-years$/i, ' years');
  formatted = formatted.replace(/-year$/i, ' year');
  formatted = formatted.replace(/-months$/i, ' months');
  formatted = formatted.replace(/-month$/i, ' month');
  
  return formatted;
};

// Utility function to format salary range: "10001_20000" -> "10,001 - 20,000"
const formatSalaryRange = (salary: string | undefined | null): string => {
  if (!salary || typeof salary !== 'string') return salary || 'N/A';
  
  const salaryMap: Record<string, string> = {
    'below_5000': '5,000 below',
    '5001_10000': '5,001 - 10,000',
    '10001_20000': '10,001 - 20,000',
    '20001_30000': '20,001 - 30,000',
    'above_30000': '30,000 above'
  };
  
  // Check if it's a known value
  if (salaryMap[salary]) {
    return salaryMap[salary];
  }
  
  // Fallback: Try to parse as numeric range (e.g., "10001_20000")
  if (salary.includes('_')) {
    const parts = salary.split('_');
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        return `${start.toLocaleString()} - ${end.toLocaleString()}`;
      }
    }
  }
  
  // If not a range, try to format as number if possible
  const num = parseFloat(salary.replace(/[^\d.]/g, ''));
  if (!isNaN(num)) {
    return num.toLocaleString();
  }
  
  return salary;
};

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

// Employment details options - matching web
const employmentTypeOptions = ['Employed by a company/organization', 'Self-employed', 'Freelance/Contract-based'];
const currentEmploymentStatusOptions = ['Permanent', 'Contractual', 'Probationary', 'Temporary', 'Unemployed'];
const sectorRadioOptions = ['Public', 'Private'];
const scopeOptions = ['Local', 'International'];
const awardsOptions = ['Yes', 'No'];
const employmentDurationOptions = [
  { value: 'less_than_6_months', label: 'Less than 6 months' },
  { value: '6_months_1_year', label: '6 months – 1 year' },
  { value: '1_2_years', label: '1-2 years' },
  { value: '3_5_years', label: '3-5 years' },
  { value: 'more_than_5_years', label: 'More than 5 years' }
];
const salaryRangeOptions = [
  { value: 'below_5000', label: '5,000 below' },
  { value: '5001_10000', label: '5,001 - 10,000' },
  { value: '10001_20000', label: '10,001 - 20,000' },
  { value: '20001_30000', label: '20,001 - 30,000' },
  { value: 'above_30000', label: '30,000 above' }
];

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

export default function SettingsPage() {
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

  // Employment form state - matching web structure
  const [employment, setEmployment] = useState({
    organization_name: '',
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
    ojt_start_date: '',
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
    updated_at: '',
    // Part III: Employment Status fields (tracker data)
    employment_type: '',
    current_employment_status: '',
    current_company_name: '',
    current_position: '',
    current_sector: '',
    current_scope: '',
    employment_duration: '',
    salary_range: '',
    received_awards: '',
    awards_supporting_doc: '',
    employment_supporting_doc: '',
    employment_sector: '',
  });

  // Employment flow state - matching web structure
  const [accountType, setAccountType] = useState<string>(''); // 'alumni' or 'ojt'
  const [hasJobInDB, setHasJobInDB] = useState<boolean | null>(null); // Check if user has job in database (for alumni: tracker data, for ojt: employment data)
  const [isEditingEmployment, setIsEditingEmployment] = useState(false);
  const [isSavingEmployment, setIsSavingEmployment] = useState(false);
  const [employmentOriginalData, setEmploymentOriginalData] = useState<any>(null); // Store original data for cancel
  const [awardsFile, setAwardsFile] = useState<any>(null);
  const [employmentFile, setEmploymentFile] = useState<any>(null);

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

  // Close dropdown when edit mode changes
  useEffect(() => {
    if (!isEditingEmployment) {
      setOpenDropdown(null);
    }
  }, [isEditingEmployment]);


  const DropDown = ({
    label,
    value,
    options,
    id,
    onSelect,
    disabled = false,
  }: {
    label: string;
    value: string;
    options: string[];
    id: string;
    onSelect: (value: string) => void;
    disabled?: boolean;
  }) => (
    <View style={[styles.formGroup, { position: 'relative', zIndex: openDropdown === id ? 20 : 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdown, disabled && styles.dropdownDisabled]}
        onPress={() => !disabled && setOpenDropdown(openDropdown === id ? null : id)}
        disabled={disabled}
      >
        <Text style={{ color: value ? (disabled ? '#9ca3af' : '#111827') : '#9ca3af' }}>
          {value || 'Select'}
        </Text>
        <FontAwesome name="chevron-down" size={14} color={disabled ? '#9ca3af' : '#111827'} />
      </TouchableOpacity>

      {openDropdown === id && !disabled && (
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

  // Helper function to normalize dropdown values to match options
  const normalizeDropdownValue = (value: string, options: string[]): string => {
    if (!value) return '';
    const trimmedValue = value.trim();
    // Exact match
    if (options.includes(trimmedValue)) return trimmedValue;
    // Case-insensitive match
    const matchedOption = options.find(opt => opt.toLowerCase() === trimmedValue.toLowerCase());
    if (matchedOption) return matchedOption;
    // Return original value if no match found
    return trimmedValue;
  };

  const loadEmploymentData = async (userId: number) => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.error('No access token found');
        setHasJobInDB(false);
        return;
      }
      
      const url = `${API_BASE_URL}/api/alumni/employment/${userId}/`;
      console.log('Fetching employment data from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Employment API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        
        // Normalize dropdown values to match options
        const currentEmploymentStatusOptions = ['Permanent', 'Temporary'];
        const sectorRadioOptions = ['Public', 'Private'];
        const scopeOptions = ['Local', 'International'];
        const awardsOptions = ['Yes', 'No'];
        const employmentTypeOptions = ['Employed by a company/organization', 'Self-employed', 'Freelance/Contract-based'];
        
        const normalizedEmploymentStatus = normalizeDropdownValue(
          data.current_employment_status || data.employment_status || '', 
          currentEmploymentStatusOptions
        );
        const normalizedSector = normalizeDropdownValue(
          data.current_sector || data.sector || '', 
          sectorRadioOptions
        );
        const normalizedScope = normalizeDropdownValue(
          data.current_scope || data.scope_current || '', 
          scopeOptions
        );
        const normalizedAwards = normalizeDropdownValue(
          data.received_awards || data.awards_recognition_current || '', 
          awardsOptions
        );
        const normalizedEmploymentType = normalizeDropdownValue(
          data.employment_type || '', 
          employmentTypeOptions
        );
        
        setEmployment({
          organization_name: data.organization_name || '',
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
          ojt_start_date: data.ojt_start_date || '',
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
          updated_at: data.updated_at || '',
          // Part III fields - prioritize tracker data fields from API response
          employment_type: data.employment_type || normalizedEmploymentType || '',
          current_employment_status: data.current_employment_status || normalizedEmploymentStatus || '',
          current_company_name: data.current_company_name || data.organization_name || '',
          current_position: data.current_position || data.position || '',
          current_sector: data.current_sector || normalizedSector || '',
          current_scope: data.current_scope || normalizedScope || '',
          // Map employment duration - convert formatted values to raw values for dropdown
          employment_duration: (() => {
            const durationValue = data.employment_duration || data.employment_duration_current || '';
            if (!durationValue) {
              console.log('Employment duration: empty value');
              return '';
            }
            console.log('Employment duration raw value from API:', durationValue);
            // Check if it's already a raw value (contains underscore)
            if (durationValue.includes('_')) {
              console.log('Employment duration: already raw value, using as-is');
              return durationValue;
            }
            // Map formatted values to raw values (case-insensitive)
            const durationMap: Record<string, string> = {
              'less than 6 months': 'less_than_6_months',
              '6 months – 1 year': '6_months_1_year',
              '6 months - 1 year': '6_months_1_year',
              '6 months to 1 year': '6_months_1_year',
              '1-2 years': '1_2_years',
              '1 to 2 years': '1_2_years',
              '3-5 years': '3_5_years',
              '3 to 5 years': '3_5_years',
              'more than 5 years': 'more_than_5_years',
            };
            const normalized = durationValue.trim().toLowerCase();
            const mapped = durationMap[normalized] || durationValue;
            console.log('Employment duration mapped value:', mapped);
            return mapped;
          })(),
          // Map salary range - convert formatted values to raw values for dropdown
          salary_range: (() => {
            const salaryValue = data.salary_range || data.salary_current || '';
            if (!salaryValue) {
              console.log('Salary range: empty value');
              return '';
            }
            console.log('Salary range raw value from API:', salaryValue);
            // Check if it's already a raw value (contains underscore or specific keywords)
            if (salaryValue.includes('_')) {
              console.log('Salary range: already raw value, using as-is');
              return salaryValue;
            }
            // Normalize common variations with "below" or "above"
            const lowerValue = salaryValue.toLowerCase().trim();
            if (lowerValue.includes('below') || lowerValue.includes('under')) {
              const mapped = 'below_5000';
              console.log('Salary range mapped to:', mapped);
              return mapped;
            }
            if (lowerValue.includes('above') || lowerValue.includes('over')) {
              // Check if it's 30k+ or just "above"
              if (lowerValue.includes('30') || lowerValue === 'above' || lowerValue === 'over') {
                const mapped = 'above_30000';
                console.log('Salary range mapped to:', mapped);
                return mapped;
              }
            }
            // Map formatted values to raw values
            const salaryMap: Record<string, string> = {
              '5,000 below': 'below_5000',
              '5000 below': 'below_5000',
              '5,001 - 10,000': '5001_10000',
              '5001 - 10000': '5001_10000',
              '5,001–10,000': '5001_10000',
              '10,001 - 20,000': '10001_20000',
              '10001 - 20000': '10001_20000',
              '10,001–20,000': '10001_20000',
              '20,001 - 30,000': '20001_30000',
              '20001 - 30000': '20001_30000',
              '20,001–30,000': '20001_30000',
              '30,000 above': 'above_30000',
              '30000 above': 'above_30000',
            };
            const mapped = salaryMap[salaryValue.trim()] || salaryValue;
            console.log('Salary range mapped value:', mapped);
            return mapped;
          })(),
          received_awards: data.received_awards || normalizedAwards || '',
          awards_supporting_doc: data.awards_supporting_doc || data.supporting_document_awards_recognition || '',
          employment_supporting_doc: data.employment_supporting_doc || data.supporting_document_current || '',
          employment_sector: data.employment_sector || '',
        });
        
        // Set account type
        const accType = data.account_type || 'alumni'; // Default to alumni if not specified
        setAccountType(accType);
        
        // For OJT accounts: use has_employment_data
        if (accType === 'ojt') {
          const hasEmploymentData = data.has_employment_data || (data.organization_name && data.organization_name.trim() !== '');
          setHasJobInDB(hasEmploymentData);
          console.log('OJT - hasEmploymentData:', hasEmploymentData);
        } else {
          // For Alumni accounts: check if they have Part III tracker data
          const hasTrackerData = data.has_tracker_data || false;
          const hasPartIIIData = data.has_part_iii_data || false;
          
          // For alumni: if they have Part III data, show it
          setHasJobInDB(hasPartIIIData);
          
          console.log('Alumni - hasTrackerData:', hasTrackerData);
          console.log('Alumni - hasPartIIIData:', hasPartIIIData);
          console.log('Alumni - hasJobInDB:', hasPartIIIData);
          console.log('Alumni - Debug info:', data.debug || 'No debug info');
          console.log('Alumni - Full employment data:', data);
        }
        
        console.log('Employment data loaded:', data);
      } else {
        // Try to get error details from response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorText = await response.text();
          console.error('Failed to fetch employment data - Response text:', errorText);
          // Try to parse as JSON
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorMessage;
            console.error('Failed to fetch employment data - Error details:', errorData);
          } catch (e) {
            // Not JSON, use text as is
            errorMessage = errorText || errorMessage;
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        console.error('Failed to fetch employment data - Status:', response.status, 'Message:', errorMessage);
        // Set to false to show "no data" state instead of keeping in loading
        setHasJobInDB(false);
      }
    } catch (error: any) {
      console.error('Error loading employment data:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      // Set to false to show "no data" state instead of keeping in loading
      setHasJobInDB(false);
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

  const handleEmploymentChange = (field: string, value: any) => {
    setEmployment(prev => ({ ...prev, [field]: value }));
  };

  // Helper function to detect MIME type from file extension
  const getMimeTypeFromUri = (uri: string): string => {
    const extension = uri.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    return mimeTypes[extension || ''] || 'image/jpeg';
  };

  const onSaveEmployment = async () => {
    try {
      setIsSavingEmployment(true);
      const user = await getUserInfo();
      if (!user) {
        Alert.alert('Error', 'User not found');
        setIsSavingEmployment(false);
        return;
      }
      
      const userId = user.user_id || user.id;
      if (!userId) {
        Alert.alert('Error', 'User ID not found');
        setIsSavingEmployment(false);
        return;
      }
      
      const accessToken = await getAccessToken();
      if (!accessToken) {
        Alert.alert('Error', 'Authentication required');
        setIsSavingEmployment(false);
        return;
      }
      
      // Prepare FormData for file uploads
      const formData = new FormData();
      
      // Add all employment fields (only Part III fields for alumni)
      const fieldsToSend = [
        'employment_type',
        'current_employment_status',
        'current_company_name',
        'current_position',
        'current_sector',
        'current_scope',
        'employment_duration',
        'salary_range',
        'received_awards'
      ];
      
      fieldsToSend.forEach(key => {
        const value = employment[key as keyof typeof employment];
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });
      
      // Add file uploads if they exist - with proper MIME type detection
      if (awardsFile) {
        const fileName = awardsFile.fileName || awardsFile.name || `awards_${Date.now()}.jpg`;
        const detectedMimeType = getMimeTypeFromUri(awardsFile.uri);
        const mimeType = awardsFile.mimeType || awardsFile.type || detectedMimeType;
        
        // Ensure we have a proper MIME type (not just "image")
        const finalMimeType = mimeType === 'image' ? detectedMimeType : mimeType;
        
        const fileObj = {
          uri: awardsFile.uri,
          type: finalMimeType,
          name: fileName,
        };
        console.log('Adding awards file to FormData:', fileObj);
        formData.append('awards_supporting_doc', fileObj as any);
      }
      
      if (employmentFile) {
        const fileName = employmentFile.fileName || employmentFile.name || `employment_${Date.now()}.jpg`;
        const detectedMimeType = getMimeTypeFromUri(employmentFile.uri);
        const mimeType = employmentFile.mimeType || employmentFile.type || detectedMimeType;
        
        // Ensure we have a proper MIME type (not just "image")
        const finalMimeType = mimeType === 'image' ? detectedMimeType : mimeType;
        
        const fileObj = {
          uri: employmentFile.uri,
          type: finalMimeType,
          name: fileName,
        };
        console.log('Adding employment file to FormData:', fileObj);
        formData.append('employment_supporting_doc', fileObj as any);
      }
      
      console.log('Sending employment update with FormData...');
      console.log('API URL:', `${API_BASE_URL}/api/alumni/employment/${userId}/`);
      
      // Use axios for PUT requests with FormData (matching updateAlumniProfile pattern)
      try {
        const response = await api.put(
          `/api/alumni/employment/${userId}/`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'ngrok-skip-browser-warning': 'true',
            },
            timeout: 30000, // 30 second timeout
          }
        );
        
        console.log('Employment update response:', response.data);

        if (response.data && (response.data.success || response.status === 200)) {
          Alert.alert('Success', 'Employment details updated successfully!');
          setIsEditingEmployment(false);
          setAwardsFile(null);
          setEmploymentFile(null);
          // Refresh employment data
          await loadEmploymentData(userId);
        } else {
          Alert.alert('Error', `Failed to update employment details: ${response.data?.error || 'Unknown error'}`);
        }
      } catch (apiError: any) {
        console.error('API Error details:', {
          message: apiError?.message,
          response: apiError?.response?.data,
          status: apiError?.response?.status,
          statusText: apiError?.response?.statusText,
        });
        
        // Better error handling
        if (apiError?.response) {
          const errorData = apiError.response.data || {};
          const errorMessage = errorData.error || errorData.message || `HTTP ${apiError.response.status}: ${apiError.response.statusText}`;
          Alert.alert('Error', `Failed to update employment details: ${errorMessage}`);
        } else if (apiError?.message) {
          Alert.alert('Error', `Network error: ${apiError.message}. Please check your connection and try again.`);
        } else {
          Alert.alert('Error', 'Failed to update employment details. Please try again.');
        }
        throw apiError; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('Error updating employment details:', error);
      // Only show alert if not already shown in the inner catch
      if (!error?.response && !error?.message?.includes('Network')) {
        Alert.alert('Error', 'Failed to update employment details. Please check your connection and try again.');
      }
    } finally {
      setIsSavingEmployment(false);
    }
  };

  const onCancelEmployment = async () => {
    if (employmentOriginalData) {
      setEmployment(employmentOriginalData);
    }
    setIsEditingEmployment(false);
    setAwardsFile(null);
    setEmploymentFile(null);
    // Reload from server to ensure we have latest data
    const user = await getUserInfo();
    if (user) {
      const userId = user.user_id || user.id;
      if (userId) {
        await loadEmploymentData(userId);
      }
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
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

        {/* Employment Details card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity style={[styles.cardHeader, { flex: 1 }]} onPress={() => toggle('employment')}>
              <Text style={styles.cardHeaderText}>Employment Details</Text>
              <FontAwesome name={open.employment ? 'chevron-up' : 'chevron-down'} size={14} color="#111827" />
            </TouchableOpacity>
            {!isEditingEmployment && hasJobInDB && accountType === 'alumni' && open.employment && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setEmploymentOriginalData(JSON.parse(JSON.stringify(employment))); // Deep copy
                  setIsEditingEmployment(true);
                }}
              >
                <Text style={styles.editButtonText}>EDIT</Text>
              </TouchableOpacity>
            )}
          </View>

          {open.employment && (
            <View style={styles.cardBody}>
              {/* Flow Logic */}
              {hasJobInDB === null && (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text>Loading employment data...</Text>
                </View>
              )}

              {/* OJT Account: Display only specified fields (view-only, no edit) */}
              {accountType === 'ojt' && (hasJobInDB === true || hasJobInDB === false) && (
                <>
                  <Text style={styles.sectionNote}>OJT employment information (view-only)</Text>
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
                    styles={styles}
                    editable={false}
                  />
                </>
              )}

              {/* Alumni Account: Display Part III tracker data or prompt to answer tracker */}
              {accountType === 'alumni' && (hasJobInDB === true || hasJobInDB === false) && (
                <>
                  {hasJobInDB ? (
                    // Display Part III tracker data with edit functionality
                    <>
                      {/* Info Box - matching web */}
                      {hasJobInDB && accountType === 'alumni' && (
                        <View style={styles.infoBox}>
                          <Text style={styles.infoBoxTitle}>Update Your Employment Status</Text>
                          <Text style={styles.infoBoxText}>
                            You can update your employment information here without redoing the entire tracker form. This is useful for periodic re-checks (e.g., after 6 months or 1 year) to update if you've changed companies, positions, or employment status.
                          </Text>
                        </View>
                      )}

                      {/* Employment Type Dropdown */}
                      <DropDown
                        id="employment_type"
                        label="Employment Type :"
                        value={employment.employment_type || ''}
                        options={employmentTypeOptions}
                        onSelect={(value) => handleEmploymentChange('employment_type', value)}
                        disabled={!isEditingEmployment}
                      />

                      {/* Current Employment Status Dropdown */}
                      <DropDown
                        id="current_employment_status"
                        label="Current Employment Status :"
                        value={employment.current_employment_status || ''}
                        options={currentEmploymentStatusOptions}
                        onSelect={(value) => handleEmploymentChange('current_employment_status', value)}
                        disabled={!isEditingEmployment}
                      />

                      {/* Company Name and Position in one row */}
                      <View style={styles.rowContainer}>
                        <View style={styles.halfWidth}>
                          <LabeledInput
                            label="Company Name :"
                            value={employment.current_company_name || ''}
                            onChangeText={(text) => handleEmploymentChange('current_company_name', text)}
                            styles={styles}
                            editable={isEditingEmployment}
                          />
                        </View>
                        <View style={styles.halfWidth}>
                          <LabeledInput
                            label="Current Position :"
                            value={employment.current_position || ''}
                            onChangeText={(text) => handleEmploymentChange('current_position', text)}
                            styles={styles}
                            editable={isEditingEmployment}
                          />
                        </View>
                      </View>

                      {/* Sector and Scope in one row */}
                      <View style={styles.rowContainer}>
                        <View style={styles.halfWidth}>
                          <DropDown
                            id="current_sector"
                            label="Sector :"
                            value={employment.current_sector || ''}
                            options={sectorRadioOptions}
                            onSelect={(value) => handleEmploymentChange('current_sector', value)}
                            disabled={!isEditingEmployment}
                          />
                        </View>
                        <View style={styles.halfWidth}>
                          <DropDown
                            id="current_scope"
                            label="Scope :"
                            value={employment.current_scope || ''}
                            options={scopeOptions}
                            onSelect={(value) => handleEmploymentChange('current_scope', value)}
                            disabled={!isEditingEmployment}
                          />
                        </View>
                      </View>

                      {/* Employment Duration Dropdown */}
                      <DropDown
                        id="employment_duration"
                        label="Employment Duration :"
                        value={employment.employment_duration ? employmentDurationOptions.find(opt => opt.value === employment.employment_duration)?.label || '' : ''}
                        options={employmentDurationOptions.map(opt => opt.label)}
                        onSelect={(label) => {
                          const option = employmentDurationOptions.find(opt => opt.label === label);
                          handleEmploymentChange('employment_duration', option?.value || '');
                        }}
                        disabled={!isEditingEmployment}
                      />

                      {/* Salary Range Dropdown */}
                      <DropDown
                        id="salary_range"
                        label="Salary Range :"
                        value={employment.salary_range ? salaryRangeOptions.find(opt => opt.value === employment.salary_range)?.label || '' : ''}
                        options={salaryRangeOptions.map(opt => opt.label)}
                        onSelect={(label) => {
                          const option = salaryRangeOptions.find(opt => opt.label === label);
                          handleEmploymentChange('salary_range', option?.value || '');
                        }}
                        disabled={!isEditingEmployment}
                      />

                      {/* Received Awards Dropdown */}
                      <DropDown
                        id="received_awards"
                        label="Received Awards :"
                        value={employment.received_awards || ''}
                        options={awardsOptions}
                        onSelect={(value) => handleEmploymentChange('received_awards', value)}
                        disabled={!isEditingEmployment}
                      />

                      {/* Supporting Documents for Awards/Recognition - Only show if "Yes" */}
                      {employment.received_awards === 'Yes' && (
                        <View style={styles.documentSection}>
                          <Text style={styles.documentSectionTitle}>
                            Supporting Documents for Awards/Recognition
                          </Text>
                          
                          {/* Show existing document if available */}
                          {employment.awards_supporting_doc && !awardsFile && (
                            <View style={styles.existingDocumentContainer}>
                              <Text style={styles.existingDocumentLabel}>Current Award Document</Text>
                              <TouchableOpacity
                                onPress={async () => {
                                  const url = `${API_BASE_URL}${employment.awards_supporting_doc}`;
                                  try {
                                    const canOpen = await Linking.canOpenURL(url);
                                    if (canOpen) {
                                      await Linking.openURL(url);
                                    } else {
                                      Alert.alert('Error', 'Cannot open this document URL');
                                    }
                                  } catch (error) {
                                    Alert.alert('Error', 'Failed to open document');
                                  }
                                }}
                                style={styles.viewDocumentButton}
                              >
                                <Text style={styles.viewDocumentText}>View Full</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* File upload input - only when editing */}
                          {isEditingEmployment && (
                            <TouchableOpacity
                              style={styles.uploadButton}
                              onPress={async () => {
                                try {
                                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                  if (status !== 'granted') {
                                    Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
                                    return;
                                  }

                                  const result = await ImagePicker.launchImageLibraryAsync({
                                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                    allowsEditing: false,
                                    quality: 0.8,
                                  });

                                  if (!result.canceled && result.assets[0]) {
                                    setAwardsFile(result.assets[0]);
                                  }
                                } catch (error) {
                                  console.error('Error with image picker:', error);
                                  Alert.alert('Error', 'Failed to select image. Please try again.');
                                }
                              }}
                            >
                              <Text style={styles.uploadButtonText}>
                                {employment.awards_supporting_doc ? 'Replace Award Document' : 'Upload Award Document'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Show selected file name */}
                          {awardsFile && (
                            <View style={styles.selectedFileContainer}>
                              <Text style={styles.selectedFileText}>
                                ✓ New file selected: {awardsFile.fileName || 'image.jpg'}
                              </Text>
                            </View>
                          )}

                          <Text style={styles.uploadHint}>
                            Upload an image of your award or recognition certificate (PNG, JPG, JPEG)
                          </Text>

                          {!isEditingEmployment && !employment.awards_supporting_doc && (
                            <Text style={styles.noDocumentText}>No award document uploaded yet</Text>
                          )}
                        </View>
                      )}

                      {/* Employment Supporting Documents Section */}
                      <View style={styles.documentSection}>
                        <Text style={styles.documentSectionTitle}>
                          Employment Supporting Document (Current)
                        </Text>
                        
                        {/* Show existing document if available */}
                        {employment.employment_supporting_doc && !employmentFile && (
                          <View style={styles.existingDocumentContainer}>
                            <Text style={styles.existingDocumentLabel}>Current Employment Document</Text>
                            <Text style={styles.existingDocumentSubtext}>Certificate of Employment or Company ID</Text>
                            <TouchableOpacity
                              onPress={async () => {
                                const url = `${API_BASE_URL}${employment.employment_supporting_doc}`;
                                try {
                                  const canOpen = await Linking.canOpenURL(url);
                                  if (canOpen) {
                                    await Linking.openURL(url);
                                  } else {
                                    Alert.alert('Error', 'Cannot open this document URL');
                                  }
                                } catch (error) {
                                  Alert.alert('Error', 'Failed to open document');
                                }
                              }}
                              style={styles.viewDocumentButton}
                            >
                              <Text style={styles.viewDocumentText}>View Full</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* File upload input - only when editing */}
                        {isEditingEmployment && (
                          <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={async () => {
                              try {
                                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                if (status !== 'granted') {
                                  Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
                                  return;
                                }

                                const result = await ImagePicker.launchImageLibraryAsync({
                                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                  allowsEditing: false,
                                  quality: 0.8,
                                });

                                if (!result.canceled && result.assets[0]) {
                                  setEmploymentFile(result.assets[0]);
                                }
                              } catch (error) {
                                console.error('Error with image picker:', error);
                                Alert.alert('Error', 'Failed to select image. Please try again.');
                              }
                            }}
                          >
                            <Text style={styles.uploadButtonText}>
                              {employment.employment_supporting_doc ? 'Replace Employment Document' : 'Upload Employment Document'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Show selected file name */}
                        {employmentFile && (
                          <View style={styles.selectedFileContainer}>
                            <Text style={styles.selectedFileText}>
                              ✓ New file selected: {employmentFile.fileName || 'image.jpg'}
                            </Text>
                          </View>
                        )}

                        <Text style={styles.uploadHint}>
                          Upload Certificate of Employment or Company ID (PNG, JPG, JPEG)
                        </Text>

                        {!isEditingEmployment && !employment.employment_supporting_doc && (
                          <Text style={styles.noDocumentText}>No employment document uploaded yet</Text>
                        )}
                      </View>

                      {/* Save/Cancel buttons - Only show for alumni accounts when editing */}
                      {isEditingEmployment && (
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            onPress={onSaveEmployment}
                            style={[styles.saveButton, isSavingEmployment && styles.buttonDisabled]}
                            disabled={isSavingEmployment}
                          >
                            {isSavingEmployment ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={styles.saveButtonText}>Save</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={onCancelEmployment}
                            style={styles.cancelButton}
                            disabled={isSavingEmployment}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  ) : (
                    // Prompt to answer tracker
                    <View style={styles.trackerPromptContainer}>
                      <Text style={styles.trackerPromptTitle}>
                        Please answer the tracker form to view your employment details
                      </Text>
                      <Text style={styles.trackerPromptText}>
                        Your employment details (Part III - Employment Status) will be displayed here once you complete the tracker form.
                      </Text>
                      <TouchableOpacity
                        style={styles.trackerButton}
                        onPress={() => router.push('/forms/forms')}
                      >
                        <Text style={styles.trackerButtonText}>Go to Tracker Form</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
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
  trackerPromptContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  trackerPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  trackerPromptText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 300,
  },
  trackerButton: {
    backgroundColor: '#174f84',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  trackerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoBox: {
    backgroundColor: '#e0f2fe',
    borderLeftWidth: 4,
    borderLeftColor: '#174f84',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 12,
    color: '#075985',
    lineHeight: 18,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
  },
  dropdownDisabled: {
    backgroundColor: '#f3f4f6',
    opacity: 0.6,
  },
  documentSection: {
    borderWidth: 2,
    borderColor: '#174f84',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  documentSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#174f84',
    marginBottom: 12,
  },
  existingDocumentContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  existingDocumentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  existingDocumentSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  viewDocumentButton: {
    borderWidth: 1,
    borderColor: '#174f84',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  viewDocumentText: {
    color: '#174f84',
    fontSize: 12,
    fontWeight: '500',
  },
  uploadButton: {
    backgroundColor: '#174f84',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedFileContainer: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedFileText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  noDocumentText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 8,
  },
});