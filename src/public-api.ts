import { Tracking } from './tracking';
import { DatatakiConfig, DatatakiEventCustomMetadataType } from './types';

export * from './types';
export { DispatchEventKey, DeviceType } from './constants';

let trackingInstance: Tracking;

export const startTracking = (apiUrl: string, config?: DatatakiConfig): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Datataki must be executed in a browser environment.');
  }

  if (trackingInstance) {
    return;
  }

  trackingInstance = new Tracking(apiUrl, config);
};

export const sendCustomEvent = (name: string, metadata?: Record<string, DatatakiEventCustomMetadataType>): void => {
  if (!trackingInstance) {
    throw new Error('Tracking not initialized. Call startTracking() first.');
  }

  trackingInstance.sendCustomEvent(name, metadata);
};
