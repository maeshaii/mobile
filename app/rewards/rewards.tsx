import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  getInventoryItems,
  getUserPoints,
  getUserInfo,
  requestReward,
  getRewardRequests,
  claimRewardRequest,
} from '../../services/api';

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
  const [selectedRewardDetail, setSelectedRewardDetail] = useState<RewardRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserPoints = async () => {
    try {
      const user = await getUserInfo();
      setUserInfo(user); // Store user info to check account type
      const userId = user?.user_id || user?.id;
      if (userId) {
        const points = await getUserPoints(userId);
        setUserPoints(points);
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

    const isVoucher = reward.type?.toLowerCase().includes('voucher') ||
      reward.type?.toLowerCase().includes('gift card') ||
      reward.type?.toLowerCase().includes('coupon');
    const isMerchandise = reward.type?.toLowerCase().includes('merchandise') ||
      reward.type?.toLowerCase().includes('merch') ||
      reward.type?.toLowerCase().includes('product') ||
      reward.type?.toLowerCase().includes('item');

    const confirmMessage = isVoucher
      ? 'Please expect a reply from us regarding your reward request.'
      : isMerchandise
        ? 'Please note that this reward must be claimed in person at the CTU office.'
        : 'Your reward request has been submitted and is pending approval.';

    Alert.alert(
      'Request Reward',
      `Request "${reward.name}" for ${reward.value}?\n\n${confirmMessage}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            try {
              setClaimingReward(rewardId);
              const response = await requestReward(rewardId);
              if (response.success) {
                Alert.alert('Success', response.message || 'Reward requested successfully!');
                await fetchUserPoints();
                await fetchInventoryItems();
                await fetchUserRewardRequests();
              } else {
                Alert.alert('Error', response.message || 'Failed to request reward');
              }
            } catch (error: any) {
              console.error('Error requesting reward:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to request reward');
            } finally {
              setClaimingReward(null);
            }
          },
        },
      ]
    );
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'approved':
        return '#10b981';
      case 'claimed':
        return '#3b82f6';
      case 'did_not_push_through':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const filteredRequests = rewardStatusFilter === 'all'
    ? userRewardRequests
    : userRewardRequests.filter(req => req.status === rewardStatusFilter);

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
                +{userPoints.points_breakdown?.likes?.points || 0}
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
                +{userPoints.points_breakdown?.comments?.points || 0}
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
                +{userPoints.points_breakdown?.shares?.points || 0}
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
                +{userPoints.points_breakdown?.replies?.points || 0}
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
                +{userPoints.points_breakdown?.posts?.points || 0}
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
                +{userPoints.points_breakdown?.posts_with_photos?.points || 0}
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
                  +{userPoints.points_breakdown?.tracker_form?.points || 0}
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
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>My Reward Requests</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowRequestsModal(false);
                    setSelectedRewardDetail(null);
                    setRewardStatusFilter('all');
                  }}
                >
                  <FontAwesome name="times" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Filter Buttons */}
              <View style={styles.filterContainer}>
                {(['all', 'pending', 'approved', 'claimed', 'did_not_push_through'] as const).map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterButton,
                      rewardStatusFilter === filter && styles.filterButtonActive,
                    ]}
                    onPress={() => setRewardStatusFilter(filter)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        rewardStatusFilter === filter && styles.filterButtonTextActive,
                      ]}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1).replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={styles.modalScrollView}>
                {filteredRequests.length === 0 ? (
                  <Text style={styles.emptyText}>No reward requests</Text>
                ) : (
                  filteredRequests.map((request) => (
                    <TouchableOpacity
                      key={request.request_id}
                      style={styles.requestCard}
                      onPress={() => setSelectedRewardDetail(request)}
                    >
                      <View style={styles.requestHeader}>
                        <Text style={styles.requestName}>{request.reward_name}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(request.status) },
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1).replace(/_/g, ' ')}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.requestPoints}>Cost: {request.points_cost} points</Text>
                      <Text style={styles.requestDate}>
                        Requested: {new Date(request.requested_at).toLocaleDateString()}
                      </Text>
                      {request.status === 'approved' && (
                        <TouchableOpacity
                          style={styles.claimButton}
                          onPress={() => handleClaimApprovedReward(request.request_id)}
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
                  ))
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
                        { backgroundColor: getStatusColor(selectedRewardDetail.status) },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {selectedRewardDetail.status.charAt(0).toUpperCase() +
                          selectedRewardDetail.status.slice(1).replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Requested At</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedRewardDetail.requested_at).toLocaleString()}
                    </Text>
                  </View>
                  {selectedRewardDetail.approved_at && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailLabel}>Approved At</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedRewardDetail.approved_at).toLocaleString()}
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
                  {selectedRewardDetail.status === 'approved' && (
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
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
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
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#1e3a8a',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
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
});

