// services/api.ts
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Base URL handling */
function normalizeBaseUrl(raw?: string): string {
  return (raw ?? '').trim().replace(/\/+$/, '');
}
function endpoint(path: string): string {
  return path.replace(/^\/+/, ''); // strip leading slashes
}

const rawFromExpo = (Constants.expoConfig?.extra as any)?.API_BASE_URL as string | undefined;
const rawFromEnv = process.env.API_BASE_URL as string | undefined;

// Prefer explicit config (Expo extra or env). Fallback to LAN server for local dev.
// Using LAN avoids DNS issues when ngrok is blocked or unreachable from the device.
export const API_BASE_URL = normalizeBaseUrl('https://a5ca217e8c56.ngrok-free.app');

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
// Mobile -> Backend: POST /api/token/ (CustomTokenObtainPairView)
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

// Mobile -> Backend: POST /api/change-password/
export const changePassword = async (old_password: string, new_password: string) => {
  try {
    const { data } = await api.post('/api/change-password/', { old_password, new_password });
    return data;
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || 'Password change failed' };
  }
};

/** Notifications */
// Mobile -> Backend: GET /api/notifications/?user_id={id}
export const getNotifications = async (userId: number) => {
  const { data } = await api.get(`/api/notifications/?user_id=${userId}`);
  return data;
};
// Mobile -> Backend: POST /api/notifications/delete/
export const deleteNotifications = async (ids: number[]) => {
  const { data } = await api.post('/api/notifications/delete/', { notification_ids: ids });
  return data;
};

/** Follow */
// Mobile -> Backend: GET /api/alumni/{user_id}/followers/
export const fetchFollowers = async (userId: number) => {
  const { data } = await api.get(`/api/alumni/${userId}/followers/`);
  return data.followers || [];
};

// Mobile -> Backend: GET /api/alumni/{user_id}/following/
export const fetchFollowing = async (userId: number) => {
  const { data } = await api.get(`/api/alumni/${userId}/following/`);
  return data.following || [];
};
// Mobile -> Backend: POST /api/follow/{user_id}/
export const followUser = async (userId: number) => {
  const { data } = await api.post(`/api/follow/${userId}/`, {});
  return data;
};
// Mobile -> Backend: DELETE /api/follow/{user_id}/
export const unfollowUser = async (userId: number) => {
  const { data } = await api.delete(`/api/follow/${userId}/`);
  return data;
};
// Mobile -> Backend: GET /api/follow/{user_id}/status/
export const checkFollowStatus = async (userId: number) => {
  const { data } = await api.get(`/api/follow/${userId}/status/`);
  return data;
};

/** Suggested Users */
// Mobile -> Backend: GET /api/users_list_view/?current_user_id={userId}
export const fetchSuggestedUsers = async () => {
  const user = await getUserInfo();
  const currentUserId = user?.user_id || user?.id;
  const { data } = await api.get(`/api/users_list_view/?current_user_id=${currentUserId}`);
  return data;
};

