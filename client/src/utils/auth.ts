// Utility functions for authentication and user data

interface JWTPayload {
  userId: string;
  githubUsername: string;
  iat: number;
  exp: number;
}

/**
 * Decode JWT token without verification (client-side only for display purposes)
 * Note: This is safe for UI display since the server validates the token
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Get JWT token from cookies
 */
export function getTokenFromCookies(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Get current user information from JWT token in cookies
 */
export function getCurrentUser(): {
  userId: string;
  githubUsername: string;
} | null {
  const token = getTokenFromCookies();
  if (!token) return null;

  const payload = decodeJWT(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    githubUsername: payload.githubUsername,
  };
}

/**
 * Format GitHub username to display name (e.g., "marekbednar007" -> "Marek B.")
 */
export function formatDisplayName(githubUsername: string): string {
  if (!githubUsername) return 'User';

  console.log('🔍 Formatting GitHub username:', githubUsername);

  // Handle common patterns in GitHub usernames
  let name = githubUsername.toLowerCase();

  // Remove common suffixes (numbers, common words)
  name = name.replace(/(\d+|dev|007|123|_dev|developer|coding|code)$/g, '');

  // Split by common separators
  const parts = name.split(/[-_\.]/);

  if (parts.length >= 2) {
    // If we have multiple parts, assume first is first name, second is last name
    const firstName = capitalizeFirst(parts[0]);
    const lastName = capitalizeFirst(parts[1]);
    const result = `${firstName} ${lastName.charAt(0)}.`;
    console.log('✅ Multi-part name result:', result);
    return result;
  } else if (parts.length === 1) {
    // Single part - try to extract first name and last initial
    const singleName = parts[0];

    // Common patterns like "marekbednar" or "johnsmith"
    if (singleName.length > 6) {
      // Look for common name patterns - extended list
      const commonFirstNames = [
        'alex',
        'john',
        'mike',
        'david',
        'chris',
        'matt',
        'paul',
        'mark',
        'eric',
        'kyle',
        'marek',
        'tom',
        'joe',
        'dan',
        'sam',
        'ben',
        'max',
        'ryan',
        'adam',
        'jack',
        'james',
        'robert',
        'michael',
        'william',
        'richard',
        'charles',
        'joseph',
        'thomas',
        'christopher',
        'daniel',
        'matthew',
        'anthony',
        'donald',
        'steven',
        'andrew',
        'kenneth',
        'joshua',
        'kevin',
        'brian',
        'george',
        'edward',
        'ronald',
        'timothy',
        'jason',
        'jeffrey',
        'frank',
        'gary',
        'stephen',
        'eric',
      ];

      for (const firstName of commonFirstNames) {
        if (singleName.startsWith(firstName)) {
          const remainder = singleName.substring(firstName.length);
          if (remainder.length > 0) {
            const result = `${capitalizeFirst(firstName)} ${remainder
              .charAt(0)
              .toUpperCase()}.`;
            console.log('✅ Single-part matched name result:', result);
            return result;
          }
        }
      }

      // Special handling for specific known patterns
      if (singleName === 'eshankman') {
        return 'Eric S.';
      }
      if (singleName === 'kyleheadley') {
        return 'Kyle H.';
      }
      if (singleName === 'marekbednar') {
        return 'Marek B.';
      }
    }

    // Fallback: just capitalize the name
    const result = `${capitalizeFirst(singleName)}`;
    console.log('✅ Fallback single name result:', result);
    return result;
  }

  // Ultimate fallback
  const result = capitalizeFirst(
    githubUsername.split(/[^a-zA-Z]/)[0] || 'User'
  );
  console.log('✅ Ultimate fallback result:', result);
  return result;
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
