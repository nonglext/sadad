# 🧪 Testing Scenarios - Quality Assurance Guide

**Purpose**: Ensure the refactored messenger works like Discord | **Time**: ~1 hour | **Coverage**: All features

---

## 🎬 Test Setup

Before running tests, make sure:

```javascript
// In browser console, verify:
✓ appState is defined
✓ appState.socketConnected === true
✓ appState.user.id exists
✓ No console errors
```

---

## 📋 Test Categories

### Category 1: Authentication & Initialization ✅

#### Test 1.1: Login and State Initialization
```
Steps:
1. Open login.html
2. Enter credentials and login
3. Should redirect to index.html
4. Check DevTools → Application → localStorage

Expected:
✓ Token stored in localStorage
✓ Current user stored in localStorage
✓ appState.user populated
✓ appState.token populated
✓ Socket connects within 2 seconds
```

#### Test 1.2: Session Persistence
```
Steps:
1. Login successfully
2. Refresh page (F5)
3. Verify app still logged in

Expected:
✓ No redirect to login
✓ Data reloaded from localStorage
✓ Socket reconnects automatically
✓ Friends list preserved
```

#### Test 1.3: Logout
```
Steps:
1. Click settings button
2. Select logout
3. Confirm logout

Expected:
✓ Redirects to login.html
✓ localStorage cleared
✓ Socket disconnected
✓ No console errors
```

---

### Category 2: Real-Time Messaging ✅

#### Test 2.1: Send Message in Channel
```
Steps:
1. Select a channel (e.g., #general)
2. Type message: "Hello @everyone"
3. Press Enter
4. Observe message appears immediately

Expected:
✓ Message shows with correct author
✓ Timestamp is current
✓ Avatar shows
✓ Message saved to database
✓ Other users see it in real-time
✓ No duplicate messages
✓ No console errors
```

#### Test 2.2: Send Message Performance
```
Steps:
1. Select a channel with 500+ messages
2. Send 10 messages rapidly (press Enter quickly)
3. Observe rendering performance

Expected:
✓ All messages appear
✓ Smooth scrolling (no jank)
✓ No lag between messages
✓ Frame rate stays 60 FPS
```

#### Test 2.3: Long Message Handling
```
Steps:
1. Send a message with 1000+ characters
2. Include newlines, emojis, special chars

Expected:
✓ Message sends successfully
✓ Wraps correctly in UI
✓ No overflow or clipping
✓ Readable in history
```

#### Test 2.4: Loading State During Slowdown
```
Steps:
1. Open DevTools → Network
2. Set throttle to "Slow 3G"
3. Click on a new channel
4. Observe loading state

Expected:
✓ Loading spinner appears
✓ Spinner animates smoothly
✓ Messages load eventually
✓ Spinner disappears when done
```

---

### Category 3: Direct Messages ✅

#### Test 3.1: Start DM with Friend
```
Steps:
1. Click on friend in Friends tab
2. Type and send message
3. Receive message from friend

Expected:
✓ DM thread opens
✓ Message history loads
✓ Can reply back
✓ Real-time delivery
```

#### Test 3.2: DM List Updates
```
Steps:
1. Open Friends view
2. Start DM with user A
3. Send message
4. Message appears in DM list

Expected:
✓ User appears in DM list
✓ Latest message shown
✓ Can click to reopen
✓ History preserved
```

#### Test 3.3: Offline DM Handling
```
Steps:
1. Open DevTools → Network
2. Go offline (check "Offline")
3. Try to send DM
4. Go back online

Expected:
✓ Error message shown gracefully
✓ App recovers when online
✓ Message can be retried
```

---

### Category 4: Friend Management ✅

#### Test 4.1: Send Friend Request
```
Steps:
1. Go to Friends → Add Friend tab
2. Search for username
3. Click "Add Friend"
4. Check that request sent

Expected:
✓ Success message shown
✓ Request visible in pending tab (for you/sender)
✓ No console errors
```

