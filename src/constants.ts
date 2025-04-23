import { DatatakiConfig } from './types';

export enum LSKey {
  UserId = 'datataki_uid',
}

export enum DispatchEventKey {
  Event = 'DatatakiEvent',
}

export enum DeviceType {
  Mobile = 'mobile',
  Tablet = 'tablet',
  Desktop = 'desktop',
  Unknown = 'unknown',
}

export const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
export const EVENT_SENT_INTERVAL = 10_000;
export const SCROLL_DEBOUNCE_TIME = 250;
export const HTML_DATA_ATTR_PREFIX = 'data-taki';
export const MAX_CUSTOM_EVENT_NAME_LENGTH = 120;
export const MAX_CUSTOM_EVENT_STRING_SIZE = 10 * 1024;
export const MAX_CUSTOM_EVENT_KEYS = 12;
export const MAX_CUSTOM_EVENT_ARRAY_SIZE = 12;

export const DEFAULT_TRACKING_CONFIG: Omit<DatatakiConfig, 'apiUrl'> = {
  debug: false,
  realTime: false,
  sessionTimeout: 60_000 * 15,
};
