# Alumni vs OJT Mobile Features Comparison

## Overview
This document compares the features available to Alumni accounts versus OJT (On-the-Job Training) accounts in the mobile application.

---

## Dashboard Features

### Alumni Dashboard (`dashboard.tsx`)
- ✅ **Feed Display**: Shows posts, reposts, and donation posts
- ✅ **Profile Card**: Displays user name, course, year graduated, profile picture
- ✅ **Edit Profile**: Quick edit modal for name, course, year graduated, profile picture
- ✅ **Tracker Status Card**: Alumni-specific feature showing:
  - Graduate Tracer Survey status
  - "Take Survey" button if form is accepting and user hasn't submitted
  - Status messages (completed, accepting, closed)
- ✅ **Post Creation**: "Start a post" button
- ✅ **Post Interactions**: Like, comment, repost functionality
- ✅ **Image Viewer**: Full-screen image viewing with gallery support
- ✅ **Tracker Reminder Modal**: Automatic reminder to complete tracker form

### OJT Dashboard (`ojt/ojtpage.tsx`)
- ✅ **Feed Display**: Shows posts, reposts, and donation posts (same as alumni)
- ✅ **Post Creation**: "Start a post" button
- ✅ **Post Interactions**: Like, comment, repost functionality
- ❌ **No Tracker Status**: OJT users don't have access to tracker form
- ❌ **No Profile Card**: No quick profile display on dashboard
- ❌ **No Edit Profile**: No quick edit functionality on dashboard
- ✅ **People You May Know**: Suggestion card appears in feed

---

## Settings Features

### Alumni Settings (`settings/settings.tsx`)
- ✅ **Personal Details Section**:
  - First Name, Last Name, Middle Name
  - Civil Status (dropdown)
  - Contact Number
  - Email
  - Address
  - Social Media Link
  - Home Address
- ✅ **Employment Details Section**:
  - Employment status check (Employed/Unemployed)
  - Organization name
  - Date hired
  - Position
  - Employment status (Full Time, Part Time, Unemployed)
  - Company address
  - Sector (Private, Government, Unemployed)
  - Edit functionality for employment data
- ✅ **Change Password Section**:
  - Current password
  - New password
  - Confirm password
  - Password validation (16+ chars, uppercase, lowercase, number, special char)
  - Password visibility toggle

### OJT Settings (`ojt/ojtsettings.tsx`)
- ❌ **Not Implemented**: Currently just a placeholder page
- ❌ **No Personal Details**: No settings form available
- ❌ **No Employment Details**: No employment information management
- ❌ **No Password Change**: No password management

---

## Profile Features

### Alumni Profile (`profile/profilepage.tsx`)
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

### OJT Profile (`ojt/ojtprofile.tsx`)
- ❌ **Not Implemented**: Currently just a placeholder page
- ❌ **No Profile Display**: No profile information shown
- ❌ **No Profile Editing**: No editing capabilities
- ❌ **No Follow/Message**: No social features

---

## Forum Features

### Alumni Forum (`forum/forumpage.tsx`)
- ✅ **Forum Access**: Full access to CCICT Forum
- ✅ **Post Viewing**: View all forum posts
- ✅ **Post Creation**: Create new forum posts
- ✅ **Interactions**: Like, comment, repost forum posts
- ✅ **Batch Filtering**: Filter alumni by graduation batch

### OJT Forum (`ojt/ojtforum.tsx`)
- ✅ **Forum Access**: OJT-specific forum page
- ✅ **Post Viewing**: View forum posts
- ✅ **Comment Functionality**: Add comments to posts
- ✅ **Interactions**: Like, repost forum posts
- ⚠️ **Separate Forum**: Uses different forum endpoint (OJT-specific)

---

## Donation Features

### Alumni Donation (`donation/donationpage.tsx`)
- ✅ **Donation Access**: Full access to donation page
- ✅ **Post Viewing**: View all donation posts
- ✅ **Post Creation**: Create donation requests
- ✅ **Interactions**: Like, comment, repost donation posts
- ✅ **Image Upload**: Attach images to donation posts
- ✅ **Mention Support**: Mention other users in posts

### OJT Donation (`ojt/ojtdonation.tsx`)
- ✅ **Donation Access**: OJT-specific donation page
- ✅ **Post Viewing**: View donation posts
- ✅ **Post Creation**: Create donation requests with:
  - Title
  - Content with mentions
  - Image upload
- ✅ **Interactions**: Like, repost donation posts
- ⚠️ **Separate Donation Page**: Uses different donation endpoint (OJT-specific)

---

## Tracker Form Features

