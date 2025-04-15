import { DeviceType } from '../constants';

export const getDeviceType = (): DeviceType => {
  try {
    if ('userAgentData' in navigator) {
      const uaData = (navigator as any).userAgentData;

      if (uaData && typeof uaData.mobile === 'boolean') {
        if (uaData.platform && typeof uaData.platform === 'string' && /ipad|tablet/i.test(uaData.platform)) {
          return DeviceType.Tablet;
        }

        return uaData.mobile ? DeviceType.Mobile : DeviceType.Desktop;
      }
    }

    const width = window.innerWidth;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const hasNoHover = window.matchMedia('(hover: none)').matches;
    const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
    const isTabletUA = /tablet|ipad|android(?!.*mobile)/.test(ua);

    if (width <= 767 || (isMobileUA && hasTouchSupport)) {
      return DeviceType.Mobile;
    }

    if ((width >= 768 && width <= 1024) || isTabletUA || (hasCoarsePointer && hasNoHover && hasTouchSupport)) {
      return DeviceType.Tablet;
    }

    return DeviceType.Desktop;
  } catch (err) {
    return DeviceType.Unknown;
  }
};
