import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl, setTenantId } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RoleProvider, useRole } from "@/context/RoleContext";
import { usePushNotifications, getFcmPushTokenAsync } from "@/hooks/usePushNotifications";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}
// Tenant 1 is intentional per architecture: this is a single-tenant deployment
// where all portal data belongs to tenant id=1. Multi-tenancy is scaffolded in the
// schema but not yet surfaced via user auth/session.
setTenantId(1);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

/**
 * Registers the device's Expo push token with the server once the parent is
 * logged in. Fetches ALL passenger IDs linked to this parent's phone number so
 * every child triggers proximity alerts on this device (multi-child support).
 *
 * Uses a plain fetch (not the generated hook) to avoid the queryKey requirement
 * of UseQueryOptions while staying outside TanStack Query's context boundary.
 */
function PushTokenRegistrar() {
  const { role, parentPhone } = useRole();
  const isParent = role === "parent" && !!parentPhone;
  const [passengerIds, setPassengerIds] = useState<number[]>([]);

  useEffect(() => {
    if (!isParent || !parentPhone) {
      setPassengerIds([]);
      return;
    }
    const base = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";
    fetch(`${base}/api/passengers?phone=${encodeURIComponent(parentPhone)}`, {
      headers: { "x-tenant-id": "1" },
    })
      .then((r) => r.json())
      .then((data: Array<{ id: number }>) => {
        if (Array.isArray(data)) {
          const ids = data.map((p) => p.id).filter(Boolean);
          if (ids.length > 0) setPassengerIds(ids);
        }
      })
      .catch(() => {});
  }, [isParent, parentPhone]);

  usePushNotifications(passengerIds, isParent);

  // ── FCM token registration ────────────────────────────────────────────
  // Fetches the raw native device token (FCM on Android / APNs on iOS) once
  // per app start and stores it alongside the Expo token for every passenger
  // this parent tracks. Best-effort: silently no-ops on web, in Expo Go, or
  // if Firebase isn't configured yet.
  const fcmRegisteredRef = useRef(false);
  useEffect(() => {
    if (!isParent || passengerIds.length === 0 || Platform.OS === "web") return;
    if (fcmRegisteredRef.current) return;

    const base = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";

    void (async () => {
      const fcmToken = await getFcmPushTokenAsync();
      if (!fcmToken) return;

      const results = await Promise.allSettled(
        passengerIds.map((passengerId) =>
          fetch(`${base}/api/push-tokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-tenant-id": "1" },
            body: JSON.stringify({ passengerId, token: fcmToken, provider: "fcm" }),
          })
        )
      );

      if (results.some((r) => r.status === "fulfilled" && r.value.ok)) {
        fcmRegisteredRef.current = true;
      }
    })();
  }, [isParent, passengerIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView
            style={
              Platform.OS === "web"
                ? { flex: 1, backgroundColor: "#09090b", alignItems: "center" }
                : { flex: 1 }
            }
          >
            <View
              style={
                Platform.OS === "web"
                  ? { flex: 1, width: "100%", maxWidth: 430, overflow: "hidden" }
                  : { flex: 1 }
              }
            >
              <KeyboardProvider>
                <RoleProvider>
                  <PushTokenRegistrar />
                  <RootLayoutNav />
                </RoleProvider>
              </KeyboardProvider>
            </View>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
