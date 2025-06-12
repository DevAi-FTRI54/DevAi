import { useState, useEffect } from 'react';
import { getCurrentUser, formatDisplayName } from '../utils/auth';

interface UseCurrentUserReturn {
  user: {
    userId: string;
    githubUsername: string;
  } | null;
  displayName: string;
  isLoading: boolean;
}

/**
 * Hook to get current user information and formatted display name
 */
export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<{ userId: string; githubUsername: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userInfo = getCurrentUser();
    setUser(userInfo);
    setIsLoading(false);
  }, []);

  const displayName = user ? formatDisplayName(user.githubUsername) : '';

  return {
    user,
    displayName,
    isLoading
  };
}
