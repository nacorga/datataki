import { DeviceType } from './constants';

export type MetadataType = string | number | boolean | string[];

export enum EventType {
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  PAGE_VIEW = 'page_view',
  SCROLL = 'scroll',
  CLICK = 'click',
  CUSTOM = 'custom',
}

export enum ScrollDirection {
  UP = 'up',
  DOWN = 'down',
}

export type DatatakiConfig = {
  debug?: boolean;
  realTime?: boolean;
  sessionTimeout?: number;
  excludeRoutes?: Array<string | RegExp>;
  samplingRate?: number;
  globalMetadata?: Record<string, MetadataType>;
};

export type DatatakiEventHandler = {
  evType: EventType;
  url?: string;
  fromUrl?: string;
  customEvent?: DatatakiEventCustom;
  scrollData?: DatatakiEventScrollData;
  clickData?: DatatakiEventClickData;
};

export type DatatakiEventCustom = {
  name: string;
  metadata?: Record<string, MetadataType>;
};

export type DatatakiEventScrollData = {
  depth: number;
  direction: ScrollDirection;
};

export type DatatakiEventClickData = {
  element: string;
  x: number;
  y: number;
  relX: number;
  relY: number;
  id?: string;
  class?: string;
};

export type DatatakiEventClickAttrData = {
  name: string;
  value?: string;
};

export type DatatakiEventUtm = {
  campaign?: string;
  source?: string;
  medium?: string;
  term?: string;
  content?: string;
};

export type DatatakiEvent = {
  type: EventType;
  page_url: string;
  timestamp: number;
  referrer?: string;
  from_page_url?: string;
  scroll_data?: DatatakiEventScrollData;
  click_data?: DatatakiEventClickData;
  custom_event?: DatatakiEventCustom;
  utm?: DatatakiEventUtm;
};

export type DatatakiQueue = {
  user_id: string;
  session_id: string;
  device: DeviceType;
  events: DatatakiEvent[];
  debug_mode?: boolean;
  global_metadata?: Record<string, MetadataType>;
};
