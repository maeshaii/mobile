import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface TrackerReminderModalProps {
  isVisible: boolean;
  onClose: () => void;
  onTakeSurvey: () => void;
  onRemindLater: () => void;
}

// No Dimensions usage needed in this component

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
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <FontAwesome name="times" size={20} color="#6b7280" />
          </TouchableOpacity>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>📋</Text>
            </View>
            
            <Text style={styles.title}>Complete Your Graduate Tracer Survey</Text>
            
            <Text style={styles.description}>
              Help us track your career success and improve our programs for future students. Your input shapes the future of education.
            </Text>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>💼</Text>
                <Text style={styles.benefitText}>Share your career journey and current employment status</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>🏅</Text>
                <Text style={styles.benefitText}>Highlight your achievements and professional milestones</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>⏰</Text>
                <Text style={styles.benefitText}>Quick 5-minute survey - your time makes a difference</Text>
              </View>

              {/* Award banner */}
              <View style={styles.awardBanner}>
                <Text style={styles.benefitIcon}>🎁</Text>
                <Text style={styles.awardText}>
                  Maybe you're one of the lucky ones who will receive an award for completing the survey!
                </Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.remindLaterButton]}
              onPress={onRemindLater}
            >
              <Text style={styles.remindLaterText}>Maybe Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.takeSurveyButton]}
              onPress={onTakeSurvey}
            >
              <Text style={styles.takeSurveyText}>Start Survey</Text>
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
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 4,
    zIndex: 10,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
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
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  awardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 12,
  },
  awardText: {
    flex: 1,
    color: '#92400e',
    fontSize: 14,
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
