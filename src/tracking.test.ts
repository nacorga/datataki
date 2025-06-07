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

  const mockApiUrl = 'https://api.example.com/track';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    tracking = new Tracking(mockApiUrl, { debug: true });
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

      tracking.sendCustomEvent('', invalidMetadata);

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

  describe('excludeRoutes with wildcard', () => {
    it('should ignore click events on excluded wildcard routes', () => {
      mockWindow.location.href = 'https://example.com/dashboard/home';
      tracking = new Tracking(mockApiUrl, { debug: true, excludeRoutes: ['/dashboard/*'] });

      const clickEvent = new MouseEvent('click', { clientX: 50, clientY: 50 });

      window.dispatchEvent(clickEvent);

      jest.advanceTimersByTime(EVENT_SENT_INTERVAL);

      const lastCall = (mockNavigator.sendBeacon as jest.Mock).mock.calls[0];

      const reader = new FileReader();
      reader.readAsText(lastCall[1]);

      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const sentData = JSON.parse(reader.result as string);
          const clickEvents = sentData.events.filter((e: any) => e.type === EventType.CLICK);
          expect(clickEvents.length).toBe(0);
          resolve();
        };
      });
    });

    it('should track click events when wildcard route does not match', () => {
      mockWindow.location.href = 'https://example.com/profile';
      tracking = new Tracking(mockApiUrl, { debug: true, excludeRoutes: ['/dashboard/*'] });

      const clickEvent = new MouseEvent('click', { clientX: 60, clientY: 60 });

      window.dispatchEvent(clickEvent);

      jest.advanceTimersByTime(EVENT_SENT_INTERVAL);

      const lastCall = (mockNavigator.sendBeacon as jest.Mock).mock.calls[0];

      const reader = new FileReader();
      reader.readAsText(lastCall[1]);

      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const sentData = JSON.parse(reader.result as string);
          const clickEvents = sentData.events.filter((e: any) => e.type === EventType.CLICK);
          expect(clickEvents.length).toBeGreaterThan(0);
          resolve();
        };
      });
    });
  });
});
