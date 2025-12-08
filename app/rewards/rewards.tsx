import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
  Image,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getInventoryItems,
  getUserPoints,
  getUserInfo,
  requestReward,
  getRewardRequests,
  claimRewardRequest,
  cancelRewardRequest,
  getEngagementPointsSettings,
  API_BASE_URL,
  fetchTrackerResponsesByUser,
} from '../../services/api';
import { NotificationWebSocket } from '../../services/notificationWebSocket';
import EarnPointsModal from '../../components/EarnPointsModal';
import { useAlert } from '../../contexts/AlertContext';

interface InventoryItem {
  id: number;
  name: string;
  type: string;
  quantity: number;
  value: string;
  created_at?: string;
  updated_at?: string;
  availability?: {
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
    label: string;
    units_available: number;
    is_available: boolean;
  };
}

interface RewardRequest {
  request_id: number;
  reward_id: number;
  reward_name: string;
  reward_type: string;
  points_cost: number;
  status: 'pending' | 'approved' | 'claimed' | 'did_not_push_through' | 'ready_for_pickup';
  requested_at: string;
  approved_at?: string;
  claimed_at?: string;
  expires_at?: string;
  voucher_code?: string;
  notes?: string;
  instructions?: string;
  gcash_number?: string | null;
  gcash_name?: string | null;
  gcash_receipt?: string | null;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  showCancel: boolean;
  onCancel: () => void;
  cancelling: boolean;
  onPress?: () => void;
}

