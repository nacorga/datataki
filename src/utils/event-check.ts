import {
  MAX_CUSTOM_EVENT_ARRAY_SIZE,
  MAX_CUSTOM_EVENT_KEYS,
  MAX_CUSTOM_EVENT_NAME_LENGTH,
  MAX_CUSTOM_EVENT_STRING_SIZE,
} from '../constants';
import { MetadataType } from '../types';

const isOnlyPrimitiveFields = (obj: Record<string, any>): obj is Record<string, MetadataType> => {
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

const validateSizeLimits = (
  metadata: Record<string, MetadataType>,
  intro: string,
): { valid: boolean; error?: string } => {
  let size = 2;
  let keyCount = 0;
  let first = true;

  for (const key in metadata) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
      continue;
    }

    keyCount += 1;

    if (keyCount > MAX_CUSTOM_EVENT_KEYS) {
      return {
        valid: false,
        error: `${intro}: object has too many keys (max ${MAX_CUSTOM_EVENT_KEYS} keys).`,
      };
    }

    if (!first) {
      size += 1;
    }

    first = false;
    size += key.length + 3;

    const value = metadata[key];

    if (Array.isArray(value)) {
      if (value.length > MAX_CUSTOM_EVENT_ARRAY_SIZE) {
        return {
          valid: false,
          error: `${intro}: object has a too large array prop (max ${MAX_CUSTOM_EVENT_ARRAY_SIZE} length).`,
        };
      }

      size += 2;

      value.forEach((item, idx) => {
        if (idx) {
          size += 1;
        }

        size += item.length + 2;
      });
    } else if (typeof value === 'string') {
      size += value.length + 2;
    } else {
      size += String(value).length;
    }

    if (size > MAX_CUSTOM_EVENT_STRING_SIZE) {
      return {
        valid: false,
        error: `${intro}: object is too large (max ${MAX_CUSTOM_EVENT_STRING_SIZE / 1024} KB).`,
      };
    }
  }

  return {
    valid: true,
  };
};

export const isEventValid = (evName: string, metadata?: Record<string, any>): { valid: boolean; error?: string } => {
  if (!evName) {
    return {
      valid: false,
      error: `sendCustomEvent name is required.`,
    };
  }

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

  return isValidMetadata(evName, metadata, 'sendCustomEvent');
};

export const isValidMetadata = (
  evName: string,
  metadata: Record<string, any>,
  type?: string,
): { valid: boolean; error?: string } => {
  const intro = type && type === 'sendCustomEvent' ? `${type} "${evName}" metadata error` : `${evName} metadata error`;

  if (!isOnlyPrimitiveFields(metadata)) {
    return {
      valid: false,
      error: `${intro}: object has invalid types. Valid types are string, number, boolean or strings lists.`,
    };
  }

  const sizeCheck = validateSizeLimits(metadata, intro);

  if (!sizeCheck.valid) {
    return sizeCheck;
  }

  let jsonString: string;

  try {
    jsonString = JSON.stringify(metadata);
  } catch (e) {
    return {
      valid: false,
      error: `${intro}: object contains circular references.`,
    };
  }

  if (jsonString.length > MAX_CUSTOM_EVENT_STRING_SIZE) {
    return {
      valid: false,
      error: `${intro}: object is too large (max ${MAX_CUSTOM_EVENT_STRING_SIZE / 1024} KB).`,
    };
  }

  return {
    valid: true,
  };
};
