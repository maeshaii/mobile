import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LandingScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/login/login');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/ctu.jpg')}
      style={styles.background}
      blurRadius={3}
    >
      <View style={styles.overlay} />
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.brandTitle}>
              WHERENAYOU : Connecting OJT's{'\n'}& Alumni Journeys
            </Text>
            <Text style={styles.brandSubtitle}>
              Excellence in Technology Education
            </Text>
          </View>

          <View style={styles.collaborationContainer}>
            <Text style={styles.collaborationTitle}>IN COLLABORATION WITH</Text>
            <View style={styles.partnersContainer}>
              <View style={styles.partnerItem}>
                <View style={styles.partnerLogo}>
                  <Image
                    source={require('../../assets/images/ccict.png')}
                    style={styles.partnerLogoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.partnerName}>
                  College of Computer, Information and Communications Technology
                </Text>
              </View>
              <View style={styles.partnerItem}>
                <View style={styles.partnerLogo}>
                  <Image
                    source={require('../../assets/images/ctu_logo.png')}
                    style={styles.partnerLogoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.partnerName}>
                  CTU - MC Alumni Association
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={16} color="#003366" style={styles.buttonIcon} />
          <Text style={styles.getStartedButtonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 51, 102, 0.8)',
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    zIndex: 1,
    flex: 1,
    justifyContent: 'center',
    marginTop: 100,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  brandSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    opacity: 0.9,
  },
  collaborationContainer: {
    alignItems: 'center',
    marginBottom: 60,
    marginTop: 40,
    width: '100%',
  },
  collaborationTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  partnersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  partnerItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  partnerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerLogoImage: {
    width: 28,
    height: 28,
  },
  partnerName: {
    fontSize: 9,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    lineHeight: 12,
  },
  getStartedButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    marginBottom: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  getStartedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003366',
  },
});

