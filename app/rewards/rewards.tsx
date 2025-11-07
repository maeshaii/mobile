import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import {
  getInventoryItems,
  getUserPoints,
  getUserInfo,
  requestReward,
  getRewardRequests,
  claimRewardRequest,
  getEngagementPointsSettings,
  API_BASE_URL,
} from '../../services/api';
import { NotificationWebSocket } from '../../services/notificationWebSocket';

interface InventoryItem {
  id: number;
  name: string;
  type: string;
  quantity: number;
  value: string;
  created_at?: string;
  updated_at?: string;
}

interface RewardRequest {
  request_id: number;
  reward_id: number;
  reward_name: string;
  reward_type: string;
  points_cost: number;
  status: 'pending' | 'approved' | 'claimed' | 'did_not_push_through';
  requested_at: string;
  approved_at?: string;
  claimed_at?: string;
  voucher_code?: string;
  notes?: string;
  instructions?: string;
}

export default function RewardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const requestIdParam = params.requestId ? String(params.requestId) : null;
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
  const [refreshing, setRefreshing] = useState(false);
  const [showMonthlyLimitModal, setShowMonthlyLimitModal] = useState(false);
  const [showConfirmRequestModal, setShowConfirmRequestModal] = useState(false);
  const [pendingRewardRequest, setPendingRewardRequest] = useState<{id: number; name: string; value: string; type?: string} | null>(null);
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

  const fetchUserPoints = async () => {
    try {
      const user = await getUserInfo();
      setUserInfo(user); // Store user info to check account type
      const userId = user?.user_id || user?.id;
      if (userId) {
        const points = await getUserPoints(userId);
        setUserPoints(points);
        
        // Fetch points settings
        try {
          const settingsResponse = await getEngagementPointsSettings();
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
          }
        } catch (settingsError) {
          console.error('Error fetching points settings:', settingsError);
        }
      }
    } catch (error) {
      console.error('Error fetching user points:', error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      setRewardsLoading(true);
      const response = await getInventoryItems();
      if (response.success) {
        setInventoryItems(response.items || []);
      } else {
        Alert.alert('Error', response.message || 'Failed to load rewards');
      }
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to load rewards');
    } finally {
      setRewardsLoading(false);
    }
  };

  const fetchUserRewardRequests = async () => {
    try {
      const response = await getRewardRequests();
      if (response.success) {
        setUserRewardRequests(response.requests || []);
      }
    } catch (error) {
      console.error('Error fetching reward requests:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUserPoints(),
      fetchInventoryItems(),
      fetchUserRewardRequests(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
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

          notificationWs = new NotificationWebSocket(userId, API_BASE_URL, token);
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
      if (requestIdParam && userRewardRequests.length > 0) {
        const requestId = parseInt(requestIdParam);
        const rewardDetail = userRewardRequests.find(
          (req) => req.request_id === requestId
        );
        if (rewardDetail) {
          // Small delay to ensure modals are ready
          setTimeout(() => {
            setSelectedRewardDetail(rewardDetail);
            setShowRequestsModal(true);
          }, 300);
        } else {
          // If not found, still open the requests modal
          setTimeout(() => {
            setShowRequestsModal(true);
          }, 300);
        }
      }
    };

    openRewardDetailFromNotification();
  }, [requestIdParam, userRewardRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRequestReward = async (rewardId: number) => {
    if (claimingReward !== null) return;

    const reward = inventoryItems.find(item => item.id === rewardId);
    if (!reward) return;

    const pointsMatch = reward.value?.match(/(\d+)/);
    const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
    const canAfford = (userPoints?.total_points || 0) >= requiredPoints;

    if (!canAfford) {
      Alert.alert(
        'Insufficient Points',
        `You need ${requiredPoints} points but only have ${userPoints?.total_points || 0}.`
      );
      return;
    }

    if (reward.quantity <= 0) {
      Alert.alert('Out of Stock', 'This reward is out of stock.');
      return;
    }

    // Check if user has already requested a reward this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRequests = userRewardRequests.filter((req) => {
      const requestedDate = new Date(req.requested_at);
      return requestedDate >= startOfMonth;
    });

    if (monthlyRequests.length >= 1) {
      setShowMonthlyLimitModal(true);
      return;
    }

    // Show confirmation modal instead of Alert
    setPendingRewardRequest({
      id: rewardId,
      name: reward.name,
      value: reward.value,
      type: reward.type
    });
    setShowConfirmRequestModal(true);
  };

  const confirmRequestReward = async () => {
    if (!pendingRewardRequest) return;
    
    const rewardId = pendingRewardRequest.id;
    setShowConfirmRequestModal(false);
    
    try {
      setClaimingReward(rewardId);
      const response = await requestReward(rewardId);
      
      if (response.success) {
        await fetchUserPoints();
        await fetchInventoryItems();
        await fetchUserRewardRequests();
        setPendingRewardRequest(null);
      } else {
        Alert.alert('Error', response.message || 'Failed to request reward');
      }
    } catch (error: any) {
      console.error('Error requesting reward:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to request reward');
    } finally {
      setClaimingReward(null);
    }
  };

  const handleClaimApprovedReward = async (requestId: number) => {
    if (claimingReward !== null) return;

    const request = userRewardRequests.find(req => req.request_id === requestId);
    if (!request) return;

    Alert.alert(
      'Claim Reward',
      `Claim "${request.reward_name}"?\n\nPoints will be deducted: ${request.points_cost}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: async () => {
            try {
              setClaimingReward(requestId);
              const response = await claimRewardRequest(requestId);
              if (response.success) {
                Alert.alert('Success', response.message || 'Reward claimed successfully!');
                await fetchUserPoints();
                await fetchUserRewardRequests();
                setSelectedRewardDetail(null);
              } else {
                Alert.alert('Error', response.message || 'Failed to claim reward');
              }
            } catch (error: any) {
              console.error('Error claiming reward:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to claim reward');
            } finally {
              setClaimingReward(null);
            }
          },
        },
      ]
    );
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

  const getStatusDisplay = (status: string, hasExpired?: boolean) => {
    if (hasExpired) return 'Expired';
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
      case 'ready_for_pickup':
        return 'Ready';
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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Points Display */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsHeader}>
            <FontAwesome name="trophy" size={24} color="#f59e0b" />
            <Text style={styles.pointsTitle}>Your Points</Text>
          </View>
          <Text style={styles.pointsValue}>{userPoints?.total_points || 0}</Text>
          {userPoints?.rank && (
            <Text style={styles.pointsRank}>Rank #{userPoints.rank}</Text>
          )}
        </View>

        {/* Points Breakdown */}
        {userPoints?.points_breakdown && (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Points Breakdown</Text>
            
            {/* Likes */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <FontAwesome name="heart" size={16} color="#6b7280" />
                <Text style={styles.breakdownLabel}>Likes</Text>
                <Text style={styles.breakdownCount}>
                  ({userPoints.points_breakdown?.likes?.count || 0})
                </Text>
              </View>
              <Text style={styles.breakdownPoints}>
                +{(userPoints.points_breakdown?.likes?.count || 0) * pointsSettings.like}
              </Text>
            </View>

            {/* Comments */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <FontAwesome name="comment" size={16} color="#6b7280" />
                <Text style={styles.breakdownLabel}>Comments</Text>
                <Text style={styles.breakdownCount}>
                  ({userPoints.points_breakdown?.comments?.count || 0})
                </Text>
              </View>
              <Text style={styles.breakdownPoints}>
                +{(userPoints.points_breakdown?.comments?.count || 0) * pointsSettings.comment}
              </Text>
            </View>

            {/* Reposts/Shares */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <FontAwesome name="retweet" size={16} color="#6b7280" />
                <Text style={styles.breakdownLabel}>Repost</Text>
                <Text style={styles.breakdownCount}>
                  ({userPoints.points_breakdown?.shares?.count || 0})
                </Text>
              </View>
              <Text style={styles.breakdownPoints}>
                +{(userPoints.points_breakdown?.shares?.count || 0) * pointsSettings.share}
              </Text>
            </View>

            {/* Replies */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <FontAwesome name="reply" size={16} color="#6b7280" />
                <Text style={styles.breakdownLabel}>Replies</Text>
                <Text style={styles.breakdownCount}>
                  ({userPoints.points_breakdown?.replies?.count || 0})
                </Text>
              </View>
              <Text style={styles.breakdownPoints}>
                +{(userPoints.points_breakdown?.replies?.count || 0) * pointsSettings.reply}
              </Text>
            </View>

            {/* Posts */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <FontAwesome name="file-text" size={16} color="#6b7280" />
                <Text style={styles.breakdownLabel}>Posts</Text>
                <Text style={styles.breakdownCount}>
                  ({userPoints.points_breakdown?.posts?.count || 0})
                </Text>
              </View>
              <Text style={styles.breakdownPoints}>
                +{(userPoints.points_breakdown?.posts?.count || 0) * pointsSettings.post}
              </Text>
            </View>

            {/* Posts with Photos */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <FontAwesome name="camera" size={16} color="#6b7280" />
                <Text style={styles.breakdownLabel}>Posts w/ Photos</Text>
                <Text style={styles.breakdownCount}>
                  ({userPoints.points_breakdown?.posts_with_photos?.count || 0})
                </Text>
              </View>
              <Text style={styles.breakdownPoints}>
                +{(userPoints.points_breakdown?.posts_with_photos?.count || 0) * pointsSettings.post_with_photo}
              </Text>
            </View>

            {/* Tracker Form - Only show for Alumni users, not OJT */}
            {userPoints.points_breakdown?.tracker_form && 
             userInfo?.account_type?.user && 
             !userInfo?.account_type?.ojt && (
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownLeft}>
                  <FontAwesome name="clipboard" size={16} color="#6b7280" />
                  <Text style={styles.breakdownLabel}>Tracker Form</Text>
                  <Text style={styles.breakdownCount}>
                    ({userPoints.points_breakdown?.tracker_form?.count || 0})
                  </Text>
                </View>
                <Text style={styles.breakdownPoints}>
                  +{(userPoints.points_breakdown?.tracker_form?.count || 0) * pointsSettings.tracker_form}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              fetchInventoryItems();
              fetchUserRewardRequests();
              setShowRewardsModal(true);
            }}
          >
            <FontAwesome name="gift" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>View Rewards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => {
              fetchUserRewardRequests();
              setShowRequestsModal(true);
            }}
          >
            <FontAwesome name="list" size={20} color="#1e3a8a" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              My Requests ({userRewardRequests.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rewards Modal */}
        <Modal
          visible={showRewardsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowRewardsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Available Rewards</Text>
                <TouchableOpacity onPress={() => setShowRewardsModal(false)}>
                  <FontAwesome name="times" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                {rewardsLoading ? (
                  <ActivityIndicator size="large" color="#1e3a8a" />
                ) : (
                  <>
                    {(() => {
                      // Filter to only show rewards user can afford and are in stock
                      const affordableRewards = inventoryItems.filter((item) => {
                        const pointsMatch = item.value?.match(/(\d+)/);
                        const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                        const canAfford = (userPoints?.total_points || 0) >= requiredPoints;
                        return canAfford && item.quantity > 0;
                      });

                      if (affordableRewards.length === 0) {
                        return (
                          <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No rewards available that you can afford at the moment</Text>
                            <Text style={styles.emptySubtext}>
                              You currently have {userPoints?.total_points || 0} points
                            </Text>
                          </View>
                        );
                      }

                      return affordableRewards.map((item) => {
                        const pointsMatch = item.value?.match(/(\d+)/);
                        const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                        const isClaiming = claimingReward === item.id;

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
                              Stock: {item.quantity} available
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.requestButton,
                                isClaiming && styles.requestButtonDisabled,
                              ]}
                              onPress={() => handleRequestReward(item.id)}
                              disabled={isClaiming}
                            >
                              {isClaiming ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.requestButtonText}>Request Reward</Text>
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
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowRequestsModal(false);
            setSelectedRewardDetail(null);
            setRewardStatusFilter('all');
            setShowRewardFilterDropdown(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.requestsModalContent]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>My Reward Requests</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowRequestsModal(false);
                    setSelectedRewardDetail(null);
                    setRewardStatusFilter('all');
                    setShowRewardFilterDropdown(false);
                  }}
                >
                  <FontAwesome name="times" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Filter Dropdown */}
              <View style={styles.filterDropdownContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.filterLabel}>Filter by status:</Text>
                  <View style={{ position: 'relative', flex: 1 }}>
                    <TouchableOpacity
                      style={styles.filterDropdownButton}
                      onPress={() => setShowRewardFilterDropdown(!showRewardFilterDropdown)}
                    >
                      <Text style={styles.filterDropdownButtonText}>
                        {rewardStatusFilter === 'all' ? 'All' : 
                         rewardStatusFilter === 'pending' ? 'Pending' : 
                         rewardStatusFilter === 'approved' ? 'Ready' : 
                         rewardStatusFilter === 'claimed' ? 'Claimed' : 
                         'Did Not Push Through'}
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
                               filter === 'did_not_push_through' ? 'Did Not Push Through' : 
                               filter.charAt(0).toUpperCase() + filter.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <ScrollView 
                style={styles.modalScrollView}
                onScrollBeginDrag={() => setShowRewardFilterDropdown(false)}
                contentContainerStyle={filteredRequests.length === 0 ? styles.emptyScrollContent : undefined}
              >
                {filteredRequests.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No reward requests</Text>
                  </View>
                ) : (
                  filteredRequests.map((request: any) => {
                    const isApproved = request.status === 'approved' || request.status === 'ready_for_pickup';
                    const isClaimed = request.status === 'claimed';
                    const hasExpired = request.expires_at && new Date(request.expires_at) < new Date();
                    const didNotPushThrough = isApproved && !isClaimed && hasExpired;
                    const isMerchandise = request.reward_type?.toLowerCase().includes('merchandise') || 
                                         request.reward_type?.toLowerCase().includes('merch') ||
                                         request.reward_type?.toLowerCase().includes('product') ||
                                         request.reward_type?.toLowerCase().includes('item');
                    const canClaim = isApproved && !isClaimed && !isMerchandise;

                    return (
                      <TouchableOpacity
                        key={request.request_id}
                        style={[
                          styles.requestCard,
                          didNotPushThrough && { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }
                        ]}
                        onPress={() => setSelectedRewardDetail(request)}
                      >
                        <View style={styles.requestHeader}>
                          <Text style={styles.requestName}>{request.reward_name}</Text>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: getStatusColor(request.status, didNotPushThrough) },
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {getStatusDisplay(request.status, didNotPushThrough)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.requestPoints}>Cost: {request.points_cost} points</Text>
                        {request.reward_type && (
                          <Text style={styles.requestDate}>Type: {request.reward_type}</Text>
                        )}
                        <Text style={styles.requestDate}>
                          Requested: {new Date(request.requested_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                        {request.approved_at && (
                          <Text style={styles.requestDate}>
                            Approved: {new Date(request.approved_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                        )}
                        {canClaim && request.expires_at && (
                          <Text style={[
                            styles.requestDate,
                            hasExpired && { color: '#dc2626', fontWeight: '600' }
                          ]}>
                            Expires: {new Date(request.expires_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                        )}
                        {canClaim && (
                          <TouchableOpacity
                            style={styles.claimButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleClaimApprovedReward(request.request_id);
                            }}
                            disabled={claimingReward === request.request_id}
                          >
                            {claimingReward === request.request_id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.claimButtonText}>Claim Reward</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Reward Detail Modal */}
        {selectedRewardDetail && (
          <Modal
            visible={!!selectedRewardDetail}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setSelectedRewardDetail(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Reward Details</Text>
                  <TouchableOpacity onPress={() => setSelectedRewardDetail(null)}>
                    <FontAwesome name="times" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScrollView}>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Reward Name</Text>
                    <Text style={styles.detailValue}>{selectedRewardDetail.reward_name}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>{selectedRewardDetail.reward_type}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Points Cost</Text>
                    <Text style={styles.detailValue}>{selectedRewardDetail.points_cost}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(selectedRewardDetail.status, 
                          selectedRewardDetail.expires_at && 
                          new Date(selectedRewardDetail.expires_at) < new Date() &&
                          (selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup') &&
                          selectedRewardDetail.status !== 'claimed'
                        ) },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {getStatusDisplay(selectedRewardDetail.status, 
                          selectedRewardDetail.expires_at && 
                          new Date(selectedRewardDetail.expires_at) < new Date() &&
                          (selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup') &&
                          selectedRewardDetail.status !== 'claimed'
                        )}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Requested At</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedRewardDetail.requested_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  {selectedRewardDetail.approved_at && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailLabel}>Approved At</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedRewardDetail.approved_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  )}
                  {selectedRewardDetail.expires_at && (selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup') && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailLabel}>Expires At</Text>
                      <Text style={[
                        styles.detailValue,
                        new Date(selectedRewardDetail.expires_at) < new Date() && { color: '#dc2626', fontWeight: '600' }
                      ]}>
                        {new Date(selectedRewardDetail.expires_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  )}
                  {selectedRewardDetail.voucher_code && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailLabel}>Voucher Code</Text>
                      <Text style={[styles.detailValue, styles.voucherCode]}>
                        {selectedRewardDetail.voucher_code}
                      </Text>
                    </View>
                  )}
                  {selectedRewardDetail.instructions && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailLabel}>Instructions</Text>
                      <Text style={styles.detailValue}>{selectedRewardDetail.instructions}</Text>
                    </View>
                  )}
                  {selectedRewardDetail.notes && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailLabel}>Notes</Text>
                      <Text style={styles.detailValue}>{selectedRewardDetail.notes}</Text>
                    </View>
                  )}
                  {(() => {
                    const isApproved = selectedRewardDetail.status === 'approved' || selectedRewardDetail.status === 'ready_for_pickup';
                    const isClaimed = selectedRewardDetail.status === 'claimed';
                    const isMerchandise = selectedRewardDetail.reward_type?.toLowerCase().includes('merchandise') || 
                                         selectedRewardDetail.reward_type?.toLowerCase().includes('merch') ||
                                         selectedRewardDetail.reward_type?.toLowerCase().includes('product') ||
                                         selectedRewardDetail.reward_type?.toLowerCase().includes('item');
                    const canClaim = isApproved && !isClaimed && !isMerchandise;

                    return canClaim ? (
                      <TouchableOpacity
                        style={styles.claimButton}
                        onPress={() => {
                          handleClaimApprovedReward(selectedRewardDetail.request_id);
                        }}
                        disabled={claimingReward === selectedRewardDetail.request_id}
                      >
                        {claimingReward === selectedRewardDetail.request_id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.claimButtonText}>Claim Reward</Text>
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
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Monthly Limit Reached</Text>
                <TouchableOpacity onPress={() => setShowMonthlyLimitModal(false)}>
                  <FontAwesome name="times" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalIcon}>⚠️</Text>
                <Text style={styles.modalMessage}>
                  You can only request 1 reward per month. Please wait until next month to request another reward.
                </Text>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowMonthlyLimitModal(false)}
                >
                  <Text style={styles.modalButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Confirm Request Modal */}
        <Modal
          visible={showConfirmRequestModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setShowConfirmRequestModal(false);
            setPendingRewardRequest(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <FontAwesome name="gift" size={20} color="#1e3a5f" />
                  <Text style={styles.modalTitle}>Request Reward</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowConfirmRequestModal(false);
                    setPendingRewardRequest(null);
                  }}
                >
                  <FontAwesome name="times" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                {pendingRewardRequest && (() => {
                  const pointsMatch = pendingRewardRequest.value?.match(/(\d+)/);
                  const pointsValue = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                  const pointsText = pointsValue === 1 ? 'point' : 'points';
                  
                  return (
                    <View style={styles.modalBody}>
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

                      {/* Info Box */}
                      <View style={styles.infoBox}>
                        <Text style={styles.infoIcon}>ℹ️</Text>
                        <Text style={styles.infoText}>
                          Note: You can only redeem 1 reward per month.
                        </Text>
                      </View>

                      <View style={styles.modalButtonRow}>
                        <TouchableOpacity
                          style={[styles.modalButton, styles.modalButtonCancel]}
                          onPress={() => {
                            setShowConfirmRequestModal(false);
                            setPendingRewardRequest(null);
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
              </ScrollView>
            </View>
          </View>
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
  pointsCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  pointsRank: {
    fontSize: 14,
    color: '#666',
  },
  breakdownCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#174f84',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#333',
  },
  breakdownCount: {
    fontSize: 12,
    color: '#999',
  },
  breakdownPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1e3a8a',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#1e3a8a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  requestsModalContent: {
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalScrollView: {
    padding: 16,
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
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filterDropdownContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    minWidth: 180,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 100,
  },
  filterDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  filterDropdownItemActive: {
    backgroundColor: '#f3f4f6',
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
  requestCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    paddingVertical: 4,
    borderRadius: 12,
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
  claimButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    marginBottom: 20,
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
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  warningIcon: {
    fontSize: 18,
    flexShrink: 0,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    fontSize: 16,
    flexShrink: 0,
    marginTop: 2,
    color: '#1e40af',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonCancelText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
});

