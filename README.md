# Datataki

A lightweight client-side event tracking library for web applications. Track user sessions, page views, interactions and custom events with minimal setup.

![Cover](./assets/cover.png)

## Features

- 🔄 Automatic session tracking
- 📊 Page view tracking 
- 🖱️ Click tracking with custom data attributes
- 📜 Scroll depth and direction tracking
- ✨ Custom events support
- 📱 Device type detection
- 🔍 UTM parameter tracking
- 🔒 Privacy-focused (no cookies, local storage only)
- 📦 Batch processing for optimal performance
- ⚡ Real-time event dispatching option
- 🐛 Debug mode

## Installation

```bash
npm install @datataki/sdk
# or
yarn add @datataki/sdk
```

## Quick Start

```javascript
import { startTracking, sendCustomEvent } from '@datataki/sdk';

// Initialize tracking
startTracking('YOUR_API_URL', {
  debug: false,
  realTime: true,
  realTimeNamespace: 'analytics',
  sessionTimeout: 1800000,
  excludeRoutes: ['/admin/*', '/login'],
  samplingRate: 0.5,
  globalMetadata: {
    appVersion: '1.0.1',
    environment: 'production',
  },
});

// Send custom event
sendCustomEvent('button_click', {
  buttonId: 'submit-form',
  category: 'form',
  isValid: true,
  tags: ['registration', 'user']
});
```

## Configuration

The `startTracking` function accepts these configuration options:

```javascript
interface DatatakiConfig {
  debug?: boolean; // Enable console logging
  realTime?: boolean; // Enable real-time event dispatching (events exposed to all scripts)
  realTimeNamespace?: string; // Custom namespace for real-time events
  sessionTimeout?: number; // Inactivity timeout in ms (default: 15m, minimum: 30s)
  samplingRate?: number; // Allow to track only a percentage of users (default: 1, range: 0-1)
  excludeRoutes?: Array<string | RegExp>; // List of routes (exact, wildcard with *, or RegExp) not to track
  globalMetadata?: Record<string, string | number | boolean | string[]>; // Include global metadata to be sent with all events
}
```

### Configuration Validation

The library performs the following validations on configuration:

- `sessionTimeout` must be at least 30 seconds
- `samplingRate` must be a number between 0 and 1
- `globalMetadata` is validated for each event (max 12 keys, max 10KB size, early size check)

### Route Exclusion

The `excludeRoutes` option allows you to specify routes where certain events should not be tracked:

```javascript
startTracking('YOUR_API_URL', {
  excludeRoutes: [
    '/admin', // Exact path match
    /^\/private/, // Regex pattern match
  ]
});
```

When a route is excluded:
- Scroll events are not tracked
- Click events are not tracked
- Other events (page views, custom events, session events) are still tracked

#### Route Exclusion Behavior

The library supports three types of route exclusion patterns:

