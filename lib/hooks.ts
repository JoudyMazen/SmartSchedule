import { useState, useEffect } from 'react';
import { GroupsResponse, AlertState } from './types';

// Hook for fetching available groups for a level
export const useAvailableGroups = (level: number) => {
  const [groups, setGroups] = useState<number[]>([1]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGroups = async (targetLevel: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/data/groups?level=${targetLevel}`);
      const data: GroupsResponse = await response.json();
      if (data.success) {
        setGroups(data.groups);
      } else {
        setGroups([1]);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([1]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups(level);
  }, [level]);

  return { groups, isLoading, refetch: () => fetchGroups(level) };
};

// Hook for managing alerts
export const useAlert = () => {
  const [alert, setAlert] = useState<AlertState | null>(null);

  const showAlert = (type: AlertState['type'], message: string) => {
    setAlert({ type, message });
  };

  const clearAlert = () => {
    setAlert(null);
  };

  return { alert, showAlert, clearAlert };
};

// Hook for managing loading states
export const useLoading = () => {
  const [isLoading, setIsLoading] = useState(false);

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  return { isLoading, startLoading, stopLoading };
};
