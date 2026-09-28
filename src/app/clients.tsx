import { DocRow } from "@/components/DocRow";
import {
  Button,
  EmptyState,
  Fab,
  Field,
  FormModal,
  SearchBar,
  SectionHeader,
  listStyles,
} from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import {
  deleteClient,
  getClientStats,
  listClients,
  listDocumentsForClient,
  saveClient,
  type Client,
  type DocListRow,
} from "@/db/queries";
import { formatFCFA, initials } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const EMPTY_CLIENT: Omit<Client, "id"> & { id?: number } = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  tax_id: "",
  contact: "",
};

export default function ClientsScreen() {
  const db = useSQLiteContext();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");

  // Detail Sheet State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientStats, setClientStats] = useState<{
    totalQuotes: number;
    totalInvoices: number;
    totalInvoiced: number;
    totalPaid: number;
    docsCount: number;
  } | null>(null);
  const [clientDocs, setClientDocs] = useState<DocListRow[]>([]);

  // Edit / Create Form Modal State
  const [form, setForm] = useState<typeof EMPTY_CLIENT | null>(null);

  const load = useCallback(() => {
    listClients(db).then(setClients);
  }, [db]);

  useFocusEffect(load);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.phone, c.email, c.address].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [clients, query]);

  // Open Client Detail Sheet
  const openClientDetail = async (c: Client) => {
    setSelectedClient(c);
    const stats = await getClientStats(db, c.id);
    setClientStats(stats);
    const docs = await listDocumentsForClient(db, c.id);
    setClientDocs(docs);
  };

  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`).catch(() => {
      Alert.alert("Appel impossible", "Impossible de composer le numéro.");
    });
  };

  const handleWhatsApp = (phone: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^\d]/g, "");
    Linking.openURL(`https://wa.me/${cleanPhone}`).catch(() => {
      Alert.alert("WhatsApp", "Impossible d'ouvrir WhatsApp.");
    });
  };

  const handleEmail = (email: string) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert("Email", "Impossible d'ouvrir l'application email.");
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      Alert.alert("Champ obligatoire", "Veuillez indiquer le nom ou la raison sociale du client.");
      return;
    }
    const savedId = await saveClient(db, {
      id: form.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      tax_id: form.tax_id.trim(),
      contact: form.contact.trim(),
    });
    setForm(null);
    load();

    // If we were editing the selected client in detail view, update it
    if (selectedClient && form.id === selectedClient.id) {
      const updated = {
        id: Number(savedId),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        tax_id: form.tax_id.trim(),
        contact: form.contact.trim(),
      };
      setSelectedClient(updated);
    }
  };

  const remove = (clientToRemove?: Client) => {
    const target = clientToRemove ?? (form?.id ? (form as Client) : null);
    if (!target?.id) return;
    const id = target.id;

    Alert.alert(
      `Supprimer « ${target.name} » ?`,
      "Les devis et factures existants seront conservés dans la base, mais n'auront plus de client rattaché.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await deleteClient(db, id);
            setForm(null);
            setSelectedClient(null);
            load();
          },
        },
      ],
    );
  };

  const setFormField = (k: keyof typeof EMPTY_CLIENT) => (v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <View style={listStyles.screen}>
      {/* 1. SEARCH BAR */}
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher par nom, téléphone, ville..."
      />

      {/* 2. CLIENTS LIST */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={listStyles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={query ? "Aucun client trouvé" : "Aucun client"}
            text={
              query
                ? "Aucun client ne correspond à votre recherche."
                : "Constituez votre carnet d'adresses pour insérer vos clients en un clic dans vos devis et factures."
            }
            actionLabel={query ? undefined : "Ajouter un client"}
            onAction={query ? undefined : () => setForm({ ...EMPTY_CLIENT })}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              listStyles.card,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
            onPress={() => openClientDetail(item)}
          >
            <View style={listStyles.avatar}>
              <Text style={listStyles.avatarText}>{initials(item.name)}</Text>
            </View>

            <View style={listStyles.cardBody}>
              <Text style={listStyles.cardTitle}>{item.name}</Text>
              {!!(item.phone || item.email) && (
                <Text style={listStyles.cardSub} numberOfLines={1}>
                  {[item.phone, item.email].filter(Boolean).join(" · ")}
                </Text>
              )}
              {!!item.address && (
                <Text style={styles.clientAddressSub} numberOfLines={1}>
                  {item.address}
                </Text>
              )}
            </View>

            <View style={styles.clientCardRight}>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </View>
          </Pressable>
        )}
      />

      {/* 3. FAB ADD BUTTON */}
      <Fab
        onPress={() => setForm({ ...EMPTY_CLIENT })}
        icon="person-add"
        label="Nouveau client"
      />

      {/* 4. CLIENT DETAIL SHEET */}
      <Modal
        visible={!!selectedClient}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedClient(null)}
      >
        {selectedClient && (
          <View style={styles.detailScreen}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <Pressable
                onPress={() => setSelectedClient(null)}
                hitSlop={12}
                style={styles.detailBackBtn}
              >
                <Ionicons name="arrow-back" size={22} color={colors.white} />
              </Pressable>
              <Text style={styles.detailHeaderTitle} numberOfLines={1}>
                Fiche Client
              </Text>
              <Pressable
                onPress={() => {
                  const toEdit = { ...selectedClient };
                  setForm(toEdit);
                }}
                hitSlop={12}
                style={styles.detailEditBtn}
              >
                <Ionicons name="create-outline" size={18} color={colors.white} />
                <Text style={styles.detailEditText}>Modifier</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.detailBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Profile Card */}
              <View style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {initials(selectedClient.name)}
                  </Text>
                </View>
                <Text style={styles.profileName}>{selectedClient.name}</Text>
                {selectedClient.address ? (
                  <View style={styles.profileMetaRow}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={colors.textMuted}
                    />
                    <Text style={styles.profileMetaText}>
                      {selectedClient.address}
                    </Text>
                  </View>
                ) : null}

                {/* Direct Contact Actions */}
                <View style={styles.contactActionsRow}>
                  {selectedClient.phone ? (
                    <>
                      <Pressable
                        style={styles.contactBtn}
                        onPress={() => handleCall(selectedClient.phone)}
                      >
                        <Ionicons name="call" size={18} color={colors.primary} />
                        <Text style={styles.contactBtnText}>Appeler</Text>
                      </Pressable>
                      <Pressable
                        style={styles.contactBtn}
                        onPress={() => handleWhatsApp(selectedClient.phone)}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={18}
                          color={colors.success}
                        />
                        <Text style={styles.contactBtnText}>WhatsApp</Text>
                      </Pressable>
                    </>
                  ) : null}
                  {selectedClient.email ? (
                    <Pressable
                      style={styles.contactBtn}
                      onPress={() => handleEmail(selectedClient.email)}
                    >
                      <Ionicons
                        name="mail"
                        size={18}
                        color={colors.secondaryDark}
                      />
                      <Text style={styles.contactBtnText}>Email</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Financial Stats for this client */}
              {clientStats && (
                <View style={styles.clientStatsGrid}>
                  <View style={styles.clientStatBox}>
                    <Text style={styles.clientStatLabel}>Total Facturé (TTC)</Text>
                    <Text style={[styles.clientStatValue, { color: colors.primary }]}>
                      {formatFCFA(clientStats.totalInvoiced)}
                    </Text>
                    <Text style={styles.clientStatSub}>
                      {clientStats.totalInvoices} facture(s)
                    </Text>
                  </View>

                  <View style={styles.clientStatBox}>
                    <Text style={styles.clientStatLabel}>Total Réglé (TTC)</Text>
                    <Text style={[styles.clientStatValue, { color: colors.success }]}>
                      {formatFCFA(clientStats.totalPaid)}
                    </Text>
                    <Text style={styles.clientStatSub}>
                      {clientStats.totalQuotes} devis émis
                    </Text>
                  </View>
                </View>
              )}

              {/* Associated Documents */}
              <SectionHeader
                title="Documents associés"
                count={clientDocs.length}
              />

              {clientDocs.length === 0 ? (
                <View style={styles.emptyDocsCard}>
                  <Text style={styles.emptyDocsText}>
                    Aucun devis ou facture associé à ce client pour le moment.
                  </Text>
                </View>
              ) : (
                clientDocs.map((d) => (
                  <DocRow
                    key={d.id}
                    doc={d}
                    onPress={() => {
                      setSelectedClient(null);
                      router.push(`/documents/${d.id}`);
                    }}
                  />
                ))
              )}

              {/* Danger Zone */}
              <View style={{ marginTop: 24, marginBottom: 30 }}>
                <Button
                  title="Supprimer ce client"
                  icon="trash-outline"
                  variant="danger"
                  onPress={() => remove(selectedClient)}
                />
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* 5. CREATE / EDIT CLIENT MODAL */}
      <FormModal
        visible={!!form}
        title={form?.id ? "Modifier le client" : "Nouveau client"}
        subtitle={
          form?.id
            ? "Mettez à jour les coordonnées du client"
            : "Renseignez les informations de contact"
        }
        onClose={() => setForm(null)}
      >
        {form && (
          <View>
            <Field
              label="Nom / Raison sociale"
              required
              value={form.name}
              onChangeText={setFormField("name")}
              placeholder="Ex. : Hôtel Terrou-Bi, Restaurant Le Lagon..."
              icon="business-outline"
              autoFocus={!form.id}
            />

            <Field
              label="Numéro de téléphone"
              value={form.phone}
              onChangeText={setFormField("phone")}
              placeholder="+221 77 000 00 00"
              icon="call-outline"
              keyboardType="phone-pad"
              helper="Utilisé pour les appels directs et l'envoi WhatsApp."
            />

            <Field
              label="Adresse email"
              value={form.email}
              onChangeText={setFormField("email")}
              placeholder="contact@entreprise.sn"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Field
              label="Adresse physique"
              value={form.address}
              onChangeText={setFormField("address")}
              placeholder="Route des Almadies, Dakar, Sénégal"
              icon="location-outline"
              multiline
            />

            <Field
              label="Ville — Pays"
              value={form.city}
              onChangeText={setFormField("city")}
              placeholder="Dakar — Sénégal"
              icon="globe-outline"
            />

            <Field
              label="N° TVA / NINEA client"
              value={form.tax_id}
              onChangeText={setFormField("tax_id")}
              placeholder="Ex. : 001234567 2G3"
              icon="document-text-outline"
            />

            <Field
              label="Interlocuteur client"
              value={form.contact}
              onChangeText={setFormField("contact")}
              placeholder="Nom de la personne à contacter"
              icon="person-outline"
              helper="Apparaît dans l'adresse de facturation du PDF."
            />

            <View style={{ marginTop: 10, gap: 10 }}>
              <Button
                title={form.id ? "Enregistrer les modifications" : "Créer le client"}
                icon="checkmark"
                onPress={save}
                size="lg"
              />

              {!!form.id && (
                <Button
                  title="Supprimer ce client"
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
  clientAddressSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  clientCardRight: {
    marginLeft: 6,
  },

  // Detail Sheet
  detailScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  detailHeader: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
  },
  detailBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  detailEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    gap: 4,
  },
  detailEditText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  detailBody: {
    padding: 16,
    paddingBottom: 40,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    ...shadows.sm,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  profileAvatarText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "800",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  profileMetaText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },

  // Contact Actions
  contactActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    width: "100%",
    justifyContent: "center",
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },

  // Stats Grid
  clientStatsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  clientStatBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  clientStatLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  clientStatValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  clientStatSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  emptyDocsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  emptyDocsText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
});
