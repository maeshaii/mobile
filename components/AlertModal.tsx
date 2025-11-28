import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { AlertButton } from '../contexts/AlertContext';

interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  type?: 'default' | 'error' | 'success' | 'info' | 'warning';
  variant?: 'default' | 'confirm' | 'success';
  onClose: () => void;
  onButtonPress: (button: AlertButton) => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  buttons,
  type = 'default',
  variant = 'default',
  onClose,
  onButtonPress,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return { name: 'exclamation-circle' as const, color: '#ef4444' };
      case 'success':
        return { name: 'check-circle' as const, color: '#10b981' };
      case 'warning':
        return { name: 'exclamation-triangle' as const, color: '#f59e0b' };
      case 'info':
        return { name: 'info-circle' as const, color: '#3b82f6' };
      default:
        return { name: 'info-circle' as const, color: '#6b7280' };
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case 'error':
        return '#fee2e2';
      case 'success':
        return '#d1fae5';
      case 'warning':
        return '#fef3c7';
      case 'info':
        return '#dbeafe';
      default:
        return '#f3f4f6';
    }
  };

  const icon = getIcon();
  const headerColor = getHeaderColor();

  // Handle cancel button (should close modal without action if no onPress)
  const handleButtonPress = (button: AlertButton) => {
    if (button.style === 'cancel' && !button.onPress) {
      onClose();
    } else {
      onButtonPress(button);
    }
  };

  // Special simplified success layout (matches image design)
  // Works for both success and processing/info types
  if (variant === 'success' && (type === 'success' || type === 'info' || type === 'default')) {
    // Don't show OK button for processing alerts
    const isProcessing = title === 'Processing';
    const displayButtons = isProcessing ? [] : buttons;
    
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={isProcessing ? undefined : onClose}
          disabled={isProcessing}
        >
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.successContainer}>
              <Text style={styles.successTitle}>{title}</Text>
              {message && (
                <Text style={styles.successMessage}>{message}</Text>
              )}
              {displayButtons.length > 0 && (
                <View style={styles.successButtonContainer}>
                  {displayButtons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.successButton}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.successButtonText}>{button.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    );
  }

  // Special simplified confirm layout (matches screenshot-style UI)
  if (variant === 'confirm') {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.confirmOverlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.confirmContainer}>
              <Text style={styles.confirmTitle}>{title}</Text>
              {message && (
                <Text style={styles.confirmMessage}>{message}</Text>
              )}

              <View style={styles.confirmButtonsRow}>
                {buttons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.confirmButton,
                        isCancel && styles.confirmCancelButton,
                        isDestructive && styles.confirmContinueButton,
                      ]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.confirmButtonText,
                          isCancel && styles.confirmCancelText,
                          isDestructive && styles.confirmContinueText,
                        ]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: headerColor }]}>
              <View style={styles.headerContent}>
                <FontAwesome name={icon.name} size={24} color={icon.color} />
                <Text style={styles.title}>{title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <FontAwesome name="times" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Message */}
            {message && (
              <View style={styles.body}>
                <Text style={styles.message}>{message}</Text>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                const isLast = index === buttons.length - 1;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                      !isLast && styles.buttonMargin,
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonCancelText,
                        isDestructive && styles.buttonDestructiveText,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Confirm-style (simple) modal styles
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  confirmContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C4E80',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 12,
  },
  confirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  confirmCancelButton: {
    backgroundColor: '#e5e7eb',
  },
  confirmContinueButton: {
    backgroundColor: '#1C4E80',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmCancelText: {
    color: '#111827',
  },
  confirmContinueText: {
    color: '#ffffff',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  body: {
    padding: 20,
  },
  message: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#1e3a5f',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonCancel: {
    backgroundColor: '#f3f4f6',
  },
  buttonDestructive: {
    backgroundColor: '#ef4444',
  },
  buttonMargin: {
    marginRight: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonCancelText: {
    color: '#374151',
  },
  buttonDestructiveText: {
    color: '#fff',
  },
  // Success variant styles (matches image design)
  successContainer: {
    backgroundColor: '#ffffff', // White background
    borderRadius: 12,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    paddingVertical: 24,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C4E80', // Bold blue text
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: '#4b5563', // Gray text
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
  },
  successButtonContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  successButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1C4E80', // Dark blue button
    minWidth: 80,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#ffffff', // White text
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AlertModal;

