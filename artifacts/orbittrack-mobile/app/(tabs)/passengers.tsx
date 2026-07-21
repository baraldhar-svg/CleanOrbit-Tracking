import { Ionicons } from "@expo/vector-icons";
import {
  useListPassengers,
  useBoardPassenger,
  useUnboardPassenger,
  useSendBoardingOtp,
  useTriggerSos,
} from "@workspace/api-client-react";
import type { Passenger } from "@workspace/api-client-react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

interface OtpTarget {
  passenger: Passenger;
  serverDemoCode: string | null;
}

export default function PassengersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [otpTarget, setOtpTarget] = useState<OtpTarget | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 80;

  const { data: passengers, isLoading, error, refetch, isRefetching } = useListPassengers(
    undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { refetchInterval: 20_000 } as any },
  );

  const boardMutation = useBoardPassenger();
  const unboardMutation = useUnboardPassenger();
  const sendOtpMutation = useSendBoardingOtp();
  const sosMutation = useTriggerSos();

  const pending = passengers?.filter((p) => p.status === "pending" && p.liveToday !== 0).length ?? 0;
  const boarded = passengers?.filter((p) => p.status === "boarded").length ?? 0;
  const total = passengers?.length ?? 0;

  const handleSos = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "SOS Emergency",
      "This will send an emergency alert to the school and all parents. Confirm?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "SEND SOS",
          style: "destructive",
          onPress: async () => {
            setSosLoading(true);
            try {
              await sosMutation.mutateAsync(undefined as unknown as void);
              Alert.alert("SOS Sent", "Emergency alert has been dispatched.");
            } catch {
              Alert.alert("Error", "Failed to send SOS. Please try again.");
            } finally {
              setSosLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBoard = async (passenger: Passenger) => {
    if (passenger.status === "boarded") {
      Alert.alert(
        "Unboard Passenger",
        `Mark ${passenger.name} as unboarded?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unboard",
            onPress: async () => {
              try {
                await unboardMutation.mutateAsync({ id: passenger.id });
                await queryClient.invalidateQueries();
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {
                Alert.alert("Error", "Failed to unboard passenger.");
              }
            },
          },
        ]
      );
      return;
    }

    try {
      const result = await sendOtpMutation.mutateAsync({ id: passenger.id });
      setOtpTarget({
        passenger,
        serverDemoCode: result.demoCode ?? null,
      });
    } catch {
      Alert.alert("Error", "Failed to send boarding OTP. Please try again.");
    }
  };

  const handleOtpConfirm = async (passenger: Passenger, enteredOtp: string) => {
    try {
      await boardMutation.mutateAsync({ id: passenger.id, data: { otp: enteredOtp } });
      await queryClient.invalidateQueries();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOtpTarget(null);
    } catch (err: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as { message?: string })?.message ??
        "Incorrect or expired OTP. Please try again.";
      Alert.alert("Boarding Failed", message);
    }
  };

  const handleOpenScanner = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Camera Not Available",
        "QR scanning requires the native app. Use OTP boarding instead.",
        [{ text: "OK" }],
      );
      return;
    }
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please allow camera access in your device settings to scan QR codes.",
          [{ text: "OK" }],
        );
        return;
      }
    }
    scanLockRef.current = false;
    setScannerOpen(true);
  };

  const handleQrScanned = async (data: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScannerOpen(false);

    let passengerId: number;
    let qrToken: string;
    try {
      // Decode base64url → base64 → JSON (using atob, which is available in React Native)
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
      const json = atob(padded);
      const parsed = JSON.parse(json) as { pid: number };
      if (typeof parsed.pid !== "number") throw new Error("Invalid token structure");
      passengerId = parsed.pid;
      qrToken = data;
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid QR Code", "This QR code was not generated by OrbitTrack.", [
        { text: "OK", onPress: () => { scanLockRef.current = false; } },
      ]);
      return;
    }

    const passenger = passengers?.find((p) => p.id === passengerId);
    if (!passenger) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Passenger Not Found", "Could not match this QR code to a passenger on this route.", [
        { text: "OK", onPress: () => { scanLockRef.current = false; } },
      ]);
      return;
    }

    if (passenger.status === "boarded") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Already Boarded", `${passenger.name} is already on board.`, [
        { text: "OK", onPress: () => { scanLockRef.current = false; } },
      ]);
      return;
    }

    try {
      await boardMutation.mutateAsync({ id: passenger.id, data: { qrToken } });
      await queryClient.invalidateQueries();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Boarded!", `${passenger.name} has been checked in.`, [
        { text: "OK", onPress: () => { scanLockRef.current = false; } },
      ]);
    } catch (err: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as { message?: string })?.message ??
        "Could not board passenger. QR may be expired.";
      Alert.alert("Boarding Failed", message, [
        { text: "OK", onPress: () => { scanLockRef.current = false; } },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Passengers
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {boarded}/{total} boarded · {pending} awaiting
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.scanBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleOpenScanner}
            >
              <Ionicons name="qr-code-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.scanBtnTxt, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                Scan QR
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.sosBtn,
                { backgroundColor: "#ef4444", opacity: pressed || sosLoading ? 0.7 : 1 },
              ]}
              onPress={handleSos}
              disabled={sosLoading}
            >
              {sosLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="warning" size={18} color="#fff" />
              )}
              <Text style={[styles.sosTxt, { fontFamily: "Inter_700Bold" }]}>SOS</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { backgroundColor: colors.primary, width: total > 0 ? `${(boarded / total) * 100}%` : "0%" },
            ]}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Could not load passengers
          </Text>
          <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.retryTxt, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={passengers ?? []}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomPad }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          scrollEnabled={!!(passengers?.length)}
          renderItem={({ item }) => (
            <PassengerRow
              passenger={item}
              colors={colors}
              onPress={handleBoard}
              isSendingOtp={sendOtpMutation.isPending && sendOtpMutation.variables?.id === item.id}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No passengers registered
              </Text>
            </View>
          }
        />
      )}

      {otpTarget && (
        <OtpModal
          passenger={otpTarget.passenger}
          serverDemoCode={otpTarget.serverDemoCode}
          colors={colors}
          onConfirm={(enteredOtp) => handleOtpConfirm(otpTarget.passenger, enteredOtp)}
          onClose={() => setOtpTarget(null)}
          isLoading={boardMutation.isPending}
        />
      )}

      {scannerOpen && (
        <QrScannerModal
          colors={colors}
          onScan={handleQrScanned}
          onClose={() => { setScannerOpen(false); scanLockRef.current = false; }}
          insets={insets}
        />
      )}
    </View>
  );
}

function PassengerRow({ passenger, colors, onPress, isSendingOtp }: {
  passenger: Passenger;
  colors: ReturnType<typeof useColors>;
  onPress: (p: Passenger) => void;
  isSendingOtp: boolean;
}) {
  const isBoarded = passenger.status === "boarded";
  const isLeave = passenger.status === "leave";
  const isAbsent = passenger.status === "absent";

  const statusColor = isBoarded ? "#22c55e" : isLeave ? "#94a3b8" : isAbsent ? "#ef4444" : colors.mutedForeground;

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.rowLeft}>
        {passenger.photoUrl ? (
          <Image source={{ uri: passenger.photoUrl }} style={[styles.avatar, { borderColor: statusColor }]} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: colors.muted, borderColor: statusColor }]}>
            <Ionicons name="person" size={18} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {passenger.name}
          </Text>
          <Text style={[styles.rowStation, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {passenger.stationName ?? `Station ${passenger.stationId}`}
          </Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.boardBtn,
          {
            backgroundColor: isBoarded ? "#22c55e22" : isLeave || isAbsent ? colors.muted : colors.primary,
            borderColor: isBoarded ? "#22c55e" : isLeave || isAbsent ? colors.border : colors.primary,
            opacity: pressed || isSendingOtp ? 0.7 : 1,
          },
        ]}
        onPress={() => onPress(passenger)}
        disabled={isLeave || isAbsent || isSendingOtp}
      >
        {isSendingOtp ? (
          <ActivityIndicator size="small" color={isBoarded ? "#22c55e" : colors.primaryForeground} />
        ) : (
          <Ionicons
            name={isBoarded ? "checkmark-circle" : "add-circle-outline"}
            size={20}
            color={isBoarded ? "#22c55e" : isLeave || isAbsent ? colors.mutedForeground : colors.primaryForeground}
          />
        )}
      </Pressable>
    </View>
  );
}

function QrScannerModal({ colors, onScan, onClose, insets }: {
  colors: ReturnType<typeof useColors>;
  onScan: (data: string) => void;
  onClose: () => void;
  insets: { top: number; bottom: number };
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.scannerBackdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.scannerHeader}>
          <Text style={[styles.scannerTitle, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
            Scan Student QR Code
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        <View style={styles.cameraWrapper}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => onScan(data)}
          />
          <View style={styles.scanOverlay} pointerEvents="none">
            <View style={[styles.scanFrame, { borderColor: colors.primary }]}>
              <View style={[styles.scanCorner, styles.scanCornerTL, { borderColor: colors.primary }]} />
              <View style={[styles.scanCorner, styles.scanCornerTR, { borderColor: colors.primary }]} />
              <View style={[styles.scanCorner, styles.scanCornerBL, { borderColor: colors.primary }]} />
              <View style={[styles.scanCorner, styles.scanCornerBR, { borderColor: colors.primary }]} />
            </View>
          </View>
        </View>

        <View style={styles.scannerFooter}>
          <View style={[styles.scanHint, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
            <Ionicons name="phone-portrait-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.scanHintTxt, { fontFamily: "Inter_400Regular" }]}>
              Ask the parent to open the QR code in their OrbitTrack app
            </Text>
          </View>
          <Pressable
            style={[styles.fallbackBtn, { borderColor: "rgba(255,255,255,0.3)" }]}
            onPress={onClose}
          >
            <Ionicons name="keypad-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.fallbackTxt, { fontFamily: "Inter_400Regular" }]}>
              Use OTP instead
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function OtpModal({ passenger, serverDemoCode, colors, onConfirm, onClose, isLoading }: {
  passenger: Passenger;
  serverDemoCode: string | null;
  colors: ReturnType<typeof useColors>;
  onConfirm: (enteredOtp: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [otp, setOtp] = useState("");
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Board Passenger
              </Text>
              <Text style={[styles.modalSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                OTP sent to parent's phone — ask them to confirm
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close-circle" size={28} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.passengerPreview}>
            <View style={[styles.previewAvatar, { backgroundColor: colors.muted }]}>
              {passenger.photoUrl ? (
                <Image source={{ uri: passenger.photoUrl }} style={styles.previewImg} />
              ) : (
                <Ionicons name="person" size={28} color={colors.mutedForeground} />
              )}
            </View>
            <View>
              <Text style={[styles.previewName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {passenger.name}
              </Text>
              <Text style={[styles.previewStation, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {passenger.stationName ?? `Station ${passenger.stationId}`}
              </Text>
            </View>
          </View>

          {serverDemoCode && (
            <View style={[styles.demoBanner, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
              <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
              <Text style={[styles.demoBannerTxt, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                Demo mode — OTP for this session: {serverDemoCode}
              </Text>
            </View>
          )}

          <View style={[styles.otpBox, { backgroundColor: colors.background, borderColor: otp.length === 4 ? colors.primary : colors.border }]}>
            <TextInput
              style={[styles.otpInput, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter OTP"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              {
                backgroundColor: otp.length === 4 ? colors.primary : colors.muted,
                opacity: pressed || isLoading ? 0.7 : 1,
              },
            ]}
            onPress={() => onConfirm(otp)}
            disabled={otp.length < 4 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="checkmark" size={20} color={otp.length === 4 ? colors.primaryForeground : colors.mutedForeground} />
            )}
            <Text style={[
              styles.confirmTxt,
              { color: otp.length === 4 ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
            ]}>
              Confirm Boarding
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  scanBtnTxt: { fontSize: 13 },
  sosBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  sosTxt: { fontSize: 13, color: "#fff" },
  progressBarBg: { height: 4, backgroundColor: "#1e293b", borderRadius: 2, overflow: "hidden" },
  progressBarFill: { height: 4, borderRadius: 2 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryTxt: { fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15 },
  rowStation: { fontSize: 12, marginTop: 2 },
  boardBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  scannerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 0,
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scannerTitle: { fontSize: 18 },
  cameraWrapper: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 1,
    borderRadius: 12,
    opacity: 0.3,
  },
  scanCorner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  scanCornerTL: { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  scanCornerTR: { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  scanCornerBL: { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  scanCornerBR: { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  scannerFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  scanHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  scanHintTxt: { color: "rgba(255,255,255,0.7)", fontSize: 13, flex: 1 },
  fallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  fallbackTxt: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingHorizontal: 24, paddingTop: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#94a3b822", alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { fontSize: 20 },
  modalSub: { fontSize: 13, marginTop: 2 },
  passengerPreview: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, padding: 16,
    borderRadius: 12, backgroundColor: "rgba(214, 139, 9, 0.08)",
  },
  previewAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewImg: { width: 52, height: 52 },
  previewName: { fontSize: 17 },
  previewStation: { fontSize: 13, marginTop: 2 },
  demoBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, marginBottom: 16,
  },
  demoBannerTxt: { fontSize: 13, flex: 1 },
  otpBox: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, marginBottom: 16 },
  otpInput: { height: 56, fontSize: 24, textAlign: "center", letterSpacing: 8 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 12, gap: 8 },
  confirmTxt: { fontSize: 16 },
});
