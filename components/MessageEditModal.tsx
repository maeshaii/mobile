/**
 * Message Edit Modal Component
 * Allows users to edit their sent messages
 * Similar to web's inline edit functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface MessageEditModalProps {
  visible: boolean;
  messageId: string;
  initialContent: string;
  onClose: () => void;
  onSave: (messageId: string, newContent: string) => Promise<void>;
}

export const MessageEditModal: React.FC<MessageEditModalProps> = ({
  visible,
  messageId,
  initialContent,
  onClose,
  onSave,
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [slideAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      setContent(initialContent);
      setError(null);
      
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Focus input after animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, initialContent]);

  const handleSave = async () => {
    const trimmedContent = content.trim();
    
    // Validation
    if (!trimmedContent) {
      setError('Message cannot be empty');
      return;
    }

    if (trimmedContent === initialContent.trim()) {
      setError('No changes made');
      return;
    }

    if (trimmedContent.length > 5000) {
      setError('Message is too long (max 5000 characters)');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(messageId, trimmedContent);
      Keyboard.dismiss();
      onClose();
    } catch (err) {
      console.error('Failed to save edited message:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(initialContent);
    setError(null);
    Keyboard.dismiss();
    onClose();
  };

  const isChanged = content.trim() !== initialContent.trim();
  const canSave = content.trim().length > 0 && isChanged && !isSaving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: slideAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <FontAwesome name="edit" size={20} color="#1C4E80" />
                <Text style={styles.title}>Edit Message</Text>
              </View>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <FontAwesome name="times" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={content}
                onChangeText={setContent}
                multiline
                placeholder="Type your message..."
                placeholderTextColor="#999"
                autoFocus={false}
                maxLength={5000}
              />
              
              {/* Character count */}
              <Text style={styles.charCount}>
                {content.length} / 5000
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <FontAwesome name="exclamation-circle" size={16} color="#d32f2f" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  !canSave && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!canSave}
              >
                {isSaving ? (
                  <Text style={styles.saveButtonText}>Saving...</Text>
                ) : (
                  <>
                    <FontAwesome name="check" size={16} color="white" style={styles.buttonIcon} />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Tips */}
            <View style={styles.tips}>
              <Text style={styles.tipText}>
                💡 Tip: Edited messages will show an "edited" indicator
              </Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    padding: 16,
  },
  input: {
    fontSize: 16,
    color: '#1a1a1a',
    minHeight: 120,
    maxHeight: 300,
    textAlignVertical: 'top',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#d32f2f',
    marginLeft: 8,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#1C4E80',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonIcon: {
    marginRight: 6,
  },
  tips: {
    padding: 16,
    paddingTop: 0,
  },
  tipText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default MessageEditModal;

