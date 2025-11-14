import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { GroupsResponse, AlertState, ScheduleEntry, ScheduleResponse, Comment } from './types';
import { getUser, getUserDisplayName, getUserIdForPresence } from './user-state';

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

interface SharedScheduleState {
  entries: ScheduleEntry[];
  isSynced: boolean;
  syncFromServer: () => Promise<void>;
  updateEntries: (entries: ScheduleEntry[]) => void;
  presenceNames: string[];
  comments: Comment[];
  addComment: (message: string) => void;
}

// Removed - using getUserDisplayName from user-state.ts instead

const resolveBrowserWsUrl = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (process.env.NEXT_PUBLIC_YJS_WS_URL) {
    return process.env.NEXT_PUBLIC_YJS_WS_URL;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port =
    process.env.NEXT_PUBLIC_YJS_WS_PORT ||
    (window.location.port ? window.location.port : undefined) ||
    '1234';

  return `${protocol}//${host}${port ? `:${port}` : ''}`;
};

const getYjsUrl = () => {
  const browserUrl = resolveBrowserWsUrl();
  if (browserUrl) {
    return browserUrl;
  }
  return process.env.NEXT_PUBLIC_YJS_WS_URL || process.env.YJS_WS_URL || 'ws://localhost:1234';
};

const normalizeEntries = (entries: any[], group: number): ScheduleEntry[] => {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.map((entry) => ({
    ...entry,
    group_num: entry.group_num ?? group,
  }));
};

