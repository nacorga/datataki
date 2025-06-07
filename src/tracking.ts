import {
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
  MetadataType,
  DatatakiEventUtm,
} from './types';
import { getDeviceType } from './utils/device-detector';
import { isEventValid, isValidMetadata } from './utils/event-check';

export class Tracking {
  private apiUrl: string;
  private config: DatatakiConfig;
  private userId: string;
  private sessionId: string;
  private globalMetadata: Record<string, MetadataType> | undefined;
  private utmParams: DatatakiEventUtm | null;
  private pageUrl: string = '';
  private isInactive: boolean = false;
  private hasEndedSession: boolean = false;
  private eventsQueue: DatatakiEvent[] = [];
  private hasInitEventsQueueInterval: boolean = false;
  private eventsQueueIntervalId: number | null = null;
  private device: DeviceType;
  private suppressNextScroll = false;

  constructor(apiUrl: string, config: DatatakiConfig = {}) {
    this.apiUrl = apiUrl;
    this.config = { ...DEFAULT_TRACKING_CONFIG, ...config };
    this.userId = this.getUserId();
    this.sessionId = this.createId();
    this.utmParams = this.getUTMParameters();
    this.device = getDeviceType();
    this.init();
  }

  sendCustomEvent(name: string, metadata?: Record<string, MetadataType>) {
    const { valid, error } = isEventValid(name, metadata);

    if (valid) {
      this.handleEvent({
        evType: EventType.CUSTOM,
        customEvent: {
          name,
          ...(metadata && { metadata }),
        },
      });
    } else if (this.config!.debug) {
      console.error(
        `sendCustomEvent "${name}" data object validation failed: ${error || 'unknown error'}. Please, review your event data and try again.`,
      );
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

    if (Object.keys(this.config!.globalMetadata || {}).length) {
      const { valid, error } = isValidMetadata('globalMetadata', this.config!.globalMetadata || {});

      if (valid) {
        this.globalMetadata = this.config!.globalMetadata;
      } else if (this.config!.debug) {
        console.error(
          `globalMetadata object validation failed: ${error || 'unknown error'}. Please, review your data and try again.`,
        );
      }
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
      if (this.suppressNextScroll) {
        this.suppressNextScroll = false;

        return;
      }

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
    const handleClick = (event: MouseEvent) => {
      const clickedElement = event.target as HTMLElement;

      if (!clickedElement) return;

      let htmlElRef: HTMLElement = clickedElement;
      let hasDataAttr = clickedElement.hasAttribute(`${HTML_DATA_ATTR_PREFIX}-name`);

      if (!hasDataAttr) {
        const closest = clickedElement.closest(`[${HTML_DATA_ATTR_PREFIX}-name]`) as HTMLElement;

        if (closest) {
          htmlElRef = closest;
          hasDataAttr = true;
        }
      }

      const rect = htmlElRef.getBoundingClientRect();
      const X = event.clientX;
      const Y = event.clientY;
      const relX = (X - rect.left) / rect.width;
      const relY = (Y - rect.top) / rect.height;

      if (hasDataAttr) {
        const name = htmlElRef.getAttribute(`${HTML_DATA_ATTR_PREFIX}-name`)!;
        const value = htmlElRef.getAttribute(`${HTML_DATA_ATTR_PREFIX}-value`);
        const attrData: DatatakiEventClickAttrData = { name, ...(value && { value }) };

        this.handleEvent({
          evType: EventType.CUSTOM,
          customEvent: {
            name: attrData.name,
            ...(attrData.value && { metadata: { value: attrData.value } }),
          },
        });
      }

      const clickData: DatatakiEventClickData = {
        element: htmlElRef.tagName.toLowerCase(),
        x: X,
        y: Y,
        relX,
        relY,
        ...(htmlElRef.id && { id: htmlElRef.id }),
        ...(htmlElRef.className && { class: htmlElRef.className }),
      };

      this.handleEvent({
        evType: EventType.CLICK,
        url: window.location.href,
        clickData,
      });
    };

    window.addEventListener('click', handleClick, true);
  }

  private handleEvent({ evType, url, fromUrl, scrollData, clickData, customEvent }: DatatakiEventHandler) {
    if (!this.isSampledUser()) {
      return;
    }

    if (this.isRouteExcluded() && [EventType.CLICK, EventType.SCROLL].includes(evType)) {
      return;
    }

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
      page_url: url || this.pageUrl,
      timestamp: Date.now(),
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
    if (this.config.debug) {
      console.log(payload);
    }

    if (this.config.realTime) {
      window.dispatchEvent(new CustomEvent(DispatchEventKey.Event, { detail: { event: payload } }));
    }

    this.eventsQueue.push(payload);

    if (!this.hasInitEventsQueueInterval) {
      this.initEventsQueueInterval();
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
    const uniqueEvents = this.eventsQueue.reduce((acc: DatatakiEvent[], current) => {
      const isDuplicate = acc.some(({ timestamp, type }) => timestamp === current.timestamp && type === current.type);

      if (!isDuplicate) {
        acc.push(current);
      }

      return acc;
    }, []);

    this.eventsQueue = uniqueEvents;

    const body: DatatakiQueue = {
      user_id: this.userId,
      session_id: this.sessionId,
      device: this.device,
      events: this.eventsQueue,
      ...(this.config.debug && { debug_mode: true }),
      ...(this.globalMetadata && { global_metadata: this.globalMetadata }),
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

    this.suppressNextScroll = true;

    setTimeout(() => {
      this.suppressNextScroll = false;
    }, SCROLL_DEBOUNCE_TIME + 10);
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
    if (isInactive && !this.hasEndedSession) {
      this.handleEvent({ evType: EventType.SESSION_END });
      this.hasEndedSession = true;
    }

    if (!isInactive && this.hasEndedSession) {
      this.sessionId = this.createId();
      this.handleEvent({ evType: EventType.SESSION_START });
      this.hasEndedSession = false;
    }
  }

  private collectEventsQueue(body: DatatakiQueue): boolean {
    if (this.apiUrl === 'demo') {
      return true;
    }

    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });

    return navigator.sendBeacon(this.apiUrl, blob);
  }

  private isSampledUser(): boolean {
    if (this.config.samplingRate === 1) {
      return true;
    }

    const userIdHash = parseInt(this.userId.slice(-6), 16) / 0xffffff;

    return userIdHash < (this.config.samplingRate || 1);
  }

  private isRouteExcluded(): boolean {
    if (!this.config.excludeRoutes?.length) {
      return false;
    }

    const path = new URL(this.pageUrl, window.location.origin).pathname;

    return this.config.excludeRoutes.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(path);
      }

      if (pattern.includes('*')) {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}$`);

        return regex.test(path);
      }

      return pattern === path;
    });
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
