import {
  Button,
  EmptyState,
  Fab,
  Field,
  FormModal,
  SearchBar,
  listStyles,
} from "@/components/ui";
import { CatalogSyncBar } from "@/components/SiteConnection";
import { colors, radii, shadows } from "@/constants/theme";
import { AVAILABILITY_LABELS } from "@/db/siteSync";
import { deleteItem, listItems, saveItem, type Item } from "@/db/queries";
import { formatFCFA, parseAmount } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type FormState = {
  id?: number;
  label: string;
  price: string;
  reference?: string;
  details?: string;
  unit?: string;
  weight?: string;
  hs_code?: string;
};

export default function ItemsScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [actionItem, setActionItem] = useState<Item | null>(null);

  const load = useCallback(() => {
    listItems(db).then(setItems);
  }, [db]);

  useFocusEffect(load);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      (i.reference ?? "").toLowerCase().includes(q) ||
      (i.brand ?? "").toLowerCase().includes(q) ||
      String(i.unit_price).includes(q)
    );
  }, [items, query]);

  const save = async () => {
    if (!form) return;
    if (!form.label.trim()) {
      Alert.alert("Désignation obligatoire", "Veuillez indiquer le libellé de l'article ou de la prestation.");
      return;
    }
    await saveItem(db, {
      id: form.id,
      label: form.label.trim(),
      unit_price: parseAmount(form.price),
      reference: form.reference?.trim(),
      details: form.details?.trim(),
      unit: form.unit?.trim().toUpperCase(),
      weight: form.weight?.trim(),
      hs_code: form.hs_code?.trim(),
    });
    setForm(null);
    load();
  };

  const remove = (itemToRemove?: Item) => {
    const target =
      itemToRemove ??
      (form?.id
        ? {
            id: form.id,
            label: form.label,
            unit_price: parseAmount(form.price),
          }
        : null);
    if (!target?.id) return;
    const id = target.id;

    Alert.alert(
      `Supprimer « ${target.label} » ?`,
      "Les devis et factures existants qui utilisent cet article ne seront pas modifiés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await deleteItem(db, id);
            setForm(null);
            setActionItem(null);
            load();
          },
        },
      ],
    );
  };

  const handleCreateDocumentWithItem = (it: Item, docType: "devis" | "facture") => {
    setActionItem(null);
    router.push(`/documents/new?type=${docType}`);
  };

  return (
    <View style={listStyles.screen}>
      {/* 1. SEARCH BAR */}
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher par désignation, référence ou prix..."
      />

      <CatalogSyncBar onSynced={load} />

      {/* 2. CATALOG SUMMARY */}
      <View style={styles.catalogSummaryRow}>
        <Text style={styles.catalogSummaryText}>
          {filtered.length}{" "}
          {filtered.length > 1 ? "articles répertoriés" : "article répertorié"}
        </Text>
      </View>

      {/* 3. ITEMS LIST */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={listStyles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={query ? "Aucun article trouvé" : "Catalogue vide"}
            text={
              query
                ? "Aucun équipement ou service ne correspond à votre recherche."
                : "Enregistrez vos équipements de cuisine professionnelle (four, plancha, chambre froide, inox...) pour accélérer vos devis."
            }
            actionLabel={query ? undefined : "Ajouter un premier article"}
            onAction={query ? undefined : () => setForm({ label: "", price: "", unit: "PCS" })}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.itemCard,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
            onPress={() => setActionItem(item)}
          >
            <View style={styles.itemIconBox}>
              <Ionicons name="cube" size={20} color={colors.primary} />
            </View>

            <View style={listStyles.cardBody}>
              <Text style={styles.itemTitle}>{item.label}</Text>
              <Text style={styles.itemPriceLabel} numberOfLines={1}>
                {[
                  item.reference,
                  item.brand,
                  item.availability ? AVAILABILITY_LABELS[item.availability] ?? item.availability : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "Prix Unitaire HT"}
                {item.remote_id ? "  ·  Site" : ""}
              </Text>
            </View>

            <View style={styles.itemPriceCol}>
              <Text style={styles.itemPriceValue}>
                {formatFCFA(item.unit_price)}
              </Text>
              <View style={styles.actionPromptBadge}>
                <Ionicons name="ellipsis-horizontal" size={14} color={colors.textMuted} />
              </View>
            </View>
          </Pressable>
        )}
      />

      {/* 4. FAB ADD BUTTON */}
      <Fab
        onPress={() => setForm({ label: "", price: "", unit: "PCS" })}
        icon="add"
        label="Nouvel article"
      />

      {/* 5. ARTICLE ACTIONS MODAL */}
      <Modal
        visible={!!actionItem}
        transparent
        animationType="fade"
        onRequestClose={() => setActionItem(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setActionItem(null)}
        >
          {actionItem && (
            <View style={styles.actionSheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.actionSheetHeader}>
                <View style={styles.itemIconBoxLg}>
                  <Ionicons name="cube" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionSheetTitle}>{actionItem.label}</Text>
                  <Text style={styles.actionSheetPrice}>
                    {formatFCFA(actionItem.unit_price)} HT
                  </Text>
                </View>
              </View>

              <View style={styles.sheetDivider} />

              <Pressable
                style={styles.sheetBtn}
                onPress={() => {
                  const it = { ...actionItem };
                  setActionItem(null);
                  setForm({
                    id: it.id,
                    label: it.label,
                    price: String(it.unit_price),
                    reference: it.reference,
                    details: it.details,
                    unit: it.unit,
                    weight: it.weight,
                    hs_code: it.hs_code,
                  });
                }}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={styles.sheetBtnText}>Modifier l&apos;article</Text>
              </Pressable>

              <Pressable
                style={styles.sheetBtn}
                onPress={() => handleCreateDocumentWithItem(actionItem, "devis")}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.accent}
                />
                <Text style={styles.sheetBtnText}>Créer un devis</Text>
              </Pressable>

              <Pressable
                style={styles.sheetBtn}
                onPress={() => handleCreateDocumentWithItem(actionItem, "facture")}
              >
                <Ionicons
                  name="receipt-outline"
                  size={20}
                  color={colors.secondaryDark}
                />
                <Text style={styles.sheetBtnText}>Créer une facture</Text>
              </Pressable>

              <Pressable
                style={[styles.sheetBtn, styles.sheetBtnDanger]}
                onPress={() => remove(actionItem)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[styles.sheetBtnText, { color: colors.danger }]}>
                  Supprimer du catalogue
                </Text>
              </Pressable>

              <Pressable
                style={styles.sheetCancelBtn}
                onPress={() => setActionItem(null)}
              >
                <Text style={styles.sheetCancelText}>Fermer</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>

      {/* 6. CREATE / EDIT FORM MODAL */}
      <FormModal
        visible={!!form}
        title={form?.id ? "Modifier l'article" : "Nouvel article au catalogue"}
        subtitle={
          form?.id
            ? "Mettez à jour le tarif ou la désignation"
            : "Renseignez les détails du produit ou service"
        }
        onClose={() => setForm(null)}
      >
        {form && (
          <View>
            <Field
              label="Désignation du produit ou service"
              required
              value={form.label}
              onChangeText={(t) => setForm({ ...form, label: t })}
              placeholder="Ex. : Four mixte professionnel 6 niveaux, Table inox..."
              icon="cube-outline"
              multiline
              autoFocus={!form.id}
            />

            <Field
              label="Prix unitaire HT (en FCFA)"
              required
              value={form.price}
              onChangeText={(t) =>
                setForm({ ...form, price: t.replace(/[^\d]/g, "") })
              }
              placeholder="0"
              icon="cash-outline"
              keyboardType="number-pad"
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Référence"
                  value={form.reference ?? ""}
                  onChangeText={(t) => setForm({ ...form, reference: t })}
                  placeholder="REF-01"
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ width: 100 }}>
                <Field
                  label="Unité"
                  value={form.unit ?? ""}
                  onChangeText={(t) => setForm({ ...form, unit: t })}
                  placeholder="PCS"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <Field
              label="Description technique"
              value={form.details ?? ""}
              onChangeText={(t) => setForm({ ...form, details: t })}
              placeholder="Caractéristiques, dimensions, options incluses…"
              multiline
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Poids (kg)"
                  value={form.weight ?? ""}
                  onChangeText={(t) => setForm({ ...form, weight: t })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="N° Douane (SH)"
                  value={form.hs_code ?? ""}
                  onChangeText={(t) => setForm({ ...form, hs_code: t })}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {/* Live formatted price preview */}
            <View style={styles.pricePreviewCard}>
              <Text style={styles.pricePreviewLabel}>Aperçu formaté :</Text>
              <Text style={styles.pricePreviewValue}>
                {formatFCFA(parseAmount(form.price))} HT
              </Text>
            </View>

            <View style={{ marginTop: 16, gap: 10 }}>
              <Button
                title={form.id ? "Enregistrer les modifications" : "Ajouter au catalogue"}
                icon="checkmark"
                onPress={save}
                size="lg"
              />

              {!!form.id && (
                <Button
                  title="Supprimer cet article"
                  icon="trash-outline"
                  variant="danger"
                  onPress={() => remove()}
                />
              )}
            </View>
          </View>
        )}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  catalogSummaryRow: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    marginBottom: 4,
  },
  catalogSummaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },

  // Item Card
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  itemIconBox: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  itemPriceLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemPriceCol: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  itemPriceValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  actionPromptBadge: {
    marginTop: 4,
  },

  // Price Preview Card
  pricePreviewCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.primarySubtle,
    borderRadius: radii.md,
    padding: 12,
    marginTop: -6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pricePreviewLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  pricePreviewValue: {
    fontSize: 16,
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
  actionSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  itemIconBoxLg: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  actionSheetPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accentDark,
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 12,
  },
  sheetBtnDanger: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 14,
  },
  sheetBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  sheetCancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.cardSubdued,
    marginTop: 10,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});
