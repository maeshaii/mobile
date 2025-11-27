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
  likesCount?: number,
  currentUserId?: number | string,
  likedByMeOverride?: boolean
): string => {
  const numericCurrentId = currentUserId != null ? Number(currentUserId) : undefined;

  const likedByMeComputed =
    numericCurrentId != null &&
    Array.isArray(likes) &&
    likes.some((like: any) => {
      const user = (like && (like.user || like)) || {};
      const rawId = (user as any).user_id ?? (user as any).id;
      if (rawId == null) return false;
      const likeUserId = Number(rawId);
      return !Number.isNaN(likeUserId) && likeUserId === numericCurrentId;
    });

  const likedByMe = Boolean(likedByMeOverride || likedByMeComputed);

  // If no likes array, fall back to count (numeric-only), but still honor "You liked this post" when we know it's you
  if (!likes || likes.length === 0) {
    const count = likesCount || 0;
    if (count === 0) return '';
    if (count === 1 && likedByMe) return 'You liked this post';
    if (count === 1) return '1 like';
    return `${count} likes`;
  }

  const count = likes.length;

  if (count === 1) {
    if (likedByMe) {
      return 'You liked this post';
    }
    const like = likes[0];
    const user = like.user || like;
    const name = formatUserFullName({
      f_name: user.f_name,
      m_name: user.m_name,
      l_name: user.l_name,
    });
    return `${name} liked this post`;
  }

  if (count === 2) {
    const firstLike = likes[0];
    const secondLike = likes[1];
    const firstUser = firstLike.user || firstLike;
    const secondUser = secondLike.user || secondLike;

    const firstName = formatUserFullName({
      f_name: firstUser.f_name,
      m_name: firstUser.m_name,
      l_name: firstUser.l_name,
    });

    const secondName = formatUserFullName({
      f_name: secondUser.f_name,
      m_name: secondUser.m_name,
      l_name: secondUser.l_name,
    });

    return `${firstName} and ${secondName} liked this post`;
  }

  // 3+ likes: "Name and X others liked this post"
  const like = likes[0];
  const user = like.user || like;
  const name = formatUserFullName({
    f_name: user.f_name,
    m_name: user.m_name,
    l_name: user.l_name,
  });
  const othersCount = count - 1;
  return `${name} and ${othersCount} ${othersCount === 1 ? 'other' : 'others'} liked this post`;
};

