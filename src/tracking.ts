import {
  CLICK_DEBOUNCE_TIME,
  DEFAULT_TRACKING_CONFIG,
  DeviceType,
  DispatchEventKey,
  EVENT_SENT_INTERVAL,
  HTML_DATA_ATTR_PREFIX,
  LSKey,
  SCROLL_DEBOUNCE_TIME,
  UTM_PARAMS,
} from './constants';
import {
  DatatakiEvent,
  EventType,
  ScrollDirection,
  DatatakiQueue,
  DatatakiConfig,
  DatatakiEventClickAttrData,
  DatatakiEventClickData,
  DatatakiEventHandler,
  DatatakiEventCustomMetadataType,
  DatatakiEventUtm,
} from './types';
import { getDeviceType } from './utils/device-detector';
import { isEventValid } from './utils/event-check';

export class Tracking {
  private apiUrl: string;
  private config: DatatakiConfig;
  private userId: string;
  private sessionId: string;
  private utmParams: DatatakiEventUtm | null;
  private pageUrl: string = '';
  private isInactive: boolean = false;
  private hasEndedSession: boolean = false;
  private eventsQueue: DatatakiEvent[] = [];
  private hasInitEventsQueueInterval: boolean = false;
  private eventsQueueIntervalId: number | null = null;
  private device: DeviceType;

  constructor(apiUrl: string, config: DatatakiConfig = {}) {
    this.apiUrl = apiUrl;
    this.config = { ...DEFAULT_TRACKING_CONFIG, ...config };
    this.userId = this.getUserId();
    this.sessionId = this.createId();
    this.utmParams = this.getUTMParameters();
    this.device = getDeviceType();
    this.init();
  }

  sendCustomEvent(name: string, metadata?: Record<string, DatatakiEventCustomMetadataType>) {
    const { valid, error } = isEventValid(name, metadata);

    if (valid) {
      try {
        this.handleEvent({
          evType: EventType.CUSTOM,
          customEvent: {
            name,
            ...(metadata && { metadata }),
          },
        });
      } catch (err) {
        if (this.config.debug) {
          console.error(`Invalid custom event: ${(err as Error).message}`);
        }
      }
    } else if (this.config.debug) {
      const message =
        error ||
        `sendCustomEvent "${name}" data object validation failed. Please, review your event data and try again.`;

      console.error(`Invalid custom event: ${message}`);
    }
  }

  private getUTMParameters(): DatatakiEventUtm | null {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams: Partial<Record<keyof DatatakiEventUtm, string>> = {};

    UTM_PARAMS.forEach((param) => {
      const value = urlParams.get(param);

      if (value) {
        const key = param.split('utm_')[1] as keyof DatatakiEventUtm;

        utmParams[key] = value;
      }
    });

    return Object.keys(utmParams).length ? utmParams : null;
  }

  private init() {
    if (this.config.debug) {
      console.warn('Datataki debug mode enabled. Remember disable it on production.');
    }

    this.pageUrl = window.location.href;
    this.handleEvent({ evType: EventType.SESSION_START });
    this.handleEvent({ evType: EventType.PAGE_VIEW });
    this.initScrollTracking();

    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);

      if (this.isInactive) {
        this.isInactiveHandler(false);
      }

