import { useState, useEffect } from 'react';
import { formatDisplayName } from '../utils/auth';
import { getCurrentUserFromApi } from '../api';

interface UseCurrentUserReturn {
  user: {
    userId: string;
    githubUsername: string;
  } | null;
  displayName: string;
  isLoading: boolean;
}

/**
 * Hook to get current user for display (cookies-only: server reads JWT from cookie, returns public info only).
 */
export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<{
    userId: string;
    githubUsername: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentUserFromApi()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const displayName = user ? formatDisplayName(user.githubUsername) : '';

  return {
    user,
    displayName,
    isLoading,
  };
}
