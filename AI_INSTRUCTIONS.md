# AI Instructions for Creating Mobile Version

This document provides comprehensive instructions for AI assistants to create a mobile (smartphone) version of the Engine Simulator application.

## Project Overview

The Engine Simulator is a real-time browser-based engine sound simulator that uses Web Audio API's AudioWorklet to synthesize realistic engine audio. The mobile version should maintain all core functionality while optimizing for mobile devices.

**Current Web Application:**
- Live Demo: https://engine-sim-murex.vercel.app
- Repository: https://github.com/SenaTaka/engine-simulator
- Technology: Vanilla JavaScript, Web Audio API, HTML5, CSS3
- No frameworks or dependencies

## Mobile Development Options

### Option 1: Progressive Web App (PWA) - Recommended
Create a PWA that works on both iOS and Android browsers.

**Advantages:**
- Single codebase for all platforms
- Minimal changes to existing code
- Works on all mobile browsers
- Installable on home screen
- No app store approval needed

**Implementation Steps:**
1. Create `manifest.json` for PWA configuration
2. Implement service worker for offline capability
3. Optimize UI for touch and smaller screens
4. Add mobile-specific gestures
5. Optimize performance for mobile devices

### Option 2: React Native / Expo
Create native mobile apps using React Native.

**Advantages:**
- Native app performance
- Access to native device features
- Better integration with mobile OS

**Challenges:**
- Requires rewriting in React Native
- Web Audio API compatibility (use expo-audio or react-native-sound)
- More complex development and maintenance

### Option 3: Capacitor / Ionic
Wrap the existing web app as a native mobile app.

**Advantages:**
- Minimal code changes
- Can reuse existing HTML/CSS/JS
- Publish to app stores

**Challenges:**
- Additional build configuration
- App store submission process

## Detailed Implementation Guide (PWA Approach)

### Phase 1: Mobile UI Optimization

#### 1.1 Responsive Layout
**Current Issue:** Desktop-focused layout (max-width: 600px)

**Required Changes:**
```css
/* Update style.css */
.container {
  width: 100%;
  max-width: 100vw;
  padding: 1rem;
  margin: 0;
}

/* Mobile-first media queries */
@media (max-width: 480px) {
  h1 { font-size: 1.8rem; }
  .rpm-gauge-circular { max-width: 250px; }
  .speed-gear-row { flex-direction: column; }
}

/* Landscape orientation */
@media (orientation: landscape) and (max-height: 500px) {
  .container {
    display: flex;
    flex-direction: row;
  }
}
```

#### 1.2 Touch-Optimized Controls
**Required Changes:**

1. **Larger Touch Targets (minimum 44x44px for iOS, 48x48dp for Android):**
```css
button, input[type="range"], select {
  min-height: 48px;
  min-width: 48px;
  font-size: 16px; /* Prevent zoom on iOS */
}
```

2. **Implement Throttle Slider (Replace Pedal Button):**
```html
<!-- Add to index.html -->
<div class="throttle-slider-container">
  <input type="range" id="throttle-slider"
         min="0" max="100" value="0"
         class="throttle-slider"
         orient="vertical">
  <label>Throttle</label>
</div>
```

```javascript
// Add to app.js
const throttleSlider = document.getElementById('throttle-slider');
throttleSlider.addEventListener('input', (e) => {
  setThrottle(parseInt(e.target.value) / 100);
});

throttleSlider.addEventListener('touchstart', (e) => {
  e.preventDefault(); // Prevent scrolling while adjusting
});
```

3. **Add Swipe Gestures for Gear Shifting:**
```javascript
// Add to app.js
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipeGesture();
});

function handleSwipeGesture() {
  const swipeThreshold = 50;
  const diff = touchEndX - touchStartX;

  if (diff > swipeThreshold) {
    // Swipe right - downshift
    if (vehicleState.gear > 0) {
      vehicleState.gear--;
      gearInput.value = vehicleState.gear;
      adjustRpmForGearChange();
      updateGearButtons();
    }
  } else if (diff < -swipeThreshold) {
    // Swipe left - upshift
    if (vehicleState.gear < 6) {
      vehicleState.gear++;
      gearInput.value = vehicleState.gear;
      adjustRpmForGearChange();
      updateGearButtons();
    }
  }
}
```

