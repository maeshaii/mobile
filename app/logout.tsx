import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { forceLogout } from '../services/api';
import { useRouter } from 'expo-router';
import { useAlert } from '../contexts/AlertContext';

export default function LogoutScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    setShowLogoutModal(true);
    showAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      variant: 'confirm',
      buttons: [
        { 
          text: 'Cancel', 
          style: 'cancel', 
          onPress: () => {
            setShowLogoutModal(false);
            router.back();
          }
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setShowLogoutModal(false);
            await forceLogout();
            router.replace('/login/login');
          },
        },
      ]
    });
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1e3a8a" />
      <Text style={styles.text}>Logging out...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#1e3a8a',
  },
}); 