#### Test 4.2: Accept Friend Request (Real-time)
```
Prerequisites:
- User A sends friend request to User B
- Open User B's interface

Steps:
1. User B accepts request
2. Observe User A's interface WITHOUT refresh

Expected (User A sees instantly):
✓ Friend appears in "All Friends" tab
✓ Friend appears in DM list
✓ Status shows online/offline correctly
✓ No page refresh needed
✓ "New friend added" notification shown
```

#### Test 4.3: Friend Status Change (Real-time)
```
Prerequisites:
- Users A and B are friends
- Both logged in

Steps:
1. User A goes offline (disconnect socket/close tab)
2. Observe User B's interface

Expected (User B sees instantly):
✓ Friend status changes to "Offline"
✓ Green pulse animation disappears
✓ No page refresh needed
```

#### Test 4.4: Remove Friend
```
Steps:
1. Hover over friend item
2. Click remove button (trash icon)
3. Confirm removal

Expected:
✓ Friend disappears from list
✓ DM conversation cleared (or archived)
✓ No console errors
```

---

### Category 5: Message Reactions ✅

#### Test 5.1: Add Reaction
```
Steps:
1. Hover over a message
2. Click emoji button (😊)
3. Select reaction (e.g., 👍)
4. Observe

Expected:
✓ Reaction appears under message
✓ Shows emoji + count
✓ Smooth animation on appearance
✓ Real-time for other users
```

#### Test 5.2: Remove Reaction
```
Steps:
1. Click on reaction badge
2. Should remove your reaction

Expected:
✓ Reaction count decreases
✓ If count = 0, whole badge disappears
✓ Real-time update for others
```

#### Test 5.3: Multiple Reactions
```
Steps:
1. Add reactions: 👍 ❤️ 😂 to same message
2. Add same reaction twice (should count)

Expected:
✓ All reactions visible
✓ Counts correct
✓ Wrap to multiple lines if needed
✓ Badges styled like Discord
```

#### Test 5.4: Empty Reactions Container
```
Steps:
1. Message with no reactions
2. Inspect HTML structure

Expected:
✓ No empty `.message-reactions` div
✓ Not taking up space (display: none)
✓ Clean DOM structure
```

---

### Category 6: Calls (Audio/Video) ✅

#### Test 6.1: Initiate Video Call
```
Prerequisites:
- 2 users logged in on different machines/tabs

Steps:
1. User A: Click video call button next to friend
2. Observe ringing on User B side
3. User B: Click accept

Expected:
✓ Incoming call notification appears
✓ Ringing sound/visual
✓ Auto-reject after 30s if not answered
✓ Call interface opens
✓ WebRTC connects (green check)
✓ Both video feeds show
✓ No delay
```

#### Test 6.2: Audio Call
```
Steps:
1. User A: Click audio call button
2. User B: Accept
3. Both should have audio working
4. Video should NOT be visible

Expected:
✓ Only audio tracks enabled
✓ Video disabled (no webcam feed)
✓ Clearer audio than with video
✓ Works on slower connections
```

#### Test 6.3: Toggle Video During Call
```
Steps:
1. During call, click video button
2. Should disable video
3. Click again to re-enable

Expected:
✓ Video button highlights when disabled
✓ Other user sees video disabled (opacity 0.7)
✓ Audio continues
✓ Smooth transition
```

#### Test 6.4: Toggle Audio During Call
```
Steps:
1. During call, click audio button
2. Should mute microphone

Expected:
✓ Audio button highlights
✓ Other user hears silence
✓ Local audio muted (volume = 0)
✓ Can unmute anytime
```

#### Test 6.5: Screen Sharing
```
Steps:
1. During video call, click screen share button
2. Select screen to share
3. Observe shared content
4. Click screen share again to stop

Expected:
✓ Screen appears in video feed
✓ Other user sees your screen
✓ Clear quality
✓ Can return to camera
✓ Audio continues
```

