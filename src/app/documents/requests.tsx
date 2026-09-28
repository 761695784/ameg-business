/**
 * Demandes de devis reçues via le site ameginternational.com
 * -> un clic pour créer le devis AMEG pré-rempli.
 */
import {
  Badge,
  Button,
  EmptyState,
  FormModal,
  Segmented,
  listStyles,
} from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import { createQuoteFromRequest, findDocForRequest } from "@/db/siteSync";
import {
  fetchQuoteRequests,
  isConnected,
  updateQuoteRequestStatus,
  type RemoteQuoteRequest,
  type RemoteRequestStatus,
} from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Filter = "all" | RemoteRequestStatus;

const STATUS_INFO: Record<RemoteRequestStatus, { label: string; color: string }> = {
  nouveau: { label: "Nouveau", color: colors.accentDark },
  en_cours: { label: "En cours", color: colors.info },
  traite: { label: "Traité", color: colors.success },
};

function requesterName(r: RemoteQuoteRequest) {
  const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
  return r.company?.trim() ? r.company.trim() : full || r.email;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SiteRequestsScreen() {
  const db = useSQLiteContext();
  const [filter, setFilter] = useState<Filter>("nouveau");
  const [items, setItems] = useState<RemoteQuoteRequest[]>([]);
  const [linked, setLinked] = useState<Record<number, { id: number; number: string }>>({});
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RemoteQuoteRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (f: Filter) => {
      setLoading(true);
      setError("");
      try {
        const ok = await isConnected(db);
        setConnected(ok);
        if (!ok) return;
        const data = await fetchQuoteRequests(db, f === "all" ? undefined : f);
        setItems(data);
        const map: Record<number, { id: number; number: string }> = {};
        for (const r of data) {
          const doc = await findDocForRequest(db, r.id);
          if (doc) map[r.id] = doc;
        }
        setLinked(map);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  const onCreateQuote = async (r: RemoteQuoteRequest) => {
    setBusy(true);
    try {
      const res = await createQuoteFromRequest(db, r);
      setSelected(null);
      router.push(`/documents/${res.id}`);
      if (res.created && r.status === "nouveau" && !res.statusUpdated) {
        Alert.alert(
          "Devis créé",
          "Le devis a été créé, mais le statut de la demande n'a pas pu être mis à jour sur le site (réseau).",
        );
      }
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSetStatus = async (r: RemoteQuoteRequest, status: RemoteRequestStatus) => {
    setBusy(true);
    try {
      await updateQuoteRequestStatus(db, r.id, status);
      setSelected(null);
      await load(filter);
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (connected === false) {
    return (
      <View style={listStyles.screen}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Non connecté au site"
          text="Connectez l'application au site AMEG International pour voir les demandes de devis reçues en ligne."
          actionLabel="Aller aux paramètres"
          onAction={() => router.push("/settings")}
        />
      </View>
    );
  }

  return (
    <View style={listStyles.screen}>
      <View style={{ height: 12 }} />
      <Segmented<Filter>
        value={filter}
        onChange={(f) => setFilter(f)}
        options={[
          { value: "nouveau", label: "Nouvelles" },
          { value: "en_cours", label: "En cours" },
          { value: "traite", label: "Traitées" },
          { value: "all", label: "Toutes" },
        ]}
      />

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={listStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => load(filter)}
            colors={[colors.accent, colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="mail-open-outline"
              title="Aucune demande"
              text="Aucune demande de devis dans cette catégorie. Tirez vers le bas pour actualiser."
            />
          )
        }
        renderItem={({ item }) => {
          const st = STATUS_INFO[item.status] ?? STATUS_INFO.nouveau;
          const doc = linked[item.id];
          const qty = item.items.reduce((s, i) => s + (i.quantity || 0), 0);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => setSelected(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {requesterName(item)}
                </Text>
                <Badge label={st.label} color={st.color} size="sm" />
              </View>
              <Text style={styles.cardSub} numberOfLines={1}>
                Demande n° {item.id} · {formatDateTime(item.created_at)}
                {item.city ? ` · ${item.city}` : ""}
              </Text>
              <Text style={styles.cardProducts} numberOfLines={2}>
                {item.items.map((i) => `${i.quantity} × ${i.product_name}`).join(" · ")}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>
                  {item.items.length} produit(s) · {qty} unité(s)
                </Text>
                {doc ? (
                  <Text style={styles.linkedText}>Devis {doc.number}</Text>
                ) : (
                  <Text style={styles.ctaText}>Créer le devis →</Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {selected && (
        <FormModal
          visible
          title={`Demande n° ${selected.id}`}
          subtitle={formatDateTime(selected.created_at)}
          onClose={() => setSelected(null)}
        >
          <View style={styles.detailCard}>
            <Text style={styles.detailName}>{requesterName(selected)}</Text>
            {!!selected.company && (
              <Text style={styles.detailLine}>
                {selected.first_name} {selected.last_name}
              </Text>
            )}
            {!!selected.city && <Text style={styles.detailLine}>{selected.city}</Text>}
            <View style={styles.contactRow}>
              {!!selected.phone && (
                <Pressable style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${selected.phone}`)}>
                  <Ionicons name="call" size={16} color={colors.primary} />
                  <Text style={styles.contactText}>{selected.phone}</Text>
                </Pressable>
              )}
              {!!selected.email && (
                <Pressable style={styles.contactBtn} onPress={() => Linking.openURL(`mailto:${selected.email}`)}>
                  <Ionicons name="mail" size={16} color={colors.primary} />
                  <Text style={styles.contactText} numberOfLines={1}>
                    {selected.email}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <Text style={styles.sectionLabel}>Produits demandés</Text>
          {selected.items.map((i) => (
            <View key={i.id} style={styles.productRow}>
              <View style={styles.qtyPill}>
                <Text style={styles.qtyText}>{i.quantity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{i.product_name}</Text>
                <Text style={styles.productRef}>Réf. {i.product_reference}</Text>
              </View>
            </View>
          ))}

          {!!selected.comment && (
            <>
              <Text style={styles.sectionLabel}>Message du client</Text>
              <Text style={styles.comment}>{selected.comment}</Text>
            </>
          )}

          <View style={{ gap: 10, marginTop: 16 }}>
            {linked[selected.id] ? (
              <Button
                title={`Ouvrir le devis ${linked[selected.id].number}`}
                icon="document-text-outline"
                size="lg"
                onPress={() => {
                  const id = linked[selected.id].id;
                  setSelected(null);
                  router.push(`/documents/${id}`);
                }}
              />
            ) : (
              <Button
                title="Créer le devis"
                icon="add-circle-outline"
                size="lg"
                loading={busy}
                disabled={busy}
                onPress={() => onCreateQuote(selected)}
              />
            )}
            {selected.status !== "traite" ? (
              <Button
                title="Marquer comme traitée"
                icon="checkmark-done-outline"
                variant="secondary"
                disabled={busy}
                onPress={() => onSetStatus(selected, "traite")}
              />
            ) : (
              <Button
                title="Remettre en cours"
                icon="refresh-outline"
                variant="secondary"
                disabled={busy}
                onPress={() => onSetStatus(selected, "en_cours")}
              />
            )}
            {busy && <ActivityIndicator color={colors.primary} />}
          </View>
        </FormModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    ...shadows.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.text },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardProducts: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cardMeta: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  ctaText: { fontSize: 12, color: colors.accentDark, fontWeight: "800" },
  linkedText: { fontSize: 12, color: colors.secondaryDark, fontWeight: "800" },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  detailName: { fontSize: 17, fontWeight: "800", color: colors.primary },
  detailLine: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  contactRow: { gap: 8, marginTop: 10 },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primarySubtle,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  contactText: { flex: 1, color: colors.primary, fontWeight: "700", fontSize: 13 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 6,
  },
  qtyPill: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  qtyText: { color: colors.white, fontWeight: "800" },
  productName: { fontSize: 14, fontWeight: "700", color: colors.text },
  productRef: { fontSize: 12, color: colors.textMuted },
  comment: {
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: colors.cardSubdued,
    borderRadius: radii.md,
    padding: 10,
    lineHeight: 19,
  },
});
