/**
 * Utility function to format user full name consistently across the app
 * Always returns full name (first + middle + last) when available
 * 
 * @param firstName - User's first name
 * @param middleName - User's middle name (optional)
 * @param lastName - User's last name
 * @param fallback - Fallback text if no name is available (default: 'User')
 * @returns Formatted full name string
 */
export const formatFullName = (
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null,
  fallback: string = 'User'
): string => {
  const first = firstName?.trim() || '';
  const middle = middleName?.trim() || '';
  const last = lastName?.trim() || '';
  
  const nameParts: string[] = [];
  
  if (first) nameParts.push(first);
  if (middle) nameParts.push(middle);
  if (last) nameParts.push(last);
  
  if (nameParts.length > 0) {
    return nameParts.join(' ');
  }
  
  return fallback;
};

/**
 * Format full name from user object (includes middle name)
 * 
 * @param user - User object with f_name/first_name, m_name/middle_name, and l_name/last_name properties
 * @param fallback - Fallback text if no name is available (default: 'User')
 * @returns Formatted full name string (First Middle Last)
 */
export const formatUserFullName = (
  user?: {
    f_name?: string | null;
    first_name?: string | null;
    m_name?: string | null;
    middle_name?: string | null;
    l_name?: string | null;
    last_name?: string | null;
  } | null,
  fallback: string = 'User'
): string => {
  if (!user) return fallback;
  
  const firstName = user.f_name || user.first_name;
  const middleName = user.m_name || user.middle_name;
  const lastName = user.l_name || user.last_name;
  
  return formatFullName(firstName, middleName, lastName, fallback);
};

/**
 * Format like count text to be concise and prevent overflow
 * - 1 like: "Name liked this"
 * - 2+ likes: "Name and X others liked this"
 * 
 * @param likes - Array of like objects with user information
 * @param likesCount - Total number of likes (fallback if likes array is not available)
 * @returns Formatted like count text
 */
export const formatLikeCountText = (
  likes?: Array<{
    user?: {
      f_name?: string | null;
      m_name?: string | null;
      l_name?: string | null;
    };
    f_name?: string | null;
    m_name?: string | null;
    l_name?: string | null;
  }> | null,
  likesCount?: number
): string => {
  // If no likes array, fall back to count
  if (!likes || likes.length === 0) {
    const count = likesCount || 0;
    if (count === 0) return '';
    if (count === 1) return '1 like';
    return `${count} likes`;
  }

  const count = likes.length;

  if (count === 1) {
    const like = likes[0];
    const user = like.user || like;
    const name = formatUserFullName({
      f_name: user.f_name,
      m_name: user.m_name,
      l_name: user.l_name,
    });
    return `${name} liked this`;
  } else {
    // For 2+ likes, always show "Name and X others liked this" format
    const like = likes[0];
    const user = like.user || like;
    const name = formatUserFullName({
      f_name: user.f_name,
      m_name: user.m_name,
      l_name: user.l_name,
    });
    const othersCount = count - 1;
    return `${name} and ${othersCount} ${othersCount === 1 ? 'other' : 'others'} liked this`;
  }
};

