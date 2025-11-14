# User Isolation Fix - Summary

## Problem Identified

When opening two different accounts (Account A and Account B) in different tabs/windows:
- Both accounts would "merge" into one
- Editing on one side made both pages show the same profile/data
- This happened because **localStorage is shared across ALL tabs** in the same browser

## Root Causes

1. **localStorage is Domain-Wide**: When Account B logs in, `localStorage.setItem('user', ...)` overwrites Account A's data in ALL tabs
2. **No Tab Isolation**: The app read user data directly from localStorage without per-tab isolation
3. **Y.js Presence Issues**: User names were stored in Y.js awareness without user_id deduplication

## Solutions Implemented

### 1. Created `lib/user-state.ts` - Tab Isolation Module
- **sessionStorage per tab**: Each tab gets unique sessionStorage key
- **localStorage sync**: Changes sync across tabs via storage events
- **Tab-specific storage**: `user_tab_{unique_id}` stored in sessionStorage
- **Cross-tab communication**: Listens to storage events to detect user changes in other tabs

### 2. Updated `lib/hooks.ts` - Y.js User Identity
- **User ID-based presence**: Uses `user_id` instead of just name for Y.js awareness
- **Deduplication**: Same user in multiple tabs shows as one presence entry
- **Fresh user data**: Gets user from `user-state` module, not from stale refs

### 3. Updated `components/Layout.tsx` - Tab-Aware User Management
- **Uses user-state module**: Replaced direct localStorage access
- **Listens to storage events**: Detects when user changes in other tabs
- **Proper cleanup**: Removes event listeners on unmount

### 4. Updated `pages/auth/login.tsx` and `pages/auth/signup.tsx`
- **Uses setUser() from user-state**: Properly stores user with tab isolation

## How It Works Now

### Tab Isolation:
1. Each tab gets unique `tab_key` stored in sessionStorage
2. User data stored as `user_tab_{tab_key}` in sessionStorage (tab-specific)
3. Also stored in localStorage as `user` (for cross-tab sync)
4. When one tab logs in/out, other tabs detect via storage events

### Y.js Presence:
1. Each user identified by `user_id` (unique per user, not per tab)
2. Same user in multiple tabs = one presence entry
3. User name displayed from user_id lookup

### API Calls:
- Added `lib/auth-middleware.ts` for token verification
- API endpoints should use `authenticateRequest()` to get user_id from token
- Database queries should filter by `user_id` to ensure data isolation

## Testing

1. **Open Tab 1**: Login as Account A
2. **Open Tab 2** (same browser): Login as Account B  
3. **Expected**: Both tabs show their respective users
4. **Edit in Tab 1**: Should only affect Account A's data
5. **Check Tab 2**: Should still show Account B's data

## Important Notes

- **localStorage is shared** - This is by design in browsers (domain-wide)
- **sessionStorage is tab-specific** - But lost when tab closes
- **Solution**: Use sessionStorage for tab isolation + localStorage for cross-tab sync
- **Y.js documents**: Already correctly scoped to `schedule-level-{level}-group-{group}`
- **API endpoints**: Should verify tokens and filter by user_id for security

## Files Modified

1. `lib/user-state.ts` - NEW: Tab isolation module
2. `lib/auth-middleware.ts` - NEW: API authentication middleware  
3. `lib/hooks.ts` - Updated: Uses user-state, Y.js presence with user_id
4. `components/Layout.tsx` - Updated: Uses user-state, listens to storage events
5. `pages/auth/login.tsx` - Updated: Uses setUser from user-state
6. `pages/auth/signup.tsx` - Updated: Uses setUser from user-state

## Next Steps (Optional Improvements)

1. **API Authentication**: Update API endpoints to use `authenticateRequest()` middleware
2. **Token Refresh**: Implement token refresh mechanism
3. **Session Expiry**: Handle expired tokens gracefully
4. **Multi-Device**: If needed, add device-specific isolation

