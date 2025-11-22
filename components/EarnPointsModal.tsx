import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPointsTasks } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PointsTask {
  task_id: number;
  task_type: string;
  title: string;
  description: string;
  points: number;
  max_points?: number;
  points_display: string;
  icon_name: string;
  is_completed: boolean;
  order: number;
  progress?: {
    current: number;
    required: number;
  } | null;
}

interface EarnPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EarnPointsModal: React.FC<EarnPointsModalProps> = ({ isOpen, onClose }) => {
  const [tasks, setTasks] = useState<PointsTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      console.log('EarnPointsModal: Fetching tasks...');
      const response = await getPointsTasks();
      console.log('EarnPointsModal: Response received:', response);
      if (response.success) {
        // Tasks are already ordered by the backend (order by 'order', 'task_id')
        // But we can ensure they're sorted here as well for consistency
        const tasksList = response.tasks || [];
        console.log('EarnPointsModal: Tasks list:', tasksList.length, 'tasks');
        const sortedTasks = [...tasksList].sort((a, b) => {
          if (a.order !== b.order) {
            return a.order - b.order;
          }
          return a.task_id - b.task_id;
        });
        console.log('EarnPointsModal: Setting tasks:', sortedTasks.length);
        setTasks(sortedTasks);
      } else {
        console.error('EarnPointsModal: Failed to fetch points tasks:', response.message);
        setTasks([]);
      }
    } catch (error) {
      console.error('EarnPointsModal: Error fetching points tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string, isCompleted: boolean = false) => {
    const name = iconName.toLowerCase();
    const color = isCompleted ? '#6b7280' : '#f59e0b';
    switch (name) {
      case 'envelope':
      case 'email':
        return <FontAwesome name="envelope" size={20} color={color} />;
      case 'user':
      case 'person':
        return <FontAwesome name="user" size={20} color={color} />;
      case 'chat':
      case 'review':
        return <FontAwesome name="comment" size={20} color={color} />;
      case 'document':
      case 'post':
        return <FontAwesome name="file-text" size={20} color={color} />;
      case 'arrow-path':
      case 'share':
        return <FontAwesome name="retweet" size={20} color={color} />;
      case 'heart':
      case 'like':
        return <FontAwesome name="heart" size={20} color={color} />;
      case 'camera':
      case 'image':
        return <FontAwesome name="camera" size={20} color={color} />;
      case 'user-plus':
      case 'follow':
        return <FontAwesome name="user-plus" size={20} color={color} />;
      default:
        return <FontAwesome name="envelope" size={20} color={color} />;
    }
  };

  const removeNumbersFromTitle = (title: string): string => {
    return title.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  };

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View 
          style={styles.modalContainer} 
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        >
          {/* Header */}
          <LinearGradient
            colors={['#f97316', '#ea580c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>Complete tasks to earn points!</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Content */}
          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            bounces={true}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.loadingText}>Loading tasks...</Text>
              </View>
            ) : tasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No tasks available at the moment.</Text>
              </View>
            ) : (
              <View style={styles.tasksContainer}>
                {tasks.map((task) => (
                  <View
                    key={task.task_id}
                    style={[
                      styles.taskCard,
                      task.is_completed && styles.taskCardCompleted,
                    ]}
                  >
                    {/* Icon */}
                    <View
                      style={[
                        styles.iconContainer,
                        task.is_completed && styles.iconContainerCompleted,
                      ]}
                    >
                      {getIcon(task.icon_name, task.is_completed)}
                    </View>

                    {/* Task Info */}
                    <View style={styles.taskInfo}>
                      <View style={styles.taskHeader}>
                        <Text style={styles.taskTitle} numberOfLines={2} ellipsizeMode="tail">
                          {removeNumbersFromTitle(task.title)}
                        </Text>
                        <View
                          style={[
                            styles.pointsBadge,
                            task.is_completed && styles.pointsBadgeCompleted,
                          ]}
                        >
                          <Text style={[
                            styles.pointsBadgeText,
                            task.is_completed && styles.pointsBadgeTextCompleted,
                          ]}>
                            {task.is_completed ? '✅' : '🪙'} {task.points_display || `${task.points} Points`}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.taskDescription} numberOfLines={3} ellipsizeMode="tail">
                        {task.description}
                      </Text>
                      {task.progress && (
                        <Text style={styles.progressText}>
                          Progress: {task.progress.current}/{task.progress.required}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
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
  modalContainer: {
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
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
  },
  tasksContainer: {
    gap: 12,
    paddingBottom: 8,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  taskCardCompleted: {
    backgroundColor: '#f9fafb',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerCompleted: {
    backgroundColor: '#d1d5db',
  },
  taskInfo: {
    flex: 1,
    minWidth: 0,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  pointsBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  pointsBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  pointsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c2410c',
  },
  pointsBadgeTextCompleted: {
    color: '#047857',
  },
  taskDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
});

export default EarnPointsModal;