export const useSharedSchedule = (level: number, group: number): SharedScheduleState => {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [presenceNames, setPresenceNames] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const stateMapRef = useRef<Y.Map<any> | null>(null);
  const commentsArrayRef = useRef<Y.Array<Comment> | null>(null);
  const loadingFromServerRef = useRef(false);

  const docName = `schedule-level-${level}-group-${group}`;

  const updateEntries = useCallback(
    (nextEntries: ScheduleEntry[]) => {
      const doc = docRef.current;
      const stateMap = stateMapRef.current;
      if (!doc || !stateMap) return;

      doc.transact(() => {
        stateMap.set('entries', nextEntries);
        stateMap.set('lastUpdatedAt', Date.now());
      });
    },
    []
  );

  const syncFromServer = useCallback(async () => {
    if (loadingFromServerRef.current) {
      return;
    }

    loadingFromServerRef.current = true;
    try {
      const response = await fetch(`/api/data/schedule?level=${level}&group=${group}`);
      const data: ScheduleResponse = await response.json();

      if (data.success && Array.isArray(data.entries)) {
        updateEntries(normalizeEntries(data.entries, group));
      } else {
        updateEntries([]);
      }
    } catch (error) {
      console.error('Failed to sync schedule from server:', error);
    } finally {
      loadingFromServerRef.current = false;
    }
  }, [group, level, updateEntries]);

  useEffect(() => {
    const doc = new Y.Doc();
    const wsUrl = getYjsUrl();
    console.info('[yjs] initializing provider', { docName, wsUrl });

    const provider = new WebsocketProvider(wsUrl, docName, doc, {
      connect: false,
    });
    const awareness = provider.awareness;

    const stateMap = doc.getMap<any>('state');
    const commentsArray = doc.getArray<Comment>('comments');
    docRef.current = doc;
    providerRef.current = provider;
    stateMapRef.current = stateMap;
    commentsArrayRef.current = commentsArray;
    
    // Use user_id-based identity for Y.js presence to avoid conflicts
    // Get fresh user data each time (not from ref) to handle tab changes
    const getUserForPresence = () => {
      const currentUser = getUser();
      const currentUserId = getUserIdForPresence();
      const currentUserName = currentUser ? getUserDisplayName(currentUser) : 'Anonymous';
      return { user: currentUser, userId: currentUserId, userName: currentUserName };
    };
    
    const { user, userId, userName } = getUserForPresence();
    
    // Store both user_id (unique) and name (display) in awareness
    awareness.setLocalStateField('user', { 
      id: userId,
      name: userName,
      user_id: user?.user_id || null
    });

    const updatePresenceNames = () => {
      const states = Array.from(awareness.getStates().values());
      // Use user_id to deduplicate (same user in multiple tabs = one entry)
      const userMap = new Map<string, string>();
      
      states.forEach((state: any) => {
        const userId = state?.user?.id || state?.user?.user_id;
        const userName = state?.user?.name;
        
        if (userId && userName && typeof userName === 'string') {
          const trimmed = userName.trim();
          if (trimmed.length > 0) {
            // Use user_id as key to avoid duplicates
            if (!userMap.has(userId)) {
              userMap.set(userId, trimmed);
            }
          }
        }
      });
      
      const uniqueNames = Array.from(userMap.values());
      // Add current user if not already in list
      const currentUser = getUser();
      const currentUserId = getUserIdForPresence();
      const currentUserName = currentUser ? getUserDisplayName(currentUser) : 'Anonymous';
      if (currentUserName && !userMap.has(currentUserId)) {
        uniqueNames.unshift(currentUserName);
      }
      
      setPresenceNames(uniqueNames);
    };

    const handleCommentsChange = () => {
      const commentsData = commentsArray.toArray();
      // Filter comments for this level and group, sort by createdAt descending (newest first)
      const filteredComments = commentsData
        .filter((c) => c.level === level && c.group === group)
        .sort((a, b) => b.createdAt - a.createdAt);
      setComments(filteredComments);
    };

    const handleStateChange = () => {
      const currentEntries = stateMap.get('entries');
      setEntries(Array.isArray(currentEntries) ? normalizeEntries(currentEntries, group) : []);
    };

    const handleStatus = (event: { status: 'connected' | 'disconnected' }) => {
      console.info('[yjs] status change', { docName, status: event.status });
      setIsSynced(event.status === 'connected');
      if (event.status === 'connected' && !stateMap.has('entries')) {
        // Only fetch from server if this document has not been seeded yet
        syncFromServer();
      }
      updatePresenceNames();
    };

    const handleSync = (isSyncedFlag: boolean) => {
      console.info('[yjs] sync event', { docName, synced: isSyncedFlag });
    };

    stateMap.observe(handleStateChange);
    commentsArray.observe(handleCommentsChange);
    provider.on('status', handleStatus);
    provider.on('sync', handleSync);
    awareness.on('change', updatePresenceNames);

    // Immediately hydrate entries if something is already stored locally
    handleStateChange();
    handleCommentsChange();
    updatePresenceNames();

    provider.connect();

    // Ensure we have data even if websocket connection is delayed
    if (!stateMap.has('entries')) {
      syncFromServer();
    }

    return () => {
      stateMap.unobserve(handleStateChange);
      commentsArray.unobserve(handleCommentsChange);
      provider.off('status', handleStatus as any);
      provider.off('sync', handleSync as any);
      awareness.off('change', updatePresenceNames);
      awareness.setLocalState(null);
      provider.destroy();
      doc.destroy();

      docRef.current = null;
      providerRef.current = null;
      stateMapRef.current = null;
      commentsArrayRef.current = null;
      setIsSynced(false);
      setPresenceNames([]);
      setComments([]);
    };
  }, [docName, group, level, syncFromServer]);

  const addComment = useCallback(
    (message: string) => {
      const commentsArray = commentsArrayRef.current;
      if (!commentsArray || !message.trim() || !commentsArray.doc) return;

      const currentUser = getUser();
      const currentUserName = currentUser ? getUserDisplayName(currentUser) : 'Anonymous';
      const currentUserRole = currentUser?.role || 'User';
      
      // Format role for display (e.g., "scheduling_committee" -> "Scheduling Committee")
      const formattedRole = currentUserRole
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const newComment: Comment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        level,
        group,
        message: message.trim(),
        authorName: currentUserName,
        authorRole: formattedRole,
        createdAt: Date.now(),
      };

      commentsArray.doc.transact(() => {
        commentsArray.push([newComment]);
      });
    },
    [level, group]
  );

  return {
    entries,
    isSynced,
    syncFromServer,
    updateEntries,
    presenceNames,
    comments,
    addComment,
  };
};
