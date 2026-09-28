import {
  Badge,
  Button,
  Field,
  FormModal,
  SearchBar,
  SectionHeader,
  listStyles,
} from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import {
  STATUSES,
  STATUS_COLORS,
  TVA_STANDARD,
  computeTotals,
  convertQuoteToInvoice,
  deleteDocument,
  findInvoiceFromQuote,
  getClient,
  getCompany,
  getDocument,
  getLines,
  listClients,
  listItems,
  saveClient,
  saveDocument,
  statusLabel,
  type Client,
  type DocLine,
  type DocStatus,
  type DocType,
  type Item,
} from "@/db/queries";
import {
  addDaysISO,
  formatDate,
  formatFCFA,
  formatQuantity,
  numberToWordsFr,
  parseAmount,
  parseDateFR,
  parseQuantity,
  todayISO,
} from "@/utils/format";
import { printDocument, shareDocumentPdf } from "@/utils/pdf";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type EditLine = {
  key: string;
  reference: string;
  description: string;
  details: string;
  qty: string;
  unit: string;
  weight: string;
  hs: string;
  price: string;
  tva: string;
  /** Affiche les champs détaillés (réf., description, poids, douane) */
  expanded: boolean;
};

let keySeq = 0;
const newKey = () => `line_${Date.now()}_${keySeq++}`;

function blankLine(tvaRate: number): EditLine {
  return {
    key: newKey(),
    reference: "",
    description: "",
    details: "",
    qty: "1",
    unit: "PCS",
    weight: "",
    hs: "",
    price: "",
    tva: formatQuantity(tvaRate),
    expanded: false,
  };
}

function toEdit(l: DocLine): EditLine {
  return {
    key: newKey(),
    reference: l.reference ?? "",
    description: l.description,
    details: l.details ?? "",
    qty: formatQuantity(l.quantity),
    unit: l.unit || "PCS",
    weight: l.weight ?? "",
    hs: l.hs_code ?? "",
    price: String(l.unit_price),
    tva: formatQuantity(l.tva_rate ?? 0),
    expanded: !!(l.reference || l.details || l.weight || l.hs_code),
  };
}

function toLine(l: EditLine): DocLine {
  return {
    reference: l.reference.trim(),
    description: l.description.trim(),
    details: l.details.trim(),
    quantity: parseQuantity(l.qty),
    unit: l.unit.trim().toUpperCase() || "PCS",
    weight: l.weight.trim(),
    hs_code: l.hs.trim(),
    unit_price: parseAmount(l.price),
    tva_rate: parseQuantity(l.tva),
  };
}

