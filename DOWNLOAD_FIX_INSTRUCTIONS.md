# 🔧 Download Feature - Critical Fix Instructions

## Root Cause
The download errors are happening because the Android app needs to be **rebuilt** to pick up the new `expo-media-library` permissions. Your `app.json` is correct, but the AndroidManifest.xml hasn't been regenerated yet.

## Error You're Seeing
```
Call to function 'ExpoMediaLibrary.requestPermissionsAsync' has been rejected.
→ You have requested the AUDIO permission, but it is not declared in AndroidManifest.
```

This means the app is trying to use permissions that aren't in the compiled Android manifest.

---

## Fix Instructions (Choose One Method)

### ⭐ Method 1: Clean Rebuild (RECOMMENDED)

This completely regenerates the Android folder with new permissions.

```powershell
# 1. Stop Expo
# Press Ctrl+C in your Expo terminal

# 2. Delete old Android build (if it exists)
cd mobile
Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue

# 3. Clear caches
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# 4. Regenerate native Android code
npx expo prebuild --platform android --clean

# 5. Start fresh
npx expo start -c
```

### 📱 Method 2: Direct Android Build (If Method 1 Fails)

This builds and runs directly on your device/emulator.

```powershell
cd mobile
npx expo run:android
```

This will:
- Automatically run `prebuild`
- Generate new AndroidManifest.xml with all permissions
- Build and install the app on your device
- Start the Metro bundler

---

## After Rebuild - Testing

1. **Launch the app** on your device
2. **Test downloads:**
   - Go to Messages → Open a conversation
   - Try downloading an **image** → Should save to Gallery
   - Try downloading a **video** → Should save to Gallery
   - Try downloading a **PDF** → File picker appears, choose Downloads folder
3. **Grant permissions** when Android asks (the first time)

---

## Why This Happens

- Expo reads `app.json` and generates native code (AndroidManifest.xml, Info.plist, etc.)
- When you add new plugins or permissions, you MUST regenerate this native code
- `expo-media-library` requires explicit Android permissions that weren't in your old manifest
- The JavaScript code can't use native features until the manifest is updated

---

## Verification

After rebuild, you should see:
- ✅ No permission errors in console
- ✅ "Downloaded!" alert appears
- ✅ Files appear in Gallery (images/videos) or Downloads (PDFs)
- ✅ No share sheet (direct save)

---

## If You Still Get Errors

1. Check device/emulator is running Android 10+
2. Make sure USB debugging is enabled
3. Try uninstalling the old app manually before rebuilding:
   ```powershell
   adb uninstall com.anonymous.wnymobile
   npx expo run:android
   ```
4. Check Android logs:
   ```powershell
   npx react-native log-android
   ```

Let me know if you hit any issues during the rebuild!

