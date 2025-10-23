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

// Prefer explicit config (Expo extra or env). Fallback to localhost for local dev.
// Use localhost for development, ngrok for production
const localhostUrl = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
// Ngrok URL for production - this line will be updated by the ngrok script
const ngrokUrl = 'https://saul-relevant-letha.ngrok-free.dev'; // This will be replaced by ngrok script
// Use ngrok for production, localhost for development
export const API_BASE_URL = normalizeBaseUrl(rawFromExpo || rawFromEnv || ngrokUrl || localhostUrl);

console.log('Mobile API base URL:', JSON.stringify(API_BASE_URL));
console.log('Raw from Expo:', rawFromExpo);
console.log('Raw from Env:', rawFromEnv);
console.log('Ngrok URL:', ngrokUrl);
console.log('Localhost URL:', localhostUrl);

/** Axios instance */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased to 60 seconds for image uploads
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

// Helper function to get current user ID (web compatibility)
export const getCurrentUserId = (user: any): number | null => {
  if (!user) return null;
  if (typeof user.user_id === 'number') return user.user_id;
  if (typeof user.id === 'number') return user.id;
  return null;
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
  console.log('Mobile: API Base URL:', API_BASE_URL);
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
  try {
    console.log('fetchFollowers: Calling API for userId:', userId);
    console.log('fetchFollowers: API base URL:', API_BASE_URL);
    const { data } = await api.get(`/api/alumni/${userId}/followers/`);
    console.log('fetchFollowers: API response:', data);
    console.log('fetchFollowers: Response structure:', {
      success: data?.success,
      followersCount: data?.followers?.length || 0,
      hasFollowers: Array.isArray(data?.followers),
      sampleFollower: data?.followers?.[0] || null
    });
    return data;
  } catch (error: any) {
    console.error('fetchFollowers error:', error);
    console.error('fetchFollowers error response:', error.response?.data);
    console.error('fetchFollowers error status:', error.response?.status);
    console.error('fetchFollowers error config:', error.config?.url);
    if (error?.response?.status === 404) {
      console.log('fetchFollowers: 404 error - returning empty followers');
      return { success: true, followers: [], count: 0 };
    }
    // Return empty data instead of throwing to prevent app crashes
    console.log('fetchFollowers: Returning empty data due to error');
    return { success: true, followers: [], count: 0 };
  }
};

// Mobile -> Backend: GET /api/alumni/{user_id}/following/
export const fetchFollowing = async (userId: number) => {
  try {
    console.log('fetchFollowing: Calling API for userId:', userId);
    console.log('fetchFollowing: API base URL:', API_BASE_URL);
    const { data } = await api.get(`/api/alumni/${userId}/following/`);
    console.log('fetchFollowing: API response:', data);
    console.log('fetchFollowing: Response structure:', {
      success: data?.success,
      followingCount: data?.following?.length || 0,
      hasFollowing: Array.isArray(data?.following),
      sampleFollowing: data?.following?.[0] || null
    });
    return data;
  } catch (error: any) {
    console.error('fetchFollowing error:', error);
    console.error('fetchFollowing error response:', error.response?.data);
    console.error('fetchFollowing error status:', error.response?.status);
    console.error('fetchFollowing error config:', error.config?.url);
    if (error?.response?.status === 404) {
      console.log('fetchFollowing: 404 error - returning empty following');
      return { success: true, following: [], count: 0 };
    }
    // Return empty data instead of throwing to prevent app crashes
    console.log('fetchFollowing: Returning empty data due to error');
    return { success: true, following: [], count: 0 };
  }
};
// Mobile -> Backend: POST /api/follow/{user_id}/
export const followUser = async (userId: number) => {
  try {
    console.log('followUser: Calling API for userId:', userId);
    const { data } = await api.post(`/api/follow/${userId}/`, {});
    console.log('followUser: API response:', data);
    return data;
  } catch (error: any) {
    console.error('followUser error:', error);
    console.error('followUser error response:', error.response?.data);
    throw error;
  }
};

// Mobile -> Backend: DELETE /api/follow/{user_id}/
export const unfollowUser = async (userId: number) => {
  try {
    console.log('unfollowUser: Calling API for userId:', userId);
    const { data } = await api.delete(`/api/follow/${userId}/`);
    console.log('unfollowUser: API response:', data);
    return data;
  } catch (error: any) {
    console.error('unfollowUser error:', error);
    console.error('unfollowUser error response:', error.response?.data);
    throw error;
  }
};

