# Datataki

A lightweight client-side event tracking library for web applications. Track user sessions, page views, interactions and custom events with minimal setup.

## Features

- 🔄 Automatic session tracking
- 📊 Page view tracking 
- 🖱️ Click tracking with custom data attributes
- 📜 Scroll depth and direction tracking
- ✨ Custom events support
- 📱 Device type detection
- 🔍 UTM parameter tracking
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
  realTime: false,
  sessionTimeout: 30000
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
  debug?: boolean;        // Enable console logging
  realTime?: boolean;     // Enable real-time event dispatching
  sessionTimeout?: number; // Inactivity timeout in ms (default: 30000)
}
```

## Automatic Events

Datataki automatically tracks these events:

### Session Events
- `SESSION_START`: When a new session begins
- `SESSION_END`: When session ends due to inactivity/page close

### Page Events
- `PAGE_VIEW`: On initial load and navigation changes
- `SCROLL`: Records scroll depth and direction
- `CLICK`: Captures click events with element details

## Click Tracking with Data Attributes

Add custom data to click events using data attributes:

```html
<button 
  data-taki-name="signup_button"
  data-taki-value="premium_plan">
  Sign Up
</button>
```

The click event will include:
```javascript
click_data: {
  element: 'button',
  x: number,
  y: number,
  attrData: {
    name: 'signup_button',
    value: 'premium_plan'
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

Metadata restrictions:
- Event name: max 120 characters
- Metadata object: max 10KB
- Max 12 metadata keys
- Arrays: max 12 items
- Valid types: string, number, boolean, string[]

## Event Payload

All events include:
```javascript
{
  type: EventType;
  session_id: string;
  page_url: string;
  timestamp: number;
  device: DeviceType;
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

## Real-time Events

Enable real-time event dispatching:

```javascript
startTracking('YOUR_API_URL', { realTime: true });

window.addEventListener('DatatakiEvent', (e: CustomEvent) => {
  console.log(e.detail.event);
});
```

## Debug Mode

Enable debug mode to log events to console:

```javascript
startTracking('YOUR_API_URL', { debug: true });
```

## Browser Support

Requires browsers with support for:
- localStorage
- Beacon API
- CustomEvent
- matchMedia

## Privacy & Data Collection

Datataki is designed with privacy in mind:

### Anonymous by Design
- No collection of personal identifiable information (PII)
- Random session IDs that cannot be linked to individuals
- No IP address tracking
- No cookies used

### Data Collection
All collected data is anonymous:
```javascript
{
  type: EventType;
  session_id: string; // randomly generated
  page_url: string; // without query params containing PII
  timestamp: number;
  device: DeviceType;
  // Event specific anonymous data
}
```

### Custom Events
When sending custom events, ensure no PII is included:

```javascript
// Good ✅
sendCustomEvent('button_click', {
  buttonId: 'submit-form',
  category: 'navigation',
  isValid: true
});

// Bad ❌
sendCustomEvent('form_submit', {
  email: 'user@email.com', // No PII!
  name: 'John Doe',        // No PII!
  userId: '12345'          // No PII!
});
```

## License

MIT 