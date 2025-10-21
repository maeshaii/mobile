import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface TrackerReminderModalProps {
  isVisible: boolean;
  onClose: () => void;
  onTakeSurvey: () => void;
  onRemindLater: () => void;
}

const { width } = Dimensions.get('window');

const TrackerReminderModal: React.FC<TrackerReminderModalProps> = ({
  isVisible,
  onClose,
  onTakeSurvey,
  onRemindLater,
}) => {
  if (!isVisible) return null;

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
            <Text style={styles.headerTitle}>📋 Graduate Tracer Survey</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome name="times" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🎓</Text>
            </View>
            
            <Text style={styles.title}>Complete Your Graduate Tracer Survey</Text>
            
            <Text style={styles.description}>
              Help us improve our programs by sharing your post-graduation journey. 
              Your responses will help future students and enhance our curriculum.
            </Text>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>📊</Text>
                <Text style={styles.benefitText}>Contribute to program improvement</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>🎯</Text>
                <Text style={styles.benefitText}>Help future students make informed decisions</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>⏱️</Text>
                <Text style={styles.benefitText}>Takes only 5-10 minutes to complete</Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.remindLaterButton]}
              onPress={onRemindLater}
            >
              <Text style={styles.remindLaterText}>Remind Me Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.takeSurveyButton]}
              onPress={onTakeSurvey}
            >
              <Text style={styles.takeSurveyText}>Take Survey</Text>
            </TouchableOpacity>
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
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  benefitsContainer: {
    width: '100%',
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    gap: 12,
  },
  benefitIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  remindLaterButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  takeSurveyButton: {
    backgroundColor: '#1e3a8a',
  },
  remindLaterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  takeSurveyText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default TrackerReminderModal;