### Alumni Tracker Form (`forms/forms.tsx`)
- ✅ **Full Access**: Alumni can access and submit tracker form
- ✅ **Dynamic Questions**: Supports backend-configured questions
- ✅ **Form Categories**: Multiple sections (Personal, Employment, Further Study, etc.)
- ✅ **Auto-prefill**: Automatically fills in user data from profile
- ✅ **File Uploads**: Support for single and multiple file uploads
- ✅ **Conditional Logic**: Shows/hides sections based on answers
- ✅ **Terms & Conditions**: Must accept terms before submission
- ✅ **Status Checking**: Checks if form is accepting responses
- ✅ **Submission Validation**: Validates required questions before submission

### OJT Tracker Form
- ❌ **No Access**: OJT users cannot access tracker form
- ❌ **Not Available**: Tracker form is alumni-exclusive feature

---

## Menu/Navigation Features

### Alumni Menu (`profile/profiletab.tsx`)
- ✅ **Full Menu Access**:
  - Rewards
  - CCICT
  - PESO
  - CCICT Forum
  - Donation
  - Settings
  - Log out

### OJT Menu (`profile/profiletab.tsx`)
- ⚠️ **Filtered Menu**:
  - Rewards
  - CCICT
  - PESO
  - ❌ CCICT Forum (hidden)
  - ❌ Donation (hidden)
  - Settings
  - Log out
- ⚠️ **OJT-Specific Pages**: Access to OJT Forum and OJT Donation through other navigation

---

## Search Features

### Alumni Search (`search/search.tsx`)
- ✅ **Search Alumni**: Search for other alumni users
- ✅ **Search OJT**: Can also search for OJT users
- ✅ **Recent Searches**: Shows recent search history
- ✅ **User Profiles**: Click to view user profiles

### OJT Search (`search/search.tsx`)
- ✅ **Search Alumni**: Can search for alumni users
- ✅ **Search OJT**: Can search for other OJT users
- ✅ **Recent Searches**: Shows recent search history
- ✅ **User Profiles**: Click to view user profiles
- ⚠️ **Same Functionality**: Uses same search page as alumni

---

## Key Differences Summary

### Alumni-Exclusive Features
1. **Tracker Form**: Graduate Tracer Survey access and submission
2. **Tracker Status Card**: Dashboard reminder for tracker form
3. **Tracker Reminder Modal**: Automatic reminders to complete survey
4. **Full Settings**: Complete personal and employment details management
5. **Full Profile**: Complete profile with editing capabilities
6. **CCICT Forum Access**: Access to main CCICT Forum
7. **Donation Access**: Access to main donation page

### OJT-Exclusive Features
1. **OJT Forum**: Separate forum page for OJT users
2. **OJT Donation**: Separate donation page for OJT users
3. **OJT Dashboard**: Simplified dashboard without tracker features

### Shared Features
1. **Feed**: Both can view and interact with posts
2. **Post Creation**: Both can create posts
3. **Post Interactions**: Like, comment, repost
4. **Search**: Both can search for users
5. **Rewards**: Both have access to rewards
6. **CCICT & PESO**: Both have access to these pages

### Missing OJT Features (Not Implemented)
1. **OJT Settings**: Currently just a placeholder
2. **OJT Profile**: Currently just a placeholder
3. **Profile Editing**: No profile editing for OJT users
4. **Password Management**: No password change for OJT users

---

## Recommendations

### High Priority
1. **Implement OJT Settings**: Create full settings page similar to alumni settings
2. **Implement OJT Profile**: Create profile page with editing capabilities
3. **Add Password Management**: Allow OJT users to change passwords

### Medium Priority
1. **Unify Forum Access**: Consider if OJT should have access to main CCICT Forum
2. **Unify Donation Access**: Consider if OJT should have access to main donation page
3. **Profile Consistency**: Ensure OJT users have same profile features as alumni

### Low Priority
1. **Dashboard Enhancement**: Add profile card to OJT dashboard
2. **Menu Consistency**: Review menu filtering logic

---

## Code References

- Alumni Dashboard: `mobile/app/dashboard.tsx`
- OJT Dashboard: `mobile/app/ojt/ojtpage.tsx`
- Alumni Settings: `mobile/app/settings/settings.tsx`
- OJT Settings: `mobile/app/ojt/ojtsettings.tsx`
- Alumni Profile: `mobile/app/profile/profilepage.tsx`
- OJT Profile: `mobile/app/ojt/ojtprofile.tsx`
- Alumni Forum: `mobile/app/forum/forumpage.tsx`
- OJT Forum: `mobile/app/ojt/ojtforum.tsx`
- Alumni Donation: `mobile/app/donation/donationpage.tsx`
- OJT Donation: `mobile/app/ojt/ojtdonation.tsx`
- Tracker Form: `mobile/app/forms/forms.tsx`
- Profile Tab (Menu): `mobile/app/profile/profiletab.tsx`
- Search: `mobile/app/search/search.tsx`

