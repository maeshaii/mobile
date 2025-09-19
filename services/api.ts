// services/api.ts
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/** Base URL handling */
function normalizeBaseUrl(raw?: string): string {
  return (raw ?? '').trim().replace(/\/+$/, '');
}

const rawFromExpo = (Constants.expoConfig?.extra as any)?.API_BASE_URL as string | undefined;
const rawFromEnv = process.env.API_BASE_URL as string | undefined;

// Prefer explicit config (Expo extra or env). Fallback to LAN server for local dev.
// Using LAN avoids DNS issues when ngrok is blocked or unreachable from the device.
export const API_BASE_URL = normalizeBaseUrl(
  rawFromExpo || rawFromEnv || 'http://192.168.1.106:8000'
);

console.log('Mobile API base URL:', JSON.stringify(API_BASE_URL));

/** Axios instance */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true'  // Required for ngrok free accounts
  },
});

/** Auth helpers */
export const getAccessToken = async () => SecureStore.getItemAsync('accessToken');
export const getRefreshToken = async () => SecureStore.getItemAsync('refreshToken');
export const getUserInfo = async () => {
  const user = await SecureStore.getItemAsync('user');
  return user ? JSON.parse(user) : null;
};
export const logoutUser = async () => {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('user');
};

// Clear all stored tokens - useful for debugging login issues
export const clearAllTokens = async () => {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('user');
  await SecureStore.deleteItemAsync('lastLogin');
};

