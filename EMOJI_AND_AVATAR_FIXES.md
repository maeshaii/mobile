# Emoji Button & Avatar Display Fixes

## Issue 1: Emoji Button Crash (FontSize -66 Error)

### Problem
When users pressed the emoji button in the chat screen, the app threw an error:
```
java.lang.IllegalArgumentException: FontSize should be a positive value. Current value: -66
```

This was caused by the `react-native-emoji-selector` library having layout calculation issues when rendered in a modal.

### Solution
✅ **Wrapped the EmojiSelector in a constrained container**

**Changes Made:**
- Added `emojiSelectorWrapper` style with explicit dimensions
- Set `overflow: 'hidden'` to prevent layout issues
- Added `minHeight: 300` and `maxHeight: 50% of screen`

**Files Modified:**
- `mobile/app/messages/chatmessage.tsx` (lines 1255, 1801-1806)

### Testing
1. Open a conversation in the mobile app
2. Tap the emoji button (smile icon) next to the text input
3. The emoji picker should open smoothly without errors
4. Select an emoji - it should be inserted into the message input
5. Close the emoji picker by tapping the X or outside the modal

---

## Issue 2: Missing Avatars in Conversation List

### Problem
User profile pictures (avatars) were not displaying in the conversation list. Users saw blank spaces instead of profile pictures or fallback initials.

### Root Cause
- The `UserAvatar` component was trying to load a CTU logo as fallback, but the image path was incorrect
- No error handling for failed image loads
- No proper fallback UI when images couldn't be loaded

### Solution
✅ **Implemented robust avatar display with initials fallback**

**Changes Made:**

1. **UserAvatar Component** (`mobile/components/UserAvatar.tsx`):
   - Changed fallback from CTU logo to **user initials** (like web version)
   - Added `imageContainer` style for proper image positioning
   - Initials are calculated from firstName and lastName
   - Blue background (#174f84) with white text for initials
   - Dynamic font sizing based on avatar size

2. **CachedImage Component** (`mobile/components/CachedImage.tsx`):
   - Added error state tracking
   - Added `onError` handler to detect failed image loads
   - Gracefully handles broken image URLs
   - Logs errors for debugging

### Avatar Display Logic
```
1. If profilePic URL exists:
   → Try to load image
   → If load fails → Show initials
   
2. If no profilePic URL:
   → Show initials immediately
   
3. Initials format:
   - Single name: First letter (e.g., "John" → "J")
   - Full name: First + Last initial (e.g., "John Doe" → "JD")
   - No name: "?"
```

**Files Modified:**
- `mobile/components/UserAvatar.tsx` (lines 47-66, 72-75)
- `mobile/components/CachedImage.tsx` (lines 35-62)

### Testing Avatars

1. **Conversation List Test:**
   - Open Messages screen
   - Check if avatars are displayed for all conversations
   - Avatars should show either:
     - Profile picture if available
     - Blue circle with white initials if no picture

2. **Different Avatar States:**
   - User with profile pic: Should show the image
   - User without profile pic: Should show initials (e.g., "JD")
   - User with broken image URL: Should fallback to initials
   - Online indicator (green dot) should appear on avatars of online users

3. **Search and Filter Test:**
   - Use the search bar to filter conversations
   - Avatars should remain visible and properly sized
   - Switch between "All Messages", "Message Request", and "Online" tabs
   - Avatars should display correctly in all tabs

4. **Avatar Consistency:**
   - Avatars should be 44x44 pixels in conversation list
   - Circular shape with proper border radius
   - Clear, readable initials if no image

---

## Additional Improvements

### Error Handling
- Both components now log errors to console for debugging
- CachedImage logs: `Image load error for URI: <url>`
- Helps diagnose network or URL issues

### Performance
- Images are cached with `force-cache` strategy
- Reduces redundant network requests
- Faster loading on subsequent views

### User Experience
- Initials fallback provides immediate visual feedback
- No more blank spaces in conversation list
- Consistent with web version's fallback behavior
- Accessible and readable (high contrast white on blue)

---

## Debugging Tips

### If Emoji Picker Still Crashes:
1. Check console for "Keyboard showing" logs
2. Verify modal animation completes
3. Check if other modals (image viewer, download) work fine
4. Try reducing `columns` prop on EmojiSelector (currently 8)

### If Avatars Still Don't Show:
1. Open console and check for "Image load error" messages
2. Verify API is returning `avatar_url` in conversation list
3. Check if initials are showing (blue circles) - if yes, images are failing to load
4. Check network tab for image request status codes
5. Verify `API_BASE_URL` is correct in `mobile/services/api.ts`

### Common Issues:
- **NGROK URLs**: If using ngrok, ensure `ngrok-skip-browser-warning` is appended (CachedImage handles this)
- **CORS**: Profile picture URLs must allow cross-origin requests
- **Invalid URLs**: Check that `avatar_url` from API is a valid URL or relative path
- **Auth Tokens**: Some profile pictures may require authentication

---

## Files Changed Summary

```
mobile/app/messages/chatmessage.tsx
  ✓ Wrapped EmojiSelector in constrained container
  ✓ Added emojiSelectorWrapper style
  
mobile/components/UserAvatar.tsx
  ✓ Changed fallback from CTU logo to initials
  ✓ Added imageContainer for proper layout
  ✓ Improved error handling
  
mobile/components/CachedImage.tsx
  ✓ Added error state tracking
  ✓ Added onError handler
  ✓ Logs failed image loads
```

---

## Next Steps

### Immediate Testing:
1. Restart the mobile app completely
2. Test emoji picker in a conversation
3. Check conversation list for avatars
4. Test with different users (with/without profile pics)

### Future Enhancements:
- Add loading spinner while images load
- Add retry mechanism for failed image loads
- Cache avatars locally with AsyncStorage (see `mobile/services/profilePicCache.ts`)
- Add placeholder blurhash for smoother transitions

---

## Rollback Instructions

If issues persist, revert with:
```bash
cd mobile
git checkout HEAD -- app/messages/chatmessage.tsx
git checkout HEAD -- components/UserAvatar.tsx
git checkout HEAD -- components/CachedImage.tsx
```

---

**Status**: ✅ Fixes applied and tested (no TypeScript errors)
**Date**: 2025-11-09
**Priority**: High (P0 - Core functionality)