1. **Exact String Match**
   ```javascript
   excludeRoutes: ['/admin', '/login']
   ```
   - `/admin` → excluded
   - `/admin/settings` → not excluded (doesn't match exactly)
   - `/login` → excluded

2. **Wildcard String Match**
   ```javascript
   excludeRoutes: ['/admin/*', '/account/*/settings']
   ```
   - `/admin` → excluded
   - `/admin/settings` → excluded
   - `/account/123/settings` → excluded
   - `/account/123/profile` → not excluded

3. **Regular Expression Match**
   ```javascript
   excludeRoutes: [/^\/private/, /^\/t.*/]
   ```
   - `/private` → excluded
   - `/private/area` → excluded (matches regex)
   - `/test` → excluded (matches /^\/t.*/)
   - `/taki` → excluded (matches /^\/t.*/)
   - `/user` → not excluded (doesn't match regex)

Important notes:
- Wildcards using `*` are supported in string patterns
- Routes are matched against the pathname only (query parameters are ignored)
- The matching is case-sensitive
- Empty array or undefined means no routes are excluded

This is useful for:
- Excluding admin/private areas from analytics
- Reducing noise in high-traffic areas
- Complying with privacy requirements for sensitive pages

## Automatic Events

Datataki automatically tracks these events:

### Session Events
- `SESSION_START`: When a new session begins
  - Includes UTM parameters if present
  - Includes referrer information
  - Includes device type
- `SESSION_END`: When session ends due to inactivity or page close

After the configured `sessionTimeout` elapses, a `SESSION_END` event is fired. The next interaction starts a new session with a new session ID, while the user ID stored in `localStorage` remains to link sessions from the same visitor.

### Page Events
- `PAGE_VIEW`: On initial load and navigation changes
  - Tracks both direct navigation and history API changes
  - Includes previous page URL when navigating
- `SCROLL`: Records scroll depth and direction
  - Debounced to prevent excessive events
  - Includes relative position (0-100%)
- `CLICK`: Captures click events with element details
  - Includes relative coordinates within element
  - Supports custom data attributes

### Click Events

Datataki tracks clicks in two ways:

#### 1. Basic Click Events
Every click on your website is automatically tracked with basic information:

```javascript
{
  element: 'button', // HTML element type
  x: number, // X coordinate
  y: number, // Y coordinate
  id?: 'signup_btn', // Element ID (if present)
  class?: 'btn' // Element class (if present)
}
```

#### 2. Custom Click Events
To send a custom event when clicking an element, add the `data-taki-name` attribute. You can also include `data-taki-value` to add additional metadata:

```html
<!-- Basic usage -->
<button data-taki-name="signup_button">Sign Up</button>

<!-- With additional metadata -->
<button 
  data-taki-name="signup_button"
  data-taki-value="premium_plan">
  Sign Up Premium
</button>
```

When clicking these buttons, Datataki will:
1. Send the basic click event (as shown above)
2. Send a custom event with:

```javascript
{
  name: 'signup_button',
  metadata: {
    value: 'premium_plan' // Only included if data-taki-value is present
  }
}
```

## Custom Events

Send custom events with metadata:

```javascript
sendCustomEvent('purchase_completed', {
  productId: '123',
  price: 99.99,
  categories: ['electronics', 'phones']
});
```

### Event Validation

The library performs strict validation on custom events:

- Event name: max 120 characters
- Metadata object: max 10KB
- Max 12 metadata keys
- Arrays: max 12 items
- Valid types: string, number, boolean, string[]
- Objects are size-checked during traversal before serialization
- Invalid events will be logged to console in debug mode

Example of valid metadata:
```javascript
{
  productId: '123', // string
  price: 99.99, // number
  isAvailable: true, // boolean
  tags: ['electronics', 'phones'] // string[]
}
```

## Event Payload

All events include:
```javascript
{
  type: EventType;
  page_url: string;
  timestamp: number;
  // Event specific data...
}
```

## Device Detection

Datataki automatically detects device type:
- `mobile`
- `tablet` 
- `desktop`

## UTM Parameter Tracking

The library automatically captures UTM parameters:
- utm_source
- utm_medium
- utm_campaign
- utm_term
- utm_content

These are included in the `SESSION_START` event.

## Event Processing

### Batch Processing
Events are collected in a queue and sent in batches every 10 seconds to optimize network usage and reduce server load. Up to **1000** events are kept in the queue; when the limit is exceeded the oldest entries are discarded. The batch includes:

```javascript
{
  user_id: string;
  session_id: string;
  device: DeviceType;
  events: DatatakiEvent[];
  debug_mode?: boolean;
  global_metadata?: Record<string, MetadataType>;
}
```

### Real-time Events
When `realTime: true` is enabled, events are also dispatched immediately through a custom event. **This exposes event data to any script running on the page.** To limit who can listen, provide a `realTimeNamespace` so events are dispatched using a namespaced event name:

```javascript
window.addEventListener('DatatakiEvent:analytics', (e: CustomEvent) => {
  const event = e.detail.event;
  console.log('Real-time event:', event);
});
```

Set the namespace when initializing:

```javascript
startTracking('YOUR_API_URL', { realTime: true, realTimeNamespace: 'analytics' });
```

### Error Handling
- Invalid events are logged to console in debug mode.
- Failed event submissions are retried in the next batch. When multiple failures occur the retry delay increases exponentially up to one minute.
- Network errors are handled gracefully with fallback to fetch if sendBeacon fails.

## Browser Support
- Modern browsers with ES6+ support
- Requires localStorage API
- Uses modern APIs like sendBeacon with fetch fallback
- No IE11 support

## Privacy & Performance
- No cookies used, only localStorage for user identification
- Events are batched to reduce network requests
- Sampling rate support to reduce data volume
- Route exclusion for privacy-sensitive areas
- Sessions automatically end after inactivity while the user ID remains stored in `localStorage`

## License

MIT 