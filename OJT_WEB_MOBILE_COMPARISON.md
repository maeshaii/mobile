# OJT Features: Web vs Mobile Comparison

## Overview
This document compares the OJT (On-the-Job Training) account features available in the web frontend versus the mobile application.

---

## Dashboard Features

### Web OJT Dashboard (`UnifiedDashboard.tsx`)
- ✅ **Unified Dashboard**: Uses same dashboard component as alumni (`UnifiedDashboard`)
- ✅ **Feed Display**: Shows posts, reposts from followed users, admin, and PESO
- ✅ **Profile Card**: Displays user name, profile picture, university
- ✅ **Quick Links**: Shows quick access links (only for alumni, not OJT)
- ✅ **Post Creation**: "Start a post" button
- ✅ **Post Interactions**: Like, comment, repost functionality
- ✅ **Image Viewer**: Full-screen image viewing
- ✅ **Donation Filtering**: Donations are filtered out from feed for OJT users
- ✅ **Suggested Users**: "People You May Know" suggestions
- ✅ **Tracker Reminder**: Only shown for alumni users (not OJT)
- ❌ **No Forum Quick Link**: Forum link not shown for OJT users
- ❌ **No Donation Quick Link**: Donation link not shown for OJT users

### Mobile OJT Dashboard (`ojt/ojtpage.tsx`)
- ✅ **OJT-Specific Dashboard**: Separate dashboard page for OJT users
- ✅ **Feed Display**: Shows posts, reposts, and donation posts
- ✅ **Post Creation**: "Start a post" button
- ✅ **Post Interactions**: Like, comment, repost functionality
- ✅ **People You May Know**: Suggestion card appears in feed
- ✅ **Pull to Refresh**: Refresh functionality
- ❌ **No Profile Card**: No quick profile display on dashboard
- ❌ **No Quick Links**: No quick access links
- ❌ **No Tracker Reminder**: No tracker form access

**Key Difference**: Web uses unified dashboard with profile card and quick links (hidden for OJT), while mobile has a separate simplified OJT dashboard.

---

## Settings Features

### Web OJT Settings (`Settings.tsx`)
- ✅ **Personal Details Section**:
  - First Name, Last Name, Middle Name
  - Civil Status (dropdown)
  - Contact Number
  - Email
  - Address
  - Social Media Link
  - Home Address
  - **Full editing capability**
- ✅ **Employment Details Section** (OJT-specific):
  - Company (read-only)
  - Company Address (read-only)
  - Company Email (read-only)
  - Company Contact (read-only)
  - Contact Person Name (read-only)
  - Contact Person Position (read-only)
  - Start Date (read-only)
  - **View-only mode** - OJT employment data cannot be edited
- ✅ **Change Password Section**:
  - Current password
  - New password
  - Confirm password
  - Password validation (16+ chars, uppercase, lowercase, number, special char)
  - Password visibility toggle
  - **Full password management**

### Mobile OJT Settings (`ojt/ojtsettings.tsx`)
- ❌ **Not Implemented**: Currently just a placeholder page
- ❌ **No Personal Details**: No settings form available
- ❌ **No Employment Details**: No employment information management
- ❌ **No Password Change**: No password management

**Key Difference**: Web has full settings implementation with view-only employment data, while mobile has no settings implementation.

---

## Profile Features

### Web OJT Profile (`Profile.tsx`)
- ✅ **Full Profile Display**:
  - Profile picture with edit option
  - Name and username
  - Bio
  - Social media link
  - Email address
  - Followers/Following counts (clickable)
- ✅ **Profile Editing**:
  - Bio editing
  - Profile picture upload (gallery)
  - Social media link editing
  - Email editing
- ✅ **Follow/Unfollow**: For viewing other users' profiles
- ✅ **Message Button**: Direct messaging to other users
- ✅ **Posts Display**: Shows all user's posts and reposts
- ✅ **Post Interactions**: Like, comment, repost on profile posts
- ✅ **Viewer Modals**: View likes and reposts for posts
- ✅ **Engagement Points**: Shows engagement points (for Alumni and OJT)
- ✅ **Rewards Access**: Access to rewards system
- ✅ **Employment Data**: Shows employment information
- ❌ **No Tracker Form**: Tracker form not shown for OJT users

### Mobile OJT Profile (`ojt/ojtprofile.tsx`)
- ❌ **Not Implemented**: Currently just a placeholder page
- ❌ **No Profile Display**: No profile information shown
- ❌ **No Profile Editing**: No editing capabilities
- ❌ **No Follow/Message**: No social features
- ❌ **No Posts Display**: No posts shown
- ❌ **No Engagement Points**: No points system

**Key Difference**: Web has full profile implementation with all features, while mobile has no profile implementation.

---

## Forum Features

### Web OJT Forum
- ❌ **No Access**: Forum route is restricted to `['user']` role only
- ❌ **Not Available**: OJT users cannot access `/forum` page
- ❌ **No Forum Quick Link**: Forum link not shown in dashboard for OJT users

