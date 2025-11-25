import React, { useState } from 'react';
import {View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface TermsAndConditionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const { width } = Dimensions.get('window');

const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({
  isVisible,
  onClose,
  onAccept,
}) => {
  const [hasReadTerms, setHasReadTerms] = useState(false);

  if (!isVisible) return null;

  const handleAccept = () => {
    if (hasReadTerms) {
      onAccept();
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>📋 Terms and Conditions</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome name="times" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={true}>
            <Text style={styles.sectionTitle}>Data Collection and Usage</Text>
            <Text style={styles.termsText}>
              By participating in this graduate tracer survey, you consent to the collection, 
              processing, and storage of your personal and professional information. This data 
              will be used for:
            </Text>
            <Text style={styles.bulletPoint}>• Academic research and institutional assessment</Text>
            <Text style={styles.bulletPoint}>• Alumni tracking and career development programs</Text>
            <Text style={styles.bulletPoint}>• Statistical analysis and reporting (anonymized)</Text>
            <Text style={styles.bulletPoint}>• Improving educational programs and services</Text>

            <Text style={styles.sectionTitle}>Data Protection</Text>
            <Text style={styles.termsText}>
              Your personal information will be protected in accordance with applicable data 
              protection laws. We implement appropriate security measures to safeguard your data 
              against unauthorized access, alteration, disclosure, or destruction.
            </Text>

            <Text style={styles.sectionTitle}>Information Sharing</Text>
            <Text style={styles.termsText}>
              Your responses may be shared in aggregated, anonymized form for research purposes. 
              Personal identifiers will not be disclosed without your explicit consent, except as 
              required by law.
            </Text>

            <Text style={styles.sectionTitle}>Your Rights</Text>
            <Text style={styles.termsText}>
              You have the right to:
            </Text>
            <Text style={styles.bulletPoint}>• Access your personal data</Text>
            <Text style={styles.bulletPoint}>• Request correction of inaccurate information</Text>
            <Text style={styles.bulletPoint}>• Withdraw consent at any time</Text>
            <Text style={styles.bulletPoint}>• Request data deletion (subject to legal requirements)</Text>

            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Text style={styles.termsText}>
              For questions about this survey or your data rights, please contact our 
              Data Protection Officer at privacy@institution.edu or call (555) 123-4567.
            </Text>

            <Text style={styles.sectionTitle}>Agreement</Text>
            <Text style={styles.termsText}>
              By proceeding with this survey, you acknowledge that you have read, understood, 
              and agree to these terms and conditions. Your participation is voluntary and 
              you may withdraw at any time.
            </Text>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity 
                style={styles.checkbox} 
                onPress={() => setHasReadTerms(!hasReadTerms)}
              >
                <View style={[styles.checkboxBox, hasReadTerms && styles.checkboxChecked]}>
                  {hasReadTerms && <FontAwesome name="check" size={12} color="white" />}
                </View>
                <Text style={styles.checkboxText}>
                  I have read and agree to the terms and conditions
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>I don't accept</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.acceptButton,
                  !hasReadTerms && styles.buttonDisabled
                ]} 
                onPress={handleAccept}
                disabled={!hasReadTerms}
              >
                <Text style={[
                  styles.acceptButtonText,
                  !hasReadTerms && styles.buttonTextDisabled
                ]}>
                  Proceed to form
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    borderRadius: 4,
  },
  body: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  termsText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginLeft: 16,
    marginBottom: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  checkboxText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  acceptButton: {
    backgroundColor: '#1e3a8a',
  },
  buttonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonTextDisabled: {
    color: '#9ca3af',
  },
});

export default TermsAndConditionsModal;