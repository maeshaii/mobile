import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput } from 'react-native';
import { followUser, getUserInfo, checkFollowStatus, getDonationPosts, createDonationPost } from '../../services/api';
import UserAvatar from '../../components/UserAvatar';
import DonationPostCard from './DonationPostCard';

const donationLogo = require('../../assets/images/wny_logo.jpg');

const orgInfo = {
  name: 'Donation Page',
  profile_pic: donationLogo,
};

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  type?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  is_liked?: boolean;
  user: { user_id: number; f_name: string; l_name: string; profile_pic?: string | null };
}

interface UserProfile {
  profile_pic?: string;
  f_name?: string;
  l_name?: string;
}

export default function DonationPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'likes' | 'comments' | 'reposts' | null>(null);
  const [selectedPostStats, setSelectedPostStats] = useState<any | null>(null);
  const [showDonationCreate, setShowDonationCreate] = useState(false);
  const [donationMessage, setDonationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks < 5) return `${diffWeeks}w`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) return `${diffMonths}mo`;
      const diffYears = Math.floor(diffDays / 365);
      return `${diffYears}y`;
    } catch {
      return '';
    }
  };

  async function loadDonationPosts() {
      try {
        const userInfo = await getUserInfo();
        setUser(userInfo);
      const meId = (userInfo as any)?.id || (userInfo as any)?.user_id || null;
      setCurrentUserId(meId);
        const donationPosts = await getDonationPosts();
        console.log('Donation page - Raw donation posts:', donationPosts);
        const arr = Array.isArray(donationPosts)
          ? donationPosts
          : Array.isArray(donationPosts?.donations)
            ? donationPosts.donations
            : [];

        // Normalize DonationRequest -> PostItem used by cards
        const normalized: PostItem[] = arr.map((d: any) => {
          const imagesArray = Array.isArray(d.images)
            ? d.images.map((img: any, idx: number) => ({
                image_url: typeof img === 'string' ? img : (img.image_url || img.url || img.path),
                order: img.order ?? idx,
              }))
            : [];
          return {
            post_id: d.donation_id ?? d.post_id ?? d.id,
            post_title: d.post_title ?? undefined,
            post_content: d.description ?? d.post_content ?? '',
            post_image: d.post_image ?? (imagesArray[0]?.image_url || null),
            type: d.type ?? 'donation',
            created_at: d.created_at ?? d.donation_date ?? d.date_created ?? null,
            likes_count: d.likes_count ?? (Array.isArray(d.likes) ? d.likes.length : 0),
            comments_count: d.comments_count ?? (Array.isArray(d.comments) ? d.comments.length : 0),
            reposts_count: d.reposts_count ?? (Array.isArray(d.reposts) ? d.reposts.length : 0),
            is_liked: !!d.is_liked,
            user: d.user || { user_id: 0, f_name: 'Unknown', l_name: 'User', profile_pic: null },
          } as PostItem;
        });

        setPosts(normalized);
      } catch (e) {
        setUser(null);
        setPosts([]);
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => { loadDonationPosts(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadDonationPosts(); } finally { setRefreshing(false); }
  };

  const handleDonationSubmit = async () => {
    if (!donationMessage.trim()) {
      Alert.alert('Error', 'Please provide a description of your need');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createDonationPost({
        description: donationMessage.trim(),
        images: [] // For now, no images - can be enhanced later
      });
      
      if (response.success) {
        Alert.alert('Success', 'Your donation request has been posted!');
        setDonationMessage('');
        setShowDonationCreate(false);
        // Refresh the donation posts
        await loadDonationPosts();
      } else {
        Alert.alert('Error', response.message || 'Failed to submit donation request');
      }
    } catch (error) {
      console.error('Error creating donation request:', error);
      Alert.alert('Error', 'Failed to submit donation request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1e3a8a"]} tintColor="#1e3a8a" />}
    >
      {/* Blue Header with Back Button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBg} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Org Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image source={orgInfo.profile_pic} style={styles.profileImage} />
        </View>
      </View>

      {/* About Card */}
      <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About</Text>
          <Text style={styles.infoText}>
            Connect with your fellow alumni for mutual support. Share your needs and help others in their time of need - 
            whether it's medical expenses, therapy, emergencies, or other important causes.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>          
          </View>
        </View>

      {/* Info Cards: Donation Request and About */}
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        {/* Donation Request Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Donation Request</Text>
          <Text style={styles.infoText}>
          Support your fellow alumni by helping with their needs - 
          medical expenses, therapy, emergencies, and other important causes.
          </Text>
          <View style={styles.bulletRow}>
              <FontAwesome name="check" size={14} color="#1e3a8a" />
              <Text style={styles.bulletText}> Medical expenses</Text>
            </View>
            <View style={styles.bulletRow}>
              <FontAwesome name="check" size={14} color="#1e3a8a" />
              <Text style={styles.bulletText}>Therapy sessions</Text>
            </View>
            <View style={styles.bulletRow}>
              <FontAwesome name="check" size={14} color="#1e3a8a" />
              <Text style={styles.bulletText}>Emergency funds</Text>
            </View>
            <View style={styles.bulletRow}>
              <FontAwesome name="check" size={14} color="#1e3a8a" />
              <Text style={styles.bulletText}>Educational support</Text>
            </View>
          <TouchableOpacity
            style={styles.infoPrimaryBtn}
            onPress={() => setShowDonationCreate(true)}
          >
            <Text style={styles.infoPrimaryBtnText}>Create Donation Request</Text>
          </TouchableOpacity>
        </View>

      </View>
      {/* Start a Post */}
      <View style={styles.startPostCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <UserAvatar 
            profilePic={user?.profile_pic}
            firstName={user?.f_name}
            lastName={user?.l_name}
            size={40}
            style={styles.avatar}
          />
          <TouchableOpacity style={styles.startPostInput} onPress={() => setShowDonationCreate(true)}>
            <Text style={{ color: '#888' }}>Request help from your fellow alumni...</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Posts */}
      {loading ? null : posts.map((post) => (
        <DonationPostCard
          key={post.post_id}
          post={post}
          currentUserId={currentUserId || undefined}
          onLikeToggle={(postId, isLiked) => {
            setPosts(prev => prev.map(p => 
              p.post_id === postId 
                ? { ...p, is_liked: isLiked, likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) }
                : p
            ));
          }}
          onOpenViewer={(post, type) => {
            setSelectedPostStats(post);
            setViewerType(type);
            setViewerVisible(true);
          }}
          onEdited={(postId, newContent) => {
            setPosts(prev => prev.map(p => 
              p.post_id === postId 
                ? { ...p, post_content: newContent }
                : p
            ));
          }}
          onDeleted={(postId) => {
            setPosts(prev => prev.filter(p => p.post_id !== postId));
          }}
        />
      ))}

      {/* Likes/Reposts Viewer Modal */}
      <Modal visible={viewerVisible} transparent animationType="slide" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewerModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>
                {viewerType === 'likes' ? 'Likes' : viewerType === 'reposts' ? 'Shares' : 'Comments'}
              </Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {viewerType === 'likes' && selectedPostStats?.likes?.map((u: any, idx: number) => (
                <View key={idx} style={styles.listItemRow}>
                  <UserAvatar 
                    profilePic={u.profile_pic}
                    firstName={u.f_name}
                    lastName={u.l_name}
                    size={36}
                    style={styles.listAvatar}
                  />
                  <Text style={styles.listText}>{u.f_name} {u.l_name}</Text>
                </View>
              ))}

              {viewerType === 'reposts' && selectedPostStats?.reposts?.map((r: any) => (
                <View key={r.repost_id} style={styles.listItemRow}>
                  <UserAvatar 
                    profilePic={r.user?.profile_pic}
                    firstName={r.user?.f_name}
                    lastName={r.user?.l_name}
                    size={36}
                    style={styles.listAvatar}
                  />
                  <View>
                    <Text style={styles.listText}>{r.user?.f_name} {r.user?.l_name}</Text>
                    <Text style={styles.listSubText}>{new Date(r.repost_date).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Donation Creation Modal */}
      <Modal visible={showDonationCreate} transparent animationType="slide" onRequestClose={() => setShowDonationCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.donationModal}>
            <View style={styles.donationModalHeader}>
              <Text style={styles.donationModalTitle}>💰 Request Help</Text>
              <TouchableOpacity onPress={() => setShowDonationCreate(false)}>
                <FontAwesome name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.donationModalContent}>
              <View style={styles.donationUserInfo}>
                <UserAvatar 
                  profilePic={user?.profile_pic}
                  firstName={user?.f_name}
                  lastName={user?.l_name}
                  size={40}
                  style={styles.donationAvatar}
                />
                <View>
                  <Text style={styles.donationUserName}>{user?.f_name} {user?.l_name}</Text>
                  <Text style={styles.donationUserSubtext}>is requesting help</Text>
                </View>
              </View>

              <View style={styles.donationInputContainer}>
                <Text style={styles.donationInputLabel}>Tell us about your need:</Text>
                <TextInput
                  style={styles.donationInput}
                  placeholder="Describe your situation and how donations would help (e.g., therapy sessions, medical expenses, emergency fund, etc.)..."
                  value={donationMessage}
                  onChangeText={setDonationMessage}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.donationModalActions}>
                <TouchableOpacity 
                  style={[styles.donationButton, styles.donationCancelButton]} 
                  onPress={() => setShowDonationCreate(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.donationCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.donationButton, styles.donationSubmitButton, isSubmitting && styles.donationButtonDisabled]} 
                  onPress={handleDonationSubmit}
                  disabled={isSubmitting}
                >
                  <Text style={styles.donationSubmitButtonText}>
                    {isSubmitting ? 'Posting...' : 'Post Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 0,
  },
  headerContainer: {
    position: 'relative',
  },
  headerBg: {
    height: 160,
    backgroundColor: '#174f84',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    width: '100%',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 2,
    alignItems: 'center',
    marginTop: -30,
    paddingTop: 60,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    width: '100%',
  },
  profileImageWrapper: {
    position: 'absolute',
    top: -40,
    left: '50%',
    marginLeft: -50,
    zIndex: 2,
    borderWidth: 4,
    borderColor: '#fff',
    borderRadius: 50,
    width: 100,
    height: 100,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 50,
  },
  startPostCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  startPostInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ef',
    marginRight: 10,
  },
  listText: {
    fontSize: 14,
    color: '#1e3a8a',
    fontWeight: '600',
  },
  listSubText: {
    fontSize: 12,
    color: '#888',
  },
  // Donation Modal Styles
  donationModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  donationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  donationModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  donationModalContent: {
    padding: 20,
  },
  donationUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  donationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  donationUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  donationUserSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  donationInputContainer: {
    marginBottom: 20,
  },
  donationInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  donationInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  donationModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  donationButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  donationCancelButton: {
    backgroundColor: '#f3f4f6',
  },
  donationSubmitButton: {
    backgroundColor: '#1e3a8a',
  },
  donationButtonDisabled: {
    opacity: 0.5,
  },
  donationCancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  donationSubmitButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  // Info cards
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  infoText: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 18,
  },
  infoPrimaryBtn: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  infoPrimaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulletText: {
    color: '#4b5563',
    fontSize: 12,
  },
});
