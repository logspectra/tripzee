import { useCallback, useState } from 'react';

export interface Position {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

/** One-shot location lookup — only runs when the user explicitly asks (never on page load). */
export function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Your browser does not support location access.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setLoading(false);
      },
      (e) => {
        setError(e.code === e.PERMISSION_DENIED ? 'Location permission was denied. You can still search or tap the map.' : 'Could not get your location. Try again or tap the map.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  return { position, error, loading, locate, setPosition };
}
