import { useUpdateDriverLocation } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const TRACKING_INTERVAL_MS = 15_000;

interface Options {
  /**
   * True only when the driver has an active journey (isJourneyActive from the
   * server). Using !!trip is wrong — the server returns trip data even when the
   * driver is offline.
   */
  isActive: boolean;
  driverId?: number | null;
}

export function useDriverLocationTracking({ isActive, driverId }: Options) {
  const mutation = useUpdateDriverLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const postLocation = (lat: number, lng: number, accuracy?: number) => {
    mutation.mutate({
      data: {
        lat,
        lng,
        ...(accuracy != null ? { accuracy } : {}),
        ...(driverId != null ? { driverId } : {}),
      },
    });
  };

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let stopped = false;

    const startTracking = async () => {
      if (Platform.OS !== "web") {
        const Location = await import("expo-location");

        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted || stopped) return;

        const tick = async () => {
          if (stopped) return;
          try {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            postLocation(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy ?? undefined
            );
          } catch {
          }
        };

        void tick();
        intervalRef.current = setInterval(() => void tick(), TRACKING_INTERVAL_MS);
      } else {
        if (!navigator.geolocation) return;

        const tick = () => {
          if (stopped) return;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              postLocation(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.accuracy ?? undefined
              );
            },
            () => {},
            { enableHighAccuracy: false, timeout: 10_000 }
          );
        };

        tick();
        intervalRef.current = setInterval(tick, TRACKING_INTERVAL_MS);
      }
    };

    void startTracking();

    return () => {
      stopped = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, driverId]);
}