### Mobile OJT Forum (`ojt/ojtforum.tsx`)
- ✅ **OJT-Specific Forum**: Separate forum page for OJT users
- ✅ **Post Viewing**: View forum posts
- ✅ **Comment Functionality**: Add comments to posts
- ✅ **Interactions**: Like, repost forum posts
- ✅ **Refresh**: Pull to refresh functionality
- ✅ **Comment Modal**: Modal for adding comments

**Key Difference**: Web blocks OJT access to forum, while mobile has a dedicated OJT forum page.

---

## Donation Features

### Web OJT Donation
- ❌ **No Access**: Donation route is restricted to `['user']` role only
- ❌ **Not Available**: OJT users cannot access `/donation` page
- ❌ **No Donation Quick Link**: Donation link not shown in dashboard for OJT users
- ❌ **Donation Filtering**: Donations are filtered out from feed for OJT users

### Mobile OJT Donation (`ojt/ojtdonation.tsx`)
- ✅ **OJT-Specific Donation**: Separate donation page for OJT users
- ✅ **Post Viewing**: View donation posts
- ✅ **Post Creation**: Create donation requests with:
  - Title
  - Content with mentions
  - Image upload
- ✅ **Interactions**: Like, repost donation posts
- ✅ **Refresh**: Pull to refresh functionality
- ✅ **Create Modal**: Modal for creating donation posts

**Key Difference**: Web blocks OJT access to donation page and filters donations from feed, while mobile has a dedicated OJT donation page.

---

## Tracker Form Features

### Web OJT Tracker Form
- ❌ **No Access**: Tracker route is restricted to `['user']` role only
- ❌ **Not Available**: OJT users cannot access `/tracker` page
- ❌ **No Tracker Reminder**: Tracker reminder modal not shown for OJT users

### Mobile OJT Tracker Form
- ❌ **No Access**: OJT users cannot access tracker form
- ❌ **Not Available**: Tracker form is alumni-exclusive feature
- ❌ **No Tracker Reminder**: Tracker reminder modal not shown for OJT users

**Key Difference**: Both web and mobile block OJT access to tracker form (alumni-exclusive).

---

## Navigation/Menu Features

### Web OJT Navigation (`UnifiedDashboard.tsx`)
- ✅ **Profile Card**: Clickable profile card in sidebar
- ✅ **Quick Links**: Only shown for alumni (hidden for OJT)
- ✅ **Top Navigation**: AlumniTopBar with navigation options
- ❌ **No Forum Link**: Forum link not available
- ❌ **No Donation Link**: Donation link not available

### Mobile OJT Navigation (`profiletab.tsx`)
- ✅ **Menu Access**: Full menu with filtered items
- ✅ **Menu Items**:
  - Rewards
  - CCICT
  - PESO
  - Settings
  - Log out
- ❌ **CCICT Forum Hidden**: Forum menu item filtered out for OJT
- ❌ **Donation Hidden**: Donation menu item filtered out for OJT

**Key Difference**: Web hides quick links in dashboard, while mobile filters menu items in profile tab.

---

## Search Features

### Web OJT Search
- ✅ **Search Functionality**: Can search for users
- ✅ **User Profiles**: Click to view user profiles
- ⚠️ **Same as Alumni**: Uses same search functionality as alumni

### Mobile OJT Search (`search/search.tsx`)
- ✅ **Search Alumni**: Can search for alumni users
- ✅ **Search OJT**: Can search for other OJT users
- ✅ **Recent Searches**: Shows recent search history
- ✅ **User Profiles**: Click to view user profiles
- ⚠️ **Same as Alumni**: Uses same search page as alumni

**Key Difference**: Both web and mobile have similar search functionality for OJT users.

---

## Messaging Features

### Web OJT Messaging
- ✅ **Full Access**: Messaging route available to `['user', 'ojt', 'admin', 'peso', 'coordinator']`
- ✅ **Direct Messaging**: Can message other users
- ✅ **Conversations**: View and manage conversations

### Mobile OJT Messaging
- ✅ **Full Access**: Messaging functionality available
- ✅ **Direct Messaging**: Can message other users
- ✅ **Conversations**: View and manage conversations

**Key Difference**: Both web and mobile have full messaging access for OJT users.

---

## Notifications Features

### Web OJT Notifications
- ✅ **Full Access**: Notifications route available to `['user', 'ojt']`
- ✅ **Real-time Updates**: WebSocket notifications
- ✅ **Notification Types**: All notification types supported

### Mobile OJT Notifications
- ✅ **Full Access**: Notifications functionality available
- ✅ **Real-time Updates**: WebSocket notifications
- ✅ **Notification Types**: All notification types supported

**Key Difference**: Both web and mobile have full notifications access for OJT users.

---

## Rewards/Engagement Points Features

### Web OJT Rewards
- ✅ **Engagement Points**: Shows engagement points on profile
- ✅ **Points Breakdown**: Shows points breakdown
- ✅ **Rewards Access**: Can access rewards system
- ✅ **Reward Requests**: Can request rewards
- ✅ **Reward Claims**: Can claim approved rewards

