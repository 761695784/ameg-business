import { DocRow } from "@/components/DocRow";
import {
  EmptyState,
  Fab,
  SearchBar,
  Segmented,
  listStyles,
} from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import {
  listDocuments,
  type DocListRow,
  type DocStatus,
  type DocType,
} from "@/db/queries";
import { formatFCFA } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TypeFilter = "all" | DocType;
type StatusFilter = "all" | DocStatus;

export default function DocumentsScreen() {
  const db = useSQLiteContext();
  const [docs, setDocs] = useState<DocListRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const load = useCallback(() => {
    listDocuments(db).then(setDocs);
  }, [db]);

  useFocusEffect(load);

  // Counts for tabs
  const quoteCount = useMemo(
    () => docs.filter((d) => d.type === "devis").length,
    [docs],
  );
  const invoiceCount = useMemo(
    () => docs.filter((d) => d.type === "facture").length,
    [docs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      // Filter by type
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      // Filter by status
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      // Filter by query
      if (q) {
        const matchesNum = d.number.toLowerCase().includes(q);
        const matchesClient = (d.client_name ?? "").toLowerCase().includes(q);
        const matchesNotes = (d.notes ?? "").toLowerCase().includes(q);
        if (!matchesNum && !matchesClient && !matchesNotes) return false;
      }
      return true;
    });
  }, [docs, typeFilter, statusFilter, query]);

  // Total TTC of currently filtered list
  const totalFilteredTtc = useMemo(() => {
    return filtered.reduce(
      (sum, d) => sum + d.total_ttc,
      0,
    );
  }, [filtered]);

  const handleCreateType = (type: DocType) => {
    setCreateModalVisible(false);
    router.push(`/documents/new?type=${type}`);
  };

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Tous les statuts" },
    { value: "brouillon", label: "Brouillons" },
    { value: "envoye", label: "Envoyés" },
    {
      value: typeFilter === "devis" ? "accepte" : "paye",
      label: typeFilter === "devis" ? "Acceptés" : "Payées",
    },
    {
      value: typeFilter === "devis" ? "refuse" : "annule",
      label: typeFilter === "devis" ? "Refusés" : "Annulées",
    },
  ];

  return (
    <View style={listStyles.screen}>
      {/* 1. SEARCH BAR */}
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="N° document, nom du client..."
      />

      {/* 1b. DEMANDES DU SITE WEB */}
      <Pressable
        style={({ pressed }) => [styles.siteRequestsBtn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/documents/requests")}
      >
        <Ionicons name="globe-outline" size={18} color={colors.secondaryDark} />
        <Text style={styles.siteRequestsText}>Demandes de devis du site web</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryDark} />
      </Pressable>

      {/* 2. TYPE SEGMENTED CONTROL */}
      <Segmented<TypeFilter>
        value={typeFilter}
        onChange={(v) => {
          setTypeFilter(v);
          setStatusFilter("all");
        }}
        options={[
          { value: "all", label: "Tous", count: docs.length },
          { value: "devis", label: "Devis", count: quoteCount },
          { value: "facture", label: "Factures", count: invoiceCount },
        ]}
      />

      {/* 3. STATUS FILTER CHIPS */}
      <View style={styles.statusChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusChipsScroll}
        >
          {statusOptions.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setStatusFilter(opt.value)}
                style={[
                  styles.statusChip,
                  active && styles.statusChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    active && styles.statusChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. SUMMARY BAR */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {filtered.length}{" "}
          {filtered.length > 1 ? "documents trouvés" : "document trouvé"}
        </Text>
        <Text style={styles.summaryAmount}>
          Total: <Text style={styles.summaryAmountBold}>{formatFCFA(totalFilteredTtc)}</Text>
        </Text>
      </View>

      {/* 5. LIST OF DOCUMENTS */}
      <FlatList
        data={filtered}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={listStyles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={query || statusFilter !== "all" ? "Aucun document trouvé" : "Aucun document"}
            text={
              query || statusFilter !== "all"
                ? "Modifiez vos filtres ou effectuez une autre recherche."
                : "Commencez par créer votre premier devis ou votre première facture."
            }
            actionLabel={query || statusFilter !== "all" ? undefined : "Créer un devis"}
            onAction={
              query || statusFilter !== "all"
                ? undefined
                : () => router.push("/documents/new?type=devis")
            }
          />
        }
        renderItem={({ item }) => <DocRow doc={item} />}
      />

      {/* 6. FAB BUTTON */}
      <Fab
        onPress={() => setCreateModalVisible(true)}
        icon="add"
        label="Nouveau"
      />

      {/* 7. CREATE ACTION MODAL */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCreateModalVisible(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Nouveau document</Text>
            <Text style={styles.sheetSubtitle}>
              Choisissez le type de document à éditer
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.sheetOption,
                pressed && { backgroundColor: colors.accentLight },
              ]}
              onPress={() => handleCreateType("devis")}
            >
              <View
                style={[
                  styles.sheetIconCircle,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Ionicons
                  name="document-text"
                  size={24}
                  color={colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionTitle}>Devis commercial</Text>
                <Text style={styles.sheetOptionDesc}>
                  Proposition tarifaire personnalisée avec validité
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.sheetOption,
                pressed && { backgroundColor: colors.primarySubtle },
              ]}
              onPress={() => handleCreateType("facture")}
            >
              <View
                style={[
                  styles.sheetIconCircle,
                  { backgroundColor: colors.primarySubtle },
                ]}
              >
                <Ionicons
                  name="receipt"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionTitle}>Facture de vente</Text>
                <Text style={styles.sheetOptionDesc}>
                  Document comptable avec date d&apos;échéance
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>

            <Pressable
              style={styles.sheetCancelBtn}
              onPress={() => setCreateModalVisible(false)}
            >
              <Text style={styles.sheetCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  siteRequestsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.secondaryLight,
    borderWidth: 1,
    borderColor: colors.secondarySubtle,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  siteRequestsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: colors.secondaryDark,
  },
  statusChipsContainer: {
    marginBottom: 8,
  },
  statusChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  statusChipTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  summaryAmount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryAmountBold: {
    fontWeight: "800",
    color: colors.primary,
  },

  // Action Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 45, 82, 0.5)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 20,
    paddingBottom: 36,
    ...shadows.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
    marginTop: 2,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 14,
  },
  sheetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  sheetOptionDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sheetCancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.cardSubdued,
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});
