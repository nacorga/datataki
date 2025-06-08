import { Tracking } from './tracking';
import { DatatakiConfig, MetadataType } from './types';

export * from './types';
export { DispatchEventKey, DeviceType } from './constants';

let trackingInstance: Tracking;
let isDebugMode: boolean = false;

export const startTracking = (apiUrl: string, config?: DatatakiConfig): void => {
  isDebugMode = config?.debug ?? false;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (isDebugMode) {
      console.error('Datataki error: Package must be executed in a browser environment.');
    }

    return;
  }

  if (trackingInstance) {
    return;
  }

  if (!apiUrl) {
    if (isDebugMode) {
      console.error('Datataki error: apiUrl is required.');
    }

    return;
  }

  if (config?.sessionTimeout && config.sessionTimeout < 30_000) {
    if (isDebugMode) {
      console.error('Datataki error: Invalid sessionTimeout config (must be bigger or equal to 30s).');
    }

    return;
  }

  if (typeof config?.samplingRate === 'number' && (config.samplingRate < 0 || config.samplingRate > 1)) {
    if (isDebugMode) {
      console.error('Datataki error: Invalid samplingRate config (must be a number between 0 and 1).');
    }

    return;
  }

  const instance = new Tracking(apiUrl, config);

  if (!instance.isInitialized) {
    if (isDebugMode) {
      console.error('Datataki error: Invalid API URL provided. Please provide a valid URL or use "demo" mode.');
    }

    return;
  }

  trackingInstance = instance;
};

export const sendCustomEvent = (name: string, metadata?: Record<string, MetadataType>): void => {
  if (!trackingInstance) {
    if (isDebugMode) {
      console.error('Datataki error: Tracking not initialized. Call startTracking() first.');
    }

    return;
  }

  if (!trackingInstance.isInitialized) {
    if (isDebugMode) {
      console.error('Datataki error: Tracking failed to initialize. Event not sent.');
    }

    return;
  }

  trackingInstance.sendCustomEvent(name, metadata);
};
