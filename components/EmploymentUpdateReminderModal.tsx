import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface EmploymentUpdateReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdateNow: () => void;
  onMaybeLater: () => void;
  onNoChanges: () => void;
}

const EmploymentUpdateReminderModal: React.FC<EmploymentUpdateReminderModalProps> = ({
  visible,
  onClose,
  onUpdateNow,
  onMaybeLater,
  onNoChanges
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <FontAwesome name="times" size={20} color="#666" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <FontAwesome name="briefcase" size={32} color="#fff" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Update Your Employment Details</Text>

          {/* Description */}
          <Text style={styles.description}>
            Keep your profile accurate and up to date by reviewing your current employment information. Updated details help us track your progress and improve our services.
          </Text>

          {/* Benefits List */}
          <ScrollView style={styles.benefitsContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.benefitItem}>
              <FontAwesome name="refresh" size={24} color="#3b82f6" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>
                Make sure your career information reflects your current status
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <FontAwesome name="line-chart" size={24} color="#3b82f6" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>
                Accurate details help improve our alumni and OJT programs
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <FontAwesome name="clock-o" size={24} color="#3b82f6" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>
                Quick update—just takes a minute
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.updateNowButton}
              onPress={onUpdateNow}
            >
              <Text style={styles.updateNowButtonText}>Update Now</Text>
            </TouchableOpacity>

            <View style={styles.secondaryButtonsContainer}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onMaybeLater}
              >
                <Text style={styles.secondaryButtonText}>Maybe Later</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onNoChanges}
              >
                <Text style={styles.secondaryButtonText}>No Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  benefitIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  updateNowButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateNowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EmploymentUpdateReminderModal;

