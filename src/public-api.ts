import { Tracking } from './tracking';
import { DatatakiConfig, MetadataType } from './types';

export * from './types';
export { DispatchEventKey, DeviceType } from './constants';

let trackingInstance: Tracking;

export const startTracking = (apiUrl: string, config?: DatatakiConfig): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error('Datataki must be executed in a browser environment.');

    return;
  }

  if (trackingInstance) {
    return;
  }

  if (!apiUrl) {
    console.error('Datataki config error: apiUrl is required.');

    return;
  }

  if (config?.sessionTimeout && config.sessionTimeout < 30_000) {
    console.error('Datataki config error: Invalid sessionTimeout (must be bigger or equal to 30s).');

    return;
  }

  if (typeof config?.samplingRate === 'number' && (config.samplingRate < 0 || config.samplingRate > 1)) {
    console.error('Datataki config error: Invalid samplingRate (must be a number between 0 and 1).');

    return;
  }

  trackingInstance = new Tracking(apiUrl, config);
};

export const sendCustomEvent = (name: string, metadata?: Record<string, MetadataType>): void => {
  if (!trackingInstance) {
    console.error('Datataki tracking not initialized. Call startTracking() first.');

    return;
  }

  trackingInstance.sendCustomEvent(name, metadata);
};