#### 1.3 Mobile Viewport Configuration
**Add to index.html `<head>`:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1a1a2e">
```

### Phase 2: PWA Implementation

#### 2.1 Create manifest.json
**Create `/manifest.json`:**
```json
{
  "name": "Engine Simulator",
  "short_name": "Engine Sim",
  "description": "Real-time browser-based engine sound simulator",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#0a0a0a",
  "theme_color": "#1a1a2e",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "categories": ["entertainment", "utilities"],
  "screenshots": [
    {
      "src": "/screenshots/mobile-1.png",
      "sizes": "540x720",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/desktop-1.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    }
  ]
}
```

**Link manifest in index.html:**
```html
<link rel="manifest" href="/manifest.json">
```

#### 2.2 Create Service Worker
**Create `/service-worker.js`:**
```javascript
const CACHE_NAME = 'engine-simulator-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/engine-processor.js',
  '/style.css',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache if available
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

**Register service worker in app.js:**
```javascript
// Add at the end of app.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('ServiceWorker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}
```

### Phase 3: Mobile-Specific Optimizations

#### 3.1 Performance Optimization

**Reduce Audio Processing Load:**
```javascript
// Modify engine-processor.js SynthConstants
const SynthConstants = {
  HARMONIC_COUNT: 16, // Reduced from 24 for mobile
  // ... other constants
};

// Add mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
  SynthConstants.HARMONIC_COUNT = 12; // Further reduce for mobile
}
```

**Optimize Animation Loop:**
```javascript
// Add FPS throttling for mobile in app.js
let lastFrameTime = 0;
const targetFPS = isMobile ? 30 : 60;
const frameInterval = 1000 / targetFPS;

function update() {
  if (!isPlaying) return;

  const nowTime = performance.now();
  const deltaTime = nowTime - lastFrameTime;

  if (deltaTime < frameInterval) {
    requestAnimationFrame(update);
    return;
  }

  lastFrameTime = nowTime - (deltaTime % frameInterval);

  // ... existing update code

  requestAnimationFrame(update);
}
```

#### 3.2 Battery Optimization

**Implement Wake Lock API:**
```javascript
// Add to app.js
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock active');

      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
      });
    }
  } catch (err) {
    console.error('Wake Lock error:', err);
  }
}

// Release wake lock when engine stops
async function releaseWakeLock() {
  if (wakeLock !== null) {
    await wakeLock.release();
    wakeLock = null;
  }
}

// Update start button handler
// Add requestWakeLock() when starting engine
// Add releaseWakeLock() when stopping engine
```

#### 3.3 Audio Context Handling for Mobile

**iOS Audio Unlock Pattern:**
```javascript
// Add to app.js - iOS requires user interaction to start audio
let audioUnlocked = false;

function unlockAudioContext() {
  if (audioUnlocked) return;

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      audioUnlocked = true;
      console.log('Audio Context unlocked');
    });
  }
}

// Add to start button handler
document.addEventListener('touchstart', unlockAudioContext, { once: true });
```

### Phase 4: Mobile-Specific Features

#### 4.1 Device Orientation Support
```javascript
// Add to app.js
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (event) => {
    // Use device tilt as throttle input (optional feature)
    const beta = event.beta; // Front-to-back tilt (-180 to 180)
    const normalizedTilt = Math.max(0, Math.min(1, (beta + 90) / 90));

    // Optional: Use tilt as alternative throttle control
    if (params.useTiltControl) {
      setThrottle(normalizedTilt);
    }
  });
}
```

