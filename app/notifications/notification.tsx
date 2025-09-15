import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import NavBar from '../(tabs)/_navbar';
import { useRouter } from 'expo-router';
import { getNotifications, deleteNotifications } from '../../services/api';
import { getUserInfo } from '../../services/api';

interface NotificationItem {
    id?: number; // Add ID for deletion
    name: string;
    message: string;
    date: string;
    avatarImage?: any;
    read?: boolean;
    notif_type?: string; // Added for new logic
    subject?: string; // Added for new logic
    selected?: boolean; // Add selection state
}

const samplePic = require('../../assets/images/sample_pic.jpg');

// Fallback data in case API fails
const fallbackNotificationsData: NotificationItem[] = [
    {
        name: 'TRACKER',
        message: 'Lorem ipsum dolor sit amet. Quo asperiores enim ut veniamrepudiandae eum quisquam voluptatem',
        date: '2/20/25',
        avatarImage: samplePic,
    },
    {
        name: 'Ma-asin, Shaira Mae',
        message: 'Lorem ipsum dolor sit amet. Quo asperiores enim ut veniamrepudiandae eum quisquam voluptatem',
        date: '2/20/25',
        avatarImage: samplePic,
    },
    {
        name: 'Vaflor, Paul Vincent',
        message: 'Lorem ipsum dolor sit amet. Quo asperiores enim ut veniamrepudiandae eum quisquam voluptatem',
        date: '2/20/25',
        avatarImage: samplePic,
    },
    {
        name: 'Aboloc, Angel Khyla',
        message: 'Lorem ipsum dolor sit amet. Quo asperiores enim ut veniamrepudiandae eum quisquam voluptatem',
        date: '2/20/25',
        avatarImage: samplePic,
    },
    {
        name: 'Paquibot, Alvin',
        message: 'Lorem ipsum dolor sit amet. Quo asperiores enim ut veniamrepudiandae eum quisquam voluptatem',
        date: '2/20/25',
        avatarImage: samplePic,
    },
];

