/**
 * Utility functions for date formatting
 */

/**
 * Formats a date string to show relative time:
 * - "Just now" for less than 1 second
 * - "X seconds ago" for less than 1 minute
 * - "X mins ago" for less than 1 hour
 * - "X hours ago" for less than 24 hours
 * - "Yesterday" for 1 day ago
 * - Date format for older notifications
 * 
 * @param dateString - The date string to format (can be ISO string, date string, etc.)
 * @returns Formatted date string
 */
export function formatNotificationDate(dateString: string | Date): string {
  if (!dateString) {
    return '';
  }

  try {
    // Parse date string as UTC by appending 'Z' if no timezone info present
    // This fixes the issue where timestamps without timezone are interpreted as local time
    let dateStr: string;
    if (dateString instanceof Date) {
      dateStr = dateString.toISOString();
    } else {
      dateStr = String(dateString);
      // If the string doesn't end with 'Z' or have a timezone offset, treat it as UTC
      if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
        // If it's a space-separated datetime, replace space with 'T' and add 'Z'
        if (dateStr.includes(' ')) {
          dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else if (!dateStr.includes('T')) {
          // If it's just a date, add time and timezone
          dateStr = dateStr + 'T00:00:00Z';
        } else {
          // If it has 'T' but no timezone, add 'Z'
          dateStr = dateStr + 'Z';
        }
      }
    }
    
    const notificationDate = new Date(dateStr);
    const now = new Date();
    
    // Check if the date is valid
    if (isNaN(notificationDate.getTime())) {
      return String(dateString);
    }

    // Calculate difference in milliseconds
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Show relative time for recent notifications
    if (diffSeconds < 1) {
      return 'Just now';
    }
    
    if (diffSeconds < 60) {
      return `${diffSeconds} ${diffSeconds === 1 ? 'second' : 'seconds'} ago`;
    }
    
    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`;
    }
    
    if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
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