#### 4.2 Haptic Feedback
```javascript
// Add to app.js
function vibrate(duration = 10) {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

// Add haptic feedback to gear shifts
function adjustRpmForGearChange() {
  // ... existing code
  vibrate(20); // Short vibration on gear change
}

// Add haptic feedback to rev limiter
// In update() function, when approaching redline
if (params.currentRpm > params.redlineRpm * 0.98) {
  vibrate([10, 50, 10]); // Pattern: vibrate-pause-vibrate
}
```

#### 4.3 Screen Orientation Lock
```javascript
// Add to app.js
async function lockOrientation() {
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('portrait');
      console.log('Orientation locked to portrait');
    }
  } catch (err) {
    console.error('Orientation lock error:', err);
  }
}

// Call when starting engine (optional)
```

### Phase 5: Testing and Debugging

#### 5.1 Mobile Testing Checklist
- [ ] Test on real iOS devices (iPhone 8+, iOS 14+)
- [ ] Test on real Android devices (Android 8+)
- [ ] Test on various screen sizes (4" to 6.7")
- [ ] Test in portrait and landscape orientations
- [ ] Test touch gestures (tap, swipe, pinch)
- [ ] Test audio playback and latency
- [ ] Test battery consumption (aim for <5% per 10 minutes)
- [ ] Test offline functionality (PWA)
- [ ] Test installation to home screen
- [ ] Test with low-end devices (2GB RAM)

#### 5.2 Performance Targets
- **Audio Latency:** < 50ms
- **Frame Rate:** 30 FPS minimum on mobile
- **Load Time:** < 3 seconds on 4G
- **Memory Usage:** < 100MB
- **CPU Usage:** < 30% average
- **Battery Drain:** < 5% per 10 minutes

#### 5.3 Debugging Tools
```javascript
// Add mobile debug overlay (development only)
function createDebugOverlay() {
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-overlay';
  debugDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    background: rgba(0,0,0,0.8);
    color: lime;
    padding: 10px;
    font-family: monospace;
    font-size: 10px;
    z-index: 9999;
    pointer-events: none;
  `;
  document.body.appendChild(debugDiv);

  setInterval(() => {
    const info = `
      FPS: ${Math.round(1000 / (performance.now() - lastFrameTime))}
      RPM: ${Math.round(params.currentRpm)}
      Load: ${(params.load * 100).toFixed(1)}%
      Memory: ${(performance.memory?.usedJSHeapSize / 1048576).toFixed(1)}MB
      Audio: ${audioCtx?.state}
    `;
    debugDiv.textContent = info;
  }, 1000);
}