#### Test 6.6: End Call
```
Steps:
1. During call, click end call button

Expected:
✓ Call interface closes
✓ All tracks stopped
✓ Other user notified
✓ No leftover video elements
✓ Can start new call
```

---

### Category 7: Voice Channels ✅

#### Test 7.1: Join Voice Channel
```
Steps:
1. Click on voice channel (e.g., "General Voice")
2. Grant permissions for audio/video

Expected:
✓ Call interface opens
✓ Local video shows
✓ Channel marked as "in-call" (green highlight)
✓ Can invite others
```

#### Test 7.2: Multiple Users in Voice Channel
```
Prerequisites:
- 3+ users in voice channel

Expected:
✓ All videos visible
✓ Grid layout adapts to number of users
✓ Names visible under each video
✓ Can see who's speaking
✓ No lag
```

#### Test 7.3: Leave Voice Channel
```
Steps:
1. In voice channel, click close/leave button
2. Should leave channel

Expected:
✓ Video feed stops
✓ Other users don't see you
✓ Can rejoin later
✓ No audio feedback from you
```

---

### Category 8: Loading States ✅

#### Test 8.1: Friends Loading
```
Steps:
1. Go to Friends tab
2. Should show loading spinner while fetching

Expected:
✓ Spinner animates smoothly
✓ Skeleton placeholders appear
✓ Content replaces skeleton
✓ No white space
```

#### Test 8.2: Messages Loading
```
Steps:
1. Click on channel with many messages
2. Should show loading spinner

Expected:
✓ Spinner visible
✓ Smooth animation
✓ Messages load in background
✓ Spinner removed when done
```

#### Test 8.3: DM History Loading
```
Steps:
1. Start DM with friend
2. First time loading history

Expected:
✓ Loading spinner shows
✓ History loads progressively
✓ Smooth transition
```

---

### Category 9: Error Handling ✅

#### Test 9.1: Network Error Recovery
```
Steps:
1. Open DevTools → Network
2. Throttle to offline
3. Try to send message
4. Go back online

Expected:
✓ Error message (not console crash)
✓ "Network error" shown
✓ Can retry
✓ Works when online again
```

#### Test 9.2: Socket Disconnect/Reconnect
```
Steps:
1. Open DevTools → Network
2. Disable Socket.IO with DevTools throttle
3. Try operations
4. Re-enable network

Expected:
✓ User sees disconnect warning
✓ Automatic reconnect attempted
✓ UI reflects disconnected state
✓ Works after reconnect
✓ No state corruption
```

#### Test 9.3: Server Error Handling
```
Steps:
1. Trigger server error (send invalid data)
2. Server returns 500 error

Expected:
✓ Client shows error message
✓ Doesn't crash
✓ Can retry
✓ Clear error communication
```

---

### Category 10: Performance ✅

#### Test 10.1: 1000+ Messages Performance
```
Steps:
1. Open channel with 1000+ messages
2. Scroll through them
3. Send new message
4. Check DevTools → Performance

Expected:
✓ Smooth scrolling (60 FPS)
✓ No jank or frame drops
✓ Message adds instantly
✓ Memory stable (no growth)
✓ CPU usage reasonable
```

#### Test 10.2: 100+ Friends List Performance
```
Steps:
1. Display 100+ friends
2. Scroll through list
3. Filter/search

Expected:
✓ List renders smoothly
✓ No lag on scroll
✓ Search works quickly
✓ Smooth animations
```

#### Test 10.3: Memory Leak Check
```
Steps:
1. Open DevTools → Memory
2. Take heap snapshot (baseline)
3. Send 50 messages
4. Delete messages
5. Take heap snapshot (final)

Expected:
✓ Memory returned to baseline
✓ No accumulating objects
✓ Clean garbage collection
```

#### Test 10.4: CPU Usage
```
Steps:
1. Open DevTools → Performance
2. Record performance profile
3. Use app normally (send messages, calls)
4. Stop recording

Expected:
✓ CPU spikes < 50% during normal use
✓ No sustained high CPU
✓ Smooth 60 FPS maintained
```

