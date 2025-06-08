import { Tracking } from './tracking';
import { EventType, MetadataType } from './types';
import { EVENT_SENT_INTERVAL } from './constants';

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

const mockNavigator = {
  sendBeacon: jest.fn().mockImplementation((url: string, data: Blob) => {
    return true;
  }),
} as unknown as Navigator;

const mockWindow = {
  location: {
    href: 'https://example.com',
    search: '',
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  scrollY: 0,
  innerHeight: 800,
  document: {
    documentElement: {
      scrollHeight: 2000,
    },
    referrer: 'https://referrer.com',
    hidden: false,
    addEventListener: jest.fn(),
  },
  history: {
    pushState: jest.fn(),
    replaceState: jest.fn(),
  },
  navigator: mockNavigator,
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
Object.defineProperty(window, 'location', { value: mockWindow.location });
Object.defineProperty(window, 'addEventListener', { value: mockWindow.addEventListener });
Object.defineProperty(window, 'removeEventListener', { value: mockWindow.removeEventListener });
Object.defineProperty(window, 'scrollY', { value: mockWindow.scrollY });
Object.defineProperty(window, 'innerHeight', { value: mockWindow.innerHeight });
Object.defineProperty(window, 'document', { value: mockWindow.document });
Object.defineProperty(window, 'history', { value: mockWindow.history });
Object.defineProperty(window, 'navigator', { value: mockNavigator });

describe('Tracking', () => {
  let tracking: Tracking;

  const mockApiUrl = 'https://api.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/test',
        origin: 'https://example.com',
      },
      writable: true,
    });
    tracking = new Tracking(mockApiUrl);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(tracking).toBeInstanceOf(Tracking);
    });

    it('should initialize with custom config', () => {
      const customConfig = { debug: true, sessionTimeout: 30000 };
      const customTracking = new Tracking(mockApiUrl, customConfig);

      expect(customTracking).toBeInstanceOf(Tracking);
    });
  });

  describe('sendCustomEvent', () => {
    it('should send a valid custom event', () => {
      const eventName = 'test_event';
      const metadata = { test: 'value' };

      tracking.sendCustomEvent(eventName, metadata);

      jest.advanceTimersByTime(EVENT_SENT_INTERVAL);

      expect(mockNavigator.sendBeacon).toHaveBeenCalled();

      const lastCall = (mockNavigator.sendBeacon as jest.Mock).mock.calls[0];

      expect(lastCall[0]).toBe(mockApiUrl);
      expect(lastCall[1]).toBeInstanceOf(Blob);

      const reader = new FileReader();
      reader.readAsText(lastCall[1]);

      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const sentData = JSON.parse(reader.result as string);
          expect(sentData).toHaveProperty('events');
          expect(sentData.events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: EventType.CUSTOM,
                custom_event: {
                  name: eventName,
                  metadata,
                },
              }),
            ]),
          );
          resolve();
        };
      });
    });

    it('should handle invalid custom event', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const invalidMetadata = {
        invalidProp: { nested: 'object' } as unknown as MetadataType,
      };

      // Instancia con debug: true
      const trackingDebug = new Tracking(mockApiUrl, { debug: true });
      trackingDebug.sendCustomEvent('', invalidMetadata);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('sendCustomEvent "" data object validation failed: sendCustomEvent name is required.'),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('session management', () => {
    it('should track session start', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
    });

    it('should track page view', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    });
  });

  describe('scroll tracking', () => {
    it('should track scroll events', () => {
      const scrollEvent = new Event('scroll');

      window.dispatchEvent(scrollEvent);

      jest.advanceTimersByTime(1000);

      expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    });
  });

  describe('click tracking', () => {
    it('should track click events', () => {
      const clickEvent = new MouseEvent('click', {
        clientX: 100,
        clientY: 200,
      });

      window.dispatchEvent(clickEvent);

      jest.advanceTimersByTime(1000);

      expect(window.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('isRouteExcluded', () => {
    it('should return false when no excludeRoutes are configured', () => {
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(false);
    });

    it('should return true for exact path match', () => {
      const tracking = new Tracking(mockApiUrl, {
        excludeRoutes: ['/test'],
      });
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(true);
    });

    it('should return true for regex pattern match', () => {
      const tracking = new Tracking(mockApiUrl, {
        excludeRoutes: [/^\/t.*/],
      });
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(true);
    });

    it('should return true for wildcard pattern match', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com/dashboard/123',
          origin: 'https://example.com',
        },
        writable: true,
      });
      const tracking = new Tracking(mockApiUrl, {
        excludeRoutes: ['/dashboard/*'],
      });
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(true);
    });

    it('should return false when path does not match any exclude pattern', () => {
      const tracking = new Tracking(mockApiUrl, {
        excludeRoutes: ['/admin', /^\/private/],
      });
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(false);
    });

    it('should handle multiple exclude patterns', () => {
      const tracking = new Tracking(mockApiUrl, {
        excludeRoutes: ['/admin', '/test', /^\/private/],
      });
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(true);
    });

    it('should handle empty excludeRoutes array', () => {
      const tracking = new Tracking(mockApiUrl, {
        excludeRoutes: [],
      });
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(false);
    });

    it('should handle different URL paths', () => {
      // Test with a different path
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com/admin',
          origin: 'https://example.com',
        },
        writable: true,
      });

      const tracking = new Tracking(mockApiUrl, {
        excludeRoutes: ['/admin'],
      });
      // @ts-ignore - accessing private method for testing
      expect(tracking.isRouteExcluded()).toBe(true);
    });
  });

  describe('isRouteExcluded - visual examples', () => {
    const cases = [
      { path: '/admin', excludeRoutes: ['/admin'], expected: true, desc: 'Exact match' },
      { path: '/admin/settings', excludeRoutes: ['/admin'], expected: false, desc: 'Does not match exactly' },
      { path: '/private', excludeRoutes: [/^\/private/], expected: true, desc: 'Regex: starts with /private' },
      { path: '/private/area', excludeRoutes: [/^\/private/], expected: true, desc: 'Regex: subroute of /private' },
      { path: '/dashboard', excludeRoutes: ['/admin', '/login'], expected: false, desc: 'Not in the list' },
      { path: '/login', excludeRoutes: ['/admin', '/login'], expected: true, desc: 'Matches /login' },
      {
        path: '/dashboard/123',
        excludeRoutes: ['/dashboard/*'],
        expected: true,
        desc: 'Wildcard /* matches subroutes of /dashboard',
      },
      { path: '/test', excludeRoutes: [/^\/t.*/], expected: true, desc: 'Regex: any route starting with /t' },
      { path: '/taki', excludeRoutes: [/^\/t.*/], expected: true, desc: 'Regex: /taki is also excluded' },
      { path: '/user', excludeRoutes: [/^\/t.*/], expected: false, desc: 'Does not match regex' },
    ];

    cases.forEach(({ path, excludeRoutes, expected, desc }) => {
      it(`Route "${path}" with excludeRoutes=${JSON.stringify(excludeRoutes)} → excluded: ${expected} (${desc})`, () => {
        Object.defineProperty(window, 'location', {
          value: {
            href: `https://example.com${path}`,
            origin: 'https://example.com',
          },
          writable: true,
        });
        const tracking = new Tracking('https://api.example.com', { excludeRoutes });
        // @ts-ignore
        expect(tracking.isRouteExcluded()).toBe(expected);
      });
    });
  });

  describe('collectEventsQueue', () => {
    let originalNavigator: Navigator;
    let originalFetch: any;

    beforeEach(() => {
      originalNavigator = window.navigator;
      Object.defineProperty(window, 'navigator', { value: {} as Navigator, configurable: true });
      originalFetch = (global as any).fetch;
    });

    afterEach(() => {
      Object.defineProperty(window, 'navigator', { value: originalNavigator });
      (global as any).fetch = originalFetch;
    });

    it('should return true when fetch status is 200', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({ status: 200 });

      const tracking = new Tracking(mockApiUrl);
      const body = {
        user_id: 'u',
        session_id: 's',
        device: 'desktop',
        events: [],
      } as any;

      // @ts-ignore - accessing private method for testing
      const result = await tracking.collectEventsQueue(body);

      expect(result).toBe(true);
    });

    it('should trigger retry when fetch status is 500', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({ status: 500 });

      const tracking = new Tracking(mockApiUrl);

      tracking.sendCustomEvent('fail');

      // @ts-ignore - accessing private method for testing
      await tracking.sendEventsQueue();

      jest.advanceTimersByTime(0);

      // @ts-ignore - accessing private property for testing
      expect(tracking.retryTimeoutId).not.toBeNull();
      // @ts-ignore - events should remain in the queue
      expect(tracking.eventsQueue.length).toBeGreaterThan(0);
    });
  });
});
