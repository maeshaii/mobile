import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import NavBar from '../(tabs)/_navbar';
import { useRouter } from 'expo-router';

const samplePic = require('../../assets/images/sample_pic.jpg');

const messagesData = [
  {
    name: 'Paquibot, Alvin',
    message: 'Hey! Are you coming to the event tomorrow?',
    date: '2/20/25',
    avatarImage: samplePic,
  },
  {
    name: 'Ma-asin, Shaira Mae',
    message: 'Don’t forget to send the report.',
    date: '2/20/25',
    avatarImage: samplePic,
  },
];

const MessageScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <NavBar />
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      <FlatList
        data={messagesData}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.messageCard} onPress={() => router.push('/messages/chatmessage')}>
            <Image source={item.avatarImage} style={styles.avatar} />
            <View style={styles.messageBox}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.message}>{item.message}</Text>
            </View>
            <Text style={styles.date}>{item.date}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 0,
    paddingLeft: 5,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 22,
    color: '#222',
    paddingLeft: 5,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 15,
    backgroundColor: '#eee',
  },
  messageBox: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  message: {
    fontSize: 13,
    color: '#333',
  },
  date: {
    fontSize: 13,
    color: '#888',
    marginLeft: 10,
    alignSelf: 'flex-start',
  },
});

export default MessageScreen;