### Mobile OJT Rewards
- ✅ **Rewards Access**: Can access rewards page
- ⚠️ **Implementation**: Similar to alumni rewards

**Key Difference**: Both web and mobile have rewards access, but web shows more detailed points information.

---

## Key Differences Summary

### Web-Exclusive Features
1. **Full Settings Implementation**: Complete settings page with personal details and view-only employment data
2. **Full Profile Implementation**: Complete profile page with all editing capabilities
3. **Engagement Points Display**: Detailed points breakdown on profile
4. **Profile Card in Dashboard**: Quick profile access from dashboard
5. **Unified Dashboard**: Uses same dashboard component as alumni

### Mobile-Exclusive Features
1. **OJT Forum Page**: Dedicated forum page for OJT users
2. **OJT Donation Page**: Dedicated donation page for OJT users
3. **Separate OJT Dashboard**: Simplified dashboard specifically for OJT users
4. **Pull to Refresh**: Mobile-specific refresh functionality

### Web Restrictions (Not in Mobile)
1. **Forum Access Blocked**: Web blocks OJT access to forum (`/forum` route restricted to `['user']`)
2. **Donation Access Blocked**: Web blocks OJT access to donation (`/donation` route restricted to `['user']`)
3. **Donation Filtering**: Web filters donations from feed for OJT users

### Mobile Restrictions (Not in Web)
1. **Menu Filtering**: Mobile filters out Forum and Donation menu items for OJT users
2. **No Settings**: Mobile has no settings implementation for OJT
3. **No Profile**: Mobile has no profile implementation for OJT

### Shared Features
1. **Feed Viewing**: Both can view and interact with posts
2. **Post Creation**: Both can create posts
3. **Post Interactions**: Like, comment, repost
4. **Search**: Both can search for users
5. **Messaging**: Both have full messaging access
6. **Notifications**: Both have full notifications access
7. **Rewards**: Both have rewards access
8. **No Tracker Access**: Both block tracker form access

---

## Missing Implementations

### Web Missing Features
- ❌ **OJT Forum**: No dedicated forum page for OJT users
- ❌ **OJT Donation**: No dedicated donation page for OJT users

### Mobile Missing Features
- ❌ **OJT Settings**: No settings page implementation
- ❌ **OJT Profile**: No profile page implementation
- ❌ **Password Management**: No password change functionality

---

## Recommendations

### High Priority - Mobile
1. **Implement OJT Settings**: Create full settings page similar to web
2. **Implement OJT Profile**: Create full profile page similar to web
3. **Add Password Management**: Allow OJT users to change passwords

### High Priority - Web
1. **Add OJT Forum Access**: Consider allowing OJT users to access forum or create OJT-specific forum
2. **Add OJT Donation Access**: Consider allowing OJT users to access donation or create OJT-specific donation page

### Medium Priority
1. **Feature Parity**: Ensure both platforms have similar feature sets
2. **Consistent Access Control**: Align access restrictions between web and mobile
3. **Unified Experience**: Consider using same components/patterns across platforms

### Low Priority
1. **Dashboard Enhancement**: Add profile card to mobile OJT dashboard
2. **Quick Links**: Add quick links to mobile OJT dashboard
3. **Navigation Consistency**: Ensure navigation is consistent across platforms

---

## Code References

### Web
- OJT Dashboard: `frontend/src/pages/shared/UnifiedDashboard.tsx`
- OJT Settings: `frontend/src/pages/alumni/Settings.tsx`
- OJT Profile: `frontend/src/pages/alumni/Profile.tsx`
- Routing: `frontend/src/App.tsx`

### Mobile
- OJT Dashboard: `mobile/app/ojt/ojtpage.tsx`
- OJT Settings: `mobile/app/ojt/ojtsettings.tsx`
- OJT Profile: `mobile/app/ojt/ojtprofile.tsx`
- OJT Forum: `mobile/app/ojt/ojtforum.tsx`
- OJT Donation: `mobile/app/ojt/ojtdonation.tsx`
- Menu: `mobile/app/profile/profiletab.tsx`

---

## Summary

### Web Strengths
- ✅ Full settings implementation
- ✅ Full profile implementation
- ✅ Engagement points display
- ✅ Unified dashboard experience

### Mobile Strengths
- ✅ OJT-specific forum page
- ✅ OJT-specific donation page
- ✅ Separate OJT dashboard
- ✅ Mobile-optimized UI

### Web Weaknesses
- ❌ No forum access for OJT
- ❌ No donation access for OJT
- ❌ Access restrictions limit functionality

### Mobile Weaknesses
- ❌ No settings implementation
- ❌ No profile implementation
- ❌ Missing core account management features

### Overall Assessment
**Web** has better account management features (settings, profile) but restricts access to forum and donation. **Mobile** has OJT-specific forum and donation pages but lacks core account management features. Both platforms need improvements to achieve feature parity.

