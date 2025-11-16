/**
 * Utility functions for date formatting
 */

/**
 * Formats a date string to show:
 * - Hours/minutes if the notification is from today
 * - Date if the notification is 24+ hours old or from tomorrow
 * 
 * @param dateString - The date string to format (can be ISO string, date string, etc.)
 * @returns Formatted date string
 */
export function formatNotificationDate(dateString: string | Date): string {
  if (!dateString) {
    return '';
  }

  try {
    const notificationDate = new Date(dateString);
    const now = new Date();
    
    // Check if the date is valid
    if (isNaN(notificationDate.getTime())) {
      return String(dateString);
    }

    // Get today's date at midnight for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const notificationDay = new Date(
      notificationDate.getFullYear(),
      notificationDate.getMonth(),
      notificationDate.getDate()
    );

    // Calculate difference in milliseconds
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // If notification is from today and less than 24 hours old, show time
    if (notificationDay.getTime() === today.getTime() && diffHours < 24) {
      // Format as hours:minutes (e.g., "2:30 PM" or "14:30")
      const hours = notificationDate.getHours();
      const minutes = notificationDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      
      // If less than 1 hour, show "X minutes ago"
      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes < 1) {
          return 'Just now';
        }
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      }
      
      // If less than 24 hours but more than 1 hour, show time
      return `${displayHours}:${displayMinutes} ${ampm}`;
    }

    // If notification is from yesterday (1 day ago), show "Yesterday"
    if (diffDays === 1) {
      return 'Yesterday';
    }

    // If notification is 24+ hours old or from a different day, show date
    // Format: "MMM DD, YYYY" (e.g., "Jan 15, 2024")
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[notificationDate.getMonth()];
    const day = notificationDate.getDate();
    const year = notificationDate.getFullYear();
    
    // If same year, don't show year
    if (notificationDate.getFullYear() === now.getFullYear()) {
      return `${month} ${day}`;
    }
    
    return `${month} ${day}, ${year}`;
  } catch (error) {
    console.error('Error formatting notification date:', error);
    return String(dateString);
  }
}

