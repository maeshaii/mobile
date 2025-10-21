import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import RadioGroup from 'react-native-radio-buttons-group';
import type { RadioButtonProps } from 'react-native-radio-buttons-group';
// @ts-ignore
import type {} from 'expo-document-picker';
import type {} from 'react-native-radio-buttons-group';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { getTrackerQuestions, getUserInfo, submitTrackerResponse, getAlumniDetails, getActiveTrackerForm, checkUserTrackerStatus } from '../../services/api';
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
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);

  // Existing static form (fallback)
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

  // Keep original questions array for compatibility
  const [questions, setQuestions] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Dropdown states (fallback UI)
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showEmploymentStatusDropdown, setShowEmploymentStatusDropdown] = useState(false);
  const [showCurrentStatusDropdown, setShowCurrentStatusDropdown] = useState(false);
  const [showYearsEmployedDropdown, setShowYearsEmployedDropdown] = useState(false);
  const [showSalaryRangeDropdown, setShowSalaryRangeDropdown] = useState(false);

  const navigation = useNavigation();
  
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
        try {
          const active = await getActiveTrackerForm();
          // Some backends return { tracker_form_id }
          const status = await checkUserTrackerStatus(); // expect { accepting_responses, has_submitted }
          setAccepting(Boolean(status?.accepting_responses ?? status?.accepting));
          setHasSubmitted(Boolean(status?.has_submitted));

          if (status?.has_submitted) {
            Alert.alert('Tracker', 'You have already completed the tracker form. Thank you!');
            navigation.goBack();
            return;
          }
          if (status && (status.accepting_responses === false || status.accepting === false)) {
            Alert.alert('Tracker', 'The tracker form is currently closed. Please check back later.');
            navigation.goBack();
            return;
          }
        } catch (e) {
          // Non-fatal: continue to allow form load, but log
          console.warn('Tracker gating check failed:', e);
        }

        // 2) Fetch dynamic questions
        const qs = await getTrackerQuestions();
        const cats = qs?.categories ?? qs ?? [];
        setQuestions(qs);
        if (Array.isArray(cats)) setCategories(cats);

        // 3) Prefill like web does
        try {
          if (user?.id) {
            const details = await getAlumniDetails(user.id);
            const alumni = details?.alumni || {};
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
          }
        } catch {}

        setError(null);
        
        // Show terms and conditions modal on first load
        setShowTermsModal(true);
      } catch (err) {
        console.error('Failed to initialize tracker form:', err);
        setError('Failed to load tracker form');
      } finally {
        setLoading(false);
      }
    };
    // @ts-ignore
    init();
  }, [navigation]);

  const handleChange = (key: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Dynamic responses change
  const setResponse = (questionId: string | number, value: any) => {
    setResponses((prev) => ({ ...prev, [String(questionId)]: value }));
  };

  const pickFileForQuestion = async (questionId: string | number) => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const f = result.assets[0];
      const asset: FileAsset = {
        name: f.name,
        uri: f.uri,
        mimeType: f.mimeType,
        size: f.size,
      };
      setFileAnswers((prev) => ({ ...prev, [String(questionId)]: asset }));
      setResponse(String(questionId), { type: 'file' });
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
    // Trigger actual form submission after accepting terms
    submitForm();
  };

  // Actual form submission logic (extracted from handleSubmit)
  const submitForm = async () => {
    try {
      setSubmitting(true);
      const user = await getUserInfo();

      const fd = new FormData();
      if (user?.id) fd.append('user_id', String(user.id));

      if (Array.isArray(categories) && categories.length > 0) {
        // Dynamic submission
        fd.append('answers', JSON.stringify(responses));
        // Attach files per question
        Object.entries(fileAnswers).forEach(([qid, file]) => {
          if (file && file.uri && file.name) {
            fd.append(`file_${qid}`, {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'application/octet-stream',
            } as any);
          }
        });
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

  const handleFilePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const file = result.assets[0];
      handleChange('file', {
        name: file.name,
        uri: file.uri,
        mimeType: file.mimeType,
        size: file.size,
      });
    }
    
  };

  // Dynamic renderer
  const renderQuestion = (q: any) => {
    const qid = String(q.id ?? q.question_id ?? q.key ?? q.text);
    const qtype = (q.type || '').toLowerCase();
    const value = responses[qid];

    if (qtype === 'file' || /upload|file/i.test(q.text || '')) {
      const file = fileAnswers[qid];
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>{q.text}</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={() => pickFileForQuestion(qid)}>
            <Text style={styles.uploadButtonText}>Choose File</Text>
          </TouchableOpacity>
          {file && <Text style={styles.fileText}>{file.name}</Text>}
        </View>
      );
    }

    if (qtype === 'radio' || qtype === 'select' || Array.isArray(q.options)) {
      const opts: string[] = (q.options || []).map((o: any) => (typeof o === 'string' ? o : (o?.label ?? o?.value)));
      return (
        <View key={qid} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>{q.text}</Text>
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

    // default to text input
    return (
      <View key={qid} style={{ marginBottom: 12 }}>
        <Text style={styles.label}>{q.text}</Text>
        <TextInput
          style={styles.input}
          value={value ?? ''}
          onChangeText={(v) => setResponse(qid, v)}
          placeholder={q.placeholder || ''}
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
        <Text style={styles.topBarTitle}>GRADUATE TRACER SURVEY – CTU MAIN</Text>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading form...</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      ) : Array.isArray(categories) && categories.length > 0 ? (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.sectionDescription}>* Required</Text>
          </View>
          {categories.map((cat, idx) => (
            <View key={cat.id ?? idx} style={styles.card}>
              {cat.name && <Text style={styles.sectionTitle}>{cat.name}</Text>}
              {Array.isArray(cat.questions) && cat.questions.map((q: any) => renderQuestion(q))}
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
        <Text style={styles.labelDesc}>If you are Self-employed. Please provide barangay permit or DTI registration or mayor’s permit </Text>
        <Text style={styles.labelDesc}>Here is the link:
        https://bit.ly/FirstEmploymentData</Text>
        <Text style={styles.labelDesc1}>Note: You will be required to sign in to Google when uploading your files.</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={handleFilePick}>
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
        <Text style={styles.labelDesc}>If you are Self-employed. Please provide barangay permit or DTI registration or mayor’s permit </Text>
        <Text style={styles.labelDesc}>Here is the link:
        https://bit.ly/FirstEmploymentData</Text>
        <Text style={styles.labelDesc1}>Note: You will be required to sign in to Google when uploading your files.</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={handleFilePick}>
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
            if (selected) setHasAwards(selected.value);
          }}
          layout="row"
        />


        <Text style={styles.label}>
        31. Supporting document for awards/recognition</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={handleFilePick}>
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

      {/* Terms and Conditions Modal */}
      <TermsAndConditionsModal
        isVisible={showTermsModal}
        onClose={handleTermsClose}
        onAccept={handleTermsAccept}
      />
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

});
