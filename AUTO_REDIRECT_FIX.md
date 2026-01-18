# Auto-Redirect Fix - New Chat Creation

## Problem

When creating a new project/chat workspace, the app was NOT automatically redirecting to the newly created chat. Users would need to manually click on the chat in the sidebar to view it.

## Root Cause

The redirect logic was using **old hash-based routing** (`window.location.hash = '#/agents/{id}'`), but the app uses **modern state-based routing** with **Jotai atoms**.

**Before:**
```typescript
window.location.hash = `#/agents/${data.id}`  // ❌ Old routing method
```

This didn't work because:
1. The app uses URL search parameters (`?chat=id`), not hash routing
2. The app uses Jotai atoms for state management, not manual hash updates
3. The atoms control navigation, not the other way around

## Solution

Changed the redirect to use the proper **Jotai atom** (`selectedAgentChatIdAtom`) which controls navigation state:

**After:**
```typescript
setSelectedChatId(data.id)  // ✅ Modern state-based routing
```

### How It Works Now

1. **Create new chat** via mutation
2. **On success:**
   - Update Jotai atom: `setSelectedChatId(data.id)`
   - The `AgentsContent` component listens to atom changes
   - When atom changes, it updates URL search params: `?chat=id`
   - The UI automatically displays the new chat
3. **User sees the chat immediately** ✨

## Files Changed

### `src/renderer/features/agents/main/new-chat-form.tsx`

```typescript
// Added import (already existed)
const setSelectedChatId = useSetAtom(selectedAgentChatIdAtom)

// Changed from:
window.location.hash = `#/agents/${data.id}`

// To:
setSelectedChatId(data.id)
```

## Testing

1. Click **"+ New Agent"** to create a new chat
2. Fill in the form and create the chat
3. ✅ **Auto-redirect** to the new chat immediately
4. The chat displays in the main view
5. No manual click needed!

## Navigation Flow

```
NewChatForm (create)
    ↓
tRPC mutation onSuccess
    ↓
setSelectedChatId(newChatId)  ← Updates Jotai atom
    ↓
AgentsContent listens to atom change
    ↓
Updates URL: ?chat=newChatId
    ↓
Selected chat displays in main view
```

## Related Components

### `src/renderer/features/agents/ui/agents-content.tsx`

This component watches `selectedChatId` atom and handles:
- URL synchronization
- Chat view selection
- Mobile view mode transitions

```typescript
// Watches atom changes
const [selectedChatId, setSelectedChatId] = useAtom(selectedAgentChatIdAtom)

// Updates URL when atom changes
useEffect(() => {
  const url = new URL(window.location.href)
  if (selectedChatId) {
    url.searchParams.set("chat", selectedChatId)
  }
  router.replace(url.pathname + url.search, { scroll: false })
}, [selectedChatId, ...])
```

## Benefits

1. ✅ **Automatic navigation** - No manual action needed
2. ✅ **Proper state management** - Uses Jotai atoms consistently
3. ✅ **Synced URL** - Browser URL stays in sync with navigation
4. ✅ **Mobile-friendly** - Works on mobile and desktop
5. ✅ **Type-safe** - Uses proper TypeScript atoms instead of magic strings

## Rollback

If needed, revert to line 622 in `new-chat-form.tsx`:

```typescript
window.location.hash = `#/agents/${data.id}`
```

But the new method is recommended and more reliable.

## Future Improvements

Consider applying the same fix to other mutations:
- `createSubChatMutation` - Also check if it needs auto-redirect
- Other navigation-related mutations

These should use the same Jotai atom pattern for consistency.

## Notes

- `selectedAgentChatIdAtom` is the source of truth for which chat is selected
- URL is derived from atom state, not the other way around
- This follows React best practices for state-driven UI
- The pattern works seamlessly on Electron (desktop) and web

## Status

✅ **Fixed** - New chats now auto-redirect immediately after creation
