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

