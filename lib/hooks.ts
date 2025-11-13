import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { GroupsResponse, AlertState, ScheduleEntry, ScheduleResponse } from './types';

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
}

const getLocalUserName = (): string => {
  if (typeof window === 'undefined') {
    return 'Unknown';
  }
  try {
    const stored = localStorage.getItem('user');
    if (!stored) {
      return 'Anonymous';
    }
    const parsed = JSON.parse(stored);
    const first = parsed.firstName || parsed.first_name || '';
    const last = parsed.lastName || parsed.last_name || '';
    const explicitName = parsed.name || parsed.fullName;
    const email = parsed.email;
    const combined = `${first} ${last}`.trim();
    if (explicitName && typeof explicitName === 'string' && explicitName.trim().length > 0) {
      return explicitName.trim();
    }
    if (combined.length > 0) {
      return combined;
    }
    if (email && typeof email === 'string') {
      const [localPart] = email.split('@');
      if (localPart) {
        return localPart;
      }
    }
    return 'Anonymous';
  } catch (error) {
    console.warn('Failed to parse local user for presence', error);
    return 'Anonymous';
  }
};

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

  const localUserNameRef = useRef<string>(getLocalUserName());
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const stateMapRef = useRef<Y.Map<any> | null>(null);
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
    docRef.current = doc;
    providerRef.current = provider;
    stateMapRef.current = stateMap;
    const localUserName = localUserNameRef.current;
    awareness.setLocalStateField('user', { name: localUserName });

    const updatePresenceNames = () => {
      const states = Array.from(awareness.getStates().values());
      const names = states
        .map((state: any) => state?.user?.name)
        .filter((name: any): name is string => Boolean(name && typeof name === 'string'))
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      const uniqueNames = Array.from(new Set(names));
      if (localUserName && !uniqueNames.includes(localUserName)) {
        uniqueNames.unshift(localUserName);
      }
      setPresenceNames(uniqueNames);
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
    provider.on('status', handleStatus);
    provider.on('sync', handleSync);
    awareness.on('change', updatePresenceNames);

    // Immediately hydrate entries if something is already stored locally
    handleStateChange();
    updatePresenceNames();

    provider.connect();

    // Ensure we have data even if websocket connection is delayed
    if (!stateMap.has('entries')) {
      syncFromServer();
    }

    return () => {
      stateMap.unobserve(handleStateChange);
      provider.off('status', handleStatus as any);
      provider.off('sync', handleSync as any);
      awareness.off('change', updatePresenceNames);
      awareness.setLocalState(null);
      provider.destroy();
      doc.destroy();

      docRef.current = null;
      providerRef.current = null;
      stateMapRef.current = null;
      setIsSynced(false);
      setPresenceNames([]);
    };
  }, [docName, group, syncFromServer]);

  return {
    entries,
    isSynced,
    syncFromServer,
    updateEntries,
    presenceNames,
  };
};