// Enable in development
if (window.location.hostname === 'localhost') {
  createDebugOverlay();
}
```

### Phase 6: Deployment

#### 6.1 PWA Deployment
1. Host on HTTPS (required for PWA and AudioWorklet)
2. Configure proper MIME types for service worker
3. Add icons to `/icons/` directory
4. Test PWA installation on mobile devices
5. Verify service worker caching

#### 6.2 App Store Deployment (Optional)
If creating native apps using Capacitor:

**iOS:**
```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios
```

**Android:**
```bash
npm install @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```

### Known Mobile Limitations

1. **iOS Audio Restrictions:**
   - Requires user interaction to start audio
   - Background audio may be restricted
   - Sample rate may be forced to 48kHz

2. **Android Audio Variations:**
   - Audio latency varies by device (20-200ms)
   - Some devices have lower audio quality
   - Battery optimization may throttle audio

3. **Performance Constraints:**
   - Lower CPU power than desktop
   - Limited memory (2-4GB on mid-range phones)
   - Thermal throttling on sustained load

4. **Browser Compatibility:**
   - Safari iOS 14.1+ required for AudioWorklet
   - Chrome Android 66+ required
   - Samsung Internet browser needs testing

## Mobile UI/UX Best Practices

### Layout Recommendations
1. **Vertical Layout:** Stack controls vertically for one-handed use
2. **Thumb Zone:** Place primary controls in bottom 2/3 of screen
3. **Visual Feedback:** Larger, more visible indicators for touch actions
4. **Gesture Hints:** Show swipe indicators for hidden features
5. **Landscape Mode:** Horizontal layout with gauge on left, controls on right

### Touch Interaction Guidelines
1. **Minimum Touch Target:** 48x48dp (Android) / 44x44pt (iOS)
2. **Touch Feedback:** Visual and haptic feedback for all interactions
3. **Prevent Conflicts:** Disable browser gestures during app interaction
4. **Gesture Discovery:** Tutorial overlay on first launch

### Audio Considerations
1. **Volume Warning:** Display warning for high volume
2. **Silent Mode Check:** Detect and notify if device is in silent mode
3. **Headphone Detection:** Adjust EQ when headphones connected
4. **Background Audio:** Handle audio interruptions (calls, notifications)

## Required Assets

### Icons
Generate PWA icons in these sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

Use a simple, recognizable icon design:
- Engine piston or tachometer
- High contrast for visibility
- Transparent background
- PNG format

### Screenshots
For PWA installation and app stores:
- Mobile portrait: 540x720, 1080x1920
- Mobile landscape: 720x540, 1920x1080
- Tablet: 1024x768, 2048x1536

## Error Handling for Mobile

### Common Issues and Solutions

**Issue: Audio doesn't play**
```javascript
// Add detection and user guidance
if (audioCtx.state === 'suspended') {
  statusText.textContent = 'Tap Start Engine to enable audio';
  // Show visual indicator
}
```

**Issue: Performance lag**
```javascript
// Detect low performance and adapt
let lowPerformanceMode = false;
let frameDrops = 0;

function update() {
  const frameTime = performance.now() - lastFrameTime;

  if (frameTime > 50) { // >20ms per frame
    frameDrops++;
    if (frameDrops > 30 && !lowPerformanceMode) {
      lowPerformanceMode = true;
      SynthConstants.HARMONIC_COUNT = 8; // Reduce load
      console.warn('Low performance detected, reducing quality');
    }
  }
  // ... rest of update
}
```

**Issue: Memory warnings**
```javascript
// Listen for memory pressure
if ('memory' in performance && 'onmemorypressure' in performance) {
  performance.addEventListener('memorypressure', () => {
    console.warn('Memory pressure detected');
    // Clear caches, reduce quality
  });
}
```

## Testing Commands

```bash
# Test on local network (for mobile device testing)
python3 -m http.server 8000

# Find your local IP
# macOS/Linux:
ifconfig | grep "inet "
# Windows:
ipconfig

# Access from mobile browser:
# http://192.168.x.x:8000

# Test PWA manifest
# Chrome DevTools > Application > Manifest

# Test service worker
# Chrome DevTools > Application > Service Workers

# Test audio on mobile
# Remote debugging via USB (Android)
# Safari Web Inspector (iOS)
```

## Additional Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Web Audio API Mobile Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [iOS Audio Guidelines](https://developer.apple.com/documentation/webkit/delivering_video_content_for_safari)
- [Android Audio Latency](https://developer.android.com/ndk/guides/audio/audio-latency)

## Success Criteria

The mobile version is complete when:
- [ ] App installs as PWA on iOS and Android
- [ ] All core features work on mobile (engine sounds, controls, presets)
- [ ] Touch controls are responsive and intuitive
- [ ] Performance meets targets (30 FPS, <50ms latency)
- [ ] Works offline after first load
- [ ] Battery consumption is acceptable
- [ ] UI is fully responsive on all screen sizes
- [ ] Audio plays reliably on all devices
- [ ] No critical bugs on major mobile browsers
- [ ] Passes accessibility standards (touch targets, contrast)

## Maintenance and Updates

### Version Control
- Keep separate branches for web and mobile features
- Test all changes on both desktop and mobile
- Maintain backward compatibility

### Performance Monitoring
- Monitor real-user performance metrics
- Track crash reports and errors
- A/B test mobile-specific features

### User Feedback
- Collect feedback on mobile usability
- Monitor app store reviews (if published)
- Track PWA installation rates
