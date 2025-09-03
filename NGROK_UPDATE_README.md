# 🚀 Ngrok URL Updater for WNY Mobile App

This directory contains scripts to help you easily update ngrok URLs in your mobile app configuration files.

## 📁 Files

- **`update-ngrok-url.js`** - Main Node.js script (cross-platform)
- **`update-ngrok.bat`** - Windows batch file (double-click to run)
- **`update-ngrok.ps1`** - PowerShell script (Windows)

## 🎯 What It Updates

The scripts will automatically update ngrok URLs in:
- `app.json` - Expo configuration (API_BASE_URL)
- `constants/Config.ts` - If you have one
- `services/api.ts` - If you have hardcoded URLs

## 🚀 How to Use

### Method 1: Interactive Mode (Recommended)
```bash
node update-ngrok-url.js
```
This will prompt you to enter the new ngrok URL.

### Method 2: Direct Update
```bash
node update-ngrok-url.js https://your-new-url.ngrok-free.app
```

### Method 3: Check Current URL
```bash
node update-ngrok-url.js --current
```

### Method 4: Show Help
```bash
node update-ngrok-url.js --help
```

### Method 5: Windows Batch File
Double-click `update-ngrok.bat` in File Explorer

### Method 6: PowerShell
Right-click `update-ngrok.ps1` → "Run with PowerShell"

## 📱 Example Workflow

1. **Start ngrok** in your backend directory:
   ```bash
   cd ../backend-wny
   ngrok http 8000
   ```

2. **Copy the new ngrok URL** (e.g., `https://abc123.ngrok-free.app`)

3. **Update your mobile app**:
   ```bash
   cd ../mobile-wny
   node update-ngrok-url.js https://abc123.ngrok-free.app
   ```

4. **Restart your Expo development server** if needed:
   ```bash
   npm start
   ```

## 🔧 Requirements

- Node.js installed
- Access to the mobile-wny directory

## 💡 Tips

- Always use HTTPS URLs for ngrok
- The script validates URL format automatically
- Your app will use the new URL immediately after update
- Remember to restart your development server if needed

## 🚨 Troubleshooting

If you get errors:
1. Make sure you're in the `mobile-wny` directory
2. Ensure Node.js is installed
3. Check that the URL starts with `http://` or `https://`
4. Use `--help` for usage information

## 📋 Current Configuration

Your current API_BASE_URL is: `https://a2ba3452de06.ngrok-free.app`

---

**Happy coding! 🎉**