// Mobile -> Backend: GET /api/follow/{user_id}/status/
export const checkFollowStatus = async (userId: number) => {
  try {
    console.log('checkFollowStatus: Calling API for userId:', userId);
    const { data } = await api.get(`/api/follow/${userId}/status/`);
    console.log('checkFollowStatus: API response:', data);
    return data;
  } catch (error: any) {
    console.error('checkFollowStatus error:', error);
    console.error('checkFollowStatus error response:', error.response?.data);
    // Return default status instead of throwing
    return { success: true, is_following: false };
  }
};

/** Suggested Users */
// Mobile -> Backend: GET /api/users_list_view/?current_user_id={userId}
export const fetchSuggestedUsers = async () => {
  const user = await getUserInfo();
  const currentUserId = user?.user_id || user?.id;
  const { data } = await api.get(`/api/users_list_view/?current_user_id=${currentUserId}`);
  return data;
};

// Mobile -> Backend: GET /api/admin-peso-users/
export const getAdminPesoUsers = async () => {
  const response = await api.get('/api/admin-peso-users/');
  return response.data;
};

// Mobile -> Backend: GET /api/alumni/search/
export const searchAlumni = async (query: string) => {
  const response = await api.get('/api/alumni/search/', { params: { q: query } });
  return response.data;
};

