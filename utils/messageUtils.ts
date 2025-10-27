/**
 * Message deduplication utilities for mobile app
 */

export interface UiMsg {
  id: string;
  text: string;
  sent: boolean;
  tempId?: string;
  sender_id?: number;
  sender_name?: string;
  created_at?: string;
  attachment_url?: string | null;
  message_type?: string;
  attachment_info?: {
    file_name?: string;
    file_type?: string;
    file_category?: string;
    file_size?: number;
  };
}

/**
 * Optimized message deduplication for mobile performance
 * Uses efficient Map-based approach with minimal memory allocation
 */
export function deduplicateMessages(messages: UiMsg[]): UiMsg[] {
  if (messages.length === 0) return [];
  if (messages.length === 1) return messages;

  const messageMap = new Map<string, UiMsg>();
  const seenKeys = new Set<string>();

  // Pre-allocate arrays for better performance
  const tempMessages: UiMsg[] = [];
  const realMessages: UiMsg[] = [];

  // Separate temp and real messages for efficient processing
  for (const message of messages) {
    if (message.tempId) {
      tempMessages.push(message);
    } else {
      realMessages.push(message);
    }
  }

  // Process real messages first (higher priority)
  for (const message of realMessages) {
    const dedupeKey = `${message.id}_${message.text}_${message.created_at}_${message.sender_id}`;
    
    if (!seenKeys.has(dedupeKey)) {
      messageMap.set(message.id, message);
      seenKeys.add(dedupeKey);
    }
  }

  // Process temp messages (lower priority)
  for (const message of tempMessages) {
    const dedupeKey = `${message.id}_${message.text}_${message.created_at}_${message.sender_id}`;
    
    // Only add if we don't have a real message with the same ID
    if (!messageMap.has(message.id) && !seenKeys.has(dedupeKey)) {
      messageMap.set(message.id, message);
      seenKeys.add(dedupeKey);
    }
  }

  // Convert to array and sort efficiently
  const result = Array.from(messageMap.values());
  
  // Use insertion sort for small arrays, quicksort for larger ones
  if (result.length < 50) {
    return result.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });
  } else {
    // For larger arrays, use more efficient sorting
    return result.sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }
}

/**
 * Add a new message to the existing list with deduplication
 */
export function addMessageWithDeduplication(
  existingMessages: UiMsg[], 
  newMessage: UiMsg
): UiMsg[] {
  // Early return for empty existing messages
  if (existingMessages.length === 0) {
    return [newMessage];
  }

  // Check for exact duplicate first (most common case)
  const isExactDuplicate = existingMessages.some(msg => 
    msg.id === newMessage.id || 
    (msg.text === newMessage.text && 
     msg.created_at === newMessage.created_at && 
     msg.sender_id === newMessage.sender_id)
  );

  if (isExactDuplicate) {
    return existingMessages;
  }

  // For small arrays, use simple concatenation
  if (existingMessages.length < 20) {
    return deduplicateMessages([...existingMessages, newMessage]);
  }

  // For larger arrays, use more efficient approach
  const messageMap = new Map<string, UiMsg>();
  
  // Add existing messages to map
  for (const msg of existingMessages) {
    messageMap.set(msg.id, msg);
  }
  
  // Add new message if not duplicate
  if (!messageMap.has(newMessage.id)) {
    messageMap.set(newMessage.id, newMessage);
  }
  
  return Array.from(messageMap.values()).sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });
}

/**
 * Replace a temporary message with a saved message
 */
export function replaceTempMessage(
  messages: UiMsg[], 
  tempId: string, 
  savedMessage: UiMsg
): UiMsg[] {
  // Use findIndex for better performance than map
  const tempIndex = messages.findIndex(msg => msg.tempId === tempId);
  
  if (tempIndex === -1) {
    // Temp message not found, just add the real message
    return addMessageWithDeduplication(messages, savedMessage);
  }
  
  // Create new array with replacement
  const newMessages = [...messages];
  newMessages[tempIndex] = savedMessage;
  
  return newMessages;
}

/**
 * Remove a temporary message (e.g., on send failure)
 */
export function removeTempMessage(
  messages: UiMsg[], 
  tempId: string
): UiMsg[] {
  return messages.filter(message => message.tempId !== tempId);
}

/**
 * Check if a message is a duplicate based on content and timing
 */
export function isDuplicateMessage(
  existingMessages: UiMsg[], 
  newMessage: UiMsg,
  timeWindowMs: number = 5000
): boolean {
  // Early return for empty arrays
  if (existingMessages.length === 0) {
    return false;
  }

  const now = new Date().getTime();
  const newMessageTime = newMessage.created_at ? new Date(newMessage.created_at).getTime() : now;
  
  // Check ID first (most common duplicate case)
  for (const existing of existingMessages) {
    if (existing.id === newMessage.id) {
      return true;
    }
  }
  
  // Check content-based duplicates with time window
  for (const existing of existingMessages) {
    const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : now;
    const timeDiff = Math.abs(newMessageTime - existingTime);
    
    if (existing.text === newMessage.text &&
        existing.sender_id === newMessage.sender_id &&
        timeDiff < timeWindowMs) {
      return true;
    }
  }
  
  return false;
}