/** Tracker */
// Mobile -> Backend: GET /api/tracker/active-form/
export const getActiveTrackerForm = async () => (await api.get('/api/tracker/active-form/')).data;
// Mobile -> Backend: GET /api/tracker/questions/
export const getTrackerQuestions = async () => (await api.get('/api/tracker/questions/')).data;
// Mobile -> Backend: POST /api/tracker/responses/
export const submitTrackerResponse = async (payload: FormData | any) => {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const { data } = await api.post('/api/tracker/responses/', payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return data;
};
// Mobile -> Backend: GET /api/tracker/check-status/
export const checkUserTrackerStatus = async () =>
  (await api.get('/api/tracker/check-status/')).data;

/** Alumni */
// Mobile -> Backend: GET /api/alumni/statistics/
export const getAlumniStatistics = async () => (await api.get('/api/alumni/statistics/')).data;
// Mobile -> Backend: GET /api/alumni-list/ (alias of alumni/list/)
export const getAlumniList = async () => (await api.get('/api/alumni-list/')).data;
// Mobile -> Backend: GET /api/alumni/{user_id}/
export const getAlumniDetails = async (userId: number) =>
  (await api.get(`/api/alumni/${userId}/`)).data;

/** Reminder */
// Mobile -> Backend: POST /api/send-reminder/
export const sendReminder = async () => (await api.post('/api/send-reminder/')).data;

/** Posts */
// Mobile -> Backend: GET /api/posts/
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

// Get combined feed of posts and reposts
export const getFeed = async () => {
  try {
    const [postsResponse, repostsResponse] = await Promise.all([
      api.get('/api/posts/'),
      api.get('/api/reposts/') // This endpoint may need to be created
    ]);
    
    const posts = postsResponse.data?.posts || [];
    const reposts = repostsResponse.data?.reposts || [];
    
    // Combine and sort by date
    const feedItems = [
      ...posts.map((post: any) => ({ ...post, item_type: 'post' })),
      ...reposts.map((repost: any) => ({ ...repost, item_type: 'repost' }))
    ].sort((a, b) => new Date(b.created_at || b.repost_date).getTime() - new Date(a.created_at || a.repost_date).getTime());
    
    return feedItems;
  } catch (error) {
    console.error('Mobile getFeed API Error:', error);
    // Fallback to just posts if reposts endpoint doesn't exist
    return getPosts().then(posts => posts.map((post: any) => ({ ...post, item_type: 'post' })));
  }
};
// Mobile -> Backend: GET /api/posts/by-user-type/?user_type={peso|admin}
export const getPostsByUserType = async (userType: 'peso' | 'admin') =>
  (await api.get(`/api/posts/by-user-type/?user_type=${userType}`)).data.posts || [];
// Mobile -> Backend: POST /api/posts/
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
// Mobile -> Backend: POST /api/posts/{post_id}/like/
export const likePost = async (postId: number) =>
  (await api.post(`/api/posts/${postId}/like/`)).data;
// Mobile -> Backend: DELETE /api/posts/{post_id}/like/
export const unlikePost = async (postId: number) =>
  (await api.delete(`/api/posts/${postId}/like/`)).data;
// Mobile -> Backend: POST /api/posts/{post_id}/comments/
export const commentOnPost = async (postId: number, comment: string) =>
  (await api.post(`/api/posts/${postId}/comments/`, { comment_content: comment })).data;
// Mobile -> Backend: GET /api/posts/{post_id}/comments/
export const getPostComments = async (postId: number) =>
  (await api.get(`/api/posts/${postId}/comments/`)).data;
// Some screens expect a dedicated likes endpoint. Provide a flexible helper.
// Mobile -> Backend: GET /api/posts/{post_id}/likes/
export const getPostLikes = async (postId: number) => {
  const { data } = await api.get(`/api/posts/${postId}/likes/`);
  // Backend may respond with { likes: [...] } or an array payload
  return (data && (data.likes ?? data)) as any[];
};
// Mobile -> Backend: GET /api/posts/{post_id}/
export const getPostDetail = async (postId: number) => (await api.get(`/api/posts/${postId}/`)).data;
// Mobile -> Backend: PUT /api/posts/{post_id}/comments/{comment_id}/
export const updateComment = async (postId: number, commentId: number, content: string) =>
  (await api.put(`/api/posts/${postId}/comments/${commentId}/`, { comment_content: content })).data;
// Mobile -> Backend: DELETE /api/posts/{post_id}/comments/{comment_id}/
export const deleteComment = async (postId: number, commentId: number) =>
  (await api.delete(`/api/posts/${postId}/comments/${commentId}/`)).data;
// Mobile -> Backend: DELETE /api/posts/delete/{post_id}/
export const deletePost = async (postId: number) =>
  (await api.delete(`/api/posts/delete/${postId}/`)).data;
// Mobile -> Backend: PUT /api/posts/{post_id}/edit/
export const editPost = async (
  postId: number,
  postData: { post_title?: string; post_content?: string }
) => (await api.put(`/api/posts/${postId}/edit/`, postData)).data;

/** Categories */
// Mobile -> Backend: GET /api/post-categories/
export const getPostCategories = async () => (await api.get('/api/post-categories/')).data;

/** Reposts */
// Mobile -> Backend: POST /api/posts/{post_id}/repost/
export async function repostPost(postId: number, caption?: string | null) {
  const body: any = {};
  if (typeof caption === 'string' && caption.trim() !== '') {
    body.caption = caption.trim();
  }
  const { data } = await api.post(`/api/posts/${postId}/repost/`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

// Mobile -> Backend: PATCH /api/reposts/{repost_id}/
export async function updateRepost(repostId: number, caption?: string | null) {
  const { data } = await api.patch(
    `/api/reposts/${repostId}/`,
    { caption: caption?.trim() ?? '' },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return data;
}
export const deleteRepost = async (repostId: number) =>
  (await api.delete(`/api/reposts/delete/${repostId}/`)).data;

// Mobile -> Backend: POST /api/reposts/{repost_id}/like/
export const likeRepost = async (repostId: number) =>
  (await api.post(`/api/reposts/${repostId}/like/`)).data;

// Mobile -> Backend: DELETE /api/reposts/{repost_id}/like/
export const unlikeRepost = async (repostId: number) =>
  (await api.delete(`/api/reposts/${repostId}/like/`)).data;

// Mobile -> Backend: GET /api/reposts/{repost_id}/
export const getRepostDetail = async (repostId: number) => {
  const { data } = await api.get(`/api/reposts/${repostId}/`);
  return data;
};

// Mobile -> Backend: GET /api/reposts/{repost_id}/likes/
export const getRepostLikes = async (repostId: number) => {
  const { data } = await api.get(`/api/reposts/${repostId}/likes/`);
  return Array.isArray(data) ? data : data?.likes || [];
};

// Repost comments
export const getRepostComments = async (repostId: number) => {
  console.log('[API] getRepostComments called with repostId:', repostId);
  try {
    const response = await api.get(`/api/reposts/${repostId}/comments/`);
    console.log('[API] getRepostComments response:', response.data);
    return response.data?.comments || [];
  } catch (error) {
    console.error('[API] getRepostComments error:', error);
    throw error;
  }
};

export const commentOnRepost = async (repostId: number, comment: string) => {
  console.log('[API] commentOnRepost called with repostId:', repostId, 'comment:', comment);
  try {
    const response = await api.post(`/api/reposts/${repostId}/comments/`, { comment_content: comment });
    console.log('[API] commentOnRepost response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] commentOnRepost error:', error);
    throw error;
  }
};

export const updateRepostComment = async (
  repostId: number,
  commentId: number,
  content: string
) => (await api.put(`/api/reposts/${repostId}/comments/${commentId}/`, { comment_content: content })).data;

export const deleteRepostComment = async (repostId: number, commentId: number) =>
  (await api.delete(`/api/reposts/${repostId}/comments/${commentId}/`)).data;

/** Forum (separate storage) */
// Mobile -> Backend: GET /api/forum/
export const getForumPosts = async () => (await api.get('/api/forum/')).data.forums || [];
// Mobile -> Backend: POST /api/forum/
export const createForumPost = async (payload: { title?: string; content: string; image?: string }) =>
  (await api.post('/api/forum/', { post_title: payload.title, post_content: payload.content, post_image: payload.image })).data;
// Mobile -> Backend: GET /api/forum/{forum_id}/
export const getForumDetail = async (forumId: number) => (await api.get(`/api/forum/${forumId}/`)).data;
// Mobile -> Backend: PUT /api/forum/{forum_id}/
export const editForumPost = async (forumId: number, payload: { title?: string; content?: string; post_content?: string }) =>
  (await api.put(`/api/forum/${forumId}/`, { post_title: payload.title, post_content: payload.content || payload.post_content })).data;
// Mobile -> Backend: DELETE /api/forum/{forum_id}/
export const deleteForumPost = async (forumId: number) => (await api.delete(`/api/forum/${forumId}/`)).data;
// Mobile -> Backend: POST /api/forum/{forum_id}/like/
export const likeForumPost = async (forumId: number) => (await api.post(`/api/forum/${forumId}/like/`)).data;
// Mobile -> Backend: DELETE /api/forum/{forum_id}/like/
export const unlikeForumPost = async (forumId: number) => (await api.delete(`/api/forum/${forumId}/like/`)).data;
// Mobile -> Backend: POST /api/forum/{forum_id}/comments/
export const commentOnForumPost = async (forumId: number, comment: string) =>
  (await api.post(`/api/forum/${forumId}/comments/`, { comment_content: comment })).data;
// Mobile -> Backend: GET /api/forum/{forum_id}/comments/
export const getForumComments = async (forumId: number) => (await api.get(`/api/forum/${forumId}/comments/`)).data;
// Mobile -> Backend: PUT /api/forum/{forum_id}/comments/{comment_id}/
export const updateForumComment = async (forumId: number, commentId: number, content: string) =>
  (await api.put(`/api/forum/${forumId}/comments/${commentId}/`, { comment_content: content })).data;
// Mobile -> Backend: DELETE /api/forum/{forum_id}/comments/{comment_id}/
export const deleteForumComment = async (forumId: number, commentId: number) =>
  (await api.delete(`/api/forum/${forumId}/comments/${commentId}/`)).data;
// Mobile -> Backend: POST /api/forum/{forum_id}/repost/
export const repostForumPost = async (forumId: number) => (await api.post(`/api/forum/${forumId}/repost/`)).data;
// Mobile -> Backend: DELETE /api/forum-reposts/{repost_id}/
export const deleteForumRepost = async (repostId: number) => (await api.delete(`/api/forum-reposts/${repostId}/`)).data;

/** Donation (separate storage) */
// Mobile -> Backend: GET /api/donation/
export const getDonationPosts = async () => (await api.get('/api/donation/')).data.donations || [];
// Mobile -> Backend: POST /api/donation/
export const createDonationPost = async (payload: { title?: string; content: string; image?: string }) =>
  (await api.post('/api/donation/', { post_title: payload.title, post_content: payload.content, post_image: payload.image })).data;
// Mobile -> Backend: GET /api/donation/{donation_id}/
export const getDonationDetail = async (donationId: number) => (await api.get(`/api/donation/${donationId}/`)).data;
// Mobile -> Backend: PUT /api/donation/{donation_id}/
export const editDonationPost = async (donationId: number, payload: { title?: string; content?: string; post_content?: string }) =>
  (await api.put(`/api/donation/${donationId}/`, { post_title: payload.title, post_content: payload.content || payload.post_content })).data;
// Mobile -> Backend: DELETE /api/donation/{donation_id}/
export const deleteDonationPost = async (donationId: number) => (await api.delete(`/api/donation/${donationId}/`)).data;
// Mobile -> Backend: POST /api/donation/{donation_id}/like/
export const likeDonationPost = async (donationId: number) => (await api.post(`/api/donation/${donationId}/like/`)).data;
// Mobile -> Backend: DELETE /api/donation/{donation_id}/like/
export const unlikeDonationPost = async (donationId: number) => (await api.delete(`/api/donation/${donationId}/like/`)).data;
// Mobile -> Backend: POST /api/donation/{donation_id}/comments/
export const commentOnDonationPost = async (donationId: number, comment: string) =>
  (await api.post(`/api/donation/${donationId}/comments/`, { comment_content: comment })).data;
// Mobile -> Backend: GET /api/donation/{donation_id}/comments/
export const getDonationComments = async (donationId: number) => (await api.get(`/api/donation/${donationId}/comments/`)).data;
// Mobile -> Backend: PUT /api/donation/{donation_id}/comments/{comment_id}/
export const updateDonationComment = async (donationId: number, commentId: number, content: string) =>
  (await api.put(`/api/donation/${donationId}/comments/${commentId}/`, { comment_content: content })).data;
// Mobile -> Backend: DELETE /api/donation/{donation_id}/comments/{comment_id}/
export const deleteDonationComment = async (donationId: number, commentId: number) =>
  (await api.delete(`/api/donation/${donationId}/comments/${commentId}/`)).data;
// Mobile -> Backend: POST /api/donation/{donation_id}/repost/
export const repostDonationPost = async (donationId: number) => (await api.post(`/api/donation/${donationId}/repost/`)).data;
// Mobile -> Backend: DELETE /api/donation-reposts/{repost_id}/
export const deleteDonationRepost = async (repostId: number) => (await api.delete(`/api/donation-reposts/${repostId}/`)).data;

/** Forgot Password */
// Mobile -> Backend: POST /api/forgot-password/
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
// Mobile -> Backend: PUT /api/profile/update/
export const updateProfile = async (bio: string, profile_pic: string) =>
  (await api.put('/api/profile/update/', { bio, profile_pic })).data;

// Mobile -> Backend: PUT /api/alumni/profile/update/?user_id={id}
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
    content: payload.content ?? '',
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