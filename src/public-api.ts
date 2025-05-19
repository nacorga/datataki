import { Tracking } from './tracking';
import { DatatakiConfig, MetadataType } from './types';

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

  if (config?.sessionTimeout && config.sessionTimeout < 30_000) {
    throw new Error('Datataki config error: Invalid sessionTimeout (must be bigger or equal to 30s).');
  }

  if (typeof config?.samplingRate === 'number' && (config.samplingRate < 0 || config.samplingRate > 1)) {
    throw new Error('Datataki config error: Invalid samplingRate (must be a number between 0 and 1).');
  }

  trackingInstance = new Tracking(apiUrl, config);
};

export const sendCustomEvent = (name: string, metadata?: Record<string, MetadataType>): void => {
  if (!trackingInstance) {
    throw new Error('Datataki tracking not initialized. Call startTracking() first.');
  }

  trackingInstance.sendCustomEvent(name, metadata);
};
