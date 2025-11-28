import React, { createContext, useContext, useState, useCallback } from 'react';
import AlertModal from '../components/AlertModal';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'default' | 'error' | 'success' | 'info' | 'warning';
  variant?: 'default' | 'confirm' | 'success';
}

// Convenience options for the common "confirm" style alert
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'error' | 'success' | 'info' | 'warning';
  // Callback when user presses the confirm button
  onConfirm?: () => void;
  // Whether confirm button should use destructive styling (default true)
  destructive?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((options: AlertOptions) => {
    // If buttons is undefined (not provided), add a default OK button
    // If buttons is explicitly an empty array, don't add default button (for processing alerts)
    if (options.buttons === undefined) {
      options.buttons = [{ text: 'OK', style: 'default' }];
    }
    setAlert(options);
    setVisible(true);
  }, []);

  // Unified confirm-style alert, matching the shared UI you've been using
  const showConfirm = useCallback(
    (options: ConfirmOptions) => {
      const {
        title,
        message,
        confirmText = 'OK',
        cancelText = 'Cancel',
        type = 'warning',
        destructive = true,
        onConfirm,
      } = options;

      showAlert({
        title,
        message,
        type,
        variant: 'confirm',
        buttons: [
          { text: cancelText, style: 'cancel' },
          {
            text: confirmText,
            style: destructive ? 'destructive' : 'default',
            onPress: onConfirm,
          },
        ],
      });
    },
    [showAlert]
  );

  const handleClose = useCallback(() => {
    setVisible(false);
    // Small delay to allow animation to complete
    setTimeout(() => {
      setAlert(null);
    }, 300);
  }, []);

  const handleButtonPress = useCallback((button: AlertButton) => {
    handleClose();
    // Small delay to ensure modal closes before executing callback
    setTimeout(() => {
      if (button.onPress) {
        button.onPress();
      }
    }, 100);
  }, [handleClose]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {alert && (
        <AlertModal
          visible={visible}
          title={alert.title}
          message={alert.message}
          buttons={alert.buttons || []}
          type={alert.type || 'default'}
          variant={alert.variant || 'default'}
          onClose={handleClose}
          onButtonPress={handleButtonPress}
        />
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

// Helper function to match Alert.alert API
export const alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  // This will be set by the provider
  // For now, we'll use a global reference
  if (globalAlertRef) {
    globalAlertRef.showAlert({ title, message, buttons });
  }
};

let globalAlertRef: AlertContextType | null = null;

export const setGlobalAlertRef = (ref: AlertContextType) => {
  globalAlertRef = ref;
};

