import {
  MAX_CUSTOM_EVENT_ARRAY_SIZE,
  MAX_CUSTOM_EVENT_KEYS,
  MAX_CUSTOM_EVENT_NAME_LENGTH,
  MAX_CUSTOM_EVENT_STRING_SIZE,
} from '../constants';
import { DatatakiEventCustomMetadataType } from '../types';

const isOnlyPrimitiveFields = (obj: Record<string, any>): obj is Record<string, DatatakiEventCustomMetadataType> => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        continue;
      }

      if (Array.isArray(value)) {
        const allStrings = value.every((item) => typeof item === 'string');

        if (!allStrings) {
          return false;
        }
      } else {
        return false;
      }
    }
  }

  return true;
};

export const isEventValid = (evName: string, metadata?: Record<string, any>): { valid: boolean; error?: string } => {
  if (evName.length > MAX_CUSTOM_EVENT_NAME_LENGTH) {
    return {
      valid: false,
      error: `sendCustomEvent name "${evName}" too large (max ${MAX_CUSTOM_EVENT_NAME_LENGTH} chars).`,
    };
  }

  if (!metadata) {
    return {
      valid: true,
    };
  }

  if (!isOnlyPrimitiveFields(metadata)) {
    return {
      valid: false,
      error: `sendCustomEvent "${evName}" metadata object has invalid types. Valid types are string, number, boolean or strings lists.`,
    };
  }

  let jsonString: string;

  try {
    jsonString = JSON.stringify(metadata);
  } catch (e) {
    return {
      valid: false,
      error: `sendCustomEvent "${evName}" metadata object contains circular references.`,
    };
  }

  if (jsonString.length > MAX_CUSTOM_EVENT_STRING_SIZE) {
    return {
      valid: false,
      error: `sendCustomEvent "${evName}" metadata object is too large (max ${MAX_CUSTOM_EVENT_STRING_SIZE / 1024} KB).`,
    };
  }

  if (Object.keys(metadata).length > MAX_CUSTOM_EVENT_KEYS) {
    return {
      valid: false,
      error: `sendCustomEvent "${evName}" metadata object has too many keys (max ${MAX_CUSTOM_EVENT_KEYS} keys).`,
    };
  }

  if (Object.values(metadata).some((value) => Array.isArray(value) && value.length > MAX_CUSTOM_EVENT_ARRAY_SIZE)) {
    return {
      valid: false,
      error: `sendCustomEvent "${evName}" metadata object has a too large array prop (max ${MAX_CUSTOM_EVENT_ARRAY_SIZE} length).`,
    };
  }

  return {
    valid: true,
  };
};