const NotificationScreen = () => {
    const [selectedFilter, setSelectedFilter] = useState<'All' | 'Unread'>('All');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
    const router = useRouter();

    // Fetch notifications from API
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const user = await getUserInfo();
                console.log('User info:', user); // Debug log
                
                if (!user) {
                    setError('User not found - please login again');
                    setNotifications(fallbackNotificationsData);
                    setLoading(false);
                    return;
                }
                
                // Check for user ID in different possible fields
                const userId = user.id || user.user_id || user.userId;
                console.log('User ID:', userId); // Debug log
                
                if (!userId) {
                    setError('User ID not found - please login again');
                    setNotifications(fallbackNotificationsData);
                    setLoading(false);
                    return;
                }
                
                const data = await getNotifications(userId);
                
                // Transform backend data to match your interface
                // Adjust this based on your actual backend response structure
                const transformedData = data.notifications ? data.notifications.map((notification: any) => {
                    // Determine avatar image based on notification type
                    let avatarImage = samplePic; // Default fallback
                    
                    if (notification.type && notification.type.toLowerCase() === 'ccict') {
                        avatarImage = require('../../assets/images/ccict_logo.jpg');
                    } else if (notification.type && ['like', 'comment', 'repost'].includes(notification.type.toLowerCase())) {
                        avatarImage = samplePic; 
                    }
                    
                    return {
                        id: notification.id, // Add ID
                        name: notification.type || notification.title || notification.name || 'CCICT',
                        message: notification.content || notification.message || 'No message',
                        date: notification.date || notification.created_at || new Date().toLocaleDateString(),
                        avatarImage: avatarImage,
                        read: notification.read || false,
                        notif_type: notification.type,
                        subject: notification.subject,
                        selected: false, // Initialize selected state
                    };
                }) : [];
                
                setNotifications(transformedData);
                setError(null);
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
                setError('Failed to load notifications');
                // Use fallback data if API fails
                setNotifications(fallbackNotificationsData);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, []);

    // Handle notification selection
    const toggleNotificationSelection = (notificationId: number) => {
        if (selectedNotifications.includes(notificationId)) {
            setSelectedNotifications(selectedNotifications.filter(id => id !== notificationId));
        } else {
            setSelectedNotifications([...selectedNotifications, notificationId]);
        }
    };

    // Handle delete notifications
    const handleDeleteNotifications = async () => {
        if (selectedNotifications.length === 0) {
            Alert.alert('No Selection', 'Please select notifications to delete');
            return;
        }

        Alert.alert(
            'Delete Notifications',
            `Are you sure you want to delete ${selectedNotifications.length} notification(s)?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteNotifications(selectedNotifications);
                            
                            // Remove deleted notifications from state
                            setNotifications(notifications.filter(
                                notification => !selectedNotifications.includes(notification.id || 0)
                            ));
                            
                            // Reset selection mode
                            setSelectionMode(false);
                            setSelectedNotifications([]);
                            
                            Alert.alert('Success', 'Notifications deleted successfully');
                        } catch (error) {
                            console.error('Error deleting notifications:', error);
                            Alert.alert('Error', 'Failed to delete notifications');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Handle delete individual notification
    const handleDeleteIndividual = async (notificationId: number, notificationName: string) => {
        Alert.alert(
            'Delete Notification',
            `Are you sure you want to delete this notification from ${notificationName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteNotifications([notificationId]);
                            
                            // Remove deleted notification from state
                            setNotifications(notifications.filter(
                                notification => notification.id !== notificationId
                            ));
                            
                            Alert.alert('Success', 'Notification deleted successfully');
                        } catch (error) {
                            console.error('Error deleting notification:', error);
                            Alert.alert('Error', 'Failed to delete notification');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Handle delete all notifications
    const handleDeleteAll = async () => {
        if (notifications.length === 0) {
            Alert.alert('No Notifications', 'There are no notifications to delete');
            return;
        }

        Alert.alert(
            'Delete All Notifications',
            `Are you sure you want to delete all ${notifications.length} notifications?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const allNotificationIds = notifications
                                .map(notification => notification.id)
                                .filter(id => id !== undefined) as number[];
                            
                            await deleteNotifications(allNotificationIds);
                            
                            // Clear all notifications from state
                            setNotifications([]);
                            
                            // Reset selection mode
                            setSelectionMode(false);
                            setSelectedNotifications([]);
                            
                            Alert.alert('Success', 'All notifications deleted successfully');
                        } catch (error) {
                            console.error('Error deleting all notifications:', error);
                            Alert.alert('Error', 'Failed to delete all notifications');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Toggle selection mode
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        if (selectionMode) {
            setSelectedNotifications([]);
        }
    };

    // Filter notifications based on selected filter
    const filteredNotifications = selectedFilter === 'All' 
        ? notifications 
        : notifications.filter(item => !item.read);

    if (loading) {
        return (
            <View style={styles.container}>
                <NavBar />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1e3a8a" />
                    <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <NavBar />
            {/* Notifications Header */}
            <View style={styles.notificationsHeader}>
                <Text style={styles.notificationsTitle}>Notifications</Text>
                <View style={styles.headerActions}>
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    {selectionMode ? (
                        <View style={styles.selectionActions}>
                            <TouchableOpacity 
                                style={styles.cancelButton} 
                                onPress={toggleSelectionMode}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.selectAllButton} 
                                onPress={() => {
                                    if (notifications.length > 0) {
                                        const allIds = notifications
                                            .map(notification => notification.id)
                                            .filter(id => id !== undefined) as number[];
                                        setSelectedNotifications(allIds);
                                    }
                                }}
                            >
                                <FontAwesome name="square-o" size={18} color="#1C4E80" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[
                                    styles.deleteButton, 
                                    selectedNotifications.length === 0 && styles.deleteButtonDisabled
                                ]} 
                                onPress={handleDeleteNotifications}
                                disabled={selectedNotifications.length === 0}
                            >
                                <Text style={styles.deleteButtonText}>
                                    Delete ({selectedNotifications.length})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.normalActions}>
                            <TouchableOpacity 
                                style={styles.editDeleteButton} 
                                onPress={toggleSelectionMode}
                            >
                                <FontAwesome name="trash" size={20} color="#333" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
            {/* Earlier Section */}
            <Text style={styles.earlier}>Earlier</Text>
            {/* Notifications List */}
            <FlatList
                data={filteredNotifications}
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.notification,
                            selectionMode && selectedNotifications.includes(item.id || 0) && styles.selectedNotification
                        ]}
                        onPress={() => {
                            if (selectionMode) {
                                // Handle selection
                                toggleNotificationSelection(item.id || 0);
                            } else {
                                // Handle navigation (existing logic)
                                const isTrackerNotif = (item.notif_type && item.notif_type.toLowerCase() === 'ccict') ||
                                                       (item.subject && item.subject.toLowerCase().includes('tracker form reminder')) ||
                                                       (item.name && (item.name.toLowerCase() === 'tracker' || item.name.toLowerCase() === 'ccict'));
                                if (isTrackerNotif) {
                                    router.push('/forms/forms');
                                }
                            }
                        }}
                        onLongPress={() => {
                            if (!selectionMode) {
                                setSelectionMode(true);
                                setSelectedNotifications([item.id || 0]);
                            }
                        }}
                    >
                        {selectionMode && (
                            <TouchableOpacity 
                                style={[
                                    styles.checkbox,
                                    selectedNotifications.includes(item.id || 0) && styles.checkboxSelected
                                ]}
                                onPress={() => toggleNotificationSelection(item.id || 0)}
                            >
                                {selectedNotifications.includes(item.id || 0) && (
                                    <FontAwesome name="check" size={12} color="#fff" />
                                )}
                            </TouchableOpacity>
                        )}
                        <Image source={item.avatarImage} style={styles.avatar} />
                        <View style={styles.messageBox}>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text style={styles.message}>{item.message}</Text>
                        </View>
                        <View style={styles.notificationActions}>
                            <Text style={styles.date}>{item.date}</Text>
                            {!selectionMode && (
                                <TouchableOpacity 
                                    style={styles.deleteIconButton}
                                    onPress={() => handleDeleteIndividual(item.id || 0, item.name)}
                                >
                                    <FontAwesome name="trash" size={16} color="#dc3545" />
                                </TouchableOpacity>
                            )}
                        </View>
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
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    topNavBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#1C4E80',
        paddingVertical: 15,
        marginTop: 30,
    },
    notificationsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingLeft: 5,
    },
    notificationsTitle: {
        fontWeight: 'bold',
        fontSize: 22,
        color: '#222',
        paddingLeft: 5,
    },
    errorText: {
        color: 'red',
        fontSize: 14,
        marginLeft: 5,
    },
    earlier: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 10,
        marginTop: 10,
        paddingHorizontal: 20,
        color: '#444',
        paddingLeft: 10,
    },
    notification: {
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
    selectedNotification: {
        backgroundColor: '#e0e0e0', 
        borderColor: '#1C4E80',
        borderWidth: 2,
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#555',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    normalActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectAllButton: {
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginRight: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 50,
        minHeight: 50,
    },
    editDeleteButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 40,
        minHeight: 40,
    },
    selectionActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cancelButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 10,
        marginRight: 1,
        paddingRight: 1,
    },
    cancelButtonText: {
        color: '#333',
        fontSize: 12,
        fontWeight: 'bold',
    },
    deleteButton: {
        backgroundColor: '#dc3545',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 10,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    deleteButtonDisabled: {
        backgroundColor: '#ccc',
        opacity: 0.7,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        backgroundColor: '#fff',
    },
    checkboxSelected: {
        backgroundColor: '#1C4E80',
        borderColor: '#1C4E80',
    },
    notificationActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
    },
    deleteIconButton: {
        marginLeft: 10,
    },
});

export default NotificationScreen; 