---

### Category 11: UI/UX ✅

#### Test 11.1: Responsive Design
```
Steps:
1. Resize browser to mobile width (375px)
2. Test all features

Expected:
✓ Layout adapts to mobile
✓ All buttons accessible
✓ No overflow
✓ Touch-friendly sizes
✓ Messages readable
```

#### Test 11.2: Dark Mode (if applicable)
```
Steps:
1. Toggle dark mode
2. Check all elements

Expected:
✓ All text readable
✓ Good contrast
✓ No white flashes
✓ Consistent styling
```

#### Test 11.3: Animations Quality
```
Steps:
1. Observe:
   - Message fade-in
   - Reaction appearance
   - Loading spinner
   - Call notification
   - Status pulse

Expected:
✓ Smooth (no stuttering)
✓ Appropriate timing
✓ Not distracting
✓ Professional quality
```

#### Test 11.4: Hover States
```
Steps:
1. Hover over:
   - Message (add reaction button appears)
   - Friend (action buttons appear)
   - Channel (highlight)
   - Server icon (color change)

Expected:
✓ Clear visual feedback
✓ Smooth transitions
✓ Buttons accessible
✓ Consistent styling
```

---

### Category 12: Browser Compatibility ✅

#### Test 12.1: Chrome/Edge
```
Expected:
✓ All features work
✓ No console errors
✓ WebRTC works
✓ Performance good
```

#### Test 12.2: Firefox
```
Expected:
✓ All features work
✓ WebRTC compatible
✓ Socket.IO connected
```

#### Test 12.3: Safari
```
Expected:
✓ Core messaging works
✓ WebRTC may need permissions
✓ No security warnings
```

---

## 📊 Test Result Template

```
Date: ________
Tester: ________
Browser: ________
OS: ________
Network: ________

Test Category 1: Authentication
├── Test 1.1: ✅ PASS / ❌ FAIL / ⏭️ SKIP
├── Test 1.2: ✅ PASS / ❌ FAIL / ⏭️ SKIP
└── Test 1.3: ✅ PASS / ❌ FAIL / ⏭️ SKIP

Test Category 2: Messaging
├── Test 2.1: ✅ PASS / ❌ FAIL / ⏭️ SKIP
├── Test 2.2: ✅ PASS / ❌ FAIL / ⏭️ SKIP
├── Test 2.3: ✅ PASS / ❌ FAIL / ⏭️ SKIP
└── Test 2.4: ✅ PASS / ❌ FAIL / ⏭️ SKIP

... (continue for all categories)

Overall Score: _____ / 100
Issues Found: _____
Critical Bugs: _____
Recommendations: _____
```

---

## 🎯 Acceptance Criteria

The app is **production-ready** when:

✅ All Category 1-9 tests pass (95%+ coverage)
✅ Category 10 performance tests pass
✅ No critical bugs
✅ No console errors in normal use
✅ Real-time features work across devices
✅ WebRTC calls stable for 10+ minutes
✅ Memory stable after 1000+ messages
✅ Graceful error handling everywhere
✅ Loading states clear and appropriate
✅ Animations smooth 60 FPS

---

## 🐛 Bug Report Template

If you find a bug, report it with:

```
Title: [Category] Brief description

Environment:
- Browser: Chrome 120
- OS: Windows 11
- Network: WiFi
- Users involved: 2

Steps to Reproduce:
1. ...
2. ...
3. ...

Expected Behavior:
...

Actual Behavior:
...

Console Errors:
[paste from DevTools]

Screenshots/Video:
[if applicable]

Severity:
🔴 CRITICAL - App crashes
🟠 HIGH - Feature broken
🟡 MEDIUM - Minor issue
🟢 LOW - Nice to fix

Priority:
P0 - Fix immediately
P1 - Fix today
P2 - Fix this week
P3 - Fix eventually
```

---

**Good luck testing!** 🧪✨

If all tests pass, your messenger is **production-ready**! 🚀
