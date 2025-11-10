# 🧪 Testing Real-Time Notifications

## Quick Test Guide

### ✅ Test 1: Basic Connection
1. Open mobile app
2. Navigate to Notifications screen
3. **Look for "Live" badge** next to "Notifications" title
4. ✅ If you see it: WebSocket connected!
5. ❌ If not: Polling fallback is working (notifications will still update every 30s)

### ✅ Test 2: Real-Time Updates
**You'll need two devices or web + mobile:**

1. **On Device 1 (mobile):** Open Notifications screen
2. **On Device 2 (web/mobile):** Perform an action that triggers notification:
   - Follow the user
   - Like a post
   - Comment on a post
   - Send a message
3. **On Device 1:** Watch for notification to appear **instantly** (no refresh needed!)
4. **Check NavBar:** Badge count should update automatically

### ✅ Test 3: Badge Counts
1. Go to Home screen (notifications in background)
2. Have someone trigger notifications for you
3. **Check bottom NavBar:**
   - Bell icon should show red badge with count
   - Count should be accurate
4. Tap Notifications → Badge should clear after viewing

### ✅ Test 4: Pull-to-Refresh
1. Open Notifications
2. Pull down to refresh
3. ✅ Should work as before
4. ✅ "Live" badge should remain (if connected)

### ✅ Test 5: App Background/Foreground
1. Open Notifications screen
2. Note the "Live" connection status
3. **Go to Home screen** (minimize app)
4. Wait 10 seconds
5. **Return to app**
6. ✅ Notifications should refresh automatically
7. ✅ "Live" badge should reappear

### ✅ Test 6: Network Loss Recovery
1. Open Notifications with "Live" badge showing
2. Turn off WiFi/data
3. ✅ "Live" badge should disappear
4. Turn WiFi/data back on
5. ✅ Should reconnect automatically
6. ✅ Notifications should update

### ✅ Test 7: Delete Functionality
1. Open Notifications
2. Swipe left on a notification
3. Tap Delete
4. ✅ Should delete and refresh list
5. ✅ Badge count should update

---

## 🔍 What to Look For

### Visual Indicators
- **"Live" Badge:** Green dot + "Live" text (when WebSocket connected)
- **NavBar Badge:** Red circle with number on bell icon
- **Smooth Updates:** No flickering or jumping
- **Loading States:** Smooth transitions

### Console Logs (for debugging)
Open React Native debugger and look for:
```
🚀 Mobile: Initializing real-time notifications...
🔌 Mobile: Auto-connect enabled, setting up WebSocket...
📡 Mobile: WebSocket status: connected
✅ Mobile: Notification WebSocket connected for user: [userId]
📊 Mobile: Fetched notifications, unread count: [count]
```

---

## ⚠️ Troubleshooting

### "Live" Badge Not Showing
**This is OK!** It means:
- WebSocket couldn't connect (backend might be down)
- Polling fallback is working instead
- Notifications still update every 30 seconds
- Everything works, just not instant

### Badge Count Incorrect
1. Pull to refresh
2. Check console logs
3. Verify backend WebSocket is running

### Notifications Not Updating
1. Check internet connection
2. Pull to refresh manually
3. Close and reopen app
4. Check console for errors

---

## 🎯 Expected Behavior

### When WebSocket Connected ✅
- ⚡ **Instant** updates (< 1 second)
- 🟢 "Live" badge visible
- 🔄 Still polls every 30s as backup

### When WebSocket Disconnected ❌
- ⏱️ Updates every **30 seconds**
- ❌ No "Live" badge
- ✅ Everything still works!

---

## 📊 Performance Benchmarks

### Good Performance
- **Connection time:** < 2 seconds
- **Update latency:** < 1 second (WebSocket) or ~30s (polling)
- **Badge update:** Instant
- **Memory usage:** < 50MB
- **Battery drain:** Negligible

### Signs of Issues
- Connection takes > 5 seconds
- Badge counts wrong
- Frequent disconnections
- High battery drain

---

## ✅ All Tests Passing?

If all tests pass, you have successfully achieved:
- ✅ Real-time notifications (WebSocket)
- ✅ Reliable fallback (Polling)
- ✅ Battery optimization
- ✅ Feature parity with web
- ✅ Professional UX

**🎉 READY FOR PRODUCTION!**