/** Attach bearer - but NOT for login/token endpoints */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Don't add Authorization header for login/token endpoints
    const isLoginEndpoint = config.url?.includes('/api/token/') && config.method === 'post';
    const isRefreshEndpoint = config.url?.includes('/api/token/refresh/');
    
    if (!isLoginEndpoint && !isRefreshEndpoint) {
      const token = await getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete (config.headers as any).Authorization;
      }
    } else {
      // Explicitly remove Authorization header for login/refresh endpoints
      delete (config.headers as any).Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/** 401 refresh (single-flight) */
let isRefreshing = false;
let refreshWaitQueue: Array<(t: string | null) => void> = [];

async function runQueuedRequests(token: string | null) {
  refreshWaitQueue.forEach((resume) => resume(token));
  refreshWaitQueue = [];
}
async function refreshAccessToken(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  const { data } = await api.post('/api/token/refresh/', { refresh });
  const newAccess = data?.access as string | undefined;
  if (!newAccess) return null;
  await SecureStore.setItemAsync('accessToken', newAccess);
  return newAccess;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!error.response || !original) return Promise.reject(error);

    if (error.response.status === 401 && !original._retry) {
      original._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshAccessToken();
          await runQueuedRequests(newToken ?? null);
          if (!newToken) {
            await logoutUser();
            return Promise.reject(error);
          }
          original.headers = original.headers ?? {};
          (original.headers as any).Authorization = `Bearer ${newToken}`;
          return api(original);
        } catch (e) {
          await runQueuedRequests(null);
          await logoutUser();
          return Promise.reject(e);
        } finally {
          isRefreshing = false;
        }
      }

      return new Promise((resolve, reject) => {
        refreshWaitQueue.push((newToken) => {
          if (!newToken) return reject(error);
          original.headers = original.headers ?? {};
          (original.headers as any).Authorization = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    return Promise.reject(error);
  }
);

/** Auth API - UNIFIED WITH WEB FRONTEND */
export const loginUser = async (acc_username: string, acc_password: string) => {
  console.log('Mobile: Sending login request:', { acc_username, acc_password });
  try {
    const response = await api.post('/api/token/', { acc_username, acc_password });
    console.log('Mobile: Login response received:', response.data);
    
    // Save tokens and user info to SecureStore (mobile equivalent of localStorage)
    if (response.data.access && response.data.refresh) {
      await SecureStore.setItemAsync('accessToken', response.data.access);
      await SecureStore.setItemAsync('refreshToken', response.data.refresh);
      if (response.data.user) {
        await SecureStore.setItemAsync('user', JSON.stringify(response.data.user));
      }
    }
    
    return { success: true, ...response.data };
  } catch (error: any) {
    console.error('Mobile: Login error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    
    // Provide more specific error messages (SAME AS WEB)
    if (error.response?.status === 400) {
      return { success: false, message: 'Invalid credentials or request format' };
    } else if (error.response?.status === 500) {
      return { success: false, message: 'Server error - please try again later' };
    } else if (error.code === 'ERR_NETWORK') {
      return { success: false, message: 'Network error - check your connection' };
    } else if (error.response?.status === 0) {
      return { success: false, message: 'CORS error - backend may not be running' };
    }
    
    return { success: false, message: 'Login failed - please try again' };
  }
};

export const changePassword = async (old_password: string, new_password: string) => {
  try {
    const { data } = await api.post('/api/change-password/', { old_password, new_password });
    return data;
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || 'Password change failed' };
  }
};

/** Notifications */
export const getNotifications = async (userId: number) => {
  const { data } = await api.get(`/api/notifications/?user_id=${userId}`);
  return data;
};
export const deleteNotifications = async (ids: number[]) => {
  const { data } = await api.post('/api/notifications/delete/', { notification_ids: ids });
  return data;
};

/** Follow */
export const fetchFollowers = async (userId: number) => {
  const { data } = await api.get(`/api/alumni/${userId}/followers/`);
  return data;
};
export const followUser = async (userId: number) => {
  const { data } = await api.post(`/api/follow/${userId}/`, {});
  return data;
};
export const unfollowUser = async (userId: number) => {
  const { data } = await api.delete(`/api/follow/${userId}/`);
  return data;
};
export const checkFollowStatus = async (userId: number) => {
  const { data } = await api.get(`/api/follow/${userId}/status/`);
  return data;
};

/** Tracker */
export const getActiveTrackerForm = async () => (await api.get('/api/tracker/active-form/')).data;
export const getTrackerQuestions = async () => (await api.get('/api/tracker/questions/')).data;
export const submitTrackerResponse = async (payload: FormData | any) => {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const { data } = await api.post('/api/tracker/responses/', payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return data;
};
export const checkUserTrackerStatus = async () =>
  (await api.get('/api/tracker/check-status/')).data;

/** Alumni */
export const getAlumniStatistics = async () => (await api.get('/api/alumni/statistics/')).data;
export const getAlumniList = async () => (await api.get('/api/alumni-list/')).data;
export const getAlumniDetails = async (userId: number) =>
  (await api.get(`/api/alumni/${userId}/`)).data;

/** Reminder */
export const sendReminder = async () => (await api.post('/api/send-reminder/')).data;

/** Posts */
export const getPosts = async () => {
  try {
    const response = await api.get('/api/posts/');
    console.log('Mobile getPosts API Response:', response.data);
    console.log('Posts array:', response.data?.posts);
    console.log('Posts count:', response.data?.posts?.length);
    return response.data?.posts || [];
  } catch (error) {
    console.error('Mobile getPosts API Error:', error);
    throw error;
  }
};
export const getPostsByUserType = async (userType: 'peso' | 'admin') =>
  (await api.get(`/api/posts/by-user-type/?user_type=${userType}`)).data.posts || [];
export const createPost = async (postData: {
  post_title: string; post_content: string; post_image?: string; post_cat_id: number; type?: string;
}) => {
  try {
    console.log('Mobile createPost sending:', postData);
    const response = await api.post('/api/posts/', postData);
    console.log('Mobile createPost response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Mobile createPost error:', error);
    throw error;
  }
};
export const likePost = async (postId: number) =>
  (await api.post(`/api/posts/${postId}/like/`)).data;
export const unlikePost = async (postId: number) =>
  (await api.delete(`/api/posts/${postId}/like/`)).data;
export const commentOnPost = async (postId: number, comment: string) =>
  (await api.post(`/api/posts/${postId}/comments/`, { comment_content: comment })).data;
export const getPostComments = async (postId: number) =>
  (await api.get(`/api/posts/${postId}/comments/`)).data;
export const getPostDetail = async (postId: number) => (await api.get(`/api/posts/${postId}/`)).data;
export const updateComment = async (postId: number, commentId: number, content: string) =>
  (await api.put(`/api/posts/${postId}/comments/${commentId}/`, { comment_content: content })).data;
export const deleteComment = async (postId: number, commentId: number) =>
  (await api.delete(`/api/posts/${postId}/comments/${commentId}/`)).data;
export const deletePost = async (postId: number) =>
  (await api.delete(`/api/posts/${postId}/`)).data;
export const editPost = async (
  postId: number,
  postData: { post_title?: string; post_content?: string }
) => (await api.put(`/api/posts/${postId}/`, postData)).data;

/** Categories */
export const getPostCategories = async () => (await api.get('/api/post-categories/')).data;

/** Reposts */
export const repostPost = async (postId: number) =>
  (await api.post(`/api/posts/${postId}/repost/`)).data;
export const deleteRepost = async (repostId: number) =>
  (await api.delete(`/api/reposts/${repostId}/`)).data;

/** Forgot Password */
export const forgotPassword = async (credentials: {
  ctu_id: string;
  email: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
}) => {
  try {
    const { data } = await api.post('/api/forgot-password/', credentials);
    return { success: true, ...data };
  } catch (error: any) {
    console.error('Mobile: Forgot password error:', error);
    if (error.response?.data?.message) {
      return { success: false, message: error.response.data.message };
    }
    return { success: false, message: 'Network error. Please try again.' };
  }
};

/** Profile */
export const updateProfile = async (bio: string, profile_pic: string) =>
  (await api.put('/api/profile/update/', { bio, profile_pic })).data;

export const updateAlumniProfile = async (params: { bio?: string; imageUri?: string }) => {
    const meRaw = await SecureStore.getItemAsync('user');
    const me = meRaw ? JSON.parse(meRaw) : null;
    const userId = me?.id || me?.user_id;
    if (!userId) throw new Error('Missing user id');

    const form = new FormData();
  if (typeof params.bio === 'string') form.append('bio', params.bio);
    if (params.imageUri) {
    form.append('profile_pic', { uri: params.imageUri, name: 'profile.jpg', type: 'image/jpeg' } as any);
  }

  const { data } = await api.put(`/api/alumni/profile/update/?user_id=${userId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

  const updated = data?.user || {};
    if (me) {
    const merged = {
      ...me,
      profile_bio: updated.bio ?? me.profile_bio,
      profile_pic: updated.profile_pic ?? me.profile_pic,
      name: updated.name ?? me.name,
    };
      await SecureStore.setItemAsync('user', JSON.stringify(merged));
    }
    return updated;
};

export default api;

/** Messaging API */
export type ConversationSummary = {
  conversation_id: number;
  updated_at: string;
  unread_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: number;
    message_type: 'text' | 'image' | 'file' | 'system';
  } | null;
  other_participant?: {
    user_id: number;
    name: string;
    avatar_url?: string | null;
  } | null;
};

export type MessageItem = {
  message_id: number;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  sender: { user_id: number; name: string; avatar_url?: string | null };
  is_read: boolean;
  created_at: string;
};

export const listConversations = async (): Promise<ConversationSummary[]> => {
  const { data } = await api.get('/api/messaging/conversations/');
  return data as ConversationSummary[];
};

export const createConversation = async (participant_id: number): Promise<ConversationSummary> => {
  const { data } = await api.post('/api/messaging/conversations/', { participant_id });
  return data as ConversationSummary;
};

export const listMessages = async (
  conversationId: number,
  params?: { cursor?: string; limit?: number }
): Promise<{ results: MessageItem[]; next_cursor?: string | null }> => {
  const qs: string[] = [];
  if (params?.cursor) qs.push(`cursor=${encodeURIComponent(params.cursor)}`);
  if (params?.limit) qs.push(`limit=${params.limit}`);
  const url = `/api/messaging/conversations/${conversationId}/messages/${qs.length ? `?${qs.join('&')}` : ''}`;
  const { data } = await api.get(url);
  return data as { results: MessageItem[]; next_cursor?: string | null };
};

export const sendMessage = async (
  conversationId: number,
  payload: { content?: string; message_type?: 'text' | 'image' | 'file' | 'system'; attachment_id?: number }
): Promise<MessageItem> => {
  const body: any = {
    message: payload.content ?? '',
    message_type: payload.message_type ?? 'text',
    attachment_id: payload.attachment_id,
  };
  const { data } = await api.post(`/api/messaging/conversations/${conversationId}/messages/`, body);
  return data as MessageItem;
};

export const markConversationRead = async (conversationId: number) => {
  const { data } = await api.post(`/api/messaging/conversations/${conversationId}/read/`, {});
  return data as { status: string; messages_marked_read: number; timestamp: string };
};

export const deleteMessageApi = async (conversationId: number, messageId: number) => {
  const { data } = await api.delete(`/api/messaging/conversations/${conversationId}/messages/${messageId}/`);
  return data as { status: string };
};

export const searchUsersForMessaging = async (q: string) => {
  const { data } = await api.get(`/api/messaging/users/search/?q=${encodeURIComponent(q)}`);
  return data as { users: Array<{ user_id: number; f_name: string; l_name: string }>; count: number; query: string };
};

/** WebSocket helpers */
export const getWebSocketBase = (): string => {
  // Translate HTTP base to WS base
  const http = API_BASE_URL;
  if (http.startsWith('https://')) return `wss://${http.slice('https://'.length)}`;
  if (http.startsWith('http://')) return `ws://${http.slice('http://'.length)}`;
  return `ws://${http}`;
};

export const getConversationWsUrl = async (conversationId: number): Promise<string> => {
  const token = await getAccessToken();
  const base = getWebSocketBase();
  const url = `${base}/ws/chat/${conversationId}/`;
  // Prefer header on native WS, but most RN environments send querystring token reliably
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

/** Attachments */
export const uploadAttachment = async (file: any): Promise<{
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  uploaded_at: string;
}> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const { data } = await api.post('/api/messaging/attachments/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};