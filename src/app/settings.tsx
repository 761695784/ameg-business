import { SiteConnectionCard } from "@/components/SiteConnection";
import { Button, Field, SectionHeader } from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

type Company = {
  name: string;
  address: string;
  phone: string;
  email: string;
  ninea: string;
  rc: string;
  logo: string;
  footer: string;
  tva_default: number;
  website: string;
  iban: string;
  bic: string;
  invoice_prefix: string;
  quote_prefix: string;
  default_contact: string;
  default_payment_terms: string;
  default_payment_method: string;
  default_incoterm: string;
  penalty_rate: string;
  recovery_fee: string;
  cgv_url: string;
};

const TEXT_KEYS = [
  "address", "phone", "email", "ninea", "rc", "footer", "website", "iban", "bic",
  "invoice_prefix", "quote_prefix", "default_contact", "default_payment_terms",
  "default_payment_method", "default_incoterm", "penalty_rate", "recovery_fee", "cgv_url",
] as const;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getFirstAsync<Company>("SELECT * FROM company WHERE id = 1")
      .then((res) => {
        setCompany(res);
      })
      .finally(() => setLoading(false));
  }, [db]);

  if (loading || !company) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const update = <K extends keyof Company>(key: K, value: Company[K]) =>
    setCompany((c) => (c ? { ...c, [key]: value } : c));

  const pickLogo = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });
      const asset = res.assets?.[0];
      if (!res.canceled && asset?.base64) {
        update(
          "logo",
          `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`,
        );
      }
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger l'image : " + String(e));
    }
  };

  const removeLogo = () => {
    update("logo", "");
  };

  const save = async () => {
    if (!company.name.trim()) {
      Alert.alert("Champ obligatoire", "Veuillez indiquer le nom ou la raison sociale de votre entreprise.");
      return;
    }
    setSaving(true);
    try {
      await db.runAsync(
        `UPDATE company SET name = ?, logo = ?, tva_default = ?,
         ${TEXT_KEYS.map((k) => `${k} = ?`).join(", ")} WHERE id = 1`,
        [
          company.name.trim(),
          company.logo,
          company.tva_default,
          ...TEXT_KEYS.map((k) => (company[k] ?? "").trim()),
        ],
      );
      Alert.alert(
        "Paramètres enregistrés",
        "Les informations de votre entreprise ont été mises à jour. Elles apparaîtront sur vos prochains devis et factures PDF.",
      );
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'enregistrer les paramètres : " + String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons
            name="information-circle"
            size={20}
            color={colors.primary}
            style={{ marginTop: 1 }}
          />
          <Text style={styles.infoBannerText}>
            Ces informations sont utilisées pour générer l&apos;en-tête officiel,
            les mentions légales et le pied de page de tous vos devis et
            factures PDF.
          </Text>
        </View>

        {/* 1. IDENTITÉ & LOGO */}
        <SectionHeader title="Connexion au site AMEG" />
        <SiteConnectionCard />

        <SectionHeader title="Identité de l'entreprise" />

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Logo officiel de l&apos;entreprise</Text>
          <Pressable style={styles.logoBox} onPress={pickLogo}>
            {company.logo ? (
              <View style={styles.logoPreviewContainer}>
                <Image
                  source={{ uri: company.logo }}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <View style={styles.logoChangeOverlay}>
                  <Ionicons name="camera" size={14} color={colors.white} />
                  <Text style={styles.logoChangeText}>Changer</Text>
                </View>
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <View style={styles.logoIconCircle}>
                  <Ionicons name="image-outline" size={28} color={colors.secondaryDark} />
                </View>
                <Text style={styles.logoPromptText}>
                  + Importer le logo officiel (PNG, JPG)
                </Text>
                <Text style={styles.logoPromptSub}>
                  Recommandé pour un rendu professionnel sur les PDF
                </Text>
              </View>
            )}
          </Pressable>

          {!!company.logo && (
            <Pressable style={styles.removeLogoBtn} onPress={removeLogo}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
              <Text style={styles.removeLogoText}>Supprimer le logo</Text>
            </Pressable>
          )}

          <Field
            label="Raison sociale / Nom commercial"
            required
            value={company.name}
            onChangeText={(t) => update("name", t)}
            placeholder="Ex. : AMEG International"
            icon="business-outline"
          />
        </View>

        {/* 2. COORDONNÉES */}
        <SectionHeader title="Coordonnées de contact" />

        <View style={styles.card}>
          <Field
            label="Adresse physique"
            value={company.address}
            onChangeText={(t) => update("address", t)}
            placeholder="Ex. : Route des Almadies, Dakar, Sénégal"
            icon="location-outline"
            multiline
          />

          <Field
            label="Numéro de téléphone standard"
            value={company.phone}
            onChangeText={(t) => update("phone", t)}
            placeholder="+221 33 000 00 00 / +221 77 000 00 00"
            icon="call-outline"
            keyboardType="phone-pad"
          />

          <Field
            label="Adresse email de contact"
            value={company.email}
            onChangeText={(t) => update("email", t)}
            placeholder="contact@ameg-international.com"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Field
            label="Site web"
            value={company.website}
            onChangeText={(t) => update("website", t)}
            placeholder="ameginternational.com"
            icon="globe-outline"
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* 3. FISCALITÉ & MENTIONS LÉGALES (SÉNÉGAL) */}
        <SectionHeader title="Fiscalité & Mentions légales (Sénégal)" />

        <View style={styles.card}>
          <Field
            label="Numéro NINEA"
            value={company.ninea}
            onChangeText={(t) => update("ninea", t)}
            placeholder="Ex. : 001234567 2V2"
            icon="card-outline"
            helper="Numéro d'Identification Nationale des Entreprises et Associations."
          />

          <Field
            label="RCCM"
            value={company.rc}
            onChangeText={(t) => update("rc", t)}
            placeholder="Ex. : SN.DKR.2020.B.1234"
            icon="document-text-outline"
            helper="Numéro d'immatriculation au RCCM."
          />

          <View style={styles.tvaDefaultRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.tvaDefaultTitle}>
                Activer la TVA (18 %) par défaut
              </Text>
              <Text style={styles.tvaDefaultSub}>
                Pré-coche automatiquement la TVA sénégalaise lors de la
                création de chaque nouveau devis ou facture.
              </Text>
            </View>
            <Switch
              value={company.tva_default === 1}
              onValueChange={(v) => update("tva_default", v ? 1 : 0)}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* 4. BANQUE & RÈGLEMENT */}
        <SectionHeader title="Banque & règlement" />

        <View style={styles.card}>
          <Field
            label="IBAN"
            value={company.iban}
            onChangeText={(t) => update("iban", t)}
            placeholder="SN08 SN010 01234 012345678901 23"
            icon="card-outline"
            autoCapitalize="characters"
          />
          <Field
            label="BIC / SWIFT"
            value={company.bic}
            onChangeText={(t) => update("bic", t)}
            placeholder="Ex. : CBAOSNDA"
            icon="swap-horizontal-outline"
            autoCapitalize="characters"
          />
          <Field
            label="Conditions de paiement par défaut"
            value={company.default_payment_terms}
            onChangeText={(t) => update("default_payment_terms", t)}
            placeholder="100% à la commande"
          />
          <Field
            label="Mode de règlement par défaut"
            value={company.default_payment_method}
            onChangeText={(t) => update("default_payment_method", t)}
            placeholder="Virement bancaire"
          />
          <Field
            label="Interlocuteur AMEG par défaut"
            value={company.default_contact}
            onChangeText={(t) => update("default_contact", t)}
            placeholder="Nom du commercial"
            helper="Pré-rempli sur chaque nouveau devis ou facture (modifiable)."
          />
          <Field
            label="Incoterm par défaut"
            value={company.default_incoterm}
            onChangeText={(t) => update("default_incoterm", t)}
            placeholder="Ex. : Delivered Duty Paid"
          />
        </View>

        {/* 5. NUMÉROTATION */}
        <SectionHeader title="Numérotation" />
        <View style={styles.card}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Préfixe factures"
                value={company.invoice_prefix}
                onChangeText={(t) => update("invoice_prefix", t.toUpperCase())}
                placeholder="AMEG"
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Préfixe devis"
                value={company.quote_prefix}
                onChangeText={(t) => update("quote_prefix", t.toUpperCase())}
                placeholder="DEV"
                autoCapitalize="characters"
              />
            </View>
          </View>
          <Text style={styles.tvaDefaultSub}>
            Exemple : {(company.invoice_prefix || "AMEG").trim()}-{new Date().getFullYear()}-0001
          </Text>
        </View>

        {/* 6. CGV */}
        <SectionHeader title="Conditions générales de vente" />
        <View style={styles.card}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Pénalité de retard (% / mois)"
                value={company.penalty_rate}
                onChangeText={(t) => update("penalty_rate", t)}
                placeholder="1,5"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Indemnité de recouvrement"
                value={company.recovery_fee}
                onChangeText={(t) => update("recovery_fee", t)}
                placeholder="Ex. : 25 000 FCFA"
              />
            </View>
          </View>
          <Field
            label="URL des CGV"
            value={company.cgv_url}
            onChangeText={(t) => update("cgv_url", t)}
            placeholder="ameginternational.com/cgv"
            icon="link-outline"
            keyboardType="url"
            autoCapitalize="none"
          />
          <Field
            label="Mentions complémentaires"
            value={company.footer}
            onChangeText={(t) => update("footer", t)}
            placeholder="Ex. : Marchandises vendues sous réserve de propriété jusqu'au paiement intégral."
            icon="information-circle-outline"
            multiline
            helper="Ajoutées sous les conditions générales de vente du PDF."
          />
        </View>

        {/* 5. SAVE BUTTON */}
        <View style={{ marginTop: 10, marginBottom: 20 }}>
          <Button
            title="Enregistrer les paramètres"
            icon="save-outline"
            onPress={save}
            loading={saving}
            size="lg"
          />
        </View>

        {/* 6. SYSTEM / APPLICATION INFO */}
        <View style={styles.appInfoCard}>
          <View style={styles.appInfoRow}>
            <Ionicons name="shield-checkmark" size={18} color={colors.secondaryDark} />
            <Text style={styles.appInfoTitle}>Ameg Business · Version 1.0.0</Text>
          </View>
          <Text style={styles.appInfoDesc}>
            Application mobile conçue pour AMEG International (Équipements de cuisine professionnelle).
            Toutes vos données sont stockées de façon 100 % locale et sécurisée sur votre appareil (SQLite).
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: 16,
    paddingBottom: 60,
  },

  infoBanner: {
    flexDirection: "row",
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    lineHeight: 18,
    fontWeight: "600",
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },

  fieldLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  logoBox: {
    height: 120,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  logoPreviewContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  logoImage: {
    width: "80%",
    height: "75%",
  },
  logoChangeOverlay: {
    position: "absolute",
    bottom: 6,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 45, 82, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
  },
  logoChangeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  logoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  logoPromptText: {
    color: colors.secondaryDark,
    fontWeight: "700",
    fontSize: 13,
  },
  logoPromptSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    textAlign: "center",
  },
  removeLogoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 14,
    marginTop: -4,
  },
  removeLogoText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "600",
  },

  tvaDefaultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  tvaDefaultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  tvaDefaultSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },

  appInfoCard: {
    backgroundColor: colors.cardSubdued,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  appInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  appInfoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textSecondary,
  },
  appInfoDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