const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onSwipeOpen,
  onSwipeClose,
  showCancel,
  onCancel,
  cancelling,
  onPress,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);
  const isSwiped = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const hasMoved = useRef(false);
  const lastGestureState = useRef({ dx: 0, dy: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Capture from the start to get priority over ScrollView
        return showCancel;
      },
      onStartShouldSetPanResponderCapture: () => {
        // Aggressively capture from the start if cancel is enabled
        return showCancel;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!showCancel) return false;
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        
        // If it's clearly a vertical scroll, release control
        if (absDy > absDx * 2.5 && absDy > 20) {
          return false; // Let ScrollView handle vertical scrolling
        }
        
        // Otherwise, keep control for horizontal or mixed gestures
        return true;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!showCancel) return false;
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        
        // Release if clearly vertical
        if (absDy > absDx * 2.5 && absDy > 20) {
          return false;
        }
        
        // Keep capture for horizontal or mixed gestures
        return true;
      },
      onPanResponderGrant: (evt) => {
        hasMoved.current = false;
        startX.current = evt.nativeEvent.pageX;
        startY.current = evt.nativeEvent.pageY;
        translateX.setOffset(currentOffset.current);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Track gesture state for termination request
        lastGestureState.current = { dx: gestureState.dx, dy: gestureState.dy };
        
        if (showCancel) {
          hasMoved.current = Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          
          // Only handle horizontal swipes (left direction)
          // If it's clearly vertical, don't translate
          if (absDy > absDx * 2 && absDy > 15) {
            // This is a vertical scroll, don't translate
            return;
          }
          
          // Only allow swiping left (negative dx)
          if (gestureState.dx < 0) {
            const newValue = Math.min(0, Math.max(-100, gestureState.dx));
            translateX.setValue(newValue);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        
        // If it was just a tap (minimal movement), trigger onPress
        if (!hasMoved.current && Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          if (onPress) {
            onPress();
          }
          return;
        }
        
        // Open if swiped left more than 40px
        const shouldOpen = gestureState.dx < -40 && showCancel;
        currentOffset.current = shouldOpen ? -100 : 0;
        isSwiped.current = shouldOpen;
        
        Animated.spring(translateX, {
          toValue: currentOffset.current,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start(() => {
          if (shouldOpen) {
            onSwipeOpen();
          } else {
            onSwipeClose();
          }
        });
      },
      onPanResponderTerminationRequest: (_, gestureState) => {
        // Allow ScrollView to take over if it's clearly a vertical scroll
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        if (absDy > absDx * 3 && absDy > 20) {
          return true; // Allow termination for vertical scrolls
        }
        // Don't allow ScrollView to take over for horizontal gestures
        return false;
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        Animated.spring(translateX, {
          toValue: currentOffset.current,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Close swipe when needed
  const closeSwipe = () => {
    if (isSwiped.current) {
      currentOffset.current = 0;
      isSwiped.current = false;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        onSwipeClose();
      });
    }
  };

  return (
    <View style={styles.swipeableContainer}>
      {/* Cancel button background */}
      {showCancel && (
        <View style={styles.swipeableAction}>
          <TouchableOpacity
            style={styles.swipeableCancelButton}
            onPress={() => {
              closeSwipe();
              onCancel();
            }}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.swipeableCancelButtonText} numberOfLines={1}>
                Cancel
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {/* Swipeable content with gesture handler */}
      <Animated.View
        style={[
          styles.swipeableContent,
          {
            transform: [{ translateX }],
          },
        ]}
        {...(showCancel ? panResponder.panHandlers : {})}
        collapsable={false}
      >
        {showCancel ? (
          children
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress || undefined}
            style={{ flex: 1 }}
          >
            {children}
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

export default function RewardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const requestIdParam = params.requestId ? String(params.requestId) : null;
  const openRequestsParam = params.openRequests === 'true';
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [userPoints, setUserPoints] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [claimingReward, setClaimingReward] = useState<number | null>(null);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [userRewardRequests, setUserRewardRequests] = useState<RewardRequest[]>([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [rewardStatusFilter, setRewardStatusFilter] = useState<'all' | 'pending' | 'approved' | 'claimed' | 'did_not_push_through'>('all');
  const [showRewardFilterDropdown, setShowRewardFilterDropdown] = useState(false);
  const [selectedRewardDetail, setSelectedRewardDetail] = useState<RewardRequest | null>(null);
  const [showRewardDetailModal, setShowRewardDetailModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingReward, setCancellingReward] = useState<number | null>(null);
  const [swipedRowId, setSwipedRowId] = useState<number | null>(null);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [pendingCancelRequestId, setPendingCancelRequestId] = useState<number | null>(null);
  const [showClaimConfirmModal, setShowClaimConfirmModal] = useState(false);
  const [pendingClaimRequest, setPendingClaimRequest] = useState<{id: number; name: string; cost: number} | null>(null);
  const [showMonthlyLimitModal, setShowMonthlyLimitModal] = useState(false);
  const [showConfirmRequestModal, setShowConfirmRequestModal] = useState(false);
  const [pendingRewardRequest, setPendingRewardRequest] = useState<{id: number; name: string; value: string; type?: string} | null>(null);
  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashName, setGcashName] = useState('');
  const [pointsSettings, setPointsSettings] = useState({
    enabled: true,
    like: 1,
    comment: 3,
    share: 5,
    reply: 2,
    post: 0,
    post_with_photo: 15,
    tracker_form: 0
  });
  const [showEarnPointsModal, setShowEarnPointsModal] = useState(false);
  const [trackerFormEnabled, setTrackerFormEnabled] = useState(false);
  const [hasCompletedTracker, setHasCompletedTracker] = useState(false);
  const openingDetailModalRef = useRef(false);
  const [showReceiptImageModal, setShowReceiptImageModal] = useState(false);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

  // Derive reward availability - matches web logic
  const deriveRewardAvailability = (item: InventoryItem) => {
    if (item?.availability) {
      return item.availability;
    }
    const units = Math.max(item?.quantity || 0, 0);
    if (units <= 0) {
      return { status: 'out_of_stock' as const, label: 'Out of Stock', units_available: 0, is_available: false };
    }
    if (units <= 5) {
      return { status: 'low_stock' as const, label: `Low Stock (${units} left)`, units_available: units, is_available: true };
    }
    return { status: 'in_stock' as const, label: 'In Stock', units_available: units, is_available: true };
  };

  const checkTrackerCompletion = useCallback(async (uid?: number, accountType?: any) => {
    if (!uid || !(accountType?.user) || accountType?.ojt) {
      setHasCompletedTracker(false);
      return;
    }
    try {
      const trackerStatus = await fetchTrackerResponsesByUser(uid);
      const completed = Boolean(
        trackerStatus &&
        trackerStatus.success !== false &&
        Array.isArray(trackerStatus.responses) &&
        trackerStatus.responses.length > 0
      );
      setHasCompletedTracker(completed);
    } catch (error) {
      console.error('RewardsScreen: Error checking tracker completion:', error);
      setHasCompletedTracker(false);
    }
  }, []);

  const fetchUserPoints = async () => {
    try {
      console.log('RewardsScreen: Fetching user info...');
      const user = await getUserInfo();
      console.log('RewardsScreen: User info fetched:', user ? 'Success' : 'Failed');
      setUserInfo(user); // Store user info to check account type
      const userId = user?.user_id || user?.id;
      console.log('RewardsScreen: User ID:', userId);
      if (userId) {
        await checkTrackerCompletion(userId, user?.account_type);
        console.log('RewardsScreen: Fetching user points for userId:', userId);
        const points = await getUserPoints(userId);
        console.log('RewardsScreen: User points fetched:', points);
        setUserPoints(points);
        
        // Fetch points settings
        try {
          console.log('RewardsScreen: Fetching engagement points settings...');
          const settingsResponse = await getEngagementPointsSettings();
          console.log('RewardsScreen: Points settings response:', settingsResponse);
          if (settingsResponse && settingsResponse.success && settingsResponse.settings) {
            setPointsSettings({
              enabled: settingsResponse.settings.enabled !== false,
              like: settingsResponse.settings.like_points || 0,
              comment: settingsResponse.settings.comment_points || 0,
              share: settingsResponse.settings.share_points || 0,
              reply: settingsResponse.settings.reply_points || 0,
              post: settingsResponse.settings.post_points || 0,
              post_with_photo: settingsResponse.settings.post_with_photo_points || 0,
              tracker_form: settingsResponse.settings.tracker_form_points || 0
            });
            // Check if tracker form is enabled
            setTrackerFormEnabled(settingsResponse.settings.tracker_form_enabled !== false);
            console.log('RewardsScreen: Points settings updated');
          }
        } catch (settingsError) {
          console.error('RewardsScreen: Error fetching points settings:', settingsError);
        }
      } else {
        console.warn('RewardsScreen: No user ID found, cannot fetch points');
        setHasCompletedTracker(false);
      }
    } catch (error) {
      console.error('RewardsScreen: Error fetching user points:', error);
      throw error; // Re-throw to be caught by loadData
    }
  };

  const fetchInventoryItems = async () => {
    try {
      setRewardsLoading(true);
      console.log('RewardsScreen: Fetching inventory items...');
      const response = await getInventoryItems();
      console.log('RewardsScreen: Inventory items response:', response);
      if (response.success) {
        const items = response.items || [];
        console.log('RewardsScreen: Inventory items fetched:', items.length, 'items');
        setInventoryItems(items);
      } else {
        console.error('RewardsScreen: Failed to load rewards:', response.message);
        showAlert({
          title: 'Error',
          message: response.message || 'Failed to load rewards',
          type: 'error',
        });
      }
    } catch (error: any) {
      console.error('RewardsScreen: Error fetching inventory:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load rewards';
      console.error('RewardsScreen: Error details:', errorMessage);
      showAlert({
        title: 'Error',
        message: errorMessage,
        type: 'error',
      });
      throw error; // Re-throw to be caught by loadData
    } finally {
      setRewardsLoading(false);
    }
  };

  const fetchUserRewardRequests = async () => {
    try {
      console.log('RewardsScreen: Fetching user reward requests...');
      const response = await getRewardRequests();
      console.log('RewardsScreen: Reward requests response:', response);
      if (response.success) {
        const requests = response.requests || [];
        console.log('RewardsScreen: Reward requests fetched:', requests.length, 'requests');
        setUserRewardRequests(requests);
        return requests;
      } else {
        console.warn('RewardsScreen: Failed to fetch reward requests:', response.message);
        return [];
      }
    } catch (error) {
      console.error('RewardsScreen: Error fetching reward requests:', error);
      // Don't throw here - reward requests are not critical for initial load
      return [];
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('RewardsScreen: Starting to load data...');
      await Promise.all([
        fetchUserPoints(),
        fetchInventoryItems(),
        fetchUserRewardRequests(),
      ]);
      console.log('RewardsScreen: Data loaded successfully');
    } catch (error) {
      console.error('RewardsScreen: Error loading data:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to load rewards data. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('RewardsScreen: Component mounted, loading data...');
    // Reset all modal states on mount to prevent stale modals from appearing
    setShowMonthlyLimitModal(false);
    setShowConfirmRequestModal(false);
    setShowRewardsModal(false);
    setShowRequestsModal(false);
    setShowCancelConfirmModal(false);
    setPendingRewardRequest(null);
    loadData();
  }, []);

  // Setup WebSocket for real-time points updates - use ref to persist across renders
  const wsRef = useRef<NotificationWebSocket | null>(null);
  const userIdRef = useRef<number | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      console.log('RewardsScreen: useFocusEffect triggered - setting up WebSocket');
      let notificationWs: NotificationWebSocket | null = null;

      const setupWebSocket = async () => {
        try {
          console.log('RewardsScreen: Starting WebSocket setup...');
          // Disconnect existing connection if any
          if (wsRef.current) {
            console.log('RewardsScreen: Disconnecting existing WebSocket');
            wsRef.current.disconnect();
            wsRef.current = null;
          }

          const user = await getUserInfo();
          console.log('RewardsScreen: Got user info:', user);
          const userId = user?.user_id || user?.id;
          console.log('RewardsScreen: Extracted userId:', userId);
          if (!userId) {
            console.error('RewardsScreen: No userId found, cannot setup WebSocket');
            return;
          }

          userIdRef.current = userId;
          console.log('RewardsScreen: Stored userId in ref:', userIdRef.current);

          const { getAccessToken } = await import('../../services/api');
          const token = await getAccessToken();
          console.log('RewardsScreen: Got access token:', token ? 'Yes' : 'No');
          console.log('RewardsScreen: API_BASE_URL:', API_BASE_URL);

          notificationWs = new NotificationWebSocket(userId, API_BASE_URL, token || undefined);
          wsRef.current = notificationWs;
          console.log('RewardsScreen: Created NotificationWebSocket instance');

          notificationWs.onNotification((event) => {
            console.log('RewardsScreen NotificationWebSocket: Received event:', event.type, event);
            if (event.type === 'points_update' && event.points) {
              const pointsData = event.points;
              console.log('RewardsScreen NotificationWebSocket: Points update received:', pointsData);
              console.log('RewardsScreen: Current userIdRef:', userIdRef.current);
              console.log('RewardsScreen: Points data userId:', pointsData.user_id);
              // Check if it's for the current user using stored userId
              if (userIdRef.current && Number(pointsData.user_id) === Number(userIdRef.current)) {
                console.log('RewardsScreen NotificationWebSocket: Updating points for current user:', pointsData);
                console.log('RewardsScreen: Setting userPoints to:', pointsData);
                setUserPoints(pointsData);
              } else {
                console.log('RewardsScreen NotificationWebSocket: Points update ignored - different user. Expected:', userIdRef.current, 'Got:', pointsData.user_id);
                console.log('RewardsScreen: Comparison - userIdRef:', userIdRef.current, 'type:', typeof userIdRef.current, 'pointsData.user_id:', pointsData.user_id, 'type:', typeof pointsData.user_id);
                console.log('RewardsScreen: Number comparison:', Number(userIdRef.current), '===', Number(pointsData.user_id), '=', Number(userIdRef.current) === Number(pointsData.user_id));
              }
            } else {
              console.log('RewardsScreen: Received non-points_update event or missing points data');
            }
          });

          notificationWs.onStatus((status) => {
            console.log('RewardsScreen Notification WebSocket status:', status);
            if (status === 'disconnected' || status === 'error') {
              console.log('RewardsScreen: WebSocket disconnected/error, will reconnect on next focus');
            }
          });

          console.log('RewardsScreen: Calling connect()...');
          await notificationWs.connect();
          console.log('RewardsScreen: WebSocket connected successfully');
        } catch (error) {
          console.error('RewardsScreen: Failed to setup notification WebSocket:', error);
          console.error('RewardsScreen: Error details:', JSON.stringify(error, null, 2));
          wsRef.current = null;
        }
      };

      setupWebSocket();

      return () => {
        console.log('RewardsScreen: Cleaning up WebSocket on blur');
        if (wsRef.current) {
          wsRef.current.disconnect();
          wsRef.current = null;
        }
      };
    }, [])
  );

  // Handle reward notification - open specific reward detail when requestId is provided
  useEffect(() => {
    const openRewardDetailFromNotification = async () => {
      if (requestIdParam && !loading) {
        // Refresh requests to ensure we have the latest data
        const requests = await fetchUserRewardRequests();
        const requestId = parseInt(requestIdParam);
        const rewardDetail = requests.find(
          (req: RewardRequest) => req.request_id === requestId
        );
        if (rewardDetail) {
          // Small delay to ensure modals are ready
          setTimeout(() => {
            // Open the detail modal directly (not the list modal)
            setSelectedRewardDetail(rewardDetail);
            setShowRequestsModal(false);
            setTimeout(() => {
              setShowRewardDetailModal(true);
            }, 300);
          }, 300);
        } else {
          // If not found, open the requests modal to show all requests
          setTimeout(() => {
            setShowRequestsModal(true);
          }, 300);
        }
      }
    };

    openRewardDetailFromNotification();
  }, [requestIdParam, loading]);

  // Handle opening requests modal from notification
  useEffect(() => {
    if (openRequestsParam && !loading) {
      // Refresh requests to ensure we have the latest data
      fetchUserRewardRequests().then(() => {
        // Small delay to ensure modals are ready
        setTimeout(() => {
          setShowRequestsModal(true);
        }, 300);
      });
    }
  }, [openRequestsParam, loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRequestReward = async (rewardId: number) => {
    console.log('Mobile: handleRequestReward called with rewardId:', rewardId);
    if (claimingReward !== null) {
      console.log('Mobile: Already claiming a reward, returning');
      return;
    }

    const reward = inventoryItems.find(item => item.id === rewardId);
    if (!reward) {
      console.log('Mobile: Reward not found');
      return;
    }
    
    const availability = deriveRewardAvailability(reward);
    const hasStock = availability.is_available;
    console.log('Mobile: Reward availability:', availability);

    const pointsMatch = reward.value?.match(/(\d+)/);
    const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
    const canAfford = (userPoints?.total_points || 0) >= requiredPoints;
    console.log('Mobile: Can afford:', canAfford, 'Required:', requiredPoints, 'Has:', userPoints?.total_points);

    if (!canAfford) {
      showAlert({
        title: 'Insufficient Points',
        message: `You need ${requiredPoints} points but only have ${userPoints?.total_points || 0}.`,
        type: 'warning',
      });
      return;
    }

    if (!hasStock) {
      showAlert({
        title: 'Out of Stock',
        message: 'This reward is out of stock.',
        type: 'warning',
      });
      return;
    }

    // Refresh reward requests to ensure we have the latest data before checking monthly limit
    const latestRequests = await fetchUserRewardRequests();
    console.log('Mobile: Latest requests after fetch:', latestRequests.length);

    // Check if user has already requested a reward this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRequests = (latestRequests || []).filter((req: RewardRequest) => {
      const requestedDate = new Date(req.requested_at);
      return requestedDate >= startOfMonth;
    });
    console.log('Mobile: Monthly requests found:', monthlyRequests.length);

    if (monthlyRequests.length >= 1) {
      console.log('Mobile: Monthly limit reached, showing modal');
      // Close the rewards modal first so the monthly limit modal can show on top
      setShowRewardsModal(false);
      // Small delay to ensure the rewards modal closes before showing the monthly limit modal
      setTimeout(() => {
        console.log('Mobile: Showing monthly limit modal');
        setShowMonthlyLimitModal(true);
      }, 200);
      return;
    }

    // Show confirmation modal instead of Alert
    console.log('Mobile: Setting pending reward request and showing confirmation modal');
    setPendingRewardRequest({
      id: rewardId,
      name: reward.name,
      value: reward.value,
      type: reward.type
    });
    // Reset GCash fields when opening modal
    setGcashNumber('');
    setGcashName('');
    setShowConfirmRequestModal(true);
    console.log('Mobile: Confirmation modal state set to true');
  };

  const confirmRequestReward = async () => {
    if (!pendingRewardRequest) return;
    
    // Validate GCash fields if reward type is GCash
    if (pendingRewardRequest.type?.toLowerCase() === 'gcash') {
      if (!gcashNumber.trim()) {
        showAlert({
          title: 'GCash Number Required',
          message: 'Please enter your GCash number',
          type: 'warning',
        });
        return;
      }
      if (!gcashName.trim()) {
        showAlert({
          title: 'GCash Name Required',
          message: 'Please enter your GCash account name',
          type: 'warning',
        });
        return;
      }
    }
    
    const rewardId = pendingRewardRequest.id;
    setShowConfirmRequestModal(false);
    
    try {
      setClaimingReward(rewardId);
      console.log('Mobile: Requesting reward with ID:', rewardId);
      const response = await requestReward(
        rewardId,
        pendingRewardRequest.type?.toLowerCase() === 'gcash' ? gcashNumber.trim() : undefined,
        pendingRewardRequest.type?.toLowerCase() === 'gcash' ? gcashName.trim() : undefined
      );
      console.log('Mobile: Request reward response:', response);
      
      if (response.success) {
        // Refresh requests
        await fetchUserRewardRequests();
        
        // Refresh inventory
        await fetchInventoryItems();
        
        // Refresh user points (mobile-specific, helps with UI updates)
        await fetchUserPoints();
        
        // Close modal and reset GCash fields
        setPendingRewardRequest(null);
        setGcashNumber('');
        setGcashName('');
      } else {
        showAlert({
          title: 'Error',
          message: response.message || 'Failed to request reward',
          type: 'error',
        });
      }
    } catch (error: any) {
      console.error('Error requesting reward:', error);
      showAlert({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to request reward',
        type: 'error',
      });
    } finally {
      setClaimingReward(null);
    }
  };

  const handleClaimApprovedReward = (requestId: number) => {
    if (claimingReward !== null) return;

    const request = userRewardRequests.find(req => req.request_id === requestId);
    if (!request) return;

    // Keep the detail modal open, just show claim confirmation modal
    setPendingClaimRequest({
      id: requestId,
      name: request.reward_name,
      cost: request.points_cost
    });
    setTimeout(() => {
      setShowClaimConfirmModal(true);
    }, 200);
  };

  const confirmClaimReward = async () => {
    if (!pendingClaimRequest) return;
    const requestId = pendingClaimRequest.id;
    setShowClaimConfirmModal(false);
    
    try {
      setClaimingReward(requestId);
      const response = await claimRewardRequest(requestId);
      if (response.success) {
        showAlert({
          title: 'Success',
          message: response.message || 'Reward claimed successfully!',
          type: 'success',
        });
        await fetchUserPoints();
        // Fetch updated requests and update the detail modal
        const updatedRequests = await fetchUserRewardRequests();
        // Update the detail modal with the latest data if it was showing this request
        if (selectedRewardDetail?.request_id === requestId) {
          const updatedRequest = updatedRequests.find((req: RewardRequest) => req.request_id === requestId);
          if (updatedRequest) {
            setSelectedRewardDetail(updatedRequest);
            setShowRewardDetailModal(true);
          }
        }
      } else {
        showAlert({
          title: 'Error',
          message: response.message || 'Failed to claim reward',
          type: 'error',
        });
      }
    } catch (error: any) {
      console.error('Error claiming reward:', error);
      showAlert({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to claim reward',
        type: 'error',
      });
    } finally {
      setClaimingReward(null);
      setPendingClaimRequest(null);
    }
  };

  const handleCancelReward = (requestId: number) => {
    const request = userRewardRequests.find((req) => req.request_id === requestId);
    if (!request) return;
    if (!['pending', 'approved', 'ready_for_pickup'].includes(request.status)) {
      showAlert({
        title: 'Error',
        message: 'This request can no longer be cancelled.',
        type: 'error',
      });
      return;
    }
    setPendingCancelRequestId(requestId);
    setSwipedRowId(null); // Close swipe when showing modal
    // Close the requests modal first so the cancel confirmation modal can be seen
    setShowRequestsModal(false);
    setShowRewardDetailModal(false);
    setSelectedRewardDetail(null);
    // Small delay to ensure the requests modal closes before showing the cancel confirmation
    setTimeout(() => {
      setShowCancelConfirmModal(true);
    }, 200);
  };

  const handleDismissCancelConfirm = () => {
    setShowCancelConfirmModal(false);
    setPendingCancelRequestId(null);
    // Reopen the requests modal after dismissing the cancel confirmation
    setTimeout(() => {
      setShowRequestsModal(true);
    }, 200);
  };

  const confirmCancelReward = async () => {
    if (!pendingCancelRequestId) return;
    const requestId = pendingCancelRequestId;
    setShowCancelConfirmModal(false);
    
    try {
      setCancellingReward(requestId);
      const response = await cancelRewardRequest(requestId);
      if (response.success) {
        showAlert({
          title: 'Success',
          message: response.message || 'Reward request cancelled.',
          type: 'success',
        });
        await fetchUserRewardRequests();
        await fetchInventoryItems();
        if (selectedRewardDetail?.request_id === requestId) {
          setSelectedRewardDetail((prev: RewardRequest | null) =>
            prev ? { ...prev, status: 'cancelled' as any, notes: response.request?.notes || prev.notes } : prev
          );
        }
        // Reopen the requests modal to show the updated list
        setTimeout(() => {
          setShowRequestsModal(true);
        }, 300);
      } else {
        showAlert({
          title: 'Error',
          message: response.message || 'Unable to cancel request.',
          type: 'error',
        });
        // Reopen the requests modal even on error
        setTimeout(() => {
          setShowRequestsModal(true);
        }, 300);
      }
    } catch (error: any) {
      console.error('Error cancelling reward request:', error);
      showAlert({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to cancel request.',
        type: 'error',
      });
      // Reopen the requests modal even on error
      setTimeout(() => {
        setShowRequestsModal(true);
      }, 300);
    } finally {
      setCancellingReward(null);
      setPendingCancelRequestId(null);
    }
  };

  const getStatusColor = (status: string, hasExpired?: boolean) => {
    if (hasExpired) return '#ef4444'; // Red for expired
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'approved':
      case 'ready_for_pickup':
        return '#10b981';
      case 'claimed':
        return '#3b82f6';
      case 'did_not_push_through':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusDisplay = (status: string, hasExpired?: boolean, rewardType?: string) => {
    if (hasExpired) return 'Expired';
    const isGcash = rewardType?.toLowerCase() === 'gcash';
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
      case 'ready_for_pickup':
        // For GCash rewards, show "Sent" instead of "Ready" when approved
        return isGcash ? 'Sent' : 'Ready';
      case 'claimed':
        return 'Claimed';
      case 'did_not_push_through':
        return 'Did Not Push Through';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
  };

  const filteredRequests = userRewardRequests.filter((req: any) => {
    if (rewardStatusFilter === 'all') return true;
    if (rewardStatusFilter === 'pending') return req.status === 'pending';
    if (rewardStatusFilter === 'approved') return req.status === 'approved' || req.status === 'ready_for_pickup';
    if (rewardStatusFilter === 'claimed') return req.status === 'claimed';
    if (rewardStatusFilter === 'did_not_push_through') {
      const isApproved = req.status === 'approved' || req.status === 'ready_for_pickup';
      const isNotClaimed = req.status !== 'claimed';
      const hasExpired = req.expires_at && new Date(req.expires_at) < new Date();
      return isApproved && isNotClaimed && hasExpired;
    }
    return true;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading rewards...</Text>
      </View>
    );
  }

  // Safety check: Ensure we have basic data before rendering
  if (!userPoints && !loading) {
    console.warn('RewardsScreen: No user points data available, but loading is false');
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button and Title */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <FontAwesome name="trophy" size={24} color="#f59e0b" />
            <Text style={styles.titleText}>Engagement Points</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Main Points Card with Gradient */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <Text style={styles.totalPointsLabel}>Total Points</Text>
          <Text style={styles.pointsValue}>{userPoints?.total_points || 0}</Text>
          {userPoints?.rank && (
            <Text style={styles.rankText}>Rank #{userPoints.rank}</Text>
          )}
          
          {/* Action Buttons inside Card */}
          <View style={styles.cardActionsContainer}>
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => {
                fetchInventoryItems();
                fetchUserRewardRequests();
                setShowRewardsModal(true);
              }}
            >
              <FontAwesome name="gift" size={18} color="#fff" />
              <Text style={styles.cardActionButtonText}>View Rewards</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => {
                fetchUserRewardRequests();
                setShowRequestsModal(true);
              }}
            >
              <FontAwesome name="check" size={18} color="#fff" />
              <Text style={styles.cardActionButtonText}>My Requests</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Earn Points Buttons */}
        <View style={styles.earnPointsContainer}>
          <TouchableOpacity
            style={styles.earnPointsButtonOrange}
            onPress={() => setShowEarnPointsModal(true)}
          >
            <Text style={styles.earnPointsButtonText}>
              Complete tasks to earn points!
            </Text>
          </TouchableOpacity>

          {trackerFormEnabled && userInfo?.account_type?.user && !userInfo?.account_type?.ojt && !hasCompletedTracker && (
            <TouchableOpacity
              style={styles.earnPointsButtonBlue}
              onPress={() => router.push('/forms/forms')}
            >
              <Text style={styles.earnPointsButtonText}>
                Complete Tracker Form to earn points!
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Earn Points Modal */}
        <EarnPointsModal
          isOpen={showEarnPointsModal}
          onClose={() => setShowEarnPointsModal(false)}
        />

        {/* Rewards Modal */}
        <Modal
          visible={showRewardsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowRewardsModal(false)}
        >
          <View style={styles.rewardsModalOverlay}>
            <View style={styles.rewardsModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Available Rewards</Text>
                <TouchableOpacity onPress={() => setShowRewardsModal(false)}>
                  <FontAwesome name="times" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={true}
                bounces={true}
                showsVerticalScrollIndicator={true}
              >
                {rewardsLoading ? (
                  <ActivityIndicator size="large" color="#1e3a8a" />
                ) : (
                  <>
                    {(() => {
                      // Show ALL rewards from DB (do not filter by affordability)
                      const rewards = Array.isArray(inventoryItems) ? inventoryItems : [];
                      
                      if (rewards.length === 0) {
                        return (
                          <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No rewards available</Text>
                            <Text style={styles.emptySubtext}>
                              You currently have {userPoints?.total_points || 0} points
                            </Text>
                          </View>
                        );
                      }

                      return rewards.map((item) => {
                        const pointsMatch = item.value?.match(/(\d+)/);
                        const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                        const canAfford = (userPoints?.total_points || 0) >= requiredPoints;
                        const availability = deriveRewardAvailability(item);
                        const hasStock = availability.is_available;
                        const canRequest = canAfford && hasStock;
                        const isClaiming = claimingReward === item.id;
                        const pointsShort = Math.max(0, requiredPoints - (userPoints?.total_points || 0));

                        return (
                          <View key={item.id} style={styles.rewardCard}>
                            <View style={styles.rewardHeader}>
                              <Text style={styles.rewardName}>{item.name}</Text>
                              <View style={styles.rewardBadge}>
                                <Text style={styles.rewardBadgeText}>{item.type}</Text>
                              </View>
                            </View>
                            <Text style={styles.rewardValue}>{item.value}</Text>
                            <Text style={styles.rewardStock}>
                              Stock: {availability.units_available} available
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.requestButton,
                                (!canRequest || isClaiming) && styles.requestButtonDisabled,
                              ]}
                              onPressIn={() => {
                                console.log('Mobile: Button onPressIn - reward:', item.id, 'canRequest:', canRequest);
                              }}
                              onPress={() => {
                                console.log('Mobile: Button onPress - reward:', item.id, 'canRequest:', canRequest, 'isClaiming:', isClaiming, 'hasStock:', hasStock, 'canAfford:', canAfford);
                                if (canRequest && !isClaiming) {
                                  console.log('Mobile: Calling handleRequestReward for reward:', item.id);
                                  handleRequestReward(item.id);
                                } else {
                                  console.log('Mobile: Button press ignored - canRequest:', canRequest, 'isClaiming:', isClaiming);
                                  if (!canRequest) {
                                    showAlert({
                                      title: 'Cannot Request',
                                      message: `canAfford: ${canAfford}, hasStock: ${hasStock}`,
                                      type: 'warning',
                                    });
                                  }
                                }
                              }}
                              disabled={!canRequest || isClaiming}
                              activeOpacity={canRequest && !isClaiming ? 0.7 : 1}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              delayPressIn={0}
                              delayPressOut={0}
                            >
                              {isClaiming ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={[
                                  styles.requestButtonText,
                                  !canRequest && styles.requestButtonTextDisabled
                                ]}>
                                  {canRequest
                                    ? 'Request to Claim Reward'
                                    : !hasStock
                                    ? 'Out of Stock'
                                    : `Need ${pointsShort} more point${pointsShort === 1 ? '' : 's'}`}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      });
                    })()}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Reward Requests Modal */}
        <Modal
          visible={showRequestsModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            // Only clear selectedRewardDetail if we're not opening the detail modal
            if (!openingDetailModalRef.current) {
              setShowRequestsModal(false);
              setShowRewardDetailModal(false);
              setSelectedRewardDetail(null);
              setRewardStatusFilter('all');
              setShowRewardFilterDropdown(false);
            } else {
              // If we're opening the detail modal, just close the requests modal
              setShowRequestsModal(false);
              setRewardStatusFilter('all');
              setShowRewardFilterDropdown(false);
            }
          }}
        >
          <View style={styles.rewardsModalOverlay}>
            <TouchableOpacity
              style={styles.overlayTouchable}
              activeOpacity={1}
              onPress={() => {
                // Only clear selectedRewardDetail if we're not opening the detail modal
                if (!openingDetailModalRef.current) {
                  setShowRequestsModal(false);
                  setShowRewardDetailModal(false);
                  setSelectedRewardDetail(null);
                  setRewardStatusFilter('all');
                  setShowRewardFilterDropdown(false);
                  setSwipedRowId(null);
                } else {
                  // If we're opening the detail modal, just close the requests modal
                  setShowRequestsModal(false);
                  setRewardStatusFilter('all');
                  setShowRewardFilterDropdown(false);
                  setSwipedRowId(null);
                }
              }}
            />
            <View 
              style={styles.rewardsModalContent}
              onStartShouldSetResponder={() => true}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <FontAwesome name="check-circle" size={18} color="#3b82f6" />
                  <Text style={styles.modalTitle}>
                    My Reward Requests ({filteredRequests.length})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    openingDetailModalRef.current = false;
                    setShowRequestsModal(false);
                    setShowRewardDetailModal(false);
                    setSelectedRewardDetail(null);
                    setRewardStatusFilter('all');
                    setShowRewardFilterDropdown(false);
                    setSwipedRowId(null);
                  }}
                >
                  <FontAwesome name="times" size={18} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Filter Dropdown */}
              <View style={styles.filterDropdownContainer}>
                  <Text style={styles.filterLabel}>Filter by status:</Text>
                <View style={{ position: 'relative', marginTop: 8 }}>
                    <TouchableOpacity
                      style={styles.filterDropdownButton}
                      onPress={() => setShowRewardFilterDropdown(!showRewardFilterDropdown)}
                    >
                      <Text style={styles.filterDropdownButtonText}>
                        {rewardStatusFilter === 'all' ? 'All' : 
                         rewardStatusFilter === 'pending' ? 'Pending' : 
                         rewardStatusFilter === 'approved' ? 'Ready' : 
                         rewardStatusFilter === 'claimed' ? 'Claimed' : 
                       'Failed'}
                      </Text>
                      <FontAwesome 
                        name={showRewardFilterDropdown ? 'chevron-up' : 'chevron-down'} 
                        size={12} 
                        color="#1e3a5f" 
                      />
                    </TouchableOpacity>
                    {showRewardFilterDropdown && (
                      <View style={styles.filterDropdownMenu}>
                        {(['all', 'pending', 'approved', 'claimed', 'did_not_push_through'] as const).map((filter) => (
                          <TouchableOpacity
                            key={filter}
                            style={[
                              styles.filterDropdownItem,
                              rewardStatusFilter === filter && styles.filterDropdownItemActive
                            ]}
                            onPress={() => {
                              setRewardStatusFilter(filter);
                              setShowRewardFilterDropdown(false);
                            }}
                          >
                            <Text style={[
                              styles.filterDropdownItemText,
                              rewardStatusFilter === filter && styles.filterDropdownItemTextActive
                            ]}>
                              {filter === 'all' ? 'All' : 
                               filter === 'approved' ? 'Ready' : 
                             filter === 'did_not_push_through' ? 'Failed' : 
                               filter.charAt(0).toUpperCase() + filter.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                </View>
              </View>

              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                onScrollBeginDrag={(e) => {
                  // Only close swipe if scrolling vertically
                  if (Math.abs(e.nativeEvent.contentOffset.y) > 0) {
                    setShowRewardFilterDropdown(false);
                    setSwipedRowId(null);
                  }
                }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                bounces={true}
                scrollEventThrottle={16}
              >
                {filteredRequests.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No reward requests yet</Text>
                  </View>
                ) : (
                  <View style={styles.requestsList}>
                    {filteredRequests.map((request: any) => {
                    const isApproved = request.status === 'approved' || request.status === 'ready_for_pickup';
                    const isClaimed = request.status === 'claimed';
                    const hasExpired = request.expires_at && new Date(request.expires_at) < new Date();
                    const didNotPushThrough = isApproved && !isClaimed && hasExpired;
                      const canCancel = ['pending', 'approved', 'ready_for_pickup'].includes(request.status);

                    return (
                        <SwipeableRow
                        key={request.request_id}
                          onSwipeOpen={() => {
                            if (swipedRowId !== request.request_id) {
                              setSwipedRowId(null);
                            }
                            setSwipedRowId(request.request_id);
                          }}
                          onSwipeClose={() => {
                            if (swipedRowId === request.request_id) {
                              setSwipedRowId(null);
                            }
                          }}
                          showCancel={canCancel}
                          onCancel={() => {
                            setSwipedRowId(null);
                            handleCancelReward(request.request_id);
                          }}
                          cancelling={cancellingReward === request.request_id}
                          onPress={() => {
                            // Only open detail if not swiped
                            if (swipedRowId !== request.request_id) {
                              // Set flag to indicate we're opening the detail modal
                              openingDetailModalRef.current = true;
                              setShowRewardFilterDropdown(false);
                              setSwipedRowId(null);
                              // Store the request to show after modal closes
                              const requestToShow = request;
                              // Close the requests modal first
                              setShowRequestsModal(false);
                              // After the requests modal closes, show the detail modal
                              setTimeout(() => {
                                setSelectedRewardDetail(requestToShow);
                                // Small delay to ensure state is set before showing modal
                                setTimeout(() => {
                                  setShowRewardDetailModal(true);
                                  // Reset flag after modal transition
                                  setTimeout(() => {
                                    openingDetailModalRef.current = false;
                                  }, 100);
                                }, 50);
                              }, 300);
                            } else {
                              // If swiped, close the swipe first
                              setSwipedRowId(null);
                            }
                          }}
                        >
                          <View style={styles.requestCard}>
                            <View style={styles.requestCardHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 8 }}>
                                <Text style={styles.requestCardTitle} numberOfLines={1}>
                                  {request.reward_name}
                                </Text>
                                {request.notes && request.notes.toLowerCase().includes('tracker') && (
                                  <View style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    backgroundColor: '#dbeafe',
                                  }}>
                                    <Text style={{
                                      fontSize: 10,
                                      fontWeight: '600',
                                      color: '#1e40af',
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.5,
                                    }}>
                                      Tracker
                                    </Text>
                                  </View>
                                )}
                              </View>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: getStatusColor(request.status, didNotPushThrough) },
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {getStatusDisplay(request.status, didNotPushThrough, request.reward_type)}
                            </Text>
                          </View>
                        </View>
                            <View style={styles.requestCardBody}>
                              <View style={styles.requestCardRow}>
                                <Text style={styles.requestCardLabel}>Type:</Text>
                                <Text style={styles.requestCardValue}>{request.reward_type || '-'}</Text>
                              </View>
                              <View style={styles.requestCardRow}>
                                <Text style={styles.requestCardLabel}>Cost:</Text>
                                <Text style={[styles.requestCardValue, styles.requestCardCost]}>
                                  {request.points_cost} pts
                                </Text>
                              </View>
                              <View style={styles.requestCardRow}>
                                <Text style={styles.requestCardLabel}>Requested:</Text>
                                <Text style={styles.requestCardValue}>
                                  {new Date(request.requested_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                              </View>
                        {request.approved_at && (
                                <View style={styles.requestCardRow}>
                                  <Text style={styles.requestCardLabel}>Approved:</Text>
                                  <Text style={styles.requestCardValue}>
                                    {new Date(request.approved_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </SwipeableRow>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Reward Detail Modal */}
        {selectedRewardDetail && (
          <Modal
            visible={showRewardDetailModal && !!selectedRewardDetail}
            animationType="fade"
            transparent={true}
            onRequestClose={() => {
              setShowRewardDetailModal(false);
              setSelectedRewardDetail(null);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.rewardDetailModalContent}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardDetailSubtitle}>REWARD DETAILS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      <Text style={styles.rewardDetailTitle}>{selectedRewardDetail.reward_name}</Text>
                      {selectedRewardDetail.notes && selectedRewardDetail.notes.toLowerCase().includes('tracker') && (
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: '#dbeafe',
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: '600',
                            color: '#1e40af',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}>
                            Tracker
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setShowRewardDetailModal(false);
                    setSelectedRewardDetail(null);
                  }}>
                    <FontAwesome name="times" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.rewardDetailScrollContent}
                  showsVerticalScrollIndicator={true}
                >
                  {/* Type Section */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailInfoHeader}>
                      <FontAwesome name="tag" size={20} color="#6b7280" />
                      <Text style={styles.detailInfoTitle}>Type</Text>
                    </View>
                    <Text style={styles.detailInfoValue}>{selectedRewardDetail.reward_type || '-'}</Text>
                  </View>

                  {/* Points Cost Section */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailInfoHeader}>
                      <FontAwesome name="star" size={20} color="#6b7280" />
                      <Text style={styles.detailInfoTitle}>Points Cost</Text>
                    </View>
                    <Text style={styles.detailInfoValue}>{selectedRewardDetail.points_cost} pts</Text>
                  </View>

                  {/* Status Section */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailInfoHeader}>
                      <FontAwesome name="info-circle" size={20} color="#6b7280" />
                      <Text style={styles.detailInfoTitle}>Status</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { 
                          backgroundColor: getStatusColor(selectedRewardDetail.status, 
                          (() => {
                            const isApproved = selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup';
                            const isNotClaimed = selectedRewardDetail.status !== 'claimed';
                            const hasExpired = selectedRewardDetail.expires_at ? new Date(selectedRewardDetail.expires_at) < new Date() : false;
                            return isApproved && isNotClaimed && hasExpired;
                          })()
                          ),
                          alignSelf: 'flex-start',
                          marginTop: 8,
                        },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {getStatusDisplay(selectedRewardDetail.status, 
                          (() => {
                            const isApproved = selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup';
                            const isNotClaimed = selectedRewardDetail.status !== 'claimed';
                            const hasExpired = selectedRewardDetail.expires_at ? new Date(selectedRewardDetail.expires_at) < new Date() : false;
                            return isApproved && isNotClaimed && hasExpired;
                          })(),
                          selectedRewardDetail.reward_type
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Requested Section */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailInfoHeader}>
                      <FontAwesome name="calendar" size={20} color="#6b7280" />
                      <Text style={styles.detailInfoTitle}>Requested</Text>
                    </View>
                    <Text style={styles.detailInfoValue}>
                      {new Date(selectedRewardDetail.requested_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </Text>
                  </View>

                  {/* Approved Section */}
                  {selectedRewardDetail.approved_at && (
                    <View style={styles.detailInfoBox}>
                      <View style={styles.detailInfoHeader}>
                        <FontAwesome name="check-circle" size={20} color="#6b7280" />
                        <Text style={styles.detailInfoTitle}>Approved</Text>
                      </View>
                      <Text style={styles.detailInfoValue}>
                        {new Date(selectedRewardDetail.approved_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </Text>
                    </View>
                  )}
                  {/* Claimed Section */}
                  {selectedRewardDetail.claimed_at && (
                    <View style={styles.detailInfoBox}>
                      <View style={styles.detailInfoHeader}>
                        <FontAwesome name="gift" size={20} color="#6b7280" />
                        <Text style={styles.detailInfoTitle}>Claimed</Text>
                      </View>
                      <Text style={styles.detailInfoValue}>
                        {new Date(selectedRewardDetail.claimed_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </Text>
                    </View>
                  )}
                  {/* Expires Section - Only show for non-GCash and non-claimed rewards */}
                  {selectedRewardDetail.expires_at && 
                   selectedRewardDetail.status !== 'claimed' && 
                   selectedRewardDetail.reward_type?.toLowerCase() !== 'gcash' &&
                   (selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup') && (
                    <View style={styles.expiresBox}>
                      <View style={styles.expiresHeader}>
                        <FontAwesome name="info-circle" size={20} color="#6b7280" />
                        <Text style={styles.expiresTitle}>Expires</Text>
                      </View>
                      <Text style={[
                        styles.expiresDate,
                        new Date(selectedRewardDetail.expires_at) < new Date() && { color: '#dc2626', fontWeight: '600' }
                      ]}>
                        {new Date(selectedRewardDetail.expires_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </Text>
                      <View style={styles.expiresWarning}>
                        <Text style={styles.expiresWarningText}>
                          Failure to claim within 5 days of approval voids this request.
                        </Text>
                      </View>
                    </View>
                  )}
                  {/* Instructions Section */}
                  {selectedRewardDetail.notes && (
                    <View style={styles.instructionsBox}>
                      <View style={styles.instructionsHeader}>
                        <FontAwesome name="info-circle" size={20} color="#1e40af" />
                        <Text style={styles.instructionsTitle}>
                          {selectedRewardDetail.notes.toLowerCase().includes('tracker') 
                            ? 'Reward Information' 
                            : 'Instructions'}
                        </Text>
                      </View>
                      <Text style={styles.instructionsText}>{selectedRewardDetail.notes}</Text>
                    </View>
                  )}
                  
                  {/* GCash Details Section */}
                  {selectedRewardDetail.reward_type?.toLowerCase() === 'gcash' && (
                    <>
                      {selectedRewardDetail.gcash_number && selectedRewardDetail.gcash_name && (
                        <View style={styles.gcashDetailsBox}>
                          <View style={styles.gcashDetailsHeader}>
                            <FontAwesome name="mobile" size={20} color="#0284c7" />
                            <Text style={styles.gcashDetailsTitle}>GCash Details</Text>
                          </View>
                          <View style={styles.gcashDetailsContent}>
                            <View style={styles.gcashDetailRow}>
                              <Text style={styles.gcashDetailLabel}>GCash Number:</Text>
                              <Text style={styles.gcashDetailValue}>{selectedRewardDetail.gcash_number}</Text>
                            </View>
                            <View style={styles.gcashDetailRow}>
                              <Text style={styles.gcashDetailLabel}>Account Name:</Text>
                              <Text style={styles.gcashDetailValue}>{selectedRewardDetail.gcash_name}</Text>
                            </View>
                          </View>
                        </View>
                      )}
                      
                      {/* GCash Receipt Section - Only for GCash rewards */}
                      {selectedRewardDetail.gcash_receipt && 
                       selectedRewardDetail.reward_type?.toLowerCase() === 'gcash' &&
                       (selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'claimed') && (() => {
                        // Helper function to convert relative URL to absolute URL (matching web implementation)
                        const getAbsoluteUrl = (url: string): string => {
                          if (url.startsWith('http://') || url.startsWith('https://')) {
                            return url;
                          }
                          const baseUrl = API_BASE_URL.replace(/\/$/, '').replace(/\/api$/, '');
                          return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
                        };
                        
                        const receiptUrl = getAbsoluteUrl(selectedRewardDetail.gcash_receipt);
                        
                        return (
                          <View style={styles.gcashReceiptBox}>
                            <View style={styles.gcashReceiptHeader}>
                              <Text style={styles.gcashReceiptEmoji}>🧾</Text>
                              <Text style={styles.gcashReceiptTitle}>Payment Receipt</Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.gcashReceiptImageContainer}
                              onPress={() => {
                                setReceiptImageUrl(receiptUrl);
                                setShowReceiptImageModal(true);
                              }}
                              activeOpacity={0.9}
                            >
                              <Image
                                source={{ uri: receiptUrl }}
                                style={styles.gcashReceiptImage}
                                resizeMode="contain"
                                onError={(error) => {
                                  console.error('Error loading receipt image:', error);
                                  // Try alternative URL format if first attempt fails
                                  const altUrl = selectedRewardDetail.gcash_receipt?.startsWith('/') 
                                    ? getAbsoluteUrl(selectedRewardDetail.gcash_receipt)
                                    : getAbsoluteUrl(`/${selectedRewardDetail.gcash_receipt}`);
                                  if (altUrl !== receiptUrl) {
                                    // Retry with alternative URL
                                    console.log('Retrying with alternative URL:', altUrl);
                                  }
                                }}
                              />
                            </TouchableOpacity>
                            <Text style={styles.gcashReceiptHint}>
                              Tap image to view full size
                            </Text>
                          </View>
                        );
                      })()}
                    </>
                  )}

                  {/* Voucher Code Section */}
                  {selectedRewardDetail.voucher_code && (
                    <View style={styles.voucherCodeBox}>
                      {selectedRewardDetail.status === 'claimed' ? (
                        <>
                          <View style={styles.voucherCodeHeader}>
                            <FontAwesome name="ticket" size={20} color="#0284c7" />
                            <Text style={styles.voucherCodeTitle}>Voucher Code</Text>
                          </View>
                          <View style={styles.voucherCodeDisplay}>
                            <Text style={styles.voucherCodeValue}>
                              {selectedRewardDetail.voucher_code}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.voucherCodeHeader}>
                          <FontAwesome name="ticket" size={20} color="#0284c7" />
                          <Text style={styles.voucherCodeMessage}>
                            Voucher code will be revealed once you claim this reward.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {(() => {
                    const isApproved = selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup';
                    const isClaimed = selectedRewardDetail.status === 'claimed';
                    const isMerchandise = selectedRewardDetail.reward_type?.toLowerCase().includes('merchandise') || 
                                         selectedRewardDetail.reward_type?.toLowerCase().includes('merch') ||
                                         selectedRewardDetail.reward_type?.toLowerCase().includes('product') ||
                                         selectedRewardDetail.reward_type?.toLowerCase().includes('item');
                    const isGcash = selectedRewardDetail.reward_type?.toLowerCase() === 'gcash';
                    const canClaim = isApproved && !isClaimed && !isMerchandise;

                    return canClaim ? (
                      <TouchableOpacity
                        style={styles.claimButton}
                        onPress={() => {
                          if (isGcash) {
                            // For GCash rewards, "Okay" just closes the modal (acknowledgment)
                            setShowRewardDetailModal(false);
                            setSelectedRewardDetail(null);
                          } else {
                            // For other rewards, show claim confirmation modal
                            handleClaimApprovedReward(selectedRewardDetail.request_id);
                          }
                        }}
                        disabled={claimingReward === selectedRewardDetail.request_id}
                      >
                        {claimingReward === selectedRewardDetail.request_id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <FontAwesome name="gift" size={18} color="#fff" />
                            <Text style={styles.claimButtonText}>
                              {isGcash ? 'Okay' : 'Claim Reward'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null;
                  })()}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Monthly Limit Modal */}
        <Modal
          visible={showMonthlyLimitModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowMonthlyLimitModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMonthlyLimitModal(false)}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.monthlyLimitModalContent}>
                <View style={styles.monthlyLimitModalHeader}>
                  <Text style={styles.monthlyLimitModalTitle}>Monthly Limit Reached</Text>
                  <TouchableOpacity 
                    onPress={() => setShowMonthlyLimitModal(false)}
                    style={styles.closeButtonTouchable}
                  >
                    <FontAwesome name="times" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <View style={styles.monthlyLimitModalBody}>
                  <View style={styles.monthlyLimitIconContainer}>
                    <Text style={styles.monthlyLimitIcon}>⚠️</Text>
                  </View>
                  <Text style={styles.monthlyLimitMessage}>
                    You can only request 1 reward per month. Please wait until next month to request another reward.
                  </Text>
                  <TouchableOpacity
                    style={styles.monthlyLimitButton}
                    onPress={() => setShowMonthlyLimitModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.monthlyLimitButtonText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Cancel Confirmation Modal */}
        <Modal
          visible={showCancelConfirmModal}
          animationType="fade"
          transparent={true}
          onRequestClose={handleDismissCancelConfirm}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleDismissCancelConfirm}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.confirmModalContent}>
                <View style={styles.confirmModalHeader}>
                  <Text style={styles.confirmModalTitle}>Cancel Request</Text>
                  <TouchableOpacity
                    onPress={handleDismissCancelConfirm}
                    style={styles.closeButtonTouchable}
                  >
                    <Text style={styles.closeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.confirmModalBody}>
                  <Text style={styles.confirmMessage}>
                    Are you sure you want to cancel your reward request?
                  </Text>
                  <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={handleDismissCancelConfirm}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        cancellingReward !== null && styles.modalButtonDisabled
                      ]}
                      onPress={confirmCancelReward}
                      disabled={cancellingReward !== null}
                    >
                      {cancellingReward !== null ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalButtonText}>Confirm</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Claim Confirmation Modal */}
        <Modal
          visible={showClaimConfirmModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setShowClaimConfirmModal(false);
            setPendingClaimRequest(null);
          }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowClaimConfirmModal(false);
              setPendingClaimRequest(null);
            }}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.confirmModalContent}>
                <View style={styles.confirmModalHeader}>
                  <Text style={styles.confirmModalTitle}>Claim Reward</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowClaimConfirmModal(false);
                      setPendingClaimRequest(null);
                    }}
                    style={styles.closeButtonTouchable}
                  >
                    <Text style={styles.closeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.confirmModalBody}>
                  {pendingClaimRequest && (
                    <>
                      <Text style={styles.confirmMessage}>
                        Claim "{pendingClaimRequest.name}"?
                      </Text>
                      <Text style={styles.confirmSubMessage}>
                        Points will be deducted: {pendingClaimRequest.cost} pts
                      </Text>
                      <View style={styles.modalButtonRow}>
                        <TouchableOpacity
                          style={[styles.modalButton, styles.modalButtonCancel]}
                          onPress={() => {
                            setShowClaimConfirmModal(false);
                            setPendingClaimRequest(null);
                          }}
                        >
                          <Text style={styles.modalButtonCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            claimingReward !== null && styles.modalButtonDisabled
                          ]}
                          onPress={confirmClaimReward}
                          disabled={claimingReward !== null}
                        >
                          {claimingReward !== null ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.modalButtonText}>Claim</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Confirm Request Modal */}
        <Modal
          visible={showConfirmRequestModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setShowConfirmRequestModal(false);
            setPendingRewardRequest(null);
            setGcashNumber('');
            setGcashName('');
          }}
          onShow={() => {
            console.log('Mobile: Confirm request modal is now visible');
          }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowConfirmRequestModal(false);
              setPendingRewardRequest(null);
              setGcashNumber('');
              setGcashName('');
            }}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.confirmModalContent} onStartShouldSetResponder={() => true}>
                {/* Header */}
                <View style={styles.confirmModalHeader}>
                  <View style={styles.modalTitleRow}>
                    <FontAwesome name="gift" size={20} color="#1e3a5f" />
                    <Text style={styles.confirmModalTitle}>Request Reward</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowConfirmRequestModal(false);
                      setPendingRewardRequest(null);
                      setGcashNumber('');
                      setGcashName('');
                    }}
                    style={styles.closeButtonTouchable}
                  >
                    <Text style={styles.closeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Content */}
                {pendingRewardRequest && (() => {
                  const pointsMatch = pendingRewardRequest.value?.match(/(\d+)/);
                  const pointsValue = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                  const pointsText = pointsValue === 1 ? 'point' : 'points';
                  
                  return (
                    <View style={styles.confirmModalBody}>
                      <Text style={styles.confirmMessage}>
                        You are about to redeem <Text style={styles.highlightText}>{pendingRewardRequest.name}</Text> as your reward for accumulating <Text style={styles.highlightText}>{pointsValue} {pointsText}</Text>.
                      </Text>
                      
                      {/* Warning Box - Only show for merchandise */}
                      {pendingRewardRequest.type && 
                       pendingRewardRequest.type.toLowerCase().includes('merchandise') && (
                        <View style={styles.warningBox}>
                          <Text style={styles.warningIcon}>⚠️</Text>
                          <Text style={styles.warningText}>
                            Please take note that this needs to be claimed in the CTU.
                          </Text>
                        </View>
                      )}

                      {/* GCash Input Fields - Only show for GCash rewards */}
                      {pendingRewardRequest.type && 
                       pendingRewardRequest.type.toLowerCase() === 'gcash' && (
                        <View style={styles.gcashInputContainer}>
                          {/* GCash Number Field */}
                          <View style={styles.gcashInputField}>
                            <Text style={styles.gcashLabel}>
                              GCash Number <Text style={styles.requiredAsterisk}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.gcashInput}
                              value={gcashNumber}
                              onChangeText={setGcashNumber}
                              placeholder="e.g., 09123456789"
                              placeholderTextColor="#9ca3af"
                              keyboardType="phone-pad"
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          </View>
                          {/* GCash Name Field */}
                          <View style={styles.gcashInputField}>
                            <Text style={styles.gcashLabel}>
                              GCash Account Name <Text style={styles.requiredAsterisk}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.gcashInput}
                              value={gcashName}
                              onChangeText={setGcashName}
                              placeholder="e.g., Juan Dela Cruz"
                              placeholderTextColor="#9ca3af"
                              autoCapitalize="words"
                              autoCorrect={false}
                            />
                          </View>
                          {/* GCash Verify Note */}
                          <View style={{
                            backgroundColor: '#fef9c3',
                            borderColor: '#fde68a',
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            marginTop: 2,
                            marginBottom: 10,
                          }}>
                            <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 18 }}>
                              Please double-check that the GCash number is verified and the name you entered is accurate. Once the transaction has proceeded, it is not reversible.
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Info Box */}
                      <View style={styles.infoBox}>
                        <Text style={styles.infoIcon}>ℹ️</Text>
                        <Text style={styles.infoText}>
                          Note: You can only redeem 1 reward per month.
                        </Text>
                      </View>

                      {/* Buttons */}
                      <View style={styles.modalButtonRow}>
                        <TouchableOpacity
                          style={[styles.modalButton, styles.modalButtonCancel]}
                          onPress={() => {
                            setShowConfirmRequestModal(false);
                            setPendingRewardRequest(null);
                            setGcashNumber('');
                            setGcashName('');
                          }}
                        >
                          <Text style={styles.modalButtonCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            claimingReward !== null && styles.modalButtonDisabled
                          ]}
                          onPress={confirmRequestReward}
                          disabled={claimingReward !== null}
                        >
                          {claimingReward !== null ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.modalButtonText}>Confirm Request</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Receipt Image Full Screen Modal */}
        <Modal
          visible={showReceiptImageModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setShowReceiptImageModal(false);
            setReceiptImageUrl(null);
          }}
        >
          <TouchableOpacity
            style={styles.receiptImageModalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowReceiptImageModal(false);
              setReceiptImageUrl(null);
            }}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.receiptImageModalContent}>
                <TouchableOpacity
                  style={styles.receiptImageCloseButton}
                  onPress={() => {
                    setShowReceiptImageModal(false);
                    setReceiptImageUrl(null);
                  }}
                >
                  <FontAwesome name="times" size={24} color="#fff" />
                </TouchableOpacity>
                {receiptImageUrl && (
                  <Image
                    source={{ uri: receiptImageUrl }}
                    style={styles.receiptImageFullScreen}
                    resizeMode="contain"
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the title
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  gradientCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  totalPointsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 24,
  },
  cardActionsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  cardActionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  earnPointsContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  earnPointsButtonOrange: {
    backgroundColor: '#F97316',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  earnPointsButtonBlue: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  earnPointsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  rewardsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '90%',
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  rewardDetailModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '95%',
    maxWidth: 500,
    height: SCREEN_HEIGHT * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 5,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  rewardsModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    height: SCREEN_HEIGHT * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.85,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 5,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 60,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
  },
  rewardDetailScrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  emptyScrollContent: {
    minHeight: 300,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    minHeight: 250,
    justifyContent: 'center',
  },
  emptySubtext: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  rewardCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  rewardBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rewardBadgeText: {
    fontSize: 12,
    color: '#1e3a8a',
    fontWeight: '600',
  },
  rewardValue: {
    fontSize: 16,
    color: '#1e3a8a',
    fontWeight: '600',
    marginBottom: 4,
  },
  rewardStock: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  requestButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestButtonTextDisabled: {
    color: '#9ca3af',
  },
  filterDropdownContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  filterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    width: '100%',
  },
  filterDropdownButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e3a5f',
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 1000,
  },
  filterDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'white',
  },
  filterDropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  filterDropdownItemText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '400',
  },
  filterDropdownItemTextActive: {
    color: '#1e3a5f',
    fontWeight: '600',
  },
  requestsList: {
    gap: 12,
    paddingBottom: 8,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    minHeight: 140,
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  requestCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  requestCardBody: {
    gap: 10,
  },
  requestCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  requestCardLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  requestCardValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  requestCardCost: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  swipeableContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  swipeableAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    backgroundColor: '#fee2e2',
  },
  swipeableCancelButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 100,
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginRight: 16,
  },
  swipeableCancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  swipeableContent: {
    backgroundColor: '#fff',
    position: 'relative',
  },
  swipeDetector: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestPoints: {
    fontSize: 14,
    color: '#1e3a8a',
    fontWeight: '600',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  viewButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  claimButton: {
    backgroundColor: '#1e3a5f',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsBox: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  instructionsTitle: {
    fontWeight: '600',
    color: '#1e40af',
    fontSize: 14,
    flex: 1,
  },
  instructionsText: {
    lineHeight: 22,
    color: '#1e3a8a',
    fontSize: 14,
  },
  voucherCodeBox: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  voucherCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voucherCodeTitle: {
    fontWeight: '600',
    color: '#0c4a6e',
    fontSize: 14,
  },
  voucherCodeMessage: {
    color: '#0c4a6e',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  voucherCodeDisplay: {
    marginTop: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#0284c7',
    alignItems: 'center',
    marginBottom: 12,
  },
  voucherCodeValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0284c7',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
  gcashInputContainer: {
    marginBottom: 20,
  },
  gcashInputField: {
    marginBottom: 16,
  },
  gcashLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#ef4444',
  },
  gcashInput: {
    width: '100%',
    padding: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  gcashDetailsBox: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  gcashDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  gcashDetailsTitle: {
    fontWeight: '600',
    color: '#0c4a6e',
    fontSize: 14,
  },
  gcashDetailsContent: {
    gap: 12,
  },
  gcashDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  gcashDetailLabel: {
    fontSize: 13,
    color: '#0369a1',
    fontWeight: '500',
  },
  gcashDetailValue: {
    fontSize: 14,
    color: '#0c4a6e',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  gcashReceiptBox: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  gcashReceiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  gcashReceiptEmoji: {
    fontSize: 24,
  },
  gcashReceiptTitle: {
    fontWeight: '600',
    color: '#166534',
    fontSize: 14,
  },
  gcashReceiptImageContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#86efac',
    padding: 12,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gcashReceiptImage: {
    width: '100%',
    maxHeight: 400,
    backgroundColor: '#f9fafb',
  },
  gcashReceiptHint: {
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  receiptImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptImageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  receiptImageCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptImageFullScreen: {
    width: '100%',
    height: '100%',
  },
  rewardDetailSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rewardDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  rewardDetailSection: {
    marginBottom: 20,
  },
  detailInfoBox: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  detailInfoTitle: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailInfoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  expiresBox: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  expiresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  expiresTitle: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expiresDate: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 8,
  },
  expiresWarning: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  expiresWarningText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '500',
    lineHeight: 18,
  },
  rewardDetailSectionLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  rewardDetailSectionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  detailCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: '#111827',
  },
  voucherCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a8a',
    letterSpacing: 2,
  },
  modalBody: {
    padding: 16,
  },
  modalIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmSubMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  highlightText: {
    color: '#1e3a5f',
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningIcon: {
    fontSize: 16,
    flexShrink: 0,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    fontSize: 14,
    flexShrink: 0,
    marginTop: 2,
    color: '#1e40af',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 17,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 48,
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonCancelText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 5,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e3a5f',
  },
  confirmModalBody: {
    // Content is already styled with individual components
  },
  closeButtonTouchable: {
    padding: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    fontSize: 28,
    color: '#6b7280',
    lineHeight: 28,
  },
  monthlyLimitModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '85%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  monthlyLimitModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  monthlyLimitModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  monthlyLimitModalBody: {
    padding: 24,
    alignItems: 'center',
  },
  monthlyLimitIconContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyLimitIcon: {
    fontSize: 56,
    textAlign: 'center',
  },
  monthlyLimitMessage: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  monthlyLimitButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthlyLimitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


