# 🚀 Build Custom Development Client for Real Downloads

## Why You Need This

**Expo Go has limitations:**
- ❌ Cannot add custom native permissions
- ❌ Cannot use `expo-media-library` for direct downloads
- ❌ Can only use share sheet

**Custom Development Build:**
- ✅ Direct downloads to Gallery/Downloads
- ✅ Custom native permissions
- ✅ Full control over the app
- ✅ Still uses Expo tools

---

## Step-by-Step Instructions

### 1. Install EAS CLI

```powershell
npm install -g eas-cli
```

### 2. Login to Expo Account

```powershell
eas login
```

If you don't have an account, create one at https://expo.dev

### 3. Configure EAS Build

```powershell
cd C:\capstone\mobile
eas build:configure
```

This creates an `eas.json` file.

### 4. Build Development Client (Local Build)

```powershell
eas build --profile development --platform android --local
```

This will:
- Install all native dependencies
- Generate AndroidManifest.xml with your custom permissions
- Build an APK file
- Take about 10-15 minutes

### 5. Install the APK on Your Device

After the build completes, you'll get an APK file:
```
mobile/build-XXXXXXXXXX.apk
```

Transfer it to your phone:
- Email it to yourself
- Use USB cable
- Upload to Google Drive

Install it on your device (you may need to allow "Install from unknown sources").

### 6. Start the Dev Server

```powershell
npx expo start --dev-client
```

### 7. Open Your Custom App

Open the newly installed app (NOT Expo Go) and it will connect to the dev server.

---

## Alternative: Use Android Studio (If You Have It)

If you have Android Studio installed, you can build locally:

```powershell
cd C:\capstone\mobile
npx expo run:android
```

This will:
- Auto-install Android SDK if needed
- Build and install the app
- Start the Metro bundler
- Launch the app

---

## What You'll Get

After building the custom development client:

- ✅ **Real downloads** (no share sheet)
- ✅ Files save directly to Gallery/Downloads
- ✅ `expo-media-library` works
- ✅ All custom permissions work
- ✅ Still get hot reload and dev tools
- ✅ Works exactly like Expo Go, but with your custom features

---

## Time Required

- **EAS Build (cloud):** ~10-15 minutes
- **Local build:** ~5-10 minutes (if you have Android SDK)
- **One-time setup:** ~20 minutes total

---

## After Building

Once you have the custom development client:
1. I'll re-enable `expo-media-library`
2. Update the download code for direct saves
3. You'll get the exact download experience you want

---

Let me know if you want to proceed with this!

