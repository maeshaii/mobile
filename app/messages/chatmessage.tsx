import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';

const samplePic = require('../../assets/images/sample_pic.jpg');

const initialMessages = [
  { id: '1', text: 'Lorem ipsum dolor sit amet. Quo asperiores enim ut veniamrepudiandae eum quisquam voluptatem', sent: false },
  { id: '2', text: 'Lorem ipsum dolor sit amet. Quo asperiores enim ut veniamrepudiandae eum quisquam voluptatem', sent: true },
];

const ChatMessageScreen = () => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const { name } = useLocalSearchParams();

  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { id: Date.now().toString(), text: input, sent: true }]);
      setInput('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#1C4E80" />
        </TouchableOpacity>
        <Image source={samplePic} style={styles.avatar} />
        <Text style={styles.name}>{typeof name === 'string' ? name : 'Chat'}</Text>
      </View>
      <View style={styles.separator} />

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.sent ? styles.bubbleSent : styles.bubbleReceived
          ]}>
            <Text style={[
              styles.bubbleText,
              item.sent ? styles.bubbleTextSent : styles.bubbleTextReceived
            ]}>
              {item.text}
            </Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
        style={styles.inputBarContainer}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Write a message.."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <FontAwesome name="send" size={22} color="#1C4E80" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    overflow: 'hidden' 
},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    marginLeft: 10, 
    marginRight: 10
 },
  name: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    color: '#222' 
},
  separator: { 
    height: 2, 
    backgroundColor: '#F0F0F0', 
    width: '100%', 
    marginBottom: 8 
},
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
  },
  bubbleReceived: {
    backgroundColor: '#F5F5F5',
    alignSelf: 'flex-start',
  },
  bubbleSent: {
    backgroundColor: '#1C4E80',
    alignSelf: 'flex-end',
  },
  bubbleText: { 
    fontSize: 15 
},
  bubbleTextReceived: { 
    color: '#222' 
},
  bubbleTextSent: { 
    color: '#fff' 
},
  inputBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F8F8F8',
    borderTopWidth: 2,
    borderTopColor: '#F0F0F0',
    paddingBottom: 8,
    paddingTop: 8,
    height: 100,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: '#5B86A6',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 50,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  sendButton: {
    marginLeft: 8,
    padding: 6,
  },
});

export default ChatMessageScreen;
