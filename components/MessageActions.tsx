/**
 * Message Actions Component
 * Provides reply, edit, delete, and reaction actions for messages
 * Similar to web's context menu but optimized for mobile
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActionSheetIOS,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

export interface MessageAction {
  id: 'reply' | 'react' | 'edit' | 'delete' | 'copy' | 'forward';
  label: string;
  icon: string;
  destructive?: boolean;
  disabled?: boolean;
}

interface MessageActionsProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
  isOwnMessage: boolean;
  messageContent: string;
  onReply?: () => void;
  onReact?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onForward?: () => void;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  visible,
  onClose,
  messageId,
  isOwnMessage,
  messageContent,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
  onForward,
}) => {
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const actions: MessageAction[] = [
    { id: 'reply', label: 'Reply', icon: 'reply', disabled: !onReply },
    { id: 'react', label: 'React', icon: 'smile-o', disabled: !onReact },
    ...(isOwnMessage ? [
      { id: 'edit' as const, label: 'Edit', icon: 'edit', disabled: !onEdit },
      { id: 'delete' as const, label: 'Delete', icon: 'trash', destructive: true, disabled: !onDelete },
    ] : []),
    { id: 'copy', label: 'Copy', icon: 'copy', disabled: !onCopy },
    { id: 'forward', label: 'Forward', icon: 'share', disabled: !onForward },
  ];

  const handleAction = (actionId: MessageAction['id']) => {
    onClose();
    
    switch (actionId) {
      case 'reply':
        onReply?.();
        break;
      case 'react':
        onReact?.();
        break;
      case 'edit':
        onEdit?.();
        break;
      case 'delete':
        // Show confirmation for delete
        Alert.alert(
          'Delete Message',
          'Are you sure you want to delete this message?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => onDelete?.(),
            },
          ]
        );
        break;
      case 'copy':
        onCopy?.();
        break;
      case 'forward':
        onForward?.();
        break;
    }
  };

  // iOS uses native ActionSheet
  if (Platform.OS === 'ios') {
    if (visible) {
      const options = actions
        .filter(a => !a.disabled)
        .map(a => a.label)
        .concat(['Cancel']);
      
      const destructiveButtonIndex = actions.findIndex(a => a.destructive && !a.disabled);
      const cancelButtonIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex < actions.length) {
            const action = actions.filter(a => !a.disabled)[buttonIndex];
            handleAction(action.id);
          }
        }
      );
      
      // Close immediately on iOS as ActionSheet handles its own visibility
      onClose();
    }
    return null;
  }

  // Android/Web uses custom modal
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Message Actions</Text>
              <TouchableOpacity onPress={onClose}>
                <FontAwesome name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.actionsList}>
              {actions.filter(a => !a.disabled).map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionButton,
                    action.destructive && styles.actionButtonDestructive,
                  ]}
                  onPress={() => handleAction(action.id)}
                >
                  <FontAwesome
                    name={action.icon as any}
                    size={20}
                    color={action.destructive ? '#d32f2f' : '#1C4E80'}
                    style={styles.actionIcon}
                  />
                  <Text
                    style={[
                      styles.actionLabel,
                      action.destructive && styles.actionLabelDestructive,
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  actionsList: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  actionButtonDestructive: {
    backgroundColor: '#ffebee',
  },
  actionIcon: {
    marginRight: 16,
    width: 24,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  actionLabelDestructive: {
    color: '#d32f2f',
  },
});

export default MessageActions;

