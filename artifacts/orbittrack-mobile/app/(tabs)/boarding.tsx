import { Ionicons } from "@expo/vector-icons";
import { useListPassengers, useGetPassengerQrToken } from "@workspace/api-client-react";
import type { Passenger } from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useRole } from "@/context/RoleContext";

const STATUS_COLORS: Record<string, string> = {
  boarded: "#22c55e",
  pending: "#f59e0b",
  absent: "#ef4444",
  leave: "#94a3b8",
};

const STATUS_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  boarded: "checkmark-circle",
  pending: "time",
  absent: "close-circle",
  leave: "moon",
};

export default function BoardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>("all");
  const { role, parentPhone } = useRole();

  const topPad = insets.top;
  const bottomPad = insets.bottom + 80;

  const phoneParam = role === "parent" && parentPhone ? parentPhone : undefined;

  const { data: passengers, isLoading, error, refetch, isRefetching } = useListPassengers(
    phoneParam ? { phone: phoneParam } : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { refetchInterval: 20_000 } as any },
  );

  const isParentView = role === "parent" && parentPhone;
  const passengerList = passengers ?? [];

  const filtered = passengerList.filter((p) => filter === "all" || p.status === filter);

  const counts = {
    all: passengerList.length,
    boarded: passengerList.filter((p) => p.status === "boarded").length,
    pending: passengerList.filter((p) => p.status === "pending").length,
    absent: passengerList.filter((p) => p.status === "absent").length,
    leave: passengerList.filter((p) => p.status === "leave").length,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {isParentView ? "My Child's Status" : "Boarding Status"}
        </Text>
        {isParentView && passengerList.length === 0 && !isLoading && (
          <View style={[styles.noChildBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.noChildTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No children found for this number
            </Text>
          </View>
        )}
        {!isParentView && (
          <View style={styles.summaryRow}>
            <SummaryBadge label="On board" count={counts.boarded} color="#22c55e" colors={colors} />
            <SummaryBadge label="Pending" count={counts.pending} color="#f59e0b" colors={colors} />
            <SummaryBadge label="Absent" count={counts.absent} color="#ef4444" colors={colors} />
          </View>
        )}
        {isParentView && passengerList.length > 0 && (
          <View style={styles.summaryRow}>
            <SummaryBadge label="On board" count={counts.boarded} color="#22c55e" colors={colors} />
            <SummaryBadge label="Pending" count={counts.pending} color="#f59e0b" colors={colors} />
            <SummaryBadge label="Absent" count={counts.absent} color="#ef4444" colors={colors} />
          </View>
        )}
        <FilterBar filter={filter} setFilter={setFilter} counts={counts} colors={colors} />
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
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomPad }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={!!filtered.length}
          renderItem={({ item }) => (
            isParentView
              ? <PassengerCardWithQr passenger={item} colors={colors} />
              : <PassengerCard passenger={item} colors={colors} />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {isParentView
                  ? "No children registered under your number"
                  : "No passengers in this filter"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function PassengerCard({ passenger, colors }: {
  passenger: Passenger;
  colors: ReturnType<typeof useColors>;
}) {
  const statusColor = STATUS_COLORS[passenger.status] ?? colors.mutedForeground;
  const statusIcon = STATUS_ICONS[passenger.status] ?? "ellipse";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardLeft}>
        {passenger.photoUrl ? (
          <Image source={{ uri: passenger.photoUrl }} style={[styles.avatar, { borderColor: statusColor }]} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.muted, borderColor: statusColor }]}>
            <Ionicons name="person" size={20} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.passengerInfo}>
          <Text style={[styles.passengerName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {passenger.name}
          </Text>
          <Text style={[styles.stationName, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {passenger.stationName ?? `Station ${passenger.stationId}`}
          </Text>
          {passenger.boardedAt && passenger.status === "boarded" && (
            <Text style={[styles.boardedTime, { color: "#22c55e", fontFamily: "Inter_400Regular" }]}>
              Boarded at {new Date(passenger.boardedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardRight}>
        <Ionicons name={statusIcon} size={24} color={statusColor} />
        <Text style={[styles.statusLabel, { color: statusColor, fontFamily: "Inter_500Medium" }]}>
          {passenger.status.charAt(0).toUpperCase() + passenger.status.slice(1)}
        </Text>
      </View>
    </View>
  );
}

function PassengerCardWithQr({ passenger, colors }: {
  passenger: Passenger;
  colors: ReturnType<typeof useColors>;
}) {
  const [showQr, setShowQr] = useState(false);
  const statusColor = STATUS_COLORS[passenger.status] ?? colors.mutedForeground;
  const statusIcon = STATUS_ICONS[passenger.status] ?? "ellipse";

  const { data: qrData, isLoading: qrLoading, refetch: refetchQr } = useGetPassengerQrToken(
    passenger.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: showQr, staleTime: 11 * 60 * 60 * 1000 } as any },
  );

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardLeft}>
          {passenger.photoUrl ? (
            <Image source={{ uri: passenger.photoUrl }} style={[styles.avatar, { borderColor: statusColor }]} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.muted, borderColor: statusColor }]}>
              <Ionicons name="person" size={20} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.passengerInfo}>
            <Text style={[styles.passengerName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {passenger.name}
            </Text>
            <Text style={[styles.stationName, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {passenger.stationName ?? `Station ${passenger.stationId}`}
            </Text>
            {passenger.boardedAt && passenger.status === "boarded" && (
              <Text style={[styles.boardedTime, { color: "#22c55e", fontFamily: "Inter_400Regular" }]}>
                Boarded at {new Date(passenger.boardedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardRight}>
          <Ionicons name={statusIcon} size={24} color={statusColor} />
          <Text style={[styles.statusLabel, { color: statusColor, fontFamily: "Inter_500Medium" }]}>
            {passenger.status.charAt(0).toUpperCase() + passenger.status.slice(1)}
          </Text>
          <Pressable
            onPress={() => setShowQr(true)}
            style={[styles.qrBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
            hitSlop={8}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
        <Pressable style={styles.qrBackdrop} onPress={() => setShowQr(false)}>
          <Pressable
            style={[styles.qrSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.qrSheetHandle} />
            <Text style={[styles.qrSheetTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Boarding QR Code
            </Text>
            <Text style={[styles.qrSheetSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Show this to the driver to board {passenger.name}
            </Text>

            <View style={[styles.qrContainer, { backgroundColor: "#fff", borderColor: colors.border }]}>
              {qrLoading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ margin: 40 }} />
              ) : qrData?.token ? (
                <QRCode
                  value={qrData.token}
                  size={220}
                  color="#0f172a"
                  backgroundColor="#ffffff"
                />
              ) : (
                <View style={styles.qrError}>
                  <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
                  <Text style={[styles.qrErrorTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Could not load QR code
                  </Text>
                  <Pressable onPress={() => refetchQr()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.retryTxt, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>Retry</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={[styles.qrHint, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.qrHintTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Valid for 12 hours · refreshes automatically
              </Text>
            </View>

            <Pressable
              style={[styles.qrCloseBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowQr(false)}
            >
              <Text style={[styles.qrCloseTxt, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function SummaryBadge({ label, count, color, colors }: {
  label: string;
  count: number;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.summaryBadge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.summaryCount, { color, fontFamily: "Inter_700Bold" }]}>{count}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
    </View>
  );
}

function FilterBar({ filter, setFilter, counts, colors }: {
  filter: string;
  setFilter: (f: string) => void;
  counts: Record<string, number>;
  colors: ReturnType<typeof useColors>;
}) {
  const filters = ["all", "boarded", "pending", "absent", "leave"];
  return (
    <View style={styles.filterRow}>
      {filters.map((f) => (
        <Pressable
          key={f}
          style={[
            styles.filterChip,
            {
              backgroundColor: filter === f ? colors.primary : colors.muted,
              borderColor: filter === f ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setFilter(f)}
        >
          <Text style={[
            styles.filterTxt,
            { color: filter === f ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}>
            {f === "all" ? `All (${counts.all})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, marginBottom: 12 },
  noChildBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  noChildTxt: { fontSize: 13 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryBadge: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  summaryCount: { fontSize: 20 },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  filterTxt: { fontSize: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryTxt: { fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 15 },
  stationName: { fontSize: 12, marginTop: 2 },
  boardedTime: { fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: "center", gap: 4 },
  statusLabel: { fontSize: 11 },
  qrBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  qrBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  qrSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  qrSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#94a3b822",
    marginBottom: 16,
  },
  qrSheetTitle: { fontSize: 20, marginBottom: 6, textAlign: "center" },
  qrSheetSub: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  qrContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  qrError: { alignItems: "center", gap: 10, paddingVertical: 20 },
  qrErrorTxt: { fontSize: 13, textAlign: "center" },
  qrHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    alignSelf: "stretch",
  },
  qrHintTxt: { fontSize: 12, flex: 1 },
  qrCloseBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 12, alignSelf: "stretch", alignItems: "center" },
  qrCloseTxt: { fontSize: 16 },
});