/** Recent Searches */
export const listRecentSearches = async (limit: number = 10) => {
  try {
    const url = `/api/search/recent/?limit=${limit}`;
    const { data } = await api.get(url);
    console.log('listRecentSearches GET', API_BASE_URL + url, '->', Array.isArray(data?.recent) ? data.recent.length : 0);
    return (data?.recent ?? []) as Array<{ user_id: number; f_name?: string; l_name?: string; profile_pic?: string; created_at?: string }>;
  } catch (e: any) {
    console.warn('listRecentSearches error:', e?.response?.status, e?.response?.data || e?.message);
    throw e;
  }
};
export const addRecentSearch = async (searchedUserId: number) => {
  const url = '/api/search/recent/';
  try {
    const { data } = await api.post(url, { searched_user_id: searchedUserId });
    console.log('addRecentSearch POST', API_BASE_URL + url, 'payload:', { searched_user_id: searchedUserId }, '->', data);
    return data;
  } catch (e: any) {
    console.warn('addRecentSearch error:', e?.response?.status, e?.response?.data || e?.message);
    throw e;
  }
};
export const clearRecentSearches = async () => {
  const { data } = await api.delete('/api/search/recent/');
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
export const checkUserTrackerStatus = async () => {
  const user = await getUserInfo();
  const userId = user?.user_id || user?.id;
  if (!userId) {
    throw new Error('User ID not found');
  }
  return (await api.get(`/api/tracker/check-status/?user_id=${userId}`)).data;
};
// Mobile -> Backend: GET /api/tracker/accepting/{tracker_form_id}/
export const getTrackerAcceptingStatus = async (trackerFormId: number) => {
  if (!trackerFormId) {
    throw new Error('Tracker form ID is required');
  }
  return (await api.get(`/api/tracker/accepting/${trackerFormId}/`)).data;
};

/** Alumni */
// Mobile -> Backend: GET /api/alumni/statistics/
export const getAlumniStatistics = async () => (await api.get('/api/alumni/statistics/')).data;
// Mobile -> Backend: GET /api/alumni-list/ (alias of alumni/list/)
export const getAlumniList = async () => (await api.get('/api/alumni-list/')).data;

// Mobile -> Convenience: Get alumni by batch/year (client-side filter)
export const getAlumniByBatch = async (batchYear: string | number) => {
  try {
    const year = String(batchYear).trim();
    const { data } = await api.get(`/api/alumni/list/?year=${encodeURIComponent(year)}`);
    // Backend returns { success: True, alumni: [...] }
    return (data?.alumni ?? []) as any[];
  } catch (e) {
    console.error('getAlumniByBatch error:', (e as any)?.response?.data || (e as any)?.message || e);
    return [] as any[];
  }
};
// Mobile -> Backend: GET /api/alumni/{user_id}/
export const getAlumniDetails = async (userId: number) =>
  (await api.get(`/api/alumni/${userId}/`)).data;

// Mobile -> Backend: GET /api/alumni/profile/{user_id}/
export const getAlumniProfile = async (userId: number) =>
  (await api.get(`/api/alumni/profile/${userId}/`)).data;

// Mobile -> Backend: PUT /api/alumni/profile/{user_id}/
export const putAlumniProfile = async (
  userId: number,
  payload: {
    f_name?: string;
    m_name?: string;
    l_name?: string;
    civil_status?: string;
    contact_number?: string;
    email?: string;
    address?: string;
    home_address?: string;
    social_media?: string;
  }
) => {
  const body: any = {};
  if (typeof payload.f_name === 'string') body.f_name = payload.f_name;
  if (typeof payload.m_name === 'string') body.m_name = payload.m_name;
  if (typeof payload.l_name === 'string') body.l_name = payload.l_name;
  if (typeof payload.civil_status === 'string') body.civil_status = payload.civil_status;
  if (typeof payload.contact_number === 'string') body.contact_number = payload.contact_number;
  if (typeof payload.email === 'string') body.email = payload.email;
  if (typeof payload.address === 'string') body.address = payload.address;
  if (typeof payload.home_address === 'string') body.home_address = payload.home_address;
  if (typeof payload.social_media === 'string') body.social_media = payload.social_media;

  const { data } = await api.put(`/api/alumni/profile/${userId}/`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
};

// Mobile -> Backend: GET /api/userprofile/{user_id}/social_media/
export const getUserProfileSocialMedia = async (userId: number) =>
  (await api.get(`/api/userprofile/${userId}/social_media/`)).data;

// Mobile -> Backend: GET /api/userprofile/{user_id}/email/
export const getUserProfileEmail = async (userId: number) =>
  (await api.get(`/api/userprofile/${userId}/email/`)).data;

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

// Helper function to sort feed with admin/peso priority
const sortFeedWithPriority = (items: any[]) => {
  return items.sort((a, b) => {
    // Get user account types
    const aUserType = a.user?.account_type || a.user?.user_type || 'user';
    const bUserType = b.user?.account_type || b.user?.user_type || 'user';
    
    // Priority order: admin > peso > others
    const getPriority = (userType: string) => {
      if (userType === 'admin') return 3;
      if (userType === 'peso') return 2;
      return 1;
    };
    
    const aPriority = getPriority(aUserType);
    const bPriority = getPriority(bUserType);
    
    // First sort by priority (admin/peso first)
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    
    // Then sort by date within same priority
    const aDate = new Date(a.created_at || a.repost_date || 0).getTime();
    const bDate = new Date(b.created_at || b.repost_date || 0).getTime();
    return bDate - aDate;
  });
};

// Get combined feed of posts and reposts (including donation reposts)
export const getFeed = async () => {
  try {
    // Get posts (which includes regular reposts)
    const postsResponse = await api.get('/api/posts/');
    const posts = postsResponse.data?.posts || [];
    
    // Get donation posts (which includes donation reposts)
    const donationsResponse = await api.get('/api/donations/');
    const donations = donationsResponse.data?.donations || [];
    
    // Extract reposts from donations
    const donationReposts: any[] = [];
    donations.forEach((donation: any) => {
      if (Array.isArray(donation.reposts)) {
        donation.reposts.forEach((repost: any) => {
          donationReposts.push({
            ...repost,
            item_type: 'repost',
            original_post: {
              post_id: donation.donation_id,
              post_content: donation.description,
              post_image: donation.images?.[0]?.image_url || null,
              user: donation.user,
              created_at: donation.created_at,
              likes_count: donation.likes_count || 0,
              comments_count: donation.comments_count || 0,
              reposts_count: donation.reposts_count || 0,
              is_liked: donation.is_liked || false,
            }
          });
        });
      }
    });
    
    // Combine all feed items
    const allItems = [
      ...posts.map((post: any) => ({ ...post, item_type: post.item_type || 'post' })),
      ...donationReposts
    ];
    
    // Sort with admin/peso priority
    const feedItems = sortFeedWithPriority(allItems);
    
    return feedItems;
  } catch (error) {
    console.error('Mobile getFeed API Error:', error);
    // Fallback to just posts if donations endpoint doesn't exist
    return getPosts().then(posts => posts.map((post: any) => ({ ...post, item_type: 'post' })));
  }
};
// Mobile -> Backend: GET /api/posts/by-user-type/?user_type={peso|admin}
export const getPostsByUserType = async (userType: 'peso' | 'admin') =>
  (await api.get(`/api/posts/by-user-type/?user_type=${userType}`)).data.posts || [];
// Mobile -> Backend: POST /api/posts/
export const createPost = async (postData: {
  post_content: string;
  post_image?: string; // Backward compatibility
  post_images?: string[]; // Multiple images
  type?: string;
  post_title?: string; // Optional for compatibility
  post_cat_id?: number; // Optional for compatibility
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

// Mobile -> Backend: Comment Reply APIs
// Mobile -> Backend: GET /api/comments/{comment_id}/replies/
export const getCommentReplies = async (commentId: number) => (await api.get(`/api/comments/${commentId}/replies/`)).data;
// Mobile -> Backend: POST /api/comments/{comment_id}/replies/
export const createCommentReply = async (commentId: number, replyContent: string) => 
  (await api.post(`/api/comments/${commentId}/replies/`, { reply_content: replyContent })).data;
// Mobile -> Backend: PUT /api/comments/{comment_id}/replies/{reply_id}/
export const updateCommentReply = async (commentId: number, replyId: number, replyContent: string) => 
  (await api.put(`/api/comments/${commentId}/replies/${replyId}/`, { reply_content: replyContent })).data;
// Mobile -> Backend: DELETE /api/comments/{comment_id}/replies/{reply_id}/
export const deleteCommentReply = async (commentId: number, replyId: number) => 
  (await api.delete(`/api/comments/${commentId}/replies/${replyId}/`)).data;
// Some screens expect a dedicated likes endpoint. Provide a flexible helper.
// Mobile -> Backend: GET /api/posts/{post_id}/likes/
export const getPostLikes = async (postId: number) => {
  const { data } = await api.get(`/api/posts/${postId}/likes/`);
  // Backend may respond with { likes: [...] } or an array payload
  return (data && (data.likes ?? data)) as any[];
};

// Mobile -> Backend: GET /api/posts/{post_id}/detail/ (includes reposts)
export const getPostReposts = async (postId: number) => {
  try {
    const { data } = await api.get(`/api/posts/${postId}/detail/`);
    // Extract reposts from post detail response
    return Array.isArray(data?.reposts) ? data.reposts : [];
  } catch (error) {
    console.error('Error fetching post reposts:', error);
    return [];
  }
};
// Mobile -> Backend: GET /api/posts/{post_id}/detail/
export const getPostDetail = async (postId: number) => {
  console.log('getPostDetail - Requesting post ID:', postId);
  console.log('getPostDetail - API URL:', `/api/posts/${postId}/detail/`);
  const result = (await api.get(`/api/posts/${postId}/detail/`)).data;
  console.log('getPostDetail - API Response:', result);
  return result;
};

// Get all user posts including donation reposts
export const getAllUserPosts = async (userId: number) => {
  try {
    // Get regular posts and reposts
    const regularPosts = await getUserPosts(userId);
    
    // Get donation posts to extract reposts
    const donationsResponse = await api.get('/api/donations/');
    const donations = donationsResponse.data?.donations || [];
    
    // Extract donation reposts by this user
    const userDonationReposts: any[] = [];
    donations.forEach((donation: any) => {
      if (Array.isArray(donation.reposts)) {
        donation.reposts.forEach((repost: any) => {
          if (repost.user?.user_id === userId) {
            userDonationReposts.push({
              ...repost,
              item_type: 'repost',
              original_post: {
                post_id: donation.donation_id,
                post_content: donation.description,
                post_image: donation.images?.[0]?.image_url || null,
                user: donation.user,
                created_at: donation.created_at,
                likes_count: donation.likes_count || 0,
                comments_count: donation.comments_count || 0,
                reposts_count: donation.reposts_count || 0,
                is_liked: donation.is_liked || false,
              }
            });
          }
        });
      }
    });
    
    // Combine all posts and reposts
    const allPosts = [
      ...(regularPosts?.posts || regularPosts || []),
      ...userDonationReposts
    ].sort((a, b) => new Date(b.created_at || b.repost_date).getTime() - new Date(a.created_at || a.repost_date).getTime());
    
    return { posts: allPosts };
  } catch (error) {
    console.error('Error getting all user posts:', error);
    // Fallback to regular posts if error
    return getUserPosts(userId);
  }
};

// Mobile -> Backend: GET /api/posts/ (filter by user_id on client side)
export const getUserPosts = async (userId: number) => {
  try {
    console.log('getUserPosts: Fetching all posts and filtering for userId:', userId);
    
    // Get all posts and filter by user_id on the client side
    const allPostsResponse = await api.get('/api/posts/');
    const allPosts = allPostsResponse.data?.posts || [];
    
    console.log('getUserPosts: Total posts received:', allPosts.length);
    
    // Filter posts by user_id
    const userPosts = allPosts.filter((post: any) => {
      const postUserId = post.user?.user_id || post.user?.id;
      return postUserId === userId;
    });
    
    console.log('getUserPosts: Filtered posts for user:', userPosts.length);
    
    return { posts: userPosts };
  } catch (error: any) {
    console.error('getUserPosts error:', error);
    return { posts: [] };
  }
};
// Mobile -> Backend: PUT /api/posts/{post_id}/comments/{comment_id}/
export const updateComment = async (postId: number, commentId: number, content: string) =>
  (await api.put(`/api/posts/${postId}/comments/${commentId}/`, { comment_content: content })).data;
// Mobile -> Backend: DELETE /api/posts/{post_id}/comments/{comment_id}/
export const deleteComment = async (postId: number, commentId: number) =>
  (await api.delete(`/api/posts/${postId}/comments/${commentId}/`)).data;
// Mobile -> Backend: DELETE /api/posts/delete/{post_id}/
export const deletePost = async (postId: number) =>
  (await api.delete(`/api/posts/delete/${postId}/`)).data;
// Mobile -> Backend: PUT /api/posts/{post_id}/
export const editPost = async (
  postId: number,
  postData: { post_title?: string; post_content?: string }
) => (await api.put(`/api/posts/${postId}/`, postData)).data;

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

// Mobile -> Backend: PUT /api/reposts/{repost_id}/
export async function updateRepost(repostId: number, caption?: string | null) {
  const { data } = await api.put(
    `/api/reposts/${repostId}/`,
    { caption: caption?.trim() ?? '' },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return data;
}

// Mobile -> Backend: PUT /api/reposts/{repost_id}/ (alias for web compatibility)
export const editRepost = async (repostId: number, repostData: { caption?: string }) => {
  const response = await api.put(`/api/reposts/${repostId}/`, repostData);
  return response.data;
};
export const deleteRepost = async (repostId: number) =>
  (await api.delete(`/api/reposts/${repostId}/`)).data;

// Mobile -> Backend: GET /api/reposts/{repost_id}/detail/
export const getRepostDetail = async (repostId: number) => {
  try {
    return (await api.get(`/api/reposts/${repostId}/detail/`)).data;
  } catch (error: any) {
    // Avoid red screen spam; log compact message and provide safe fallback for UI
    console.warn('getRepostDetail error:', error?.response?.status, error?.response?.data || error?.message);
    if (error?.response?.status === 500 || error?.response?.status === 404) {
      return {
        repost_id: repostId,
        caption: '',
        repost_date: new Date().toISOString(),
        user: {
          user_id: 0,
          f_name: 'Unknown',
          l_name: 'User',
          profile_pic: null
        },
        likes_count: 0,
        comments_count: 0,
        likes: [],
        comments: [],
        original: {
          post_id: 0,
          user: {
            user_id: 0,
            f_name: 'Unknown',
            l_name: 'User',
            profile_pic: null
          },
          post_content: 'Original post content unavailable',
          post_image: null,
          post_images: []
        }
      };
    }
    throw error;
  }
};

// Mobile -> Backend: POST /api/reposts/{repost_id}/like/
export const likeRepost = async (repostId: number) =>
  (await api.post(`/api/reposts/${repostId}/like/`)).data;

// Mobile -> Backend: DELETE /api/reposts/{repost_id}/like/
export const unlikeRepost = async (repostId: number) =>
  (await api.delete(`/api/reposts/${repostId}/like/`)).data;

// Mobile -> Backend: GET /api/reposts/{repost_id}/likes/
export const getRepostLikes = async (repostId: number) => {
  try {
    const response = await api.get(`/api/reposts/${repostId}/likes/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching repost likes:', error);
    throw error;
  }
};

// Mobile -> Backend: GET /api/reposts/{repost_id}/comments/
export const getRepostComments = async (repostId: number) => {
  try {
    return (await api.get(`/api/reposts/${repostId}/comments/`)).data;
  } catch (error: any) {
    console.error('getRepostComments error:', error);
    // Return empty comments if there's an error
    if (error?.response?.status === 500 || error?.response?.status === 404) {
      console.log('Returning empty comments due to error');
      return { comments: [] };
    }
    throw error;
  }
};

// Mobile -> Backend: POST /api/reposts/{repost_id}/comments/
export const commentOnRepost = async (repostId: number, commentText: string) =>
  (await api.post(`/api/reposts/${repostId}/comments/`, { comment_content: commentText })).data;

// Mobile -> Backend: PUT /api/reposts/{repost_id}/comments/{comment_id}/
export const updateRepostComment = async (repostId: number, commentId: number, commentText: string) =>
  (await api.put(`/api/reposts/${repostId}/comments/${commentId}/`, { comment_content: commentText })).data;

// Mobile -> Backend: DELETE /api/reposts/{repost_id}/comments/{comment_id}/
export const deleteRepostComment = async (repostId: number, commentId: number) =>
  (await api.delete(`/api/reposts/${repostId}/comments/${commentId}/`)).data;

/** Forum (separate storage) */
// Mobile -> Backend: GET /api/forum/
export const getForumPosts = async () => (await api.get('/api/forum/')).data.forums || [];

// Web-compatible alias
export const getForums = async () => {
  const response = await api.get('/api/forum/');
  return response.data?.forums || [];
};
// Mobile -> Backend: POST /api/forum/
export const createForumPost = async (payload: { title?: string; content: string; image?: string; images?: string[] }) => {
  const forumData: any = { 
    post_title: payload.title, 
    post_content: payload.content 
  };
  
  // Handle multiple images if provided
  if (payload.images && payload.images.length > 0) {
    forumData.post_images = payload.images;
  } else if (payload.image) {
    // Fallback to single image for backward compatibility
    forumData.post_image = payload.image;
  }
  
  return (await api.post('/api/forum/', forumData)).data;
};
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
export const repostForumPost = async (forumId: number, caption?: string) => 
  (await api.post(`/api/forum/${forumId}/repost/`, { caption: caption || '' })).data;
// Mobile -> Backend: DELETE /api/forum-reposts/{repost_id}/
export const deleteForumRepost = async (repostId: number) => (await api.delete(`/api/forum-reposts/${repostId}/`)).data;

// Mobile -> Backend: DELETE /api/reposts/{repost_id}/ (alias for web compatibility)
export const unrepostForumPost = async (repostId: number) => {
  const response = await api.delete(`/api/reposts/${repostId}/`);
  return response.data;
};

/** Donation (separate storage) */
// Mobile -> Backend: GET /api/donations/
export const getDonationPosts = async () => (await api.get('/api/donations/')).data.donations || [];
// Mobile -> Backend: POST /api/donations/
export const createDonationPost = async (payload: { description: string; images?: string[] }) =>
  (await api.post('/api/donations/', { description: payload.description, images: payload.images })).data;
// Mobile -> Backend: GET /api/donations/{donation_id}/
export const getDonationDetail = async (donationId: number) => (await api.get(`/api/donations/${donationId}/`)).data;
// Mobile -> Backend: PUT /api/donations/{donation_id}/
export const editDonationPost = async (donationId: number, payload: { description?: string }) =>
  (await api.put(`/api/donations/${donationId}/`, { description: payload.description })).data;
// Mobile -> Backend: DELETE /api/donations/{donation_id}/
export const deleteDonationPost = async (donationId: number) => (await api.delete(`/api/donations/${donationId}/`)).data;

// Web-compatible aliases for donation operations
export const getDonationRequests = async () => {
  console.log('API: Fetching donation requests from donations/ endpoint');
  try {
    const response = await api.get('/api/donations/');
    console.log('API: Donation requests response:', response);
    console.log('API: Response data:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API: Error fetching donation requests:', error);
    console.error('API: Error response:', error.response);
    throw error;
  }
};

export const createDonationRequest = async (donationData: {
  description: string;
  images?: string[];
}) => {
  console.log('Creating donation request with data:', donationData);
  try {
    const response = await api.post('/api/donations/', donationData);
    console.log('Donation request response:', response);
    console.log('Response data:', response.data);
    console.log('Response status:', response.status);
    return response.data;
  } catch (error: any) {
    console.error('Donation request API error:', error);
    console.error('Error response:', error.response);
    console.error('Error response data:', error.response?.data);
    throw error;
  }
};

export const updateDonationRequest = async (donationId: number, updateData: {
  description?: string;
  status?: string;
}) => {
  const response = await api.put(`/api/donations/${donationId}/`, updateData);
  return response.data;
};

export const deleteDonationRequest = async (donationId: number) => {
  const response = await api.delete(`/api/donations/${donationId}/`);
  return response.data;
};
// Mobile -> Backend: POST /api/donations/{donation_id}/like/
export const likeDonationPost = async (donationId: number) => (await api.post(`/api/donations/${donationId}/like/`)).data;
// Mobile -> Backend: DELETE /api/donations/{donation_id}/like/
export const unlikeDonationPost = async (donationId: number) => (await api.delete(`/api/donations/${donationId}/like/`)).data;
// Mobile -> Backend: GET /api/donations/{donation_id}/ (includes likes and reposts)
export const getDonationLikes = async (donationId: number) => {
  const data = await (await api.get(`/api/donations/${donationId}/`)).data;
  return { likes: data.likes || [] };
};
export const getDonationReposts = async (donationId: number) => {
  const data = await (await api.get(`/api/donations/${donationId}/`)).data;
  return { reposts: data.reposts || [] };
};

// Web-compatible aliases for donation likes
export const likeDonation = async (donationId: number) => {
  const response = await api.post(`/api/donations/${donationId}/like/`);
  return response.data;
};

export const unlikeDonation = async (donationId: number) => {
  const response = await api.delete(`/api/donations/${donationId}/like/`);
  return response.data;
};
// Mobile -> Backend: POST /api/donations/{donation_id}/comments/
export const commentOnDonationPost = async (donationId: number, comment: string) =>
  (await api.post(`/api/donations/${donationId}/comments/`, { comment_content: comment })).data;
// Mobile -> Backend: GET /api/donations/{donation_id}/comments/
export const getDonationComments = async (donationId: number) => (await api.get(`/api/donations/${donationId}/comments/`)).data;
// Mobile -> Backend: PUT /api/donations/{donation_id}/comments/{comment_id}/
export const updateDonationComment = async (donationId: number, commentId: number, content: string) =>
  (await api.put(`/api/donations/${donationId}/comments/${commentId}/`, { comment_content: content })).data;
// Mobile -> Backend: DELETE /api/donations/{donation_id}/comments/{comment_id}/
export const deleteDonationComment = async (donationId: number, commentId: number) =>
  (await api.delete(`/api/donations/${donationId}/comments/${commentId}/`)).data;
// Mobile -> Backend: POST /api/donations/{donation_id}/repost/
export const repostDonationPost = async (donationId: number, repostCaption?: string) => 
  (await api.post(`/api/donations/${donationId}/repost/`, { caption: repostCaption || '' })).data;

// Mobile -> Backend: POST /api/donations/{donation_id}/comments/ (alias for web compatibility)
export const commentOnDonation = async (donationId: number, commentContent: string) => {
  const response = await api.post(`/api/donations/${donationId}/comments/`, {
    comment_content: commentContent
  });
  return response.data;
};

// Mobile -> Backend: POST /api/donations/{donation_id}/repost/ (alias for web compatibility)
export const repostDonation = async (donationId: number, repostCaption: string) => {
  const response = await api.post(`/api/donations/${donationId}/repost/`, {
    caption: repostCaption
  });
  return response.data;
};
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
export const updateAlumniProfile = async (params: { bio?: string; imageUri?: string; socialMedia?: string; email?: string }) => {
    const meRaw = await SecureStore.getItemAsync('user');
    const me = meRaw ? JSON.parse(meRaw) : null;
    const userId = me?.id || me?.user_id;
    if (!userId) throw new Error('Missing user id');

    // Update bio and profile picture using the main endpoint
    const form = new FormData();
    if (typeof params.bio === 'string') form.append('bio', params.bio);
    if (params.imageUri) {
      console.log('Adding image to FormData:', params.imageUri);
      form.append('profile_pic', { uri: params.imageUri, name: 'profile.jpg', type: 'image/jpeg' } as any);
    }

    // Normalize optional fields (allow clearing when provided as empty string)
    const normalizedSocial = typeof params.socialMedia === 'string' ? params.socialMedia.trim() : undefined;
    const normalizedEmail = typeof params.email === 'string' ? params.email.trim() : undefined;

    // Fire requests; keep references by name to avoid index math
    const bioPromise = (params.bio || params.imageUri)
      ? api.put(`/api/alumni/profile/update/?user_id=${userId}`, form, {
          headers: { 
            'Content-Type': 'multipart/form-data',
          },
        })
      : null;
    
    console.log('Making API request to:', `/api/alumni/profile/update/?user_id=${userId}`);
    console.log('FormData contents:', form);

    const socialPromise = (typeof normalizedSocial !== 'undefined')
      ? api.put(
          `/api/userprofile/${userId}/social_media/`,
          { social_media: normalizedSocial },
          { headers: { 'Content-Type': 'application/json' } }
        )
      : null;

    const emailPromise = (typeof normalizedEmail !== 'undefined')
      ? api.put(
          `/api/userprofile/${userId}/email/`,
          { email: normalizedEmail },
          { headers: { 'Content-Type': 'application/json' } }
        )
      : null;

    const [bioRes, socialRes, emailRes] = await Promise.all([
      bioPromise?.catch((e) => { 
        console.error('Update bio/photo failed:', e?.response?.data || e?.message);
        console.error('Full error:', e);
        return null; 
      }),
      socialPromise?.catch((e) => { console.error('Update social media failed:', e?.response?.data || e?.message); return null; }),
      emailPromise?.catch((e) => { console.error('Update email failed:', e?.response?.data || e?.message); return null; }),
    ]);

    // Update local storage with new data
    if (me) {
      const merged = { ...me };

      if (bioRes?.data?.user) {
        const bioResult = bioRes.data.user;
        merged.profile_bio = bioResult.bio ?? merged.profile_bio;
        // Handle profile picture URL properly
        if (bioResult.profile_pic) {
          // If it's a full URL, use it directly, otherwise prepend API_BASE_URL
          merged.profile_pic = bioResult.profile_pic.startsWith('http') 
            ? bioResult.profile_pic 
            : `${API_BASE_URL}${bioResult.profile_pic}`;
        }
        merged.name = bioResult.name ?? merged.name;
      }

      if (socialRes?.data) {
        merged.social_media = socialRes.data.social_media ?? merged.social_media;
      }

      if (emailRes?.data) {
        merged.email = emailRes.data.email ?? merged.email;
      }

      await SecureStore.setItemAsync('user', JSON.stringify(merged));
    }

    return { success: true };
};

export default api;

/** Notification API */
// Mobile -> Backend: GET /api/notifications/?user_id={userId}
export const fetchNotifications = async (userId: number) => {
  const response = await api.get(`/api/notifications/?user_id=${userId}`);
  return response.data;
};

// Mobile -> Backend: GET /api/notifications/count/?user_id={userId}
export const fetchNotificationCount = async (userId: number) => {
  const response = await api.get(`/api/notifications/count/?user_id=${userId}`);
  return response.data;
};

// Mobile -> Backend: POST /api/notifications/mark-read/
export const markNotificationAsRead = async (notificationId: number) => {
  const response = await api.post('/api/notifications/mark-read/', { notification_id: notificationId });
  return response.data;
};

// Mobile -> Backend: POST /api/notifications/mark-all-read/
export const markAllNotificationsAsRead = async (userId: number) => {
  const response = await api.post('/api/notifications/mark-all-read/', { user_id: userId });
  return response.data;
};

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