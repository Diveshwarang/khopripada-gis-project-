/**
 * Browser Geolocation API Service for Field Surveyors
 * High-accuracy GPS positioning with spatial bounding box enforcement for Khopripada
 */

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Khopripada - Bapane study corridor bounds
export const KHOPRIPADA_BOUNDS: BoundingBox = {
  minLat: 19.3000,
  maxLat: 19.4500,
  minLng: 72.7500,
  maxLng: 72.9000,
};

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isWithinBounds: boolean;
}

export interface GeolocationErrorResult {
  code: number;
  message: string;
}

/**
 * Check if a coordinate pair falls within the defined survey bounding box
 */
export const isCoordInStudyCorridor = (
  lat: number,
  lng: number,
  bounds: BoundingBox = KHOPRIPADA_BOUNDS
): boolean => {
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
};

/**
 * Request single high-accuracy GNSS fix using browser navigator.geolocation
 */
export const getCurrentPosition = (): Promise<GeolocationResult> => {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({
        code: 0,
        message: 'Geolocation API is not supported by your browser.',
      });
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude, heading, speed } =
          position.coords;
        const isWithin = isCoordInStudyCorridor(latitude, longitude);

        resolve({
          latitude,
          longitude,
          accuracy,
          altitude,
          heading,
          speed,
          timestamp: position.timestamp,
          isWithinBounds: isWithin,
        });
      },
      (error) => {
        let errorMsg = 'Failed to obtain GPS position.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'GPS location permission was denied. Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'GPS satellite fix unavailable. Check your device location sensors.';
            break;
          case error.TIMEOUT:
            errorMsg = 'GNSS location acquisition timed out (10s threshold). Retrying in high accuracy mode...';
            break;
        }
        reject({
          code: error.code,
          message: errorMsg,
        });
      },
      options
    );
  });
};