      inactivityTimer = setTimeout(() => {
        this.isInactiveHandler(true);
      }, this.config.sessionTimeout);
    };

    ['mousemove', 'keydown', 'scroll', 'click'].forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    resetInactivityTimer();
    this.initClickTracking();

    history.pushState = this.handleHistoryStateChange(history.pushState);
    history.replaceState = this.handleHistoryStateChange(history.replaceState);

    window.addEventListener('popstate', () => {
      const fromUrl = this.pageUrl;

      this.pageUrl = window.location.href;
      this.trackPageNavigation(fromUrl);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isInactiveHandler(true);

        if (this.eventsQueue.length) {
          this.sendEventsQueue();
        }
      } else {
        this.isInactiveHandler(false);
      }
    });

    const handleSessionEnd = () => {
      if (!this.hasEndedSession) {
        this.hasEndedSession = true;
        this.handleEvent({ evType: EventType.SESSION_END });

        if (this.eventsQueueIntervalId !== null) {
          clearInterval(this.eventsQueueIntervalId);
        }
      }
    };

    window.addEventListener('beforeunload', handleSessionEnd);
    window.addEventListener('pagehide', handleSessionEnd);
  }

  private initScrollTracking() {
    let lastScrollTop = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        const scrollTop = window.scrollY;
        const viewportHeight = window.innerHeight;
        const pageHeight = document.documentElement.scrollHeight;
        const scrollDepth = Math.min(100, Math.max(0, Math.floor((scrollTop / (pageHeight - viewportHeight)) * 100)));
        const direction = scrollTop > lastScrollTop ? ScrollDirection.DOWN : ScrollDirection.UP;

        lastScrollTop = scrollTop;

        this.handleEvent({
          evType: EventType.SCROLL,
          scrollData: {
            depth: scrollDepth,
            direction,
          },
        });

        debounceTimer = null;
      }, SCROLL_DEBOUNCE_TIME);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  private initClickTracking() {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleClick = (event: MouseEvent) => {
      const pageUrl = window.location.href;

      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        const clickedElement = event.target as HTMLElement;

        if (!clickedElement) return;

        let htmlElRef: HTMLElement = clickedElement;
        let hasDataAttr = clickedElement.hasAttribute(`${HTML_DATA_ATTR_PREFIX}-name`);

        if (!hasDataAttr) {
          const closestClickedElementWithDataAttr = clickedElement.closest(
            `[${HTML_DATA_ATTR_PREFIX}-name]`,
          ) as HTMLElement;

          if (closestClickedElementWithDataAttr) {
            htmlElRef = closestClickedElementWithDataAttr;
            hasDataAttr = true;
          }
        }

        let attrData: DatatakiEventClickAttrData | undefined;

        if (hasDataAttr) {
          const attrName = htmlElRef.getAttribute(`${HTML_DATA_ATTR_PREFIX}-name`);
          const attrValue = htmlElRef.getAttribute(`${HTML_DATA_ATTR_PREFIX}-value`);

          if (attrName) {
            attrData = {
              name: attrName,
              ...(attrValue && { value: attrValue }),
            };
          }
        }

        const clickData: DatatakiEventClickData = {
          element: htmlElRef.tagName.toLowerCase(),
          x: event.clientX,
          y: event.clientY,
          ...(htmlElRef.id && { id: htmlElRef.id }),
          ...(htmlElRef.className && { class: htmlElRef.className }),
          ...(attrData && { attrData }),
        };

        this.handleEvent({
          evType: EventType.CLICK,
          url: pageUrl,
          clickData,
        });

        debounceTimer = null;
      }, CLICK_DEBOUNCE_TIME);
    };

    window.addEventListener('click', handleClick);
  }

  private handleEvent({ evType, url, fromUrl, scrollData, clickData, customEvent }: DatatakiEventHandler) {
    let errorMessage: string | null = null;

    if (evType === EventType.SCROLL && !scrollData) {
      errorMessage = 'scrollData is required for SCROLL event. Event ignored.';
    }

    if (evType === EventType.CLICK && !clickData) {
      errorMessage = 'clickData is required for CLICK event. Event ignored.';
    }

    if (evType === EventType.CUSTOM && !customEvent) {
      errorMessage = 'customEvent is required for CUSTOM event. Event ignored.';
    }

    if (errorMessage) {
      if (this.config.debug) {
        console.error(errorMessage);
      }

      return;
    }

    const isFirstEvent = evType === EventType.SESSION_START;

    const payload: DatatakiEvent = {
      type: evType,
      session_id: this.sessionId,
      page_url: url || this.pageUrl,
      timestamp: Date.now(),
      device: this.device,
      ...(isFirstEvent && { referrer: document.referrer || 'Direct' }),
      ...(fromUrl && { from_page_url: fromUrl }),
      ...(scrollData && { scroll_data: scrollData }),
      ...(clickData && { click_data: clickData }),
      ...(customEvent && { custom_event: customEvent }),
      ...(isFirstEvent && this.utmParams && { utm: this.utmParams }),
    };

    this.sendEvent(payload);
  }

  private sendEvent(payload: DatatakiEvent) {
    this.eventsQueue.push(payload);

    if (!this.hasInitEventsQueueInterval) {
      this.initEventsQueueInterval();
    }

    if (this.config.debug) {
      console.log(payload);

      if (this.config.realTime) {
        window.dispatchEvent(new CustomEvent(DispatchEventKey.Event, { detail: { event: payload } }));
      }
    }

    if (payload.type === EventType.SESSION_END && this.eventsQueue.length) {
      this.sendEventsQueue();
    }
  }

  private initEventsQueueInterval() {
    this.hasInitEventsQueueInterval = true;

    this.eventsQueueIntervalId = window.setInterval(() => {
      if (this.eventsQueue.length) {
        this.sendEventsQueue();
      }
    }, EVENT_SENT_INTERVAL);
  }

  private sendEventsQueue() {
    const body: DatatakiQueue = {
      user_id: this.userId,
      events: this.eventsQueue,
      ...(this.config.debug && { debug_mode: true }),
    };

    const isSendBeaconSuccess = this.collectEventsQueue(body);

    if (isSendBeaconSuccess) {
      this.eventsQueue = [];
    }
  }

  private trackPageNavigation(fromUrl: string) {
    this.handleEvent({
      evType: EventType.PAGE_VIEW,
      fromUrl,
    });
  }

  private handleHistoryStateChange(method: any) {
    return (...args: any[]) => {
      method.apply(history, args);
      const fromUrl = this.pageUrl;
      this.pageUrl = window.location.href;
      this.trackPageNavigation(fromUrl);
    };
  }

  private isInactiveHandler(isInactive: boolean) {
    if (isInactive) {
      if (!this.hasEndedSession) {
        this.handleEvent({ evType: EventType.SESSION_END });
        this.hasEndedSession = true;
      }
    } else {
      if (this.hasEndedSession) {
        this.sessionId = this.createId();
        this.handleEvent({ evType: EventType.SESSION_START });
        this.hasEndedSession = false;
      }
    }
  }

  private collectEventsQueue(body: DatatakiQueue): boolean {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });

    return navigator.sendBeacon(this.apiUrl, blob);
  }

  private getUserId(): string {
    const storedId = localStorage.getItem(LSKey.UserId);

    if (storedId) {
      return storedId;
    }

    const newId = this.createId();

    localStorage.setItem(LSKey.UserId, newId);

    return newId;
  }

  private createId() {
    const timestamp = Date.now();

    return (
      'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) +
      '-' +
      timestamp.toString(16)
    );
  }
}
