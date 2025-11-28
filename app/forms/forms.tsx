import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import RadioGroup from 'react-native-radio-buttons-group';
import type { RadioButtonProps } from 'react-native-radio-buttons-group';
// @ts-ignore
import type {} from 'expo-document-picker';
import type {} from 'react-native-radio-buttons-group';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { getTrackerQuestions, getUserInfo, submitTrackerResponse, getAlumniDetails, getActiveTrackerForm, checkUserTrackerStatus, getTrackerAcceptingStatus, saveTrackerDraft, loadTrackerDraft, getJobAutocomplete, checkJobAlignment, confirmJobAlignment } from '../../services/api';
import TermsAndConditionsModal from './termsandcondi';

type FileAsset = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

export default function TrackerForm() {
  // Dynamic, web-parity states
  const [categories, setCategories] = useState<any[] | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [fileAnswers, setFileAnswers] = useState<Record<string, FileAsset | null>>({});
  const [multipleFileAnswers, setMultipleFileAnswers] = useState<Record<string, FileAsset[]>>({});
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);

  // Static form (fallback when dynamic categories don't load)
  const [form, setForm] = useState({
    email: '',
    yearGraduated: '',
    courseGraduated: '',
    contact: '',
    fbLink: '',
    program: '',
    lastName: '',
    firstName: '',
    middleName: '',
    gender: 'Male',
    age: '',
    birthdate: '',
    contactno: '',
    socmedlink:'',
    currentAdd: '',
    homeAdd: '',
    employeer1: '',
    empstat1:'',
    jobPos1:'',
    compAdd1:'',
    sector: '',
    presentlyEmployed: '',
    currentStat: '',
    currentComp: '',
    dateHired1: '',
    currentPos: '',
    employmentStatus: '',
    yearsEmployed: '',
    salaryRange: '',
    currentEmploy:'',
    fsDateStart: '',
    postGrad: '',
    postGradUniv:'',
    totalUnits:'',
    file: null as FileAsset | null,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  
  // Auto-save states (matching web)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null);
  const [draftCheckComplete, setDraftCheckComplete] = useState(false);
  const [hasDraftData, setHasDraftData] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Dropdown states (fallback UI)
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showEmploymentStatusDropdown, setShowEmploymentStatusDropdown] = useState(false);
  const [showCurrentStatusDropdown, setShowCurrentStatusDropdown] = useState(false);
  const [showYearsEmployedDropdown, setShowYearsEmployedDropdown] = useState(false);
  const [showSalaryRangeDropdown, setShowSalaryRangeDropdown] = useState(false);
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState<{ questionId: string; visible: boolean }>({ questionId: '', visible: false });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Raw input values for date picker (allow free typing)
  const [dateInputs, setDateInputs] = useState({ year: '', month: '', day: '' });
  
  // Job title autocomplete state
  const [jobSuggestions, setJobSuggestions] = useState<any[]>([]);
  const [showJobSuggestions, setShowJobSuggestions] = useState<{ questionId: string; visible: boolean }>({ questionId: '', visible: false });
  const [loadingJobSuggestions, setLoadingJobSuggestions] = useState<{ questionId: string; loading: boolean }>({ questionId: '', loading: false });
  const [jobAlignmentStatus, setJobAlignmentStatus] = useState<{ questionId: string; status: string; normalized?: string } | null>(null);
  const [showJobAlignmentModal, setShowJobAlignmentModal] = useState<{ questionId: string; position: string; visible: boolean; needsConfirmation: boolean; suggestion?: any }>({ questionId: '', position: '', visible: false, needsConfirmation: false });
  const [jobAlignmentAnswer, setJobAlignmentAnswer] = useState<'yes' | 'no' | null>(null);
  const [checkingAlignment, setCheckingAlignment] = useState(false);
  const jobSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobAlignmentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag to prevent onBlur from running when suggestion is selected
  const suggestionSelectedRef = useRef<{ questionId: string; timestamp: number } | null>(null);
  
  // Job title autocomplete search handler (moved outside renderQuestion to avoid hooks violation)
  const searchJobTitles = useCallback(async (query: string, questionId: string) => {
    if (query.length < 2) {
      setJobSuggestions([]);
      setShowJobSuggestions({ questionId: '', visible: false });
      setLoadingJobSuggestions({ questionId: '', loading: false });
      return;
    }
    
    // Clear previous debounce
    if (jobSearchDebounceRef.current) {
      clearTimeout(jobSearchDebounceRef.current);
    }
    
    // Set loading state
    setLoadingJobSuggestions({ questionId, loading: true });
    
    // Debounce search (300ms to match web)
    jobSearchDebounceRef.current = setTimeout(async () => {
      try {
        const user = await getUserInfo();
        if (!user?.id && !user?.user_id) {
          setLoadingJobSuggestions({ questionId: '', loading: false });
          return;
        }
        
        const result = await getJobAutocomplete(query, 20);
        if (result.success && result.suggestions) {
          setJobSuggestions(result.suggestions);
          setShowJobSuggestions({ questionId: questionId, visible: true });
        } else {
          setJobSuggestions([]);
          setShowJobSuggestions({ questionId: '', visible: false });
        }
      } catch (error) {
        console.error('Error searching job titles:', error);
        setJobSuggestions([]);
        setShowJobSuggestions({ questionId: '', visible: false });
      } finally {
        setLoadingJobSuggestions({ questionId: '', loading: false });
      }
    }, 300);
  }, []);
  
  // Check job alignment (called when user finishes typing or selects a suggestion)
  const handleCheckJobAlignment = useCallback(async (position: string, questionId: string, fromAutocomplete: boolean = false) => {
    if (!position || position.trim().length < 2) {
      setJobAlignmentStatus(null);
      return;
    }
    
    // CRITICAL: When user selects from autocomplete, check immediately (no debounce)
    // This ensures the modal shows immediately and value is set correctly
    if (fromAutocomplete) {
      // Clear any pending debounced check
      if (jobAlignmentDebounceRef.current) {
        clearTimeout(jobAlignmentDebounceRef.current);
        jobAlignmentDebounceRef.current = null;
      }
      
      // Check alignment immediately for autocomplete selections
      setCheckingAlignment(true);
      try {
        const user = await getUserInfo();
        if (!user?.id && !user?.user_id) {
          setCheckingAlignment(false);
          return;
        }
        
        const userId = user.id || user.user_id;
        const selectedPosition = position.trim();
        
        // Note: Value is already set in the suggestion selection handler
        // We just need to check alignment now
        
        // Check alignment immediately for autocomplete selections
        const result = await checkJobAlignment(selectedPosition, userId, true);
        
        // Preserve user's exact selection (don't overwrite with normalized position)
        // The user chose this specific suggestion - ensure it stays as-is
        // (Response is already set from suggestion handler, this is just a safety check)
        setResponse(questionId, selectedPosition);
        
        // Store alignment status
        setJobAlignmentStatus({
          questionId,
          status: result.job_alignment_status || 'unknown',
          normalized: result.normalized_position
        });
        
        // Show confirmation modal if needed
        if (result.needs_confirmation) {
          setShowJobAlignmentModal({
            questionId,
            position: selectedPosition, // Use the selected position, not normalized
            visible: true,
            needsConfirmation: true,
            suggestion: result.suggestion
          });
        }
      } catch (error) {
        console.error('Error checking job alignment:', error);
        setJobAlignmentStatus({ questionId, status: 'error' });
      } finally {
        setCheckingAlignment(false);
      }
      return; // Exit early for autocomplete selections
    }
    
    // For manual typing, use debounce to avoid excessive API calls
    // Clear previous debounce
    if (jobAlignmentDebounceRef.current) {
      clearTimeout(jobAlignmentDebounceRef.current);
    }
    
    setCheckingAlignment(true);
    
    // Debounce alignment check for manual typing
    jobAlignmentDebounceRef.current = setTimeout(async () => {
      try {
        const user = await getUserInfo();
        if (!user?.id && !user?.user_id) {
          setCheckingAlignment(false);
          return;
        }
        
        const userId = user.id || user.user_id;
        const result = await checkJobAlignment(position.trim(), userId, false);
        
        // User typed manually - allow normalization if provided
        if (result.normalized_position && result.normalized_position !== position.trim()) {
          setTimeout(() => {
            setResponse(questionId, result.normalized_position);
          }, 50);
        }
        
        // Store alignment status
        setJobAlignmentStatus({
          questionId,
          status: result.job_alignment_status || 'unknown',
          normalized: result.normalized_position
        });
        
        // Show confirmation modal if needed
        if (result.needs_confirmation) {
          setShowJobAlignmentModal({
            questionId,
            position: result.normalized_position || position,
            visible: true,
            needsConfirmation: true,
            suggestion: result.suggestion
          });
        }
      } catch (error) {
        console.error('Error checking job alignment:', error);
        setJobAlignmentStatus({ questionId, status: 'error' });
      } finally {
        setCheckingAlignment(false);
      }
    }, 500); // Debounce for manual typing
  }, [responses]); // Include responses in dependencies to avoid stale closure

  const navigation = useNavigation();
  
  // Function to check tracker status (reusable for focus effect and after submission)
  // CRITICAL: Returns null only on error - must be treated as blocking condition
  const checkTrackerStatus = React.useCallback(async (retryCount = 0): Promise<{ accepting: boolean; hasSubmitted: boolean } | null> => {
    const MAX_RETRIES = 2;
    try {
      const active = await getActiveTrackerForm();
      if (!active?.tracker_form_id) {
        console.error('❌ No active tracker form found');
        return null;
      }

      const status = await checkUserTrackerStatus();
      if (!status || typeof status.has_submitted !== 'boolean') {
        console.error('❌ Invalid status response:', status);
        if (retryCount < MAX_RETRIES) {
          console.log(`🔄 Retrying status check (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          return checkTrackerStatus(retryCount + 1);
        }
        return null;
      }

      let acceptingStatus = null;
      try {
        acceptingStatus = await getTrackerAcceptingStatus(active.tracker_form_id);
      } catch (e) {
        console.warn('Could not get accepting status:', e);
        acceptingStatus = { accepting_responses: true };
      }
      
      const accepting = Boolean(acceptingStatus?.accepting_responses);
      const hasSubmitted = Boolean(status.has_submitted);
      
      console.log('✅ Tracker status check:', { accepting, hasSubmitted });
      setAccepting(accepting);
      setHasSubmitted(hasSubmitted);
      
      return { accepting, hasSubmitted };
    } catch (e) {
      console.error('❌ Tracker status check failed:', e);
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying status check after error (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return checkTrackerStatus(retryCount + 1);
      }
      return null;
    }
  }, []);
  
  const [genderOptions, setGenderOptions] = useState<RadioButtonProps[]>([
    { id: '1', label: 'Male', value: 'Male', selected: true },
    { id: '2', label: 'Female', value: 'Female' },
  ]);

  const [sectorOptions, setSectorOptions] = useState<RadioButtonProps[]>([
    { id: '1', label: 'Private', value: 'Private', selected: true },
    { id: '2', label: 'Government', value: 'Government' },
  ]);

  const [presentlyEmployedOptions, setPresentlyEmployedOptions] = useState<RadioButtonProps[]>([
    { id: '1', label: 'Yes', value: 'Yes' },
    { id: '2', label: 'No', value: 'No', selected: true },  
  ]);

  const [employmentTypes, setEmploymentTypes] = useState({
    company: false,
    selfEmployed: false,
    freelance: false,
  });

  // Web-parity: init with gating + dynamic questions + prefill
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const user = await getUserInfo();

        // 1) Gating: active form + status
        // CRITICAL: If status check fails (returns null), block form loading to prevent re-submission
        const statusResult = await checkTrackerStatus();
        if (!statusResult) {
          // Status check failed - this is a blocking condition to prevent allowing form access
          // when we can't verify if user has already submitted
          Alert.alert(
            'Error', 
            'Unable to verify your submission status. Please check your internet connection and try again later.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack()
              }
            ]
          );
          setLoading(false);
          return;
        }

        // User has already submitted - block access
        if (statusResult.hasSubmitted) {
          Alert.alert('Tracker', 'You have already completed the tracker form. Thank you!');
          navigation.goBack();
          return;
        }

        // Form is not accepting responses - block access
        if (!statusResult.accepting) {
          Alert.alert('Tracker', 'The tracker form is currently closed. Please check back later.');
          navigation.goBack();
          return;
        }

        // 2) Fetch dynamic questions
        const qs = await getTrackerQuestions();
        const cats = qs?.categories ?? qs ?? [];
        if (Array.isArray(cats)) {
          // Sort questions within each category by order
          const sortedCategories = cats.map(cat => ({
            ...cat,
            questions: (cat.questions || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          }));
          setCategories(sortedCategories);
        }

        // 2.5) Load saved draft if available (before prefill)
        let draftLoaded = false;
        if ((user?.id || user?.user_id) && Array.isArray(cats) && cats.length > 0) {
          const userId = String(user.user_id || user.id);
          userIdRef.current = userId;
          try {
            console.log('🔄 Mobile: Checking for saved draft for user:', userId);
            const draftResponse = await loadTrackerDraft(userId);
            
            if (draftResponse?.success && draftResponse?.has_draft && Object.keys(draftResponse.answers || {}).length > 0) {
              console.log('✅ Mobile: Draft found with', Object.keys(draftResponse.answers).length, 'answers - loading...');
              console.log('📋 Mobile: Draft answers:', JSON.stringify(draftResponse.answers, null, 2));
              
              // Sanitize draft data (remove empty objects, null values, etc.)
              // IMPORTANT: Keep file markers (objects with type: 'file' and uploaded: true) - these indicate files were uploaded
              const sanitizedAnswers: Record<string, any> = {};
              let fileMarkerCount = 0;
              
              for (const [key, value] of Object.entries(draftResponse.answers || {})) {
                if (value === null || value === undefined) continue;
                // Keep file markers (indicate files were uploaded before refresh)
                if (typeof value === 'object' && !Array.isArray(value) && 'type' in value && 'uploaded' in value) {
                  const fileMarker = value as { type?: string; uploaded?: boolean; multiple?: boolean };
                  if (fileMarker.type === 'file' && fileMarker.uploaded === true) {
                    sanitizedAnswers[key] = value;
                    fileMarkerCount++;
                    console.log(`✅ Mobile: Preserved file marker for question ${key}:`, value);
                    continue;
                  }
                }
                // Skip empty objects (but keep file markers)
                if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
                if (typeof value === 'string' && value.trim() === '') continue;
                sanitizedAnswers[key] = value;
              }
              
              console.log(`📋 Mobile: Loaded ${Object.keys(sanitizedAnswers).length} answers (${fileMarkerCount} file markers)`);
              
              if (Object.keys(sanitizedAnswers).length > 0) {
                setResponses(sanitizedAnswers);
                setSaveStatus('saved');
                setHasDraftData(true);
                draftLoaded = true;
                console.log('✅ Mobile: Draft loaded with file markers preserved');
              } else {
                console.log('ℹ️ Mobile: Draft found but no valid answers after sanitization');
                setHasDraftData(false);
              }
            } else {
              console.log('ℹ️ Mobile: No saved draft found');
              setHasDraftData(false);
            }
          } catch (error) {
            console.error('❌ Mobile: Error loading draft:', error);
            setHasDraftData(false);
          }
        } else if (user?.id || user?.user_id) {
          userIdRef.current = String(user.user_id || user.id);
        }
        setDraftCheckComplete(true);

        // 3) Prefill like web does (only if no draft was loaded)
        if (!draftLoaded) {
          try {
            if (user?.id || user?.user_id) {
            const userId = user.id || user.user_id;
            const details = await getAlumniDetails(userId);
            const alumni = details?.alumni || {};
            setUserDetails(alumni);
            setForm(prev => ({
              ...prev,
              courseGraduated: alumni.course || prev.courseGraduated,
              yearGraduated: alumni.batch || alumni.year_graduated || prev.yearGraduated,
              birthdate: alumni.birthdate || prev.birthdate,
              contactno: alumni.phone || prev.contactno,
              email: alumni.email || prev.email,
              program: alumni.program || prev.program,
              lastName: alumni.last_name || alumni.l_name || prev.lastName,
              firstName: alumni.first_name || alumni.f_name || prev.firstName,
              middleName: alumni.middle_name || alumni.m_name || prev.middleName,
              gender: alumni.gender || prev.gender,
              currentAdd: alumni.address || prev.currentAdd,
              currentStat: alumni.civil_status || prev.currentStat,
              age: alumni.age ? String(alumni.age) : prev.age,
              socmedlink: alumni.social_media || prev.socmedlink,
            }));
            
              // Prefill dynamic form responses (only if no draft)
            if (Array.isArray(cats) && cats.length > 0) {
              const initialResponses: Record<string, any> = {};
              for (const category of cats) {
                for (const question of category.questions || []) {
                  const questionText = question.text?.toLowerCase() || '';
                  const qid = String(question.id);
                  
                  if (questionText.includes('first name')) {
                    initialResponses[qid] = alumni.first_name || alumni.f_name || '';
                  } else if (questionText.includes('last name')) {
                    initialResponses[qid] = alumni.last_name || alumni.l_name || '';
                  } else if (questionText.includes('middle name')) {
                    initialResponses[qid] = alumni.middle_name || alumni.m_name || '';
                  } else if (questionText.includes('email')) {
                    initialResponses[qid] = alumni.email || '';
                  } else if (questionText.includes('birthdate') || questionText.includes('birth date')) {
                    if (alumni.birthdate) {
                      const date = new Date(alumni.birthdate);
                      initialResponses[qid] = date.toISOString().split('T')[0];
                    }
                  } else if (questionText.includes('age')) {
                    if (alumni.age) {
                      initialResponses[qid] = String(alumni.age);
                    } else if (alumni.birthdate) {
                      const birthDate = new Date(alumni.birthdate);
                      const today = new Date();
                      const age = today.getFullYear() - birthDate.getFullYear() - 
                        ((today.getMonth() < birthDate.getMonth()) ? 1 : 0) - 
                        ((today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
                      initialResponses[qid] = String(age);
                    }
                  } else if (questionText.includes('phone') || questionText.includes('mobile') || questionText.includes('landline')) {
                    initialResponses[qid] = alumni.phone || alumni.phone_num || '';
                  } else if (questionText.includes('address') && !questionText.includes('company')) {
                    initialResponses[qid] = alumni.address || '';
                  } else if (questionText.includes('civil status')) {
                    initialResponses[qid] = alumni.civil_status || '';
                  } else if (questionText.includes('social media')) {
                    initialResponses[qid] = alumni.social_media || '';
                  } else if ((questionText.includes('year') && questionText.includes('graduated')) || questionText.includes('batch')) {
                    const yearValue = alumni.year_graduated || alumni.batch || '';
                    initialResponses[qid] = yearValue ? String(yearValue) : '';
                  } else if (questionText.includes('program graduated') || (questionText.includes('program') && questionText.includes('graduated'))) {
                    initialResponses[qid] = alumni.program || '';
                  } else if (questionText.includes('current position')) {
                    // Don't pre-fill position - let user answer (matching web behavior)
                    // This prevents OJT data from affecting current employment
                    initialResponses[qid] = '';
                  } else if (questionText.includes('current company') || (questionText.includes('current') && questionText.includes('organization') && questionText.includes('employer'))) {
                    // Don't pre-fill company name - let user answer (matching web behavior)
                    // This prevents OJT data from affecting current employment
                    initialResponses[qid] = '';
                  } else if (questionText.includes('presently employed') || (questionText.includes('presently') && questionText.includes('employed'))) {
                    // Don't pre-fill employment status - let user answer (matching web behavior)
                    // This prevents OJT data from affecting employment status
                    initialResponses[qid] = '';
                  }
                }
              }
              setResponses(prev => ({ ...prev, ...initialResponses }));
            }
          }
          } catch (prefillError) {
            console.error('❌ Mobile: Error prefilling form:', prefillError);
          }
        }

        setError(null);
        
        // Show privacy modal on first load (matching web behavior)
        setShowPrivacyModal(true);
      } catch (err) {
        console.error('Failed to initialize tracker form:', err);
        setError('Failed to load tracker form');
      } finally {
        setLoading(false);
      }
    };
    // @ts-ignore
    init();
  }, [navigation, checkTrackerStatus]);

  // Refresh tracker status when page is focused (to sync with web/mobile submissions)
  useFocusEffect(
    React.useCallback(() => {
      const refreshStatus = async () => {
        const statusResult = await checkTrackerStatus();
        if (!statusResult) {
          // Status check failed - block access to prevent re-submission
          Alert.alert(
            'Error',
            'Unable to verify your submission status. Please check your connection and try again.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }

        // If already submitted, show alert and go back
        if (statusResult.hasSubmitted) {
          Alert.alert('Tracker', 'You have already completed the tracker form. Thank you!');
          navigation.goBack();
          return;
        }
        // If form is closed, show alert and go back
        if (!statusResult.accepting) {
          Alert.alert('Tracker', 'The tracker form is currently closed. Please check back later.');
          navigation.goBack();
          return;
        }
      };
      refreshStatus();
    }, [checkTrackerStatus, navigation])
  );

  const handleChange = (key: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Dynamic responses change (triggers auto-save)
  const setResponse = (questionId: string | number, value: any) => {
    setResponses((prev) => ({ ...prev, [String(questionId)]: value }));
  };
  
  // Auto-save formResponses (debounced - saves 3 seconds after last change, matching web)
  // SINGLE auto-save effect (removed duplicate)
  useEffect(() => {
    if (!draftCheckComplete || !userIdRef.current || !privacyAccepted) {
      return; // Don't auto-save if draft check not complete, no user ID, or privacy not accepted
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Don't auto-save if there are no responses
    if (Object.keys(responses).length === 0) {
      return;
    }

    // Set status to unsaved
    setSaveStatus('unsaved');

    // Debounce: save 3 seconds after last change (matching web)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        console.log('💾 Mobile: Auto-saving draft...');
        console.log('📋 Mobile: Total responses to save:', Object.keys(responses).length);
        
        // Save draft responses - INCLUDING file markers (file markers indicate files were uploaded)
        // Note: Actual file objects can't be saved, but markers can be saved to remember uploads after refresh
        const draftResponses: Record<string, any> = {};
        let fileMarkerCount = 0;
        
        for (const [key, value] of Object.entries(responses)) {
          // Skip actual file objects (arrays of FileAsset or File objects with uri property)
          if (value && typeof value === 'object') {
            // Check if it's an actual file object (has uri property) - skip these
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'uri' in value[0]) {
              console.log(`⏭️ Mobile: Skipping actual file array for question ${key}`);
              continue; // Skip actual file arrays (file objects can't be serialized)
            }
            // Keep file markers (objects with type: 'file' and uploaded: true) - these CAN be saved
            if ('type' in value && 'uploaded' in value && value.type === 'file' && value.uploaded === true) {
              // This is a file marker, save it to remember file was uploaded
              draftResponses[key] = value;
              fileMarkerCount++;
              console.log(`✅ Mobile: Saving file marker for question ${key}:`, value);
              continue;
            }
            // Skip actual file objects (FileAsset with uri) but keep markers
            if ('uri' in value) {
              console.log(`⏭️ Mobile: Skipping actual file object for question ${key}`);
              continue; // Skip actual file objects
            }
          }
          // Save all other responses (including file markers)
          draftResponses[key] = value;
        }
        
        console.log(`💾 Mobile: Saving ${Object.keys(draftResponses).length} responses (${fileMarkerCount} file markers)`);
        await saveTrackerDraft(userIdRef.current!, draftResponses);
        
        setSaveStatus('saved');
        console.log('✅ Mobile: Draft auto-saved successfully');
        
        // Reset to null after 2 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 2000);
      } catch (error) {
        console.error('❌ Mobile: Auto-save failed:', error);
        setSaveStatus('unsaved');
      }
    }, 3000); // 3 second debounce (matching web)

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [responses, draftCheckComplete, privacyAccepted]);

  const pickFileForQuestion = async (questionId: string | number, isMultiple: boolean = false, questionText?: string) => {
    // Check if this is an image-only question (20, 31, 32)
    const lowerText = (questionText || '').toLowerCase();
    const isFirstEmploymentDoc = lowerText.includes('first employment supporting document');
    const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                   (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
    const isCurrentEmploymentDoc = lowerText.includes('employment supporting document') && lowerText.includes('current');
    const isImageOnlyQuestion = isFirstEmploymentDoc || isAwardSupportingDocs || isCurrentEmploymentDoc;
    
    let asset: FileAsset | null = null;
    
    if (isImageOnlyQuestion) {
      // Use ImagePicker for image-only questions
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant permission to access your photo library to upload images.');
          return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1,
          allowsMultipleSelection: false,
        });
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const f = result.assets[0];
          // Get file extension from URI or name
          const uri = f.uri;
          const fileName = f.fileName || `image_${Date.now()}.jpg`;
          const mimeType = f.type || 'image/jpeg';
          
          asset = {
            name: fileName,
            uri: uri,
            mimeType: mimeType,
            size: f.fileSize || 0,
          };
        }
      } catch (error) {
        console.error('ImagePicker error:', error);
        Alert.alert('Error', 'Failed to pick image. Please try again.');
        return;
      }
    } else {
      // Use DocumentPicker for other file questions
      const result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const f = result.assets[0];
        asset = {
          name: f.name,
          uri: f.uri,
          mimeType: f.mimeType,
          size: f.size,
        };
      }
    }
    
    if (asset) {
      // Validate file size (10MB)
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert('File Size Error', 'File size must be less than 10MB');
        return;
      }
      
      // Validate file type for image-only questions
      if (isImageOnlyQuestion) {
        const allowedImageTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/svg+xml',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/tiff',
        ];
        
        if (asset.mimeType && !allowedImageTypes.includes(asset.mimeType)) {
          Alert.alert('File Type Error', 'Please select an image file only (JPEG, PNG, SVG, GIF, WEBP, BMP, or TIFF)');
          return;
        }
      }
      
      if (isMultiple) {
        const currentFiles = multipleFileAnswers[String(questionId)] || [];
        const updatedFiles = [...currentFiles, asset];
        setMultipleFileAnswers((prev) => ({ ...prev, [String(questionId)]: updatedFiles }));
        // Save file marker in responses for draft persistence (files can't be saved, but markers can)
        setResponse(String(questionId), { 
          type: 'file', 
          multiple: true, 
          uploaded: true, 
          count: updatedFiles.length 
        });
      } else {
        setFileAnswers((prev) => ({ ...prev, [String(questionId)]: asset }));
        // Save file marker in responses for draft persistence
        setResponse(String(questionId), { type: 'file', uploaded: true, filename: asset.name });
      }
    }
  };
  
  const removeFileFromMultiple = (questionId: string | number, index: number) => {
    const currentFiles = multipleFileAnswers[String(questionId)] || [];
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    setMultipleFileAnswers((prev) => ({ ...prev, [String(questionId)]: updatedFiles }));
    // Update file marker in responses (remove if no files left, otherwise update count)
    if (updatedFiles.length === 0) {
      setResponse(String(questionId), null);
    } else {
      setResponse(String(questionId), { 
        type: 'file', 
        multiple: true, 
        uploaded: true, 
        count: updatedFiles.length 
      });
    }
  };

  // Submit form: show terms modal first if not accepted
  const handleSubmit = async () => {
    // Show terms modal if not already accepted
    if (!termsAccepted) {
      setShowTermsModal(true);
      return;
    }
    
    // If terms already accepted, proceed with submission
    await submitForm();
  };

  // Terms modal handlers
  const handleTermsAccept = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
    // Don't submit form here - let user fill out form first, then submit via Submit button
  };

  // Actual form submission logic (extracted from handleSubmit)
  const submitForm = async () => {
    try {
      setSubmitting(true);
      const user = await getUserInfo();

      // Validate required questions (matching web validation logic)
      if (Array.isArray(categories) && categories.length > 0) {
        const missingRequiredQuestions: any[] = [];
        for (const category of categories) {
          // Only validate questions in visible categories (matching web)
          if (!shouldShowCategory(category)) {
            continue;
          }
          
          for (const question of category.questions || []) {
            // Skip hidden questions (matching web)
            if (shouldHideQuestionText(question.text || '')) {
              continue;
            }
            
            // Skip conditional questions that shouldn't be shown (matching web)
            const lowerText = (question.text || '').toLowerCase();
              const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                             (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
              
              if (isAwardSupportingDocs) {
              // Only validate if the parent award question is answered "Yes"
              const awardQuestion = categories
                .flatMap(cat => cat.questions || [])
                .find((ques: any) => {
                  const qt = (ques.text || '').toLowerCase();
                  return ques.type === 'radio' && 
                         (qt.includes('awards') || qt.includes('award') || qt.includes('recognition')) &&
                         (qt.includes('received') || qt.includes('during') || qt.includes('employment'));
                });
              
              // Only validate if parent question exists and is answered "Yes"
              if (!awardQuestion || responses[String(awardQuestion.id)] !== 'Yes') {
                continue; // Skip validation - question shouldn't be shown
              }
            }
            
            // Validate required questions (skip hidden questions)
            if (question.required) {
              const answer = responses[String(question.id)];
              
              if (isAwardSupportingDocs) {
                // For award documents, require ACTUAL files for submission (not just markers)
                // File markers are only for draft persistence after refresh
                const files = multipleFileAnswers[String(question.id)] || [];
                // Filter out null entries to get valid file count
                const validFiles = files.filter(f => f !== null && f !== undefined);
                const hasActualFiles = validFiles.length > 0;
                
                // Check if there's a file marker (files were uploaded but lost after refresh)
                const hasFileMarker = answer && 
                  typeof answer === 'object' && 
                  !Array.isArray(answer) &&
                  'type' in answer && 
                  'uploaded' in answer &&
                  answer.type === 'file' && 
                  answer.uploaded === true;
                
                // For FINAL SUBMISSION: Require actual files, not just markers
                if (!hasActualFiles) {
                  missingRequiredQuestions.push(question.text + (hasFileMarker ? ' (Files were uploaded but need to be re-uploaded after page refresh)' : ''));
                }
              } else if (question.type === 'file' || 
                         (answer && typeof answer === 'object' && !Array.isArray(answer) && 'type' in answer && answer.type === 'file')) {
                // 🔧 FIX: For ALL single file upload questions (check by type instead of text matching)
                // This ensures Question 20, 33, and any other file questions are properly validated
                const file = fileAnswers[String(question.id)];
                const hasActualFile = file && file.uri;
                
                // Check for file marker (file was uploaded but lost after refresh)
                const hasFileMarker = answer && 
                  typeof answer === 'object' && 
                  !Array.isArray(answer) &&
                  'type' in answer && 
                  'uploaded' in answer &&
                  answer.type === 'file' && 
                  answer.uploaded === true;
                
                // For FINAL SUBMISSION: Require actual file, not just marker
                if (!hasActualFile) {
                  missingRequiredQuestions.push(question.text + (hasFileMarker ? ' (File was uploaded but needs to be re-uploaded after page refresh)' : ''));
                }
              } else if (!shouldHideQuestionText(question.text || '')) {
                // Only validate non-hidden questions
                // Skip file markers in validation for non-file questions
                const isFileMarker = answer && typeof answer === 'object' && !Array.isArray(answer) && 'type' in answer && answer.type === 'file';
                if (isFileMarker) {
                  continue; // Skip file markers in validation for non-file questions
                }
                
                if (!answer || (typeof answer === 'string' && answer.trim() === '') || 
                   (typeof answer === 'object' && answer !== null && !Array.isArray(answer) && Object.keys(answer).length === 0) ||
                       (Array.isArray(answer) && answer.length === 0)) {
                missingRequiredQuestions.push(question.text);
                }
              }
            }
          }
        }
        
        if (missingRequiredQuestions.length > 0) {
          Alert.alert('Required Questions', `Please answer the following required questions:\n\n${missingRequiredQuestions.join('\n')}`);
          setSubmitting(false);
          return;
        }
      }

      const fd = new FormData();
      if (user?.id) fd.append('user_id', String(user.id));

      if (Array.isArray(categories) && categories.length > 0) {
        // Dynamic submission
        const processedAnswers: Record<string, any> = {};
        
        for (const [questionId, answer] of Object.entries(responses)) {
          const question = categories
            .flatMap(cat => cat.questions || [])
            .find(q => String(q.id) === questionId);
          
          const lowerText = question?.text?.toLowerCase() || '';
          const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                         (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
          
          // 🔧 FIX: Check for both array answers AND file markers with multiple: true
          const isMultipleFileUpload = isAwardSupportingDocs && (
            Array.isArray(answer) || 
            (answer && typeof answer === 'object' && 'multiple' in answer && answer.multiple === true)
          );
          
          if (isMultipleFileUpload) {
            // Handle multiple file uploads (award documents)
            const files = multipleFileAnswers[questionId] || [];
            const validFiles = files.filter(f => f && f.uri && f.name);
            
            processedAnswers[questionId] = { type: 'file', multiple: true, count: validFiles.length };
            
            validFiles.forEach((file, index) => {
              fd.append(`file_${questionId}_${index}`, {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
              } as any);
            });
            
            console.log(`📤 Uploading ${validFiles.length} file(s) for question ${questionId} (${question?.text})`);
          } else if (answer && typeof answer === 'object' && 'type' in answer && answer.type === 'file') {
            // Handle single file uploads
            processedAnswers[questionId] = { type: 'file' };
            const file = fileAnswers[questionId];
            if (file && file.uri && file.name) {
              fd.append(`file_${questionId}`, {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
              } as any);
              console.log(`📤 Uploading file for question ${questionId} (${question?.text}): ${file.name}`);
            }
          } else {
            processedAnswers[questionId] = answer;
          }
        }
        
        fd.append('answers', JSON.stringify(processedAnswers));
      } else {
        // Fallback submission (existing static mapping)
        const answers: Record<string, any> = {
          Email: form.email,
          'Year Graduated': form.yearGraduated,
          Course: form.courseGraduated,
          'Last Name': form.lastName,
          'First Name': form.firstName,
          'Middle Name': form.middleName,
          Gender: form.gender,
          Age: form.age,
          Birthdate: form.birthdate,
          'Phone Number': form.contactno,
          'Social Media': form.socmedlink,
          'Current Address': form.currentAdd,
          'Home Address': form.homeAdd,
          'First Employer': form.employeer1,
          'First Date Hired': form.dateHired1,
          'First Job Position': form.jobPos1,
          'First Employment Status': form.empstat1,
          'First Company Address': form.compAdd1,
          Sector: form.sector,
          'Presently Employed': form.presentlyEmployed,
          'Current Employment Status': form.currentStat,
          'Current Company': form.currentComp,
          'Current Position': form.currentPos,
          'Years Employed': form.yearsEmployed,
          'Salary Range': form.salaryRange,
          'Has Awards': hasAwards,
          'Further Study': furtherStudy,
          'Further Study Date Started': form.fsDateStart,
          'Post Graduate Degree': form.postGrad,
          'Further Study University': form.postGradUniv,
          'Further Study Total Units': form.totalUnits,
          'Unemployment Reasons': Object.keys(unemploymentReasons)
            .filter(k => (unemploymentReasons as any)[k] === true && k !== 'otherText'),
          'Unemployment Other': unemploymentReasons.otherText,
        };
        fd.append('answers', JSON.stringify(answers));
        if (form.file && form.file.uri && form.file.name) {
          fd.append('file_9999', {
            uri: form.file.uri,
            name: form.file.name,
            type: form.file.mimeType || 'application/octet-stream',
          } as any);
        }
      }

      console.log('Submitting tracker (multipart)');
      await submitTrackerResponse(fd);
      
      // Refresh status after successful submission to ensure sync
      await checkTrackerStatus();
      
      Alert.alert('Success', 'Form submitted successfully!');
      navigation.goBack();
    } catch (error: any) {
      const serverMsg = error?.response?.data?.message || error?.message || 'Failed to submit form';
      console.error('Submit error:', serverMsg, error?.response?.data);
      Alert.alert('Error', String(serverMsg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTermsClose = () => {
    setShowTermsModal(false);
  };

  const [hasAwards, setHasAwards] = useState('No');
  const [awardOptions, setAwardOptions] = useState([
    { id: '1', label: 'Yes', value: 'Yes' },
    { id: '2', label: 'No', value: 'No', selected: true },
  ]);

  const [furtherStudy, setFurtherStudy] = useState('No');
  const [furtherStudyOptions, setFurtherStudyOptions] = useState([
    { id: '1', label: 'Yes', value: 'Yes' },
    { id: '2', label: 'No', value: 'No', selected: true },
  ]);

  const [unemploymentReasons, setUnemploymentReasons] = useState({
    family: false,
    health: false,
    experience: false,
    noOpportunity: false,
    notLooking: false,
    seeking: false,
    study: false,
    other: false,
    otherText: '',
  });

  const handleFilePick = async (questionText?: string) => {
    // Check if this is an image-only question (20, 31, 32)
    const lowerText = (questionText || '').toLowerCase();
    const isFirstEmploymentDoc = lowerText.includes('first employment supporting document');
    const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                   (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
    const isCurrentEmploymentDoc = (lowerText.includes('employment supporting document') && lowerText.includes('current')) ||
                                    (lowerText.includes('current employment supporting document'));
    const isImageOnlyQuestion = isFirstEmploymentDoc || isAwardSupportingDocs || isCurrentEmploymentDoc;
    
    let fileAsset: FileAsset | null = null;
    
    if (isImageOnlyQuestion) {
      // Use ImagePicker for image-only questions
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant permission to access your photo library to upload images.');
          return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1,
          allowsMultipleSelection: false,
        });
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const f = result.assets[0];
          const fileName = f.fileName || `image_${Date.now()}.jpg`;
          const mimeType = f.type || 'image/jpeg';
          
          fileAsset = {
            name: fileName,
            uri: f.uri,
            mimeType: mimeType,
            size: f.fileSize || 0,
          };
          
          // Validate file size (10MB)
          if (fileAsset.size && fileAsset.size > 10 * 1024 * 1024) {
            Alert.alert('File Size Error', 'File size must be less than 10MB');
            return;
          }
          
          // Validate file type - IMAGE ONLY
          const allowedImageTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/svg+xml',
            'image/gif',
            'image/webp',
            'image/bmp',
            'image/tiff',
          ];
          
          if (fileAsset.mimeType && !allowedImageTypes.includes(fileAsset.mimeType)) {
            Alert.alert('File Type Error', 'Please select an image file only (JPEG, PNG, SVG, GIF, WEBP, BMP, or TIFF)');
            return;
          }
        }
      } catch (error) {
        console.error('ImagePicker error:', error);
        Alert.alert('Error', 'Failed to pick image. Please try again.');
        return;
      }
    } else {
      // Use DocumentPicker for other file questions
      const result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        fileAsset = {
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
          size: file.size,
        };
      }
    }
    
    if (fileAsset) {
      handleChange('file', fileAsset);
    }
  };

  // Helper: check if question text should be hidden (matching web)
  const shouldHideQuestionText = (text: string): boolean => {
    const t = (text || '').toLowerCase();
    return t.includes('current scope of your job');
  };
  
  // Conditional rendering logic (MUST be defined before getFlatQuestions since it's used there)
  // Use useCallback to maintain stable reference and prevent infinite re-renders
  const shouldShowCategory = useCallback((category: any) => {
    if (!Array.isArray(categories)) return true;
    
    const title = (category.title || category.name || '').toLowerCase();
    
    // Check if this is "PART III: EMPLOYMENT STATUS" category
    if (title.includes('employment status') && !title.includes('unemployed')) {
      const employmentQuestion = categories.find((cat) =>
        (cat.questions || []).some((q: any) => q.text?.toLowerCase().includes('presently employed'))
      );
      if (employmentQuestion) {
        const employmentQuestionId = employmentQuestion.questions?.find((q: any) =>
          q.text?.toLowerCase().includes('presently employed')
        )?.id;
        return responses[String(employmentQuestionId)] === 'Yes';
      }
    }

    // Check if this is "IF UNEMPLOYED" category
    if (title.includes('unemployed')) {
      const employmentQuestion = categories.find((cat) =>
        (cat.questions || []).some((q: any) => q.text?.toLowerCase().includes('presently employed'))
      );
      if (employmentQuestion) {
        const employmentQuestionId = employmentQuestion.questions?.find((q: any) =>
          q.text?.toLowerCase().includes('presently employed')
        )?.id;
        return responses[String(employmentQuestionId)] === 'No';
      }
    }

    // Check if this is "PART IV: FURTHER STUDY" category
    if (title.includes('further study')) {
      const studyQuestion = categories.find((cat) =>
        (cat.questions || []).some((q: any) => {
          const t = q.text?.toLowerCase() || '';
          return t.includes('pursue') && t.includes('study');
        })
      );
      if (studyQuestion) {
        const studyQuestionId = studyQuestion.questions?.find((q: any) => {
          const t = q.text?.toLowerCase() || '';
          return t.includes('pursue') && t.includes('study');
        })?.id;
        return responses[String(studyQuestionId)] === 'Yes';
      }
    }

    // Show all other categories by default
    return true;
  }, [categories, responses]);
  
  // Helper: get flat list of all VISIBLE questions with their number (matching web logic exactly)
  const getFlatQuestions = () => {
    if (!Array.isArray(categories)) return [];
    const flat: { catIdx: number; qIdx: number; questionId: number; number: number }[] = [];
    let num = 1;
    
    // Only count questions from visible categories (same filter as rendering)
    categories
      .filter((cat) => shouldShowCategory(cat))
      .forEach((cat) => {
        // Get the original category index from the full categories array
        const originalCatIdx = categories.indexOf(cat);
        
        // Sort questions by order (same as rendering)
        const sortedQuestions = [...(cat.questions || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        
        sortedQuestions.forEach((q: any) => {
          // Skip hidden questions (same check as rendering)
          if (shouldHideQuestionText(q.text || '')) return;
          
          // Check for conditional questions (e.g., award supporting docs)
          const lowerText = (q.text || '').toLowerCase();
          const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                         (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
          
          if (isAwardSupportingDocs) {
            // Find question 30 (awards/recognition question) - only count if it would be shown
            const awardQuestion = categories
              .flatMap(cat => cat.questions || [])
              .find((ques: any) => {
                const qt = (ques.text || '').toLowerCase();
                return ques.type === 'radio' && 
                       (qt.includes('awards') || qt.includes('award') || qt.includes('recognition')) &&
                       (qt.includes('received') || qt.includes('during') || qt.includes('employment'));
              });
            
            // Only count if the award question exists (would be shown when answered Yes)
            if (!awardQuestion) return; // Skip if parent question doesn't exist
          }
          
          // Find the original index in the unsorted questions array
          const originalQIdx = (cat.questions || []).findIndex((origQ: any) => origQ.id === q.id);
          
          flat.push({ catIdx: originalCatIdx, qIdx: originalQIdx, questionId: q.id, number: num++ });
        });
      });
    
    return flat;
  };
  
  // Memoize flat questions to avoid recalculating on every render (matching web)
  // Note: shouldShowCategory is defined above and uses useCallback for stable reference
  const flatQuestions = useMemo(() => getFlatQuestions(), [categories, responses, shouldShowCategory]);
  
  // Helper to get question number by question ID directly (most reliable, matching web)
  const getQuestionNumberById = (questionId: number) => {
    const found = flatQuestions.find((fq) => fq.questionId === questionId);
    return found ? found.number : '';
  };
  
  // Fallback: get question number by indices (for backward compatibility)
  const getQuestionNumber = (catIdx: number, qIdx: number) => {
    // First try to find by question ID (most reliable)
    const question = categories?.[catIdx]?.questions?.[qIdx];
    if (question) {
      const found = flatQuestions.find((fq) => fq.questionId === question.id);
      if (found) return found.number;
    }
    
    // Fallback: try to find by catIdx and qIdx
    const found = flatQuestions.find((fq) => fq.catIdx === catIdx && fq.qIdx === qIdx);
    return found ? found.number : '';
  };
  
  // Helper to check if field should be read-only
  const isReadOnlyField = (q: any): boolean => {
    const text = (q.text || '').toLowerCase();
    return text.includes('program') || text.includes('year graduated') || text.includes('batch') || 
           text.includes('birthdate') || text.includes('birth date') || text.includes('birthday');
  };
  
  // Helper to get prefilled value (matching web logic exactly)
  const getPrefilledValue = (q: any) => {
    const qid = String(q.id);
    
    // Always check responses first (user input or draft)
    if (responses[qid] !== undefined) {
      return responses[qid];
    }
    
    if (!userDetails) return '';
    
    const text = (q.text || '').toLowerCase();
    
    // Always use User model for course, batch, birthdate, phone (matching web)
    if (text.includes('program graduated') || (text.includes('program') && text.includes('graduated'))) {
      return userDetails.program || '';
    } else if ((text.includes('year') && text.includes('graduated')) || text.includes('batch')) {
      const yearValue = userDetails.year_graduated || userDetails.batch || '';
      return yearValue ? String(yearValue) : '';
    } else if (text.includes('birthdate') || text.includes('birth date') || text.includes('birthday')) {
      if (userDetails.birthdate) {
        const date = new Date(userDetails.birthdate);
        return date.toISOString().split('T')[0];
      }
      return '';
    } else if (text.includes('phone') || text.includes('mobile') || text.includes('contact') || text.includes('landline')) {
      return userDetails.phone || userDetails.phone_num || '';
    }
    
    // Don't pre-fill current position/company/presently employed (matching web behavior)
    // This prevents OJT data from affecting current employment
    if (text.includes('current position')) {
      return ''; // Don't pre-fill - let user answer
    } else if (text.includes('current company') || (text.includes('current') && text.includes('organization') && text.includes('employer'))) {
      return ''; // Don't pre-fill - let user answer
    } else if (text.includes('presently employed') || (text.includes('presently') && text.includes('employed'))) {
      return ''; // Don't pre-fill - let user answer
    }
    
    // Standard field mappings (matching web)
    if (text.includes('first name')) {
      return userDetails.first_name || userDetails.f_name || '';
    } else if (text.includes('last name')) {
      return userDetails.last_name || userDetails.l_name || '';
    } else if (text.includes('middle name')) {
      return userDetails.middle_name || userDetails.m_name || '';
    } else if (text.includes('email')) {
      return userDetails.email || '';
    } else if (text.includes('age')) {
      if (userDetails.age) {
        return String(userDetails.age);
      } else if (userDetails.birthdate) {
        const birthDate = new Date(userDetails.birthdate);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear() - 
          ((today.getMonth() < birthDate.getMonth()) ? 1 : 0) - 
          ((today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
        return String(age);
      }
      return '';
    } else if (text.includes('address') && !text.includes('company')) {
      return userDetails.address || '';
    } else if (text.includes('civil status')) {
      return userDetails.civil_status || '';
    } else if (text.includes('social media')) {
      return userDetails.social_media || '';
    }
    
    return '';
  };

  // Dynamic renderer
  const renderQuestion = (q: any, catIdx: number = 0, qIdx: number = 0) => {
    const qid = String(q.id ?? q.question_id ?? q.key ?? q.text);
    const qtype = (q.type || '').toLowerCase();
    const value = responses[qid] !== undefined ? responses[qid] : getPrefilledValue(q);
    // Use question ID for numbering (most reliable, matching web)
    const questionNumber = getQuestionNumberById(q.id) || getQuestionNumber(catIdx, qIdx);
    // Define lowerText early for use throughout the function
    const lowerText = (q.text || '').toLowerCase();
    
    // Skip hidden questions (matching web behavior)
    if (shouldHideQuestionText(q.text || '')) {
      return null;
    }
    
    // Check if this is award supporting docs question - only show if awards question is "Yes"
    const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                   (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
    
    if (isAwardSupportingDocs) {
      const awardQuestion = categories
        ?.flatMap(cat => cat.questions || [])
        .find((ques: any) => {
          const qt = ques.text?.toLowerCase() || '';
          return ques.type === 'radio' && 
                 (qt.includes('awards') || qt.includes('award') || qt.includes('recognition')) &&
                 (qt.includes('received') || qt.includes('during') || qt.includes('employment'));
        });
      
      if (!awardQuestion || responses[String(awardQuestion.id)] !== 'Yes') {
        return null;
      }
      
      // Multiple file upload for award documents (matching web implementation)
      const files = multipleFileAnswers[qid] || [];
      
      // Check if there's a file marker in responses (from draft) indicating files were uploaded
      const responseValue = responses[qid];
      const hasFileMarker = responseValue && 
        typeof responseValue === 'object' && 
        !Array.isArray(responseValue) &&
        'type' in responseValue && 
        'uploaded' in responseValue &&
        responseValue.type === 'file' && 
        responseValue.multiple === true &&
        responseValue.uploaded === true;
      
      // If file marker exists but no actual files (after refresh), show helper message
      const showReuploadMessage = hasFileMarker && (!files || files.length === 0 || files.every(f => f === null));
      
      // Helper function to update file at specific index
      const updateFileAtIndex = async (index: number) => {
        // For award documents (question 31), use ImagePicker (image-only)
        let asset: FileAsset | null = null;
        
        try {
          const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (permissionResult.status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant permission to access your photo library to upload images.');
            return;
          }
          
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
            allowsMultipleSelection: false,
          });
          
          if (!result.canceled && result.assets && result.assets.length > 0) {
            const f = result.assets[0];
            const fileName = f.fileName || `image_${Date.now()}.jpg`;
            const mimeType = f.type || 'image/jpeg';
            
            asset = {
              name: fileName,
              uri: f.uri,
              mimeType: mimeType,
              size: f.fileSize || 0,
            };
          }
        } catch (error) {
          console.error('ImagePicker error:', error);
          Alert.alert('Error', 'Failed to pick image. Please try again.');
          return;
        }
        
        if (!asset) return;
        
        // Validate file size (10MB)
        if (asset.size && asset.size > 10 * 1024 * 1024) {
          Alert.alert('File Size Error', 'File size must be less than 10MB');
          return;
        }
        
        // Validate file type - IMAGE ONLY for question 31
        const allowedImageTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/svg+xml',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/tiff',
        ];
        
        if (asset.mimeType && !allowedImageTypes.includes(asset.mimeType)) {
          Alert.alert('File Type Error', 'Please select an image file only (JPEG, PNG, SVG, GIF, WEBP, BMP, or TIFF)');
          return;
        }
          
          // Update file at specific index
          const currentFiles = [...files];
          // Ensure array is large enough
          while (currentFiles.length <= index) {
            currentFiles.push(null as any);
          }
          currentFiles[index] = asset;
          
          // Filter out null entries to get actual file count
          const validFiles = currentFiles.filter(f => f !== null);
          
          setMultipleFileAnswers((prev) => ({ ...prev, [qid]: currentFiles }));
          // Save file marker in responses for draft persistence (count only valid files)
          setResponse(qid, { 
            type: 'file', 
            multiple: true, 
            uploaded: true, 
            count: validFiles.length 
          });
        }
      };
      
      // Ensure at least one slot exists automatically when question is shown (matching web behavior)
      // This ensures "Choose File" appears immediately without needing "+ Add Another Award"
      const displayFiles = files.length === 0 ? [null] : files;
      
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          {displayFiles.map((file, index) => (
            <View key={index} style={{ marginBottom: 8, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontWeight: '500', fontSize: 14 }}>Award Document {index + 1}</Text>
                {displayFiles.length > 1 && file && (
                  <TouchableOpacity 
                    onPress={() => removeFileFromMultiple(qid, index)}
                    style={{
                      backgroundColor: '#ff3b3b',
                      paddingVertical: 4,
                      paddingHorizontal: 12,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 12 }}>Remove</Text>
              </TouchableOpacity>
                )}
            </View>
              
              {/* Choose File Button - shown for each slot (matching web) */}
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={() => updateFileAtIndex(index)}
              >
            <Text style={styles.uploadButtonText}>
                  {file ? 'Choose File' : 'Choose File'}
            </Text>
          </TouchableOpacity>
              
              {/* Show selected file info if file exists */}
              {file && (
                <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.fileText}>{file.name}</Text>
                  {file.size && (
                    <Text style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
          
          {/* Add Another Award Button */}
          <TouchableOpacity 
            style={[styles.uploadButton, { marginTop: 8, backgroundColor: '#1e4c7a' }]} 
            onPress={() => {
              const currentFiles = multipleFileAnswers[qid] || [];
              const updatedFiles = [...currentFiles, null as any];
              setMultipleFileAnswers((prev) => ({ ...prev, [qid]: updatedFiles }));
              // Update file marker - keep existing marker if files exist, otherwise create new one
              const existingFiles = currentFiles.filter(f => f !== null);
              if (existingFiles.length > 0) {
                setResponse(qid, { 
                  type: 'file', 
                  multiple: true, 
                  uploaded: true, 
                  count: existingFiles.length 
                });
              }
            }}
          >
            <Text style={[styles.uploadButtonText, { color: 'white' }]}>
              + Add Another Award
            </Text>
          </TouchableOpacity>
          
          {files.length === 0 && !showReuploadMessage && (
            <Text style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
              Click the button above to add your first award document.
            </Text>
          )}
          
          {/* Show re-upload message if files were uploaded before refresh */}
          {showReuploadMessage && (
            <View style={{ marginTop: 8, padding: 12, backgroundColor: '#fff3cd', borderRadius: 6, borderWidth: 1, borderColor: '#ffc107' }}>
              <Text style={{ fontSize: 12, color: '#856404', fontWeight: '500' }}>
                ⚠️ Files were uploaded but need to be re-uploaded after page refresh. Please select your files again.
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (qtype === 'file' || /upload|file/i.test(q.text || '')) {
      const file = fileAnswers[qid];
      // Check if there's a file marker in responses (from draft) indicating file was uploaded
      const responseValue = responses[qid];
      const hasFileMarker = responseValue && 
        typeof responseValue === 'object' && 
        !Array.isArray(responseValue) &&
        'type' in responseValue && 
        'uploaded' in responseValue &&
        responseValue.type === 'file' && 
        responseValue.uploaded === true;
      
      // If file marker exists but no actual file (after refresh), show helper message
      const showReuploadMessage = hasFileMarker && !file;
      
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          <TouchableOpacity style={styles.uploadButton} onPress={() => pickFileForQuestion(qid, false, q.text)}>
            <Text style={styles.uploadButtonText}>Choose File</Text>
          </TouchableOpacity>
          {file && <Text style={styles.fileText}>{file.name}</Text>}
          
          {/* Show re-upload message if file was uploaded before refresh */}
          {showReuploadMessage && (
            <View style={{ marginTop: 8, padding: 12, backgroundColor: '#fff3cd', borderRadius: 6, borderWidth: 1, borderColor: '#ffc107' }}>
              <Text style={{ fontSize: 12, color: '#856404', fontWeight: '500' }}>
                ⚠️ File was uploaded but needs to be re-uploaded after page refresh. Please select your file again.
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (qtype === 'radio' || (qtype === 'select' && Array.isArray(q.options))) {
      const opts: string[] = (q.options || []).map((o: any) => (typeof o === 'string' ? o : (o?.label ?? o?.value)));
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {opts.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setResponse(qid, opt)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: value === opt ? '#005c99' : '#ccc',
                  backgroundColor: value === opt ? '#e6f0fa' : '#fff',
                  marginRight: 8,
                  marginTop: 6,
                }}
              >
                <Text style={{ color: '#005c99' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
    
    if (qtype === 'checkbox' && Array.isArray(q.options)) {
      const opts: string[] = (q.options || []).map((o: any) => (typeof o === 'string' ? o : (o?.label ?? o?.value)));
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          <View style={{ marginTop: 8 }}>
            {opts.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  const prev = Array.isArray(value) ? value : [];
                  if (prev.includes(opt)) {
                    setResponse(qid, prev.filter((v: string) => v !== opt));
                  } else {
                    setResponse(qid, [...prev, opt]);
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
              >
                <View style={[styles.checkboxBox, selectedValues.includes(opt) && styles.checked]} />
                <Text style={styles.checkboxLabel}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
    
    if (qtype === 'multiple' && Array.isArray(q.options)) {
      const opts: string[] = (q.options || []).map((o: any) => (typeof o === 'string' ? o : (o?.label ?? o?.value)));
      const readOnly = isReadOnlyField(q);
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={[styles.dropdown, readOnly && { backgroundColor: '#f0f0f0', opacity: 0.7 }]} 
              onPress={() => {
                if (readOnly) return; // Don't allow selection if read-only
                // Simple dropdown implementation - you might want to use a proper picker
                Alert.alert('Select Option', '', [
                  ...opts.map(opt => ({
                    text: opt,
                    onPress: () => setResponse(qid, opt)
                  })),
                  { text: 'Cancel', style: 'cancel' }
                ]);
              }}
              disabled={readOnly}
            >
              <Text style={{ color: value ? '#222' : '#aaa' }}>
                {value || 'Select...'}
              </Text>
              {!readOnly && <FontAwesome name="chevron-down" size={16} color="#222" style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Special handling for date fields (Birthdate, Date Hired, Date Started)
    const text = (q.text || '').toLowerCase();
    const isBirthdate = text.includes('birth') || text.includes('bday') || (text.includes('date') && text.includes('birth'));
    const isDateHired = (text.includes('date hired') || (text.includes('hired') && text.includes('date'))) && !text.includes('birth');
    const isDateStarted = (text.includes('date started') || (text.includes('started') && text.includes('date'))) && !text.includes('birth');
    const isDate = isBirthdate || isDateHired || isDateStarted;
    
    if (isDate) {
      // Helper function to safely parse date
      const parseDateSafe = (dateStr: string): Date | null => {
        if (!dateStr || dateStr.trim() === '') return null;
        
        // Try YYYY-MM-DD format
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) return date;
        }
        
        // Try MM/DD/YYYY format
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const month = parseInt(parts[0]) - 1;
            const day = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
              const date = new Date(year, month, day);
              if (!isNaN(date.getTime())) return date;
            }
          }
        }
        
        // Try direct Date parsing as fallback
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date;
        
        return null;
      };
      
      const currentValue = value ? String(value) : '';
      let formattedValue = '';
      const parsedDate = parseDateSafe(currentValue);
      
      if (parsedDate) {
        // Format as YYYY-MM-DD
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        formattedValue = `${year}-${month}-${day}`;
      }
      
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          <TouchableOpacity
            onPress={() => {
              // Use parsed date if valid, otherwise use today
              let initialDate: Date;
              if (parsedDate && !isNaN(parsedDate.getTime())) {
                initialDate = parsedDate;
              } else {
                initialDate = new Date();
              }
              // Ensure date is valid before setting
              if (isNaN(initialDate.getTime())) {
                initialDate = new Date();
              }
              setSelectedDate(initialDate);
              // Initialize raw inputs with current date values
              setDateInputs({
                year: String(initialDate.getFullYear()),
                month: String(initialDate.getMonth() + 1),
                day: String(initialDate.getDate())
              });
              setShowDatePicker({ questionId: qid, visible: true });
            }}
            style={[styles.input, { justifyContent: 'center' }]}
          >
            <Text style={{ color: formattedValue ? '#000' : '#999' }}>
              {formattedValue || 'YYYY-MM-DD'}
            </Text>
            <FontAwesome name="calendar" size={16} color="#666" style={{ marginLeft: 'auto', marginRight: 8 }} />
          </TouchableOpacity>
        </View>
      );
    }
    
    // Special handling for "How long have you been employed?" (Question 28)
    const isEmploymentDuration = text.includes('how long') && text.includes('employed');
    if (isEmploymentDuration) {
      const durationOptions = [
        { value: 'less_than_6_months', label: 'Less than 6 months' },
        { value: '6_months_1_year', label: '6 months – 1 year' },
        { value: '1_2_years', label: '1 – 2 years' },
        { value: '3_5_years', label: '3 – 5 years' },
        { value: 'more_than_5_years', label: 'More than 5 years' }
      ];
      
      const currentLabel = durationOptions.find(opt => opt.value === value)?.label || value || '';
      
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              Alert.alert(
                'Select Employment Duration',
                '',
                [
                  ...durationOptions.map(opt => ({
                    text: opt.label,
                    onPress: () => setResponse(qid, opt.value)
                  })),
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Text style={{ color: currentLabel ? '#000' : '#999' }}>
              {currentLabel || 'Select employment duration'}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#666" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      );
    }
    
    // Special handling for "Current Salary range" (Question 29)
    const isSalaryRange = (text.includes('salary') || text.includes('salary range')) && !text.includes('monthly') && !text.includes('annual');
    if (isSalaryRange) {
      const salaryOptions = [
        { value: 'below_5000', label: '5,000 below' },
        { value: '5001_10000', label: '5,001 to 10,000' },
        { value: '10001_20000', label: '10,001 to 20,000' },
        { value: '20001_30000', label: '20,001 to 30,000' },
        { value: 'above_30000', label: '30,000 above' }
      ];
      
      const currentLabel = salaryOptions.find(opt => opt.value === value)?.label || value || '';
      
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              Alert.alert(
                'Select Salary Range',
                '',
                [
                  ...salaryOptions.map(opt => ({
                    text: opt.label,
                    onPress: () => setResponse(qid, opt.value)
                  })),
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Text style={{ color: currentLabel ? '#000' : '#999' }}>
              {currentLabel || 'Select salary range'}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#666" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      );
    }
    
    // Enhanced current position with autocomplete and alignment checking (matching web)
    const isCurrentPosition = lowerText.includes('current position');
    if (isCurrentPosition) {
      const currentQuestionSuggestions = showJobSuggestions.questionId === qid ? jobSuggestions : [];
      const alignmentInfo = jobAlignmentStatus?.questionId === qid ? jobAlignmentStatus : null;
      const isLoadingSuggestions = loadingJobSuggestions.questionId === qid && loadingJobSuggestions.loading;
      const isCheckingAlignment = checkingAlignment && jobAlignmentStatus?.questionId === qid;
      
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>
            {questionNumber ? `${questionNumber}. ` : ''}{q.text}
            {q.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
          
          {/* Job Title Input with Suggestions */}
          <View style={{ position: 'relative', zIndex: 1000 }}>
            <TextInput
              style={styles.input}
              value={value !== null && value !== undefined ? String(value) : ''}
              onChangeText={(v) => {
                setResponse(qid, v);
                // Clear alignment status when typing
                if (jobAlignmentStatus?.questionId === qid) {
                  setJobAlignmentStatus(null);
                }
                // Search for job suggestions (debounced)
                searchJobTitles(v, qid);
              }}
              onSubmitEditing={() => {
                // Handle Enter key - check alignment if user typed manually
                const currentValue = responses[qid] !== undefined ? String(responses[qid]) : '';
                if (currentValue && currentValue.trim().length >= 2) {
                  const isFromAutocomplete = currentQuestionSuggestions.some(s => s.title.toLowerCase().trim() === currentValue.toLowerCase().trim());
                  if (!isFromAutocomplete) {
                    handleCheckJobAlignment(currentValue.trim(), qid, false);
                  }
                }
                // Hide suggestions
                setShowJobSuggestions({ questionId: '', visible: false });
              }}
              onBlur={() => {
                // CRITICAL FIX: Prevent onBlur from interfering with suggestion selection
                // Check if a suggestion was just selected (within last 300ms)
                const justSelected = suggestionSelectedRef.current && 
                  suggestionSelectedRef.current.questionId === qid &&
                  Date.now() - suggestionSelectedRef.current.timestamp < 300;
                
                if (justSelected) {
                  // Don't run onBlur logic if suggestion was just selected
                  return;
                }
                
                // For manually typed jobs, check alignment after a delay
                setTimeout(() => {
                  const currentValue = responses[qid] !== undefined ? String(responses[qid]) : '';
                  
                  // Double-check that suggestion wasn't selected during the delay
                  const stillJustSelected = suggestionSelectedRef.current && 
                    suggestionSelectedRef.current.questionId === qid &&
                    Date.now() - suggestionSelectedRef.current.timestamp < 500;
                  
                  if (stillJustSelected) {
                    return; // Don't interfere with suggestion selection
                  }
                  
                  // Only check alignment if user typed something manually
                  if (currentValue && currentValue.trim().length >= 2 && !showJobSuggestions.visible) {
                    // Check if this value exactly matches any suggestion (case-insensitive)
                    const isFromAutocomplete = currentQuestionSuggestions.some(s => 
                      s.title.toLowerCase().trim() === currentValue.toLowerCase().trim()
                    );
                    
                    // Only check alignment for manually typed jobs (not from autocomplete)
                    if (!isFromAutocomplete) {
                      handleCheckJobAlignment(currentValue.trim(), qid, false);
                    }
                  }
                  
                  // Always hide suggestions after blur (if still visible)
                  if (showJobSuggestions.visible && showJobSuggestions.questionId === qid) {
                    setShowJobSuggestions({ questionId: '', visible: false });
                  }
                }, 200); // Short delay to allow suggestion selection to complete
              }}
              placeholder={q.placeholder || "Select or type Job Title"}
              autoCapitalize="words"
              ref={(ref) => {
                // Store ref for potential programmatic updates if needed
              }}
            />
            
            {/* Loading Indicator */}
            {isLoadingSuggestions && (
              <View style={{ position: 'absolute', right: 12, top: 12 }}>
                <ActivityIndicator size="small" color="#174f84" />
              </View>
            )}
            
            {/* Job Suggestions Dropdown */}
            {currentQuestionSuggestions.length > 0 && showJobSuggestions.visible && showJobSuggestions.questionId === qid && (
              <View style={styles.jobSuggestionsContainer}>
                <ScrollView style={styles.jobSuggestionsList} nestedScrollEnabled={true}>
                  {currentQuestionSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={`${suggestion.title}-${suggestion.program}-${index}`}
                      style={styles.jobSuggestionItem}
                      onPress={async () => {
                        // CRITICAL FIX: Ensure the selected value appears in TextInput immediately
                        const selectedTitle = suggestion.title;
                        
                        // Mark that a suggestion was selected (prevents onBlur from interfering)
                        suggestionSelectedRef.current = {
                          questionId: qid,
                          timestamp: Date.now()
                        };
                        
                        // Hide suggestions immediately to prevent blur event conflicts
                        setShowJobSuggestions({ questionId: '', visible: false });
                        setJobSuggestions([]);
                        
                        // Update response state immediately - this triggers re-render with new value
                        setResponse(qid, selectedTitle);
                        
                        // Use requestAnimationFrame to ensure state update has propagated to TextInput
                        // Then check alignment immediately (fromAutocomplete=true means no debounce)
                        requestAnimationFrame(() => {
                          // Check alignment immediately for autocomplete selections
                          handleCheckJobAlignment(selectedTitle, qid, true);
                        });
                      }}
                    >
                      <Text style={styles.jobSuggestionTitle}>{suggestion.title}</Text>
                      <View style={{ flexDirection: 'row', marginTop: 4 }}>
                        <Text style={styles.jobSuggestionProgram}>{suggestion.program}</Text>
                        <Text style={styles.jobSuggestionCode}> • Code: {suggestion.code}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
          
          {/* Alignment Status Helper Text */}
          {isCheckingAlignment ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <ActivityIndicator size="small" color="#174f84" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                Checking job alignment...
              </Text>
            </View>
          ) : alignmentInfo && (
            <View style={{ marginTop: 6 }}>
              {alignmentInfo.status === 'aligned' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#4caf50' }}>
                  <FontAwesome name="check-circle" size={14} color="#2e7d32" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: '500' }}>
                    ✓ This job is aligned to your program
                  </Text>
                </View>
              ) : alignmentInfo.status === 'not_aligned' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#ff9800' }}>
                  <FontAwesome name="info-circle" size={14} color="#f57c00" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, color: '#e65100', fontWeight: '500' }}>
                    ⚠ This job may not be aligned to your program
                  </Text>
                </View>
              ) : alignmentInfo.status === 'pending' || showJobAlignmentModal.needsConfirmation ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#2196f3' }}>
                  <FontAwesome name="question-circle" size={14} color="#1976d2" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, color: '#1565c0', fontWeight: '500' }}>
                    ? Please confirm if this job is aligned to your program
                  </Text>
                </View>
              ) : null}
            </View>
          )}
          
          {/* Helper Text (always show) */}
          <Text style={{ fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
            💡 Tip: Type your job title to see suggestions. The system will check if it's aligned with your course.
          </Text>
        </View>
      );
    }
    
    // Special handling for "Current Company Name" - regular text input (matching web)
    const isCurrentCompany = lowerText.includes('current company') || 
                            (lowerText.includes('current') && lowerText.includes('organization') && lowerText.includes('employer')) ||
                            lowerText.includes('company name');
    
    // default to text input
    const isPhone = text.includes('phone') || text.includes('mobile') || text.includes('contact');
    const isEmail = text.includes('email');
    const isNumeric = text.includes('age') || text.includes('units') || text.includes('number');
    const readOnly = isReadOnlyField(q);
    
    return (
      <View key={qid} style={{ marginBottom: 12 }}>
        <Text style={styles.label}>
          {questionNumber ? `${questionNumber}. ` : ''}{q.text}
          {q.required && <Text style={{ color: 'red' }}> *</Text>}
        </Text>
        <TextInput
          style={[styles.input, readOnly && { backgroundColor: '#f0f0f0', opacity: 0.7 }]}
          value={value !== null && value !== undefined ? String(value) : ''}
          onChangeText={(v) => {
            if (!readOnly) {
              setResponse(qid, v);
            }
          }}
          placeholder={q.placeholder || (isCurrentCompany ? 'Enter company name' : '')}
          keyboardType={isPhone ? 'phone-pad' : isEmail ? 'email-address' : isNumeric ? 'numeric' : 'default'}
          autoCapitalize={isCurrentCompany ? 'words' : 'none'}
          editable={!readOnly}
        />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1C4E80' }}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <FontAwesome name="arrow-left" size={20} color="#174f84" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>CTU MAIN ALUMNI TRACKER</Text>
      </View>
      
      {/* Auto-save status indicator */}
      {saveStatus && (
        <View style={{
          backgroundColor: saveStatus === 'saved' ? '#4CAF50' : saveStatus === 'saving' ? '#FF9800' : '#F44336',
          paddingVertical: 6,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {saveStatus === 'saving' && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
            {saveStatus === 'saved' && '✓ Draft saved'}
            {saveStatus === 'saving' && 'Saving draft...'}
            {saveStatus === 'unsaved' && '● Unsaved changes'}
          </Text>
        </View>
      )}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading form...</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      ) : Array.isArray(categories) && categories.length > 0 ? (
        <ScrollView contentContainerStyle={styles.container}>
        
          {categories
            .filter((cat) => shouldShowCategory(cat))
            .map((cat, catIdx) => (
              <View key={cat.id ?? catIdx} style={styles.card}>
                {(cat.title || cat.name) && <Text style={styles.sectionTitle}>{cat.title || cat.name}</Text>}
                {cat.description && <Text style={styles.sectionDescription}>{cat.description}</Text>}
                {Array.isArray(cat.questions) && cat.questions.map((q: any, qIdx: number) => renderQuestion(q, catIdx, qIdx))}
              </View>
            ))}

          <TouchableOpacity 
            style={[styles.button, submitting && styles.buttonDisabled]} 
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#005c99" />
                <Text style={styles.buttonText}>Submitting...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Submit</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        // Fallback to existing static form UI if no dynamic questions
        <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>To our Dear Graduates,</Text>
        <Text style={styles.sectionDescription}>Kindly complete this questionnaire accurately and truthfully. Your responses will be used for research purposes to assess employability and, ultimately, improve the curriculum programs offered at Cebu Technological University (CTU). Rest assured that your answers to this survey will be treated with the utmost confidentiality.</Text>
        <Text style={styles.sectionDescription}>Thank you very much!</Text>
        <Text style={styles.sectionDescription}>If you have any questions, you may contact the office of the Alumni Director through 
        email address gts@ctu.edu.ph or Contact no: (032) 402 4060.</Text>
      </View>

      {/* Personal Info */}
      <View style={styles.card}>
        <Text style={styles.sectionDescription}>* Required</Text>

        <Text style={styles.label}>1. Email </Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={form.email}
          onChangeText={(v) => handleChange('email', v)}
        />

        <Text style={styles.label}>2. Year Graduated</Text>
        <TextInput
          style={styles.input}
          placeholder="Year"
          keyboardType="numeric"
          value={form.yearGraduated}
          onChangeText={(v) => handleChange('yearGraduated', v)}
        />

        <Text style={styles.label}>3. Course Graduated </Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowCourseDropdown(!showCourseDropdown)}>
            <Text style={{ color: form.courseGraduated ? '#222' : '#aaa' }}>{form.courseGraduated || 'Select your course'}</Text>
            <FontAwesome name="chevron-down" size={16} color="#222" style={{ marginLeft: 250 }} />
          </TouchableOpacity>
          {showCourseDropdown && (
            <View style={styles.dropdownList}>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('courseGraduated', 'Bachelor in Science in Information Technology'); setShowCourseDropdown(false); }}>
                <Text style={{ color: '#222' }}>Bachelor in Science in Information Technology</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('courseGraduated', 'Bachelor in Science in Information System'); setShowCourseDropdown(false); }}>
                <Text style={{ color: '#222' }}>Bachelor in Science in Information System</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('courseGraduated', 'Bachelor in Industrial Technology major in Computer Technology'); setShowCourseDropdown(false); }}>
                <Text style={{ color: '#222' }}>Bachelor in Industrial Technology major in Computer Technology</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* PART I - Personal Profile */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PART I - Personal Profile</Text>
        <Text style={styles.sectionDescription}>N/A if not applicable</Text>

        <Text style={styles.label}>4. Last Name </Text>
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={form.lastName}
          onChangeText={(v) => handleChange('lastName', v)}
        />       

        <Text style={styles.label}>5. First Name </Text>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={form.firstName}
          onChangeText={(v) => handleChange('firstName', v)}
        /> 

        <Text style={styles.label}>6. Middle Name </Text>
        <TextInput
          style={styles.input}
          placeholder="Middle Name"
          value={form.middleName}
          onChangeText={(v) => handleChange('middleName', v)}
        /> 
        <Text style={styles.label}>7. Gender</Text>
        <RadioGroup
          radioButtons={genderOptions}
          selectedId={genderOptions.find((btn) => btn.selected)?.id}
          onPress={(selectedId: any) => {
            const updatedButtons = genderOptions.map((btn) => ({
              ...btn,
              selected: btn.id === selectedId,
            }));
            setGenderOptions(updatedButtons);

            const selected = updatedButtons.find((btn) => btn.id === selectedId);
            if (selected) handleChange('gender', selected.value);
          }}
          layout="row"
        />

        <Text style={styles.label}>8. Age </Text>
        <TextInput
          style={styles.input}
          placeholder="22"
          value={form.age}
          onChangeText={(v) => handleChange('age', v)}
        />

        <Text style={styles.label}>9. Birthdate</Text>
        <TextInput
          style={styles.input}
          placeholder="00/00/0000"
          value={form.birthdate}
          onChangeText={(v) => handleChange('birthdate', v)}
        />

        <Text style={styles.label}>10. Landline or Mobile Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+63"
          value={form.contactno}
          onChangeText={(v) => handleChange('contactno', v)}
        />     

        <Text style={styles.label}>11. Social Media Account Link (e.g  https://www.facebook.com/aboloc)  </Text>
        <TextInput
          style={styles.input}
          placeholder="https://www.facebook.com/aboloc"
          value={form.socmedlink}
          onChangeText={(v) => handleChange('socmedlink', v)}
        />  

        <Text style={styles.label}>12. Complete Current Address </Text>
        <TextInput
          style={styles.input}
          placeholder="Address 1"
          value={form.currentAdd}
          onChangeText={(v) => handleChange('currentAdd', v)}
        />  

        <Text style={styles.label}>13. Complete Home Address </Text>
        <TextInput
          style={styles.input}
          placeholder="Address 1"
          value={form.homeAdd}
          onChangeText={(v) => handleChange('homeAdd', v)}
        />         
      </View>


      {/* PART II - Employment Status */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PART II - Employment Status</Text>
        <Text style={styles.sectionDescription}>N/A if not applicable</Text>

        <Text style={styles.label}>14. Name of your organization/employer <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Employeer 1"
          value={form.employeer1}
          onChangeText={(v) => handleChange('employeer1', v)}
        />

        <Text style={styles.label}>15. Date hired <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="00/00/0000"
          value={form.dateHired1}
          onChangeText={(v) => handleChange('dateHired1', v)}
        />    

        <Text style={styles.label}>16. Position <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text></Text>
        <Text style={styles.sectionDescription}><Text style={{ fontStyle: 'italic' }}>(N/A if not applicable)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Manager"
          value={form.jobPos1}
          onChangeText={(v) => handleChange('jobPos1', v)}
        />  

        <Text style={styles.label}>17. Status of your employment <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text></Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowEmploymentStatusDropdown(!showEmploymentStatusDropdown)}>
            <Text style={{ color: form.empstat1 ? '#222' : '#aaa' }}>{form.empstat1 || 'Select Employment Status'}</Text>
            <FontAwesome name="chevron-down" size={16} color="#222" style={{ marginLeft: 130 }} />
          </TouchableOpacity>
          {showEmploymentStatusDropdown && (
            <View style={styles.dropdownList}>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('empstat1', 'permanent'); setShowEmploymentStatusDropdown(false); }}>
                <Text style={{ color: '#222' }}>Permanent</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('empstat1', 'temporary'); setShowEmploymentStatusDropdown(false); }}>
                <Text style={{ color: '#222' }}>Temporary</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.label}>18. Company Address <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Company 1"
          value={form.compAdd1}
          onChangeText={(v) => handleChange('compAdd1', v)}
        /> 

        <Text style={styles.label}>
          19. Sector <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text>
        </Text>
        <RadioGroup
          radioButtons={sectorOptions}
          selectedId={sectorOptions.find((btn) => btn.selected)?.id}
          onPress={(selectedId: any) => {
            const updatedButtons = sectorOptions.map((btn) => ({
              ...btn,
              selected: btn.id === selectedId,
            }));
            setSectorOptions(updatedButtons);

            const selected = updatedButtons.find((btn) => btn.id === selectedId);
            if (selected) handleChange('sector', selected.value);
          }}
          layout="row"
        />

        <Text style={styles.label}>20. First Employment Supporting Document </Text>
        <Text style={styles.labelDesc}>Please upload the soft copy of your Company ID (Back to back) 
        and either your employment Contract or Certificate of Employment using the provided link below.</Text>
        <Text style={styles.labelDesc}>If you are Self-employed. Please provide barangay permit or DTI registration or mayor's permit </Text>
        <Text style={styles.labelDesc}>Here is the link:
        https://bit.ly/FirstEmploymentData</Text>
        <Text style={styles.labelDesc1}>Note: You will be required to sign in to Google when uploading your files.</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => handleFilePick('First Employment Supporting Document')}>
        <Text style={styles.uploadButtonText}>Choose File</Text>
        </TouchableOpacity>
        {form.file && <Text style={styles.fileText}>{form.file.name}</Text>}

        <Text style={styles.label}>
          21. Are you <Text style={{ fontWeight: 'bold' }}>PRESENTLY</Text> employed?
        </Text>
        <RadioGroup
          radioButtons={presentlyEmployedOptions}
          selectedId={presentlyEmployedOptions.find((btn) => btn.selected)?.id}
          onPress={(selectedId: any) => {
            const updatedButtons = presentlyEmployedOptions.map((btn) => ({
              ...btn,
              selected: btn.id === selectedId,
            }));
            setPresentlyEmployedOptions(updatedButtons);

            const selected = updatedButtons.find((btn) => btn.id === selectedId);
            if (selected) handleChange('presentlyEmployed', selected.value);
          }}
          layout="row"
        />

        </View>

      {/* PART III - Employment Status */}
      {form.presentlyEmployed === 'Yes' && (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PART III - Employment Status</Text>
        <Text style={styles.label}>
        22. Are you employed by a company/organization or are you self-employed?
        </Text>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setEmploymentTypes((prev) => ({ ...prev, company: !prev.company }))
            }
        >
            <View style={[styles.checkboxBox, employmentTypes.company && styles.checked]} />
            <Text style={styles.checkboxLabel}>Employed by a company/organization</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setEmploymentTypes((prev) => ({ ...prev, selfEmployed: !prev.selfEmployed }))
            }
        >
            <View style={[styles.checkboxBox, employmentTypes.selfEmployed && styles.checked]} />
            <Text style={styles.checkboxLabel}>Self-employed</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setEmploymentTypes((prev) => ({ ...prev, freelance: !prev.freelance }))
            }
        >
            <View style={[styles.checkboxBox, employmentTypes.freelance && styles.checked]} />
            <Text style={styles.checkboxLabel}>Freelance/Contract-based</Text>
        </TouchableOpacity>
        </View>
        
        <Text style={styles.label}>23. Status of your CURRENT Employment</Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowCurrentStatusDropdown(!showCurrentStatusDropdown)}>
            <Text style={{ color: form.currentStat ? '#222' : '#aaa' }}>{form.currentStat || 'Select Employment Status'}</Text>
            <FontAwesome name="chevron-down" size={16} color="#222" style={{ marginLeft: 130 }} />
          </TouchableOpacity>
          {showCurrentStatusDropdown && (
            <View style={styles.dropdownList}>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('currentStat', 'permanent'); setShowCurrentStatusDropdown(false); }}>
                <Text style={{ color: '#222' }}>Permanent</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('currentStat', 'temporary'); setShowCurrentStatusDropdown(false); }}>
                <Text style={{ color: '#222' }}>Temporary</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.label}>24. Name of your CURRENT organization/employer. <Text style={{ fontStyle: 'italic' }}>(Please don't abbreviate)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Company 1"
          value={form.currentComp}
          onChangeText={(v) => handleChange('currentComp', v)}
        />

        <Text style={styles.label}>25. Position <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text></Text>
        <Text style={styles.sectionDescription}><Text style={{ fontStyle: 'italic' }}>(N/A if not applicable)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Manager"
          value={form.currentPos}
          onChangeText={(v) => handleChange('currentPos', v)}
        />  

        <Text style={styles.label}>
          26. Sector <Text style={{ fontStyle: 'italic' }}>(1st employer right after graduation)</Text>
        </Text>
        <RadioGroup
          radioButtons={sectorOptions}
          selectedId={sectorOptions.find((btn) => btn.selected)?.id}
          onPress={(selectedId: any) => {
            const updatedButtons = sectorOptions.map((btn) => ({
              ...btn,
              selected: btn.id === selectedId,
            }));
            setSectorOptions(updatedButtons);

            const selected = updatedButtons.find((btn) => btn.id === selectedId);
            if (selected) handleChange('sector', selected.value);
          }}
          layout="row"
        />


        <Text style={styles.label}>
        27. How long have you been employed? <Text style={{ fontStyle: 'italic' }}>(Current Employment)</Text></Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowYearsEmployedDropdown(!showYearsEmployedDropdown)}>
            <Text style={{ color: form.yearsEmployed ? '#222' : '#aaa' }}>{form.yearsEmployed || 'Select duration'}</Text>
            <FontAwesome name="chevron-down" size={16} color="#222" style={{ marginLeft: 195}} />
          </TouchableOpacity>
          {showYearsEmployedDropdown && (
            <View style={styles.dropdownList}>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('yearsEmployed', 'less_than_1'); setShowYearsEmployedDropdown(false); }}>
                <Text style={{ color: '#222' }}>Less than 1 year</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('yearsEmployed', 'more_than_1'); setShowYearsEmployedDropdown(false); }}>
                <Text style={{ color: '#222' }}>More than one (1) year</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.label}>
        28. What is your current salary range? <Text style={{ fontStyle: 'italic' }}>(Current Employment)</Text></Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowSalaryRangeDropdown(!showSalaryRangeDropdown)}>
            <Text style={{ color: form.salaryRange ? '#222' : '#aaa' }}>
              {form.salaryRange === 'below_5000' ? '5,000 below' :
               form.salaryRange === '5001_10000' ? '5,001 to 10,000' :
               form.salaryRange === '10001_20000' ? '10,001 to 20,000' :
               form.salaryRange === '20001_30000' ? '20,001 to 30,000' :
               form.salaryRange === 'above_30000' ? '30,000 above' :
               'Select salary range'}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#222" style={{ marginLeft: 170 }} />
          </TouchableOpacity>
          {showSalaryRangeDropdown && (
            <View style={styles.dropdownList}>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('salaryRange', 'below_5000'); setShowSalaryRangeDropdown(false); }}>
                <Text style={{ color: '#222' }}>5,000 below</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('salaryRange', '5001_10000'); setShowSalaryRangeDropdown(false); }}>
                <Text style={{ color: '#222' }}>5,001 to 10,000</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('salaryRange', '10001_20000'); setShowSalaryRangeDropdown(false); }}>
                <Text style={{ color: '#222' }}>10,001 to 20,000</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('salaryRange', '20001_30000'); setShowSalaryRangeDropdown(false); }}>
                <Text style={{ color: '#222' }}>20,001 to 30,000</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { handleChange('salaryRange', 'above_30000'); setShowSalaryRangeDropdown(false); }}>
                <Text style={{ color: '#222' }}>30,000 above</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        <Text style={styles.label}>29. CURRENT Employment Supporting Document </Text>
        <Text style={styles.labelDesc}>Please upload the soft copy of your Company ID (Back to back) 
        and either your employment Contract or Certificate of Employment using the provided link below.</Text>
        <Text style={styles.labelDesc}>If you are Self-employed. Please provide barangay permit or DTI registration or mayor's permit </Text>
        <Text style={styles.labelDesc}>Here is the link:
        https://bit.ly/FirstEmploymentData</Text>
        <Text style={styles.labelDesc1}>Note: You will be required to sign in to Google when uploading your files.</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => handleFilePick('Employment Supporting Document(Current)')}>
        <Text style={styles.uploadButtonText}>Choose File</Text>
        </TouchableOpacity>
        {form.file && <Text style={styles.fileText}>{form.file.name}</Text>}

        <Text style={styles.label}>
          30. Have you received any awards or recognition during your employment?
        </Text>
        <RadioGroup
          radioButtons={awardOptions}
          selectedId={awardOptions.find((btn) => btn.selected)?.id}
          onPress={(selectedId: any) => {
            const updatedButtons = awardOptions.map((btn) => ({
              ...btn,
              selected: btn.id === selectedId,
            }));
            setAwardOptions(updatedButtons);

            const selected = updatedButtons.find((btn) => btn.id === selectedId);
            if (selected) {
              setHasAwards(selected.value);
              
              // When "Yes" is selected, automatically create the first file upload slot for Question 31
              if (selected.value === 'Yes') {
                // Find Question 31 (Supporting Documents for awards/recognition)
                const awardDocsQuestion = categories
                  ?.flatMap(cat => cat.questions || [])
                  .find((q: any) => {
                    const qt = (q.text || '').toLowerCase();
                    return (qt.includes('supporting document') || qt.includes('supporting documents')) && 
                           (qt.includes('awards') || qt.includes('award') || qt.includes('recognition'));
                  });
                
                if (awardDocsQuestion) {
                  const questionId = String(awardDocsQuestion.id);
                  const currentFiles = multipleFileAnswers[questionId] || [];
                  // Auto-create first slot if none exists
                  if (currentFiles.length === 0) {
                    setMultipleFileAnswers((prev) => ({ ...prev, [questionId]: [null as any] }));
                  }
                }
              } else if (selected.value === 'No') {
                // Clear award documents when "No" is selected
                const awardDocsQuestion = categories
                  ?.flatMap(cat => cat.questions || [])
                  .find((q: any) => {
                    const qt = (q.text || '').toLowerCase();
                    return (qt.includes('supporting document') || qt.includes('supporting documents')) && 
                           (qt.includes('awards') || qt.includes('award') || qt.includes('recognition'));
                  });
                
                if (awardDocsQuestion) {
                  const questionId = String(awardDocsQuestion.id);
                  setMultipleFileAnswers((prev) => {
                    const newState = { ...prev };
                    delete newState[questionId];
                    return newState;
                  });
                  // Clear file marker from responses
                  setResponse(questionId, '');
                }
              }
            }
          }}
          layout="row"
        />


        <Text style={styles.label}>
        31. Supporting document for awards/recognition</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => handleFilePick('Supporting Documents for awards/recognition')}>
        <Text style={styles.uploadButtonText}>Choose File</Text>
        </TouchableOpacity>
        {form.file && <Text style={styles.fileText}>{form.file.name}</Text>}

        <Text style={styles.label}>
          32. Did you pursue further study?
        </Text>
        <RadioGroup
          radioButtons={furtherStudyOptions}
          selectedId={furtherStudyOptions.find((btn) => btn.selected)?.id}
          onPress={(selectedId: any) => {
            const updatedButtons = furtherStudyOptions.map((btn) => ({
              ...btn,
              selected: btn.id === selectedId,
            }));
            setFurtherStudyOptions(updatedButtons);

            const selected = updatedButtons.find((btn) => btn.id === selectedId);
            if (selected) setFurtherStudy(selected.value);
          }}
          layout="row"
        />

      </View>
      )}

      {/* IF UNEMPLOYED */}
      {form.presentlyEmployed === 'No' && (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>IF UNEMPLOYED</Text>
        <Text style={styles.label}>
        33. Reason for unemployment</Text>
        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, family: !prev.family }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.family && styles.checked]} />
            <Text style={styles.checkboxLabel}>Family concerns and the decision not to find a job</Text>
        </TouchableOpacity>
        </View>
        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, health: !prev.health }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.health && styles.checked]} />
            <Text style={styles.checkboxLabel}>Health-related reasons</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, experience: !prev.experience }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.experience && styles.checked]} />
            <Text style={styles.checkboxLabel}>Lack of work experience</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, noOpportunity: !prev.noOpportunity }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.noOpportunity && styles.checked]} />
            <Text style={styles.checkboxLabel}>No job opportunity</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, notLooking: !prev.notLooking }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.notLooking && styles.checked]} />
            <Text style={styles.checkboxLabel}>Did not look for a job</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, seeking: !prev.seeking }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.seeking && styles.checked]} />
            <Text style={styles.checkboxLabel}>Seeking employment</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, study: !prev.study }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.study && styles.checked]} />
            <Text style={styles.checkboxLabel}>For further study</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.checkboxItem}>
        <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
            setUnemploymentReasons((prev) => ({ ...prev, other: !prev.other }))
            }
        >
            <View style={[styles.checkboxBox, unemploymentReasons.other && styles.checked]} />
            <Text style={styles.checkboxLabel}>Other</Text>
        </TouchableOpacity>
        </View>

        {unemploymentReasons.other && (
        <TextInput
            style={styles.input}
            placeholder="Other"
            value={unemploymentReasons.otherText}
            onChangeText={(text) =>
            setUnemploymentReasons((prev) => ({ ...prev, otherText: text }))
            }
        />
        )}
      </View>
      )}

      {/* PART IV - Further Study */}
      {furtherStudy === 'Yes' && (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PART IV - Further Study</Text>
        <Text style={styles.sectionDescription}>N/A if not applicable</Text> 

        <Text style={styles.label}>34. Date Started</Text>
        <TextInput
          style={styles.input}
          placeholder="00/00/0000"
          value={form.fsDateStart}
          onChangeText={(v) => handleChange('fsDateStart', v)}
        />  

        <Text style={styles.label}>35. Please specify post graduate/degree</Text>
        <TextInput
          style={styles.input}
          placeholder="Graduate Program"
          value={form.postGrad}
          onChangeText={(v) => handleChange('postGrad', v)}
        />

        <Text style={styles.label}>36. Name of Institution/University</Text>
        <TextInput
          style={styles.input}
          placeholder="University"
          value={form.postGradUniv}
          onChangeText={(v) => handleChange('postGradUniv', v)}
        />

        <Text style={styles.label}>37. Total number of units obtain</Text>
        <TextInput
          style={styles.input}
          placeholder="Units"
          value={form.totalUnits}
          onChangeText={(v) => handleChange('totalUnits', v)}
        />
    </View>
    )}

      <TouchableOpacity 
        style={[styles.button, submitting && styles.buttonDisabled]} 
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#005c99" />
            <Text style={styles.buttonText}>Submitting...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Submit</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
      )}

      {/* Privacy Notice Modal (matching web) */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // Don't allow closing without accepting
          if (!privacyAccepted) {
            Alert.alert('Privacy Notice', 'Please read and accept the Privacy Notice to continue.');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Notice</Text>
              <Text style={styles.modalSubtitle}>Republic Act No. 10173 - Data Privacy Act of 2012</Text>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView} 
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.modalBody}>
                <Text style={styles.modalText}>
                  We are committed to protecting your personal data in accordance with the Data Privacy Act of 2012. 
                  The information you provide in this Tracer Form will be used solely for academic and institutional purposes.
                </Text>
                <Text style={styles.modalText}>
                  Your personal data will be:
                </Text>
                <View style={styles.modalBulletList}>
                  <Text style={styles.modalBullet}>• Collected and processed lawfully and fairly</Text>
                  <Text style={styles.modalBullet}>• Used only for the stated purposes</Text>
                  <Text style={styles.modalBullet}>• Kept accurate and up-to-date</Text>
                  <Text style={styles.modalBullet}>• Stored securely and confidentially</Text>
                  <Text style={styles.modalBullet}>• Not shared with unauthorized parties</Text>
                </View>
                <Text style={styles.modalText}>
                  By proceeding with the Tracer Form, you acknowledge that you have read and understood this privacy notice.
                </Text>
                
                <TouchableOpacity
                  style={[styles.modalCheckbox, privacyAccepted && styles.modalCheckboxChecked]}
                  onPress={() => setPrivacyAccepted(!privacyAccepted)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkboxBox, privacyAccepted && styles.checked]} />
                  <Text style={styles.modalCheckboxText}>
                    I have read and understood the Privacy Notice and I voluntarily consent to the collection and use of my personal data for Tracer Form.
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowPrivacyModal(false);
                  setPrivacyAccepted(false);
                  navigation.goBack();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonAccept, 
                  !privacyAccepted && styles.modalButtonDisabled
                ]}
                onPress={() => {
                  if (privacyAccepted) {
                    setShowPrivacyModal(false);
                  } else {
                    Alert.alert('Privacy Notice', 'Please accept the Privacy Notice to continue.');
                  }
                }}
                disabled={!privacyAccepted}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modalButtonAcceptText,
                  !privacyAccepted && styles.modalButtonAcceptTextDisabled
                ]}>
                  Accept & Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Job Alignment Confirmation Modal */}
      <Modal
        visible={showJobAlignmentModal.visible && showJobAlignmentModal.needsConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowJobAlignmentModal({ questionId: '', position: '', visible: false, needsConfirmation: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.jobAlignmentModalContent}>
            {/* Header */}
            <View style={styles.jobAlignmentHeader}>
              <Text style={styles.jobAlignmentTitle}>🤔 Job Alignment Question</Text>
            </View>
            
            {/* Content */}
            <View style={styles.jobAlignmentBody}>
              <Text style={styles.jobAlignmentQuestion}>
                {showJobAlignmentModal.suggestion?.question || `Is '${showJobAlignmentModal.position}' aligned to your program?`}
              </Text>
              
              {/* Radio Options */}
              <View style={styles.jobAlignmentOptions}>
                <TouchableOpacity
                  style={[
                    styles.jobAlignmentOption,
                    jobAlignmentAnswer === 'yes' && styles.jobAlignmentOptionSelected
                  ]}
                  onPress={() => setJobAlignmentAnswer('yes')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, jobAlignmentAnswer === 'yes' && styles.radioCircleSelected]}>
                    {jobAlignmentAnswer === 'yes' && <View style={styles.radioCircleInner} />}
                  </View>
                  <Text style={[styles.jobAlignmentOptionText, jobAlignmentAnswer === 'yes' && styles.jobAlignmentOptionTextSelected]}>
                    ✅ Yes, this job is aligned to my program
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.jobAlignmentOption,
                    jobAlignmentAnswer === 'no' && styles.jobAlignmentOptionSelected
                  ]}
                  onPress={() => setJobAlignmentAnswer('no')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, jobAlignmentAnswer === 'no' && styles.radioCircleSelected]}>
                    {jobAlignmentAnswer === 'no' && <View style={styles.radioCircleInner} />}
                  </View>
                  <Text style={[styles.jobAlignmentOptionText, jobAlignmentAnswer === 'no' && styles.jobAlignmentOptionTextSelected]}>
                    ❌ No, this job is not aligned to my program
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Footer */}
            <View style={styles.jobAlignmentFooter}>
              <TouchableOpacity
                style={[
                  styles.jobAlignmentConfirmButton,
                  (!jobAlignmentAnswer || checkingAlignment) && styles.jobAlignmentConfirmButtonDisabled
                ]}
                onPress={async () => {
                  if (!jobAlignmentAnswer || checkingAlignment) return;
                  
                  try {
                    setCheckingAlignment(true);
                    const user = await getUserInfo();
                    if (!user?.id && !user?.user_id) {
                      Alert.alert('Error', 'User ID not found');
                      return;
                    }
                    
                    const userId = user.id || user.user_id;
                    const employmentId = showJobAlignmentModal.suggestion?.employment_id || 0;
                    
                    const result = await confirmJobAlignment(employmentId, userId, jobAlignmentAnswer === 'yes');
                    
                    if (result.success) {
                      // Update alignment status
                      setJobAlignmentStatus({
                        questionId: showJobAlignmentModal.questionId,
                        status: result.job_alignment_status || (jobAlignmentAnswer === 'yes' ? 'aligned' : 'not_aligned')
                      });
                      
                      // Close modal
                      setShowJobAlignmentModal({ questionId: '', position: '', visible: false, needsConfirmation: false });
                      setJobAlignmentAnswer(null);
                    } else {
                      Alert.alert('Error', 'Failed to confirm job alignment');
                    }
                  } catch (error) {
                    console.error('Error confirming job alignment:', error);
                    Alert.alert('Error', 'Failed to confirm job alignment');
                  } finally {
                    setCheckingAlignment(false);
                  }
                }}
                disabled={!jobAlignmentAnswer || checkingAlignment}
                activeOpacity={0.7}
              >
                {checkingAlignment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.jobAlignmentConfirmButtonText}>Confirm Answer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker({ questionId: '', visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModalContent}>
            {/* Header */}
            <View style={styles.datePickerHeader}>
              <View style={styles.datePickerIconContainer}>
                <FontAwesome name="calendar" size={24} color="#174f84" />
              </View>
              <Text style={styles.datePickerTitle}>Select Date</Text>
              <TouchableOpacity
                style={styles.datePickerCloseButton}
                onPress={() => setShowDatePicker({ questionId: '', visible: false })}
              >
                <FontAwesome name="times" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <View style={styles.datePickerBody}>
              {/* Date Inputs in Grid */}
              <View style={styles.dateInputGrid}>
                {/* Year Input */}
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>Year</Text>
                  <TextInput
                    style={styles.dateInputField}
                    value={dateInputs.year}
                    onChangeText={(year) => setDateInputs(prev => ({ ...prev, year }))}
                    keyboardType="numeric"
                    placeholder="YYYY"
                    placeholderTextColor="#999"
                    maxLength={4}
                    selectTextOnFocus={true}
                  />
                  <Text style={styles.dateInputHint}>1900 - 2100</Text>
                </View>
                
                {/* Month Input */}
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>Month</Text>
                  <TextInput
                    style={styles.dateInputField}
                    value={dateInputs.month}
                    onChangeText={(month) => setDateInputs(prev => ({ ...prev, month }))}
                    keyboardType="numeric"
                    placeholder="MM"
                    placeholderTextColor="#999"
                    maxLength={2}
                    selectTextOnFocus={true}
                  />
                  <Text style={styles.dateInputHint}>1 - 12</Text>
                </View>
                
                {/* Day Input */}
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>Day</Text>
                  <TextInput
                    style={styles.dateInputField}
                    value={dateInputs.day}
                    onChangeText={(day) => setDateInputs(prev => ({ ...prev, day }))}
                    keyboardType="numeric"
                    placeholder="DD"
                    placeholderTextColor="#999"
                    maxLength={2}
                    selectTextOnFocus={true}
                  />
                  <Text style={styles.dateInputHint}>1 - 31</Text>
                </View>
              </View>
              
              {/* Preview Section */}
              {(() => {
                const year = parseInt(dateInputs.year);
                const month = parseInt(dateInputs.month);
                const day = parseInt(dateInputs.day);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day) && year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  const previewDate = new Date(year, month - 1, day);
                  const maxDays = new Date(year, month, 0).getDate();
                  if (day <= maxDays && !isNaN(previewDate.getTime())) {
                    return (
                      <View style={styles.datePreviewContainer}>
                        <Text style={styles.datePreviewLabel}>Selected Date</Text>
                        <View style={styles.datePreviewBox}>
                          <FontAwesome name="check-circle" size={16} color="#28a745" style={{ marginRight: 8 }} />
                          <Text style={styles.datePreviewText}>
                            {year}-{String(month).padStart(2, '0')}-{String(day).padStart(2, '0')}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                }
                return null;
              })()}
            </View>
            
            {/* Footer Actions */}
            <View style={styles.datePickerFooter}>
              <TouchableOpacity
                style={styles.datePickerButtonCancel}
                onPress={() => setShowDatePicker({ questionId: '', visible: false })}
                activeOpacity={0.7}
              >
                <Text style={styles.datePickerButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.datePickerButtonConfirm}
                onPress={() => {
                  // Validate inputs on confirm
                  const year = parseInt(dateInputs.year);
                  const month = parseInt(dateInputs.month);
                  const day = parseInt(dateInputs.day);
                  
                  if (isNaN(year) || isNaN(month) || isNaN(day)) {
                    Alert.alert('Invalid Date', 'Please enter year, month, and day');
                    return;
                  }
                  
                  if (year < 1900 || year > 2100) {
                    Alert.alert('Invalid Year', 'Year must be between 1900 and 2100');
                    return;
                  }
                  
                  if (month < 1 || month > 12) {
                    Alert.alert('Invalid Month', 'Month must be between 1 and 12');
                    return;
                  }
                  
                  const maxDays = new Date(year, month, 0).getDate();
                  if (day < 1 || day > maxDays) {
                    Alert.alert('Invalid Day', `Day must be between 1 and ${maxDays} for ${year}-${String(month).padStart(2, '0')}`);
                    return;
                  }
                  
                  const finalDate = new Date(year, month - 1, day);
                  if (isNaN(finalDate.getTime())) {
                    Alert.alert('Invalid Date', 'Please enter a valid date');
                    return;
                  }
                  
                  // Format as YYYY-MM-DD
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  setResponse(showDatePicker.questionId, dateStr);
                  setShowDatePicker({ questionId: '', visible: false });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.datePickerButtonConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <TermsAndConditionsModal
        isVisible={showTermsModal}
        onClose={handleTermsClose}
        onAccept={handleTermsAccept}
      />
      
      {/* Auto-save status indicator (matching web) */}
      {saveStatus && (
        <View style={styles.saveStatusIndicator}>
          <Text style={styles.saveStatusText}>
            {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1C4E80',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#003366',
  },
  introText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'justify',
    color: '#003366',
    
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#005c99',
  },
  sectionDescription: {
    fontSize: 13,
    marginTop: 5,
    marginBottom: 5,
    color: '#005c99',
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '600',
    color: '#005c99',
  },
  labelDesc: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 13,
    color: '#005c99',
  },
  labelDesc1: {
    marginTop: 25,
    marginBottom: 4,
    fontSize: 10,
    color: '#005c99',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 10,
    borderColor: '#ccc',
    borderWidth: 1,
  },
  card: {
    backgroundColor: '#A5D8DD',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 30,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#005c99',
    fontWeight: 'bold',
  },
  fileText: {
    marginTop: 8,
    color: '#333',
  },
  checkboxItem: {
  marginVertical: 4,
},

checkbox: {
  flexDirection: 'row',
  alignItems: 'center',
},

checkboxBox: {
  width: 20,
  height: 20,
  borderWidth: 2,
  borderColor: '#005c99',
  marginRight: 8,
  borderRadius: 4,
},

checked: {
  backgroundColor: '#005c99',
},

checkboxLabel: {
  fontSize: 14,
  color: '#005c99',
},
uploadButton: {
  backgroundColor: '#ffff',
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 8,
  alignItems: 'center',
  marginTop: 10,
},

uploadButtonText: {
  color: '#005c99',
  fontWeight: 'bold',
  fontSize: 16,
},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 40,
    paddingBottom: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
    borderRadius: 20,
  },
  topBarTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#174f84',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
    marginRight: 30, // to balance the back arrow
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C4E80',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: '#ff6b6b',
    marginTop: 10,
    fontSize: 14,
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
    marginBottom: 10,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginTop: 2,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 1000,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    color: '#222',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    flexDirection: 'column',
  },
  modalHeader: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#174f84',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 350,
  },
  modalScrollContent: {
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  modalBody: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 200,
  },
  modalText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
    lineHeight: 22,
  },
  modalBulletList: {
    marginBottom: 15,
    paddingLeft: 10,
  },
  modalBullet: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 22,
  },
  modalCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  modalCheckboxChecked: {
    borderColor: '#174f84',
  },
  modalCheckboxText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 10,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#6c757d',
  },
  modalButtonAccept: {
    backgroundColor: '#174f84',
  },
  modalButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  modalButtonCancelText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonAcceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonAcceptTextDisabled: {
    color: '#999',
  },
  // Date Picker Modal Styles
  datePickerModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxWidth: 420,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    position: 'relative',
  },
  datePickerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#174f84',
    flex: 1,
  },
  datePickerCloseButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  datePickerBody: {
    padding: 24,
  },
  dateInputGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  dateInputGroup: {
    flex: 1,
    alignItems: 'center',
  },
  dateInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateInputField: {
    width: '100%',
    height: 56,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#174f84',
    textAlign: 'center',
  },
  dateInputHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
  },
  datePreviewContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  datePreviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  datePreviewText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
    letterSpacing: 1,
  },
  datePickerFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  datePickerButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#dee2e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  datePickerButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#174f84',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#174f84',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  datePickerButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  // Job Alignment Modal Styles
  jobAlignmentModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  jobAlignmentHeader: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  jobAlignmentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#174f84',
    textAlign: 'center',
  },
  jobAlignmentBody: {
    padding: 24,
  },
  jobAlignmentQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  jobAlignmentOptions: {
    gap: 12,
  },
  jobAlignmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: '#ffffff',
  },
  jobAlignmentOptionSelected: {
    borderColor: '#174f84',
    backgroundColor: '#e3f2fd',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#174f84',
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#174f84',
  },
  jobAlignmentOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  jobAlignmentOptionTextSelected: {
    color: '#174f84',
    fontWeight: '600',
  },
  jobAlignmentFooter: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  jobAlignmentConfirmButton: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#174f84',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#174f84',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  jobAlignmentConfirmButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  jobAlignmentConfirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  // Job Suggestions Styles
  jobSuggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  jobSuggestionsList: {
    maxHeight: 200,
  },
  jobSuggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  jobSuggestionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#174f84',
    marginBottom: 4,
  },
  jobSuggestionProgram: {
    fontSize: 13,
    color: '#666',
  },
  jobSuggestionCode: {
    fontSize: 12,
    color: '#999',
  },
  saveStatusIndicator: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveStatusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },

});