export default function DocumentScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const isNew = params.id === "new";
  const docId = isNew ? undefined : Number(params.id);
  const savedId = useRef<number | undefined>(docId);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string>("");

  const [type, setType] = useState<DocType>(
    params.type === "facture" ? "facture" : "devis",
  );
  const [number, setNumber] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [date, setDate] = useState(formatDate(todayISO()));
  const [dueDate, setDueDate] = useState(
    formatDate(addDaysISO(todayISO(), 30)),
  );
  const [status, setStatus] = useState<DocStatus>("brouillon");
  const [defaultRate, setDefaultRate] = useState(TVA_STANDARD);
  const [notes, setNotes] = useState("");
  const [contact, setContact] = useState("");
  const [clientRef, setClientRef] = useState("");
  const [internalRef, setInternalRef] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [discount, setDiscount] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [sourceQuote, setSourceQuote] = useState<number | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<{
    id: number;
    number: string;
  } | null>(null);

  const [clientPicker, setClientPicker] = useState(false);
  const [itemPicker, setItemPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (isNew) {
          const company = await getCompany(db);
          const rate = (company?.tva_default ?? 1) === 1 ? TVA_STANDARD : 0;
          setDefaultRate(rate);
          setContact(company?.default_contact ?? "");
          setIncoterm(company?.default_incoterm ?? "");
          setPaymentTerms(company?.default_payment_terms ?? "");
          setPaymentMethod(company?.default_payment_method ?? "");
          setLines([blankLine(rate)]);
        } else if (docId) {
          const doc = await getDocument(db, docId);
          if (!doc) {
            Alert.alert("Document introuvable", "Ce document n'existe plus.");
            router.back();
            return;
          }
          setType(doc.type);
          setNumber(doc.number);
          setClient(await getClient(db, doc.client_id));
          setDate(formatDate(doc.date));
          setDueDate(formatDate(doc.due_date));
          setStatus(doc.status);
          setDefaultRate(doc.tva_enabled === 1 ? TVA_STANDARD : 0);
          setNotes(doc.notes);
          setContact(doc.contact ?? "");
          setClientRef(doc.client_ref ?? "");
          setInternalRef(doc.internal_ref ?? "");
          setIncoterm(doc.incoterm ?? "");
          setPaymentTerms(doc.payment_terms ?? "");
          setPaymentMethod(doc.payment_method ?? "");
          setDiscount(doc.discount ? String(doc.discount) : "");
          setTaxCode(doc.tax_code ?? "");
          setSourceQuote(doc.source_quote_id);
          const dbLines = await getLines(db, docId);
          setLines(
            dbLines.length > 0
              ? dbLines.map(toEdit)
              : [blankLine(doc.tva_enabled === 1 ? TVA_STANDARD : 0)],
          );
          if (doc.type === "devis") {
            setLinkedInvoice(await findInvoiceFromQuote(db, docId));
          }
        }
      } catch (err) {
        console.error("Erreur chargement document:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [db, docId, isNew]);

  const docLines = useMemo(() => lines.map(toLine), [lines]);
  const totals = useMemo(
    () => computeTotals(docLines, parseAmount(discount)),
    [docLines, discount],
  );
  const allTaxed = lines.length > 0 && docLines.every((l) => (l.tva_rate ?? 0) > 0);
  const hasExempt = docLines.some((l) => l.description && (l.tva_rate ?? 0) === 0);
  const setAllRates = (on: boolean) => {
    const r = on ? TVA_STANDARD : 0;
    setDefaultRate(r);
    setLines((ls) => ls.map((l) => ({ ...l, tva: formatQuantity(r) })));
  };

  const updateLine = (key: string, patch: Partial<EditLine>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) {
      // Re-initialize to a single blank line
      setLines([blankLine(defaultRate)]);
      return;
    }
    setLines((ls) => ls.filter((l) => l.key !== key));
  };

  const addBlankLine = () => {
    setLines((ls) => [...ls, blankLine(defaultRate)]);
  };

  const addItem = (it: Item) => {
    setLines((ls) => {
      // Replace first empty line if exists
      const blankIndex = ls.findIndex(
        (l) => !l.description.trim() && !l.price,
      );
      const newLine: EditLine = {
        ...blankLine(defaultRate),
        reference: it.reference ?? "",
        description: it.label,
        details: it.details ?? "",
        unit: it.unit || "PCS",
        weight: it.weight ?? "",
        hs: it.hs_code ?? "",
        price: String(it.unit_price),
        expanded: !!(it.reference || it.details || it.weight || it.hs_code),
      };
      if (blankIndex >= 0) {
        return ls.map((l, i) => (i === blankIndex ? newLine : l));
      }
      return [...ls, newLine];
    });
    setItemPicker(false);
  };

  const setDueInDays = (days: number) => {
    const baseIso = parseDateFR(date) ?? todayISO();
    setDueDate(formatDate(addDaysISO(baseIso, days)));
  };

  const persist = async (): Promise<number | null> => {
    const isoDate = parseDateFR(date);
    if (!isoDate) {
      Alert.alert("Date invalide", "Veuillez saisir la date au format JJ/MM/AAAA.");
      return null;
    }
    const isoDue = dueDate.trim() ? parseDateFR(dueDate) : null;
    if (dueDate.trim() && !isoDue) {
      Alert.alert(
        "Date d'échéance invalide",
        "La date d'échéance doit être au format JJ/MM/AAAA.",
      );
      return null;
    }
    const validLines = docLines.filter((l) => l.description.trim().length > 0);
    if (validLines.length === 0) {
      Alert.alert(
        "Articles manquants",
        "Ajoutez au moins une ligne avec une désignation d'article ou de prestation.",
      );
      return null;
    }
    if (!client) {
      Alert.alert(
        "Client obligatoire",
        "Veuillez sélectionner un client pour ce document.",
      );
      return null;
    }

    setBusy(true);
    setBusyMessage("Enregistrement...");
    try {
      const id = await saveDocument(
        db,
        {
          type,
          client_id: client.id,
          date: isoDate,
          due_date: isoDue,
          status,
          notes: notes.trim(),
          source_quote_id: sourceQuote,
          contact: contact.trim(),
          client_ref: clientRef.trim(),
          internal_ref: internalRef.trim(),
          incoterm: incoterm.trim(),
          payment_terms: paymentTerms.trim(),
          payment_method: paymentMethod.trim(),
          discount: parseAmount(discount),
          tax_code: taxCode.trim(),
          lines: validLines,
        },
        savedId.current,
      );
      savedId.current = id;
      return id;
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'enregistrer le document : " + String(e));
      return null;
    } finally {
      setBusy(false);
      setBusyMessage("");
    }
  };

  const onSave = async () => {
    const id = await persist();
    if (id == null) return;
    if (isNew) {
      router.replace(`/documents/${id}`);
    } else {
      Alert.alert("Enregistré", "Le document a été mis à jour avec succès.");
    }
  };

  const exportPdf = async (mode: "share" | "print") => {
    const id = await persist();
    if (id == null) return;

    const [company, doc, cl, ls] = await Promise.all([
      getCompany(db),
      getDocument(db, id),
      getClient(db, client?.id ?? null),
      getLines(db, id),
    ]);

    if (!company || !doc) return;
    if (!company.name.trim()) {
      Alert.alert(
        "Configuration requise",
        "Veuillez renseigner le nom de votre entreprise dans les Paramètres avant d'exporter un PDF.",
        [
          { text: "Plus tard", style: "cancel" },
          {
            text: "Aller aux paramètres",
            onPress: () => router.push("/settings"),
          },
        ],
      );
      return;
    }

    setBusy(true);
    setBusyMessage(mode === "share" ? "Génération du PDF..." : "Préparation impression...");
    try {
      if (mode === "share") {
        await shareDocumentPdf(company, doc, cl, ls);
      } else {
        await printDocument(company, doc, cl, ls);
      }
    } catch (e) {
      Alert.alert("Erreur PDF", "Impossible de générer le document : " + String(e));
    } finally {
      setBusy(false);
      setBusyMessage("");
    }

    if (isNew) {
      router.replace(`/documents/${id}`);
    }
  };

  const onConvert = async () => {
    if (!docId) return;
    if (linkedInvoice) {
      router.push(`/documents/${linkedInvoice.id}`);
      return;
    }
    const saved = await persist();
    if (saved == null) return;

    Alert.alert(
      "Transformer en facture ?",
      "Une nouvelle facture sera créée avec les mêmes lignes et conditions. Le devis sera automatiquement marqué comme « Accepté ».",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Créer la facture",
          onPress: async () => {
            setBusy(true);
            setBusyMessage("Création de la facture...");
            try {
              const today = todayISO();
              const invoiceId = await convertQuoteToInvoice(
                db,
                docId,
                today,
                addDaysISO(today, 30),
              );
              router.replace(`/documents/${invoiceId}`);
            } catch (e) {
              Alert.alert("Erreur", "Impossible de convertir le devis : " + String(e));
            } finally {
              setBusy(false);
              setBusyMessage("");
            }
          },
        },
      ],
    );
  };

  const onDuplicate = async () => {
    Alert.alert(
      "Dupliquer ce document ?",
      "Un nouveau document brouillon sera créé avec les mêmes lignes et informations.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Dupliquer",
          onPress: async () => {
            setBusy(true);
            setBusyMessage("Duplication...");
            try {
              const valid = docLines.filter((l) => l.description.trim().length > 0);
              const today = todayISO();
              const id = await saveDocument(db, {
                type,
                client_id: client?.id ?? null,
                date: today,
                due_date: addDaysISO(today, 30),
                status: "brouillon",
                notes: notes.trim(),
                contact: contact.trim(),
                client_ref: clientRef.trim(),
                internal_ref: internalRef.trim(),
                incoterm: incoterm.trim(),
                payment_terms: paymentTerms.trim(),
                payment_method: paymentMethod.trim(),
                discount: parseAmount(discount),
                tax_code: taxCode.trim(),
                lines: valid,
              });
              router.replace(`/documents/${id}`);
            } catch (e) {
              Alert.alert("Erreur", "Impossible de dupliquer : " + String(e));
            } finally {
              setBusy(false);
              setBusyMessage("");
            }
          },
        },
      ],
    );
  };

  const onDelete = () => {
    if (!docId) return;
    Alert.alert(
      `Supprimer ${number || "ce document"} ?`,
      "Cette action est définitive et supprimera toutes les lignes associées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteDocument(db, docId);
              router.back();
            } catch (e) {
              Alert.alert("Erreur", "Impossible de supprimer le document : " + String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[listStyles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const screenTitle = isNew
    ? type === "facture"
      ? "Nouvelle facture"
      : "Nouveau devis"
    : `${type === "facture" ? "Facture" : "Devis"} ${number}`;

  return (
    <KeyboardAvoidingView
      style={listStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: screenTitle,
          headerRight: () => (
            <Pressable
              onPress={onSave}
              hitSlop={12}
              disabled={busy}
              style={({ pressed }) => [
                styles.saveHeaderBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.saveHeaderText}>Enregistrer</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. DOCUMENT STATUS & TYPE BADGE */}
        <View style={styles.statusSectionCard}>
          <View style={styles.statusHeaderRow}>
            <View
              style={[
                styles.typeIndicatorBadge,
                {
                  backgroundColor:
                    type === "facture" ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Ionicons
                name={type === "facture" ? "receipt" : "document-text"}
                size={14}
                color={colors.white}
              />
              <Text style={styles.typeIndicatorText}>
                {type === "facture" ? "FACTURE" : "DEVIS"}
              </Text>
            </View>

            <Badge
              label={statusLabel(type, status)}
              color={STATUS_COLORS[status]}
              size="md"
            />
          </View>

          {/* Status selector chips */}
          <Text style={styles.subSectionTitle}>Modifier le statut :</Text>
          <View style={styles.statusSelectorRow}>
            {STATUSES[type].map((s) => {
              const active = s === status;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStatus(s)}
                  style={[
                    styles.statusPill,
                    { borderColor: STATUS_COLORS[s] },
                    active && { backgroundColor: STATUS_COLORS[s] },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: active ? colors.white : STATUS_COLORS[s] },
                    ]}
                  >
                    {statusLabel(type, s)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Origin link if converted */}
        {sourceQuote != null && (
          <Pressable
            style={styles.linkedDocCard}
            onPress={() => router.push(`/documents/${sourceQuote}`)}
          >
            <Ionicons
              name="link-outline"
              size={18}
              color={colors.secondaryDark}
            />
            <Text style={styles.linkedDocText}>
              Issu d&apos;un devis commercial — Afficher le devis d&apos;origine →
            </Text>
          </Pressable>
        )}

        {/* 2. CLIENT SECTION */}
        <SectionHeader title="Client" />
        <Pressable
          style={[
            styles.clientCard,
            !client && styles.clientCardMissing,
          ]}
          onPress={() => setClientPicker(true)}
        >
          <View
            style={[
              styles.clientAvatar,
              {
                backgroundColor: client
                  ? colors.secondary
                  : colors.accentLight,
              },
            ]}
          >
            <Ionicons
              name={client ? "person" : "person-add"}
              size={20}
              color={client ? colors.white : colors.accentDark}
            />
          </View>

          <View style={{ flex: 1 }}>
            {client ? (
              <>
                <Text style={styles.clientNameSelected}>{client.name}</Text>
                {!!client.phone && (
                  <View style={styles.clientMetaRow}>
                    <Ionicons
                      name="call-outline"
                      size={12}
                      color={colors.textMuted}
                    />
                    <Text style={styles.clientMetaText}>{client.phone}</Text>
                  </View>
                )}
                {!!client.address && (
                  <View style={styles.clientMetaRow}>
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={colors.textMuted}
                    />
                    <Text style={styles.clientMetaText} numberOfLines={1}>
                      {client.address}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.clientPlaceholderTitle}>
                  Choisir un client *
                </Text>
                <Text style={styles.clientPlaceholderSub}>
                  Touchez pour rechercher ou ajouter un client
                </Text>
              </>
            )}
          </View>

          <View style={styles.clientChangeBadge}>
            <Text style={styles.clientChangeText}>
              {client ? "Changer" : "Sélectionner"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.secondaryDark}
            />
          </View>
        </Pressable>

        {/* 3. DATES SECTION */}
        <SectionHeader title="Dates & Échéance" />
        <View style={styles.datesGrid}>
          <View style={{ flex: 1 }}>
            <Field
              label="Date d'émission"
              value={date}
              onChangeText={setDate}
              placeholder="JJ/MM/AAAA"
              icon="calendar-outline"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={type === "facture" ? "Date d'échéance" : "Valable jusqu'au"}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="JJ/MM/AAAA"
              icon="time-outline"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* Quick deadline pills */}
        <View style={styles.dateHelperPills}>
          <Text style={styles.dateHelperLabel}>Délai rapide :</Text>
          <Pressable
            style={styles.dateHelperPill}
            onPress={() => setDueInDays(15)}
          >
            <Text style={styles.dateHelperPillText}>+15 jours</Text>
          </Pressable>
          <Pressable
            style={styles.dateHelperPill}
            onPress={() => setDueInDays(30)}
          >
            <Text style={styles.dateHelperPillText}>+30 jours</Text>
          </Pressable>
          <Pressable
            style={styles.dateHelperPill}
            onPress={() => setDueInDays(60)}
          >
            <Text style={styles.dateHelperPillText}>+60 jours</Text>
          </Pressable>
        </View>

        {/* 3b. RÉFÉRENCES & CONDITIONS (en-tête du modèle AMEG) */}
        <SectionHeader title="Références & conditions" />
        <View style={styles.refsCard}>
          <Field
            label="Votre interlocuteur AMEG"
            value={contact}
            onChangeText={setContact}
            placeholder="Nom du commercial"
            icon="person-circle-outline"
          />
          <View style={styles.datesGrid}>
            <View style={{ flex: 1 }}>
              <Field
                label="Réf. commande client"
                value={clientRef}
                onChangeText={setClientRef}
                placeholder="Ex. : BC-4471"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Réf. AMEG"
                value={internalRef}
                onChangeText={setInternalRef}
                placeholder="Référence interne"
              />
            </View>
          </View>
          <Field
            label="Incoterm"
            value={incoterm}
            onChangeText={setIncoterm}
            placeholder="Ex. : Delivered Duty Paid (DDP)"
          />
          <View style={styles.chipRow}>
            {["EXW", "FOB", "CIF", "DAP", "DDP"].map((code) => (
              <Pressable
                key={code}
                style={styles.dateHelperPill}
                onPress={() => setIncoterm(code)}
              >
                <Text style={styles.dateHelperPillText}>{code}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Conditions de paiement"
            value={paymentTerms}
            onChangeText={setPaymentTerms}
            placeholder="Ex. : 100% à la commande"
          />
          <Field
            label="Mode de règlement"
            value={paymentMethod}
            onChangeText={setPaymentMethod}
            placeholder="Ex. : Virement bancaire"
          />
          <View style={styles.chipRow}>
            {["Virement bancaire", "Chèque", "Espèces", "Wave", "Orange Money"].map(
              (m) => (
                <Pressable
                  key={m}
                  style={styles.dateHelperPill}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text style={styles.dateHelperPillText}>{m}</Text>
                </Pressable>
              ),
            )}
          </View>
        </View>

        {/* 4. LINE ITEMS SECTION */}
        <SectionHeader
          title="Articles & Lignes"
          count={docLines.filter((l) => l.description.trim()).length}
        />

        {lines.map((line, index) => {
          const parsedQ = parseQuantity(line.qty);
          const parsedP = parseAmount(line.price);
          const lineTotal = Math.round(parsedQ * parsedP);

          return (
            <View key={line.key} style={styles.lineCard}>
              <View style={styles.lineHeaderRow}>
                <View style={styles.lineNumberPill}>
                  <Text style={styles.lineNumberText}>Ligne {index + 1}</Text>
                </View>

                <Pressable
                  onPress={() => removeLine(line.key)}
                  hitSlop={10}
                  style={styles.lineDeleteBtn}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.lineDeleteText}>Supprimer</Text>
                </Pressable>
              </View>

              {line.expanded && (
                <TextInput
                  style={[styles.lineNumInput, { marginBottom: 8 }]}
                  value={line.reference}
                  onChangeText={(t) => updateLine(line.key, { reference: t })}
                  placeholder="Référence article (ex. : REF-01)"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="characters"
                />
              )}
              <TextInput
                style={styles.lineDescInput}
                value={line.description}
                onChangeText={(t) => updateLine(line.key, { description: t })}
                placeholder="Désignation de l'équipement ou service..."
                placeholderTextColor={colors.textLight}
                multiline
              />
              {line.expanded && (
                <TextInput
                  style={[styles.lineDescInput, styles.lineDetailsInput]}
                  value={line.details}
                  onChangeText={(t) => updateLine(line.key, { details: t })}
                  placeholder="Description technique (caractéristiques, dimensions, options…)"
                  placeholderTextColor={colors.textLight}
                  multiline
                />
              )}

              <View style={styles.lineInputsRow}>
                <View style={{ width: 80 }}>
                  <Text style={styles.lineInputLabel}>Quantité</Text>
                  <TextInput
                    style={styles.lineNumInput}
                    value={line.qty}
                    onChangeText={(t) =>
                      updateLine(line.key, { qty: t.replace(/[^\d.,]/g, "") })
                    }
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <View style={{ width: 70 }}>
                  <Text style={styles.lineInputLabel}>Unité</Text>
                  <TextInput
                    style={styles.lineNumInput}
                    value={line.unit}
                    onChangeText={(t) => updateLine(line.key, { unit: t })}
                    autoCapitalize="characters"
                    placeholder="PCS"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.lineInputLabel}>PU Net HT (FCFA)</Text>
                  <TextInput
                    style={styles.lineNumInput}
                    value={line.price}
                    onChangeText={(t) =>
                      updateLine(line.key, { price: t.replace(/[^\d]/g, "") })
                    }
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              </View>

              {line.expanded && (
                <View style={[styles.lineInputsRow, { marginTop: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineInputLabel}>Poids (kg)</Text>
                    <TextInput
                      style={styles.lineNumInput}
                      value={line.weight}
                      onChangeText={(t) => updateLine(line.key, { weight: t })}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineInputLabel}>N° Douane (SH)</Text>
                    <TextInput
                      style={styles.lineNumInput}
                      value={line.hs}
                      onChangeText={(t) => updateLine(line.key, { hs: t })}
                      keyboardType="numbers-and-punctuation"
                      placeholder="—"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>
                </View>
              )}

              <View style={styles.lineTvaRow}>
                <Text style={styles.lineInputLabel}>TVA :</Text>
                {[TVA_STANDARD, 0].map((r) => {
                  const active = parseQuantity(line.tva) === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => updateLine(line.key, { tva: formatQuantity(r) })}
                      style={[styles.tvaChip, active && styles.tvaChipActive]}
                    >
                      <Text style={[styles.tvaChipText, active && styles.tvaChipTextActive]}>
                        {r} %
                      </Text>
                    </Pressable>
                  );
                })}
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => updateLine(line.key, { expanded: !line.expanded })}
                  hitSlop={8}
                >
                  <Text style={styles.moreFieldsText}>
                    {line.expanded ? "Moins de détails" : "+ Réf., description, poids, douane"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.lineFooterRow}>
                <Text style={styles.lineTotalLabel}>Montant HT :</Text>
                <Text style={styles.lineTotalValue}>{formatFCFA(lineTotal)}</Text>
              </View>
            </View>
          );
        })}

        {/* Line Add Buttons */}
        <View style={styles.addButtonsRow}>
          <Pressable style={styles.addBtnCatalog} onPress={() => setItemPicker(true)}>
            <Ionicons name="cube-outline" size={18} color={colors.white} />
            <Text style={styles.addBtnCatalogText}>Depuis le catalogue</Text>
          </Pressable>

          <Pressable style={styles.addBtnCustom} onPress={addBlankLine}>
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.addBtnCustomText}>Ligne libre</Text>
          </Pressable>
        </View>

        {/* 5. FINANCIAL TOTALS & TVA */}
        <SectionHeader title="Récapitulatif & TVA" />

        <View style={styles.totalsCard}>
          <View style={styles.tvaSwitchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.tvaTitle}>
                TVA {TVA_STANDARD} % sur toutes les lignes
              </Text>
              <Text style={styles.tvaSubtitle}>
                Le taux se règle aussi ligne par ligne (18 % ou 0 %)
              </Text>
            </View>
            <Switch
              value={allTaxed}
              onValueChange={setAllRates}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.totalDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Sous-total HT</Text>
            <Text style={styles.totalRowValue}>{formatFCFA(totals.subtotal)}</Text>
          </View>

          <View style={styles.discountRow}>
            <Text style={styles.totalRowLabel}>Remise éventuelle (FCFA)</Text>
            <TextInput
              style={styles.discountInput}
              value={discount}
              onChangeText={(t) => setDiscount(t.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Total HT</Text>
            <Text style={styles.totalRowValue}>{formatFCFA(totals.ht)}</Text>
          </View>

          {totals.groups.map((g) => (
            <View key={g.rate} style={styles.totalRow}>
              <Text style={g.rate > 0 ? styles.totalRowLabel : styles.totalRowLabelMuted}>
                TVA {formatQuantity(g.rate)} % (base {formatFCFA(g.base)})
              </Text>
              <Text style={g.rate > 0 ? styles.totalRowValue : styles.totalRowValueMuted}>
                {formatFCFA(g.amount)}
              </Text>
            </View>
          ))}

          {hasExempt && (
            <View style={{ marginTop: 8 }}>
              <Field
                label="Code taxe / motif d'exonération (lignes à 0 %)"
                value={taxCode}
                onChangeText={setTaxCode}
                placeholder="Ex. : Exonération Art. ... du CGI"
              />
            </View>
          )}

          {/* Grand Total TTC Banner */}
          <View style={styles.ttcBanner}>
            <View>
              <Text style={styles.ttcLabel}>TOTAL TTC</Text>
              <Text style={styles.ttcSub}>Toutes Taxes Comprises</Text>
            </View>
            <Text style={styles.ttcAmount}>{formatFCFA(totals.ttc)}</Text>
          </View>

          {/* Amount in words */}
          <View style={styles.wordsBox}>
            <Text style={styles.wordsLabel}>Montant en toutes lettres :</Text>
            <Text style={styles.wordsText}>
              Arrêté{type === "facture" ? "e la présente facture" : " le présent devis"} à la somme de :{" "}
              <Text style={styles.wordsHighlight}>
                {numberToWordsFr(totals.ttc)} francs CFA
              </Text>
              .
            </Text>
          </View>
        </View>

        {/* 6. NOTES & CONDITIONS */}
        <SectionHeader title="Notes & Conditions" />
        <Field
          label="Notes visibles sur le PDF"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Ex. : Acompte 50 % à la commande. Règlement par Wave, Orange Money ou virement bancaire."
          helper="Ces mentions apparaîtront directement au bas du document PDF officiel."
        />

        {/* 7. ACTION BUTTONS */}
        <View style={styles.actionButtonsContainer}>
          <Button
            title={isNew ? "Enregistrer le document" : "Enregistrer les modifications"}
            icon="save-outline"
            onPress={onSave}
            disabled={busy}
            loading={busy && busyMessage.includes("Enregistrement")}
            size="lg"
          />

          <View style={styles.pdfActionsRow}>
            <View style={{ flex: 1 }}>
              <Button
                title="Partager PDF"
                icon="share-social-outline"
                variant="primaryNavy"
                onPress={() => exportPdf("share")}
                disabled={busy}
                loading={busy && busyMessage.includes("PDF")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Imprimer"
                icon="print-outline"
                variant="secondary"
                onPress={() => exportPdf("print")}
                disabled={busy}
                loading={busy && busyMessage.includes("impression")}
              />
            </View>
          </View>

          {!isNew && type === "devis" && (
            <Button
              title={
                linkedInvoice
                  ? `Voir la facture ${linkedInvoice.number}`
                  : "Transformer en facture"
              }
              icon="swap-horizontal-outline"
              variant="secondaryTeal"
              onPress={onConvert}
              disabled={busy}
              loading={busy && busyMessage.includes("facture")}
            />
          )}

          {!isNew && (
            <View style={styles.pdfActionsRow}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Dupliquer"
                  icon="copy-outline"
                  variant="secondary"
                  onPress={onDuplicate}
                  disabled={busy}
                  loading={busy && busyMessage.includes("Duplication")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Supprimer"
                  icon="trash-outline"
                  variant="danger"
                  onPress={onDelete}
                  disabled={busy}
                />
              </View>
            </View>
          )}

          {busy && !!busyMessage && (
            <View style={styles.busyOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.busyText}>{busyMessage}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CLIENT PICKER MODAL */}
      {clientPicker && (
        <ClientPickerModal
          visible
          onClose={() => setClientPicker(false)}
          onPick={(c) => {
            setClient(c);
            setClientPicker(false);
          }}
        />
      )}

      {/* ITEM PICKER MODAL */}
      {itemPicker && (
        <ItemPickerModal
          visible
          onClose={() => setItemPicker(false)}
          onPick={addItem}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ==========================================
// CLIENT PICKER MODAL
// ==========================================
function ClientPickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (c: Client) => void;
}) {
  const db = useSQLiteContext();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    listClients(db).then(setClients);
  }, [db]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      )
    : clients;

  const handleQuickCreate = async () => {
    const name = query.trim();
    if (!name) return;
    const id = await saveClient(db, {
      name,
      phone: newPhone.trim(),
      email: "",
      address: "",
    });
    onPick({
      id,
      name,
      phone: newPhone.trim(),
      email: "",
      address: "",
      city: "",
      tax_id: "",
      contact: "",
    });
  };

  return (
    <FormModal
      visible={visible}
      title="Sélectionner un client"
      subtitle="Recherchez ou créez un nouveau client"
      onClose={onClose}
    >
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Nom, téléphone ou email..."
      />

      {/* Quick create prompt if no exact match */}
      {!!query.trim() && !clients.some((c) => c.name.toLowerCase() === q) && (
        <View style={styles.quickCreateBox}>
          <Text style={styles.quickCreateTitle}>
            Client non répertorié : « {query.trim()} »
          </Text>
          {creating ? (
            <View style={{ marginTop: 10 }}>
              <Field
                label="Téléphone (optionnel)"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                placeholder="+221 77 000 00 00"
              />
              <Button
                title={`Confirmer et créer « ${query.trim()} »`}
                icon="checkmark"
                onPress={handleQuickCreate}
              />
            </View>
          ) : (
            <Button
              title={`Créer « ${query.trim()} »`}
              icon="person-add"
              variant="secondaryTeal"
              size="sm"
              onPress={() => setCreating(true)}
              style={{ marginTop: 6 }}
            />
          )}
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        {filtered.map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [
              listStyles.card,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onPick(c)}
          >
            <View style={listStyles.avatar}>
              <Text style={listStyles.avatarText}>
                {c.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={listStyles.cardBody}>
              <Text style={listStyles.cardTitle}>{c.name}</Text>
              {!!c.phone && (
                <Text style={listStyles.cardSub}>{c.phone}</Text>
              )}
            </View>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={colors.secondary}
            />
          </Pressable>
        ))}

        {filtered.length === 0 && !query && (
          <Text style={styles.pickerEmpty}>
            Aucun client enregistré. Tapez un nom ci-dessus pour le créer directement.
          </Text>
        )}
      </View>
    </FormModal>
  );
}

// ==========================================
// ITEM PICKER MODAL
// ==========================================
function ItemPickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (it: Item) => void;
}) {
  const db = useSQLiteContext();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listItems(db).then(setItems);
  }, [db]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.label.toLowerCase().includes(q))
    : items;

  return (
    <FormModal
      visible={visible}
      title="Catalogue d'articles"
      subtitle="Sélectionnez un article pour l'ajouter au document"
      onClose={onClose}
    >
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher un équipement ou service..."
      />

      <View style={{ marginTop: 12 }}>
        {filtered.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              listStyles.card,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onPick(item)}
          >
            <View
              style={[
                styles.itemIconCircle,
                { backgroundColor: colors.primarySubtle },
              ]}
            >
              <Ionicons name="cube" size={18} color={colors.primary} />
            </View>
            <View style={listStyles.cardBody}>
              <Text style={listStyles.cardTitle}>{item.label}</Text>
              <Text style={listStyles.cardSub}>Prix catalogue HT</Text>
            </View>
            <Text style={listStyles.price}>{formatFCFA(item.unit_price)}</Text>
            <Ionicons
              name="add-circle"
              size={22}
              color={colors.accent}
            />
          </Pressable>
        ))}

        {filtered.length === 0 && (
          <Text style={styles.pickerEmpty}>
            {items.length === 0
              ? "Votre catalogue est vide. Vous pouvez ajouter des articles dans l'onglet Articles."
              : "Aucun article ne correspond à votre recherche."}
          </Text>
        )}
      </View>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: 16,
    paddingBottom: 60,
  },
  saveHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
    gap: 4,
  },
  saveHeaderText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 13,
  },

  // Status Card
  statusSectionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statusHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  typeIndicatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    gap: 5,
  },
  typeIndicatorText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statusSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusPill: {
    borderWidth: 1.2,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Linked Doc Card
  linkedDocCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondaryLight,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  linkedDocText: {
    color: colors.secondaryDark,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },

  // Client Card
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 14,
    gap: 12,
    ...shadows.sm,
  },
  clientCardMissing: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
    borderStyle: "dashed",
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  clientNameSelected: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  clientMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  clientMetaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  clientPlaceholderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accentDark,
  },
  clientPlaceholderSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  clientChangeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  clientChangeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.secondaryDark,
  },

  refsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    paddingBottom: 4,
    marginBottom: 16,
    ...shadows.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -8,
    marginBottom: 14,
  },
  lineDetailsInput: {
    minHeight: 60,
    fontSize: 13,
    color: colors.textSecondary,
    textAlignVertical: "top",
  },
  lineTvaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  tvaChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tvaChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  tvaChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  tvaChipTextActive: {
    color: colors.white,
  },
  moreFieldsText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.secondaryDark,
  },
  discountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  discountInput: {
    minWidth: 110,
    textAlign: "right",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  // Dates
  datesGrid: {
    flexDirection: "row",
    gap: 10,
  },
  dateHelperPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -8,
    marginBottom: 16,
  },
  dateHelperLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  dateHelperPill: {
    backgroundColor: colors.cardSubdued,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  dateHelperPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  // Lines
  lineCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    ...shadows.sm,
  },
  lineHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  lineNumberPill: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  lineNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
  },
  lineDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lineDeleteText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  },
  lineDescInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    minHeight: 46,
    marginBottom: 10,
  },
  lineInputsRow: {
    flexDirection: "row",
    gap: 10,
  },
  lineInputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 4,
  },
  lineNumInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  lineFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  lineTotalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  lineTotalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  addButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  addBtnCatalog: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    gap: 6,
    ...shadows.sm,
  },
  addBtnCatalogText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  addBtnCustom: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    gap: 6,
  },
  addBtnCustomText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },

  // Totals Card
  totalsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    ...shadows.sm,
  },
  tvaSwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
  },
  tvaTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  tvaSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  totalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  totalRowLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  totalRowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  totalRowLabelMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  totalRowValueMuted: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  ttcBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 12,
    ...shadows.sm,
  },
  ttcLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  ttcSub: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "600",
  },
  ttcAmount: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  wordsBox: {
    marginTop: 12,
    backgroundColor: colors.cardSubdued,
    borderRadius: radii.md,
    padding: 10,
  },
  wordsLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 2,
  },
  wordsText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  wordsHighlight: {
    fontWeight: "800",
    color: colors.primary,
  },

  // Action Buttons
  actionButtonsContainer: {
    gap: 10,
    marginTop: 8,
    marginBottom: 30,
  },
  pdfActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  busyOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  busyText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  // Modal Specific
  quickCreateBox: {
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.accentSubtle,
  },
  quickCreateTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentDark,
  },
  pickerEmpty: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 30,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
});
