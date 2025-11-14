/**
 * User State Management
 * Handles per-tab user isolation and localStorage synchronization
 */

interface User {
  user_id: number;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  displayName?: string;
  name?: string;
  fullName?: string;
}

const STORAGE_KEY = 'user';
const STORAGE_KEY_PREFIX = 'user_'; // Per-tab unique key

/**
 * Get a unique key for this browser tab/window
 */
function getTabKey(): string {
  if (typeof window === 'undefined') return 'default';
  
  // Try to get existing tab key from sessionStorage
  let tabKey = sessionStorage.getItem('tab_key');
  
  if (!tabKey) {
    // Generate unique tab key
    tabKey = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('tab_key', tabKey);
  }
  
  return tabKey;
}

/**
 * Store user data with tab isolation
 * IMPORTANT: Each tab maintains its own user independently
 */
export function setUser(user: User): void {
  if (typeof window === 'undefined') return;
  
  const tabKey = getTabKey();
  const storageKey = `${STORAGE_KEY_PREFIX}${tabKey}`;
  
  // Store in sessionStorage (tab-specific) - this is the primary storage
  sessionStorage.setItem(storageKey, JSON.stringify(user));
  
  // Also store in localStorage for persistence, but with tab-specific key
  // This allows tabs to maintain independence
  localStorage.setItem(storageKey, JSON.stringify(user));
  
  // Store a global marker for "last logged in" but don't overwrite other tabs
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  
  // Store tab key in localStorage for tracking
  localStorage.setItem(`${STORAGE_KEY}_tab`, tabKey);
  
  // Note: We don't dispatch storage events to prevent overwriting other tabs' users
  // Each tab maintains its own session independently
}

/**
 * Get user data for current tab
 * Prioritizes tab-specific storage to maintain isolation
 */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const tabKey = getTabKey();
    const storageKey = `${STORAGE_KEY_PREFIX}${tabKey}`;
    
    // First try sessionStorage (tab-specific) - this is the primary source
    const sessionUser = sessionStorage.getItem(storageKey);
    if (sessionUser) {
      return JSON.parse(sessionUser);
    }
    
    // If no sessionStorage, try localStorage with tab-specific key
    const tabSpecificLocal = localStorage.getItem(storageKey);
    if (tabSpecificLocal) {
      const user = JSON.parse(tabSpecificLocal);
      // Restore to sessionStorage for this tab
      sessionStorage.setItem(storageKey, tabSpecificLocal);
      return user;
    }
    
    // Only fallback to global localStorage if this tab has no user at all
    // This happens on first load, before any user has logged in for this tab
    const localUser = localStorage.getItem(STORAGE_KEY);
    if (localUser) {
      const user = JSON.parse(localUser);
      // Store in tab-specific storage to claim this user for this tab
      sessionStorage.setItem(storageKey, localUser);
      localStorage.setItem(storageKey, localUser);
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Clear user data for current tab
 */
export function clearUser(): void {
  if (typeof window === 'undefined') return;
  
  const tabKey = getTabKey();
  const storageKey = `${STORAGE_KEY_PREFIX}${tabKey}`;
  
  sessionStorage.removeItem(storageKey);
  sessionStorage.removeItem('tab_key');
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(`${STORAGE_KEY}_tab`);
  
  // Dispatch event
  window.dispatchEvent(new StorageEvent('storage', {
    key: STORAGE_KEY,
    newValue: null,
    storageArea: localStorage
  }));
}

/**
 * Listen for user changes from other tabs
 * IMPORTANT: This should NOT overwrite the current tab's user!
 * Only notify if the current tab doesn't have its own user set
 */
export function onUserChange(callback: (user: User | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (e: StorageEvent | Event) => {
    if (e instanceof StorageEvent && e.key === STORAGE_KEY) {
      // Check if this tab already has its own user in sessionStorage
      const tabKey = getTabKey();
      const storageKey = `${STORAGE_KEY_PREFIX}${tabKey}`;
      const currentTabUser = sessionStorage.getItem(storageKey);
      
      // Only update if current tab doesn't have its own user
      // This prevents one user's login from overwriting another user's session
      if (!currentTabUser) {
        // User changed in another tab, but this tab has no user yet
        if (e.newValue) {
          try {
            const user = JSON.parse(e.newValue);
            // Store in sessionStorage for this tab only if it doesn't have one
            sessionStorage.setItem(storageKey, e.newValue);
            callback(user);
          } catch (error) {
            console.error('Error parsing user from storage event:', error);
            callback(null);
          }
        } else {
          callback(null);
        }
      }
      // If current tab already has a user, ignore storage events from other tabs
      // This maintains tab isolation
    }
  };
  
  window.addEventListener('storage', handler);
  
  // Return cleanup function
  return () => window.removeEventListener('storage', handler);
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return '';
  
  const explicitName = user.name || user.fullName || user.displayName;
  if (explicitName) return explicitName.trim();
  
  const first = user.firstName || user.first_name || '';
  const last = user.lastName || user.last_name || '';
  const combined = `${first} ${last}`.trim();
  
  if (combined) return combined;
  
  if (user.email) {
    const [localPart] = user.email.split('@');
    return localPart || '';
  }
  
  return 'Anonymous';
}

/**
 * Get user ID for Y.js presence (unique per user, not per tab)
 */
export function getUserIdForPresence(): string {
  const user = getUser();
  if (user?.user_id) {
    return `user_${user.user_id}`;
  }
  const tabKey = getTabKey();
  return `anonymous_${tabKey}`;
}

