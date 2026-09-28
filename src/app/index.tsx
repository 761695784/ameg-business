import { DocRow } from "@/components/DocRow";
import { EmptyState, SectionHeader } from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import {
  getCompany,
  getDashboard,
  listDocuments,
  type DashboardStats,
  type DocListRow,
} from "@/db/queries";
import { formatFCFA, todayISO } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocListRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      const company = await getCompany(db);
      setCompanyName(company?.name ?? "");
      const currentMonth = todayISO().slice(0, 7);
      const dashboardStats = await getDashboard(db, currentMonth);
      setStats(dashboardStats);
      const docs = await listDocuments(db);
      setRecentDocs(docs.slice(0, 5));
    } catch (e) {
      console.error("Erreur chargement tableau de bord:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getMonthNameFR = () => {
    const months = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    return months[new Date().getMonth()];
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.accent, colors.primary]}
        />
      }
    >
      {/* 0. EN-TÊTE AMEG INTERNATIONAL */}
      <View style={styles.brandCard}>
        <Image
          source={require("../../assets/images/ameg-logo.png")}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityLabel="AMEG International"
        />
        <View style={styles.brandBand}>
          <View style={[styles.brandBandPart, { backgroundColor: colors.primary }]} />
          <View style={[styles.brandBandPart, { backgroundColor: colors.secondary }]} />
          <View style={[styles.brandBandPart, { backgroundColor: colors.accent }]} />
        </View>
      </View>

      {/* 1. HERO BANNER */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>Bienvenue sur votre espace</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {companyName || "Ameg Business"}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
            <Text style={styles.heroBadgeText}>100% Local</Text>
          </View>
        </View>

        {!companyName && (
          <Link href="/settings" asChild>
            <Pressable style={styles.setupPrompt}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.setupPromptText}>
                Configurez votre entreprise pour les PDF (NINEA, RC...) →
              </Text>
            </Pressable>
          </Link>
        )}
      </View>

      {/* 2. RACCOURCIS D'ACTION RAPIDE (4 RACCOURCIS REQUIS) */}
      <View style={styles.quickActionsGrid}>
        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            { backgroundColor: colors.accent },
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push("/documents/new?type=devis")}
        >
          <View style={styles.actionIconCircle}>
            <Ionicons
              name="document-text-outline"
              size={22}
              color={colors.accent}
            />
          </View>
          <View>
            <Text style={styles.actionTitle}>Nouveau devis</Text>
            <Text style={styles.actionSub}>Offre de prix</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            { backgroundColor: colors.primary },
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push("/documents/new?type=facture")}
        >
          <View style={styles.actionIconCircle}>
            <Ionicons name="receipt-outline" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.actionTitle}>Nouvelle facture</Text>
            <Text style={styles.actionSub}>Vente directe</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionCardSecondary,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push("/clients")}
        >
          <View
            style={[
              styles.actionIconCircleSec,
              { backgroundColor: colors.secondaryLight },
            ]}
          >
            <Ionicons
              name="person-add-outline"
              size={20}
              color={colors.secondaryDark}
            />
          </View>
          <View>
            <Text style={styles.actionTitleSec}>Nouveau client</Text>
            <Text style={styles.actionSubSec}>Carnet d&apos;adresses</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionCardSecondary,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push("/items")}
        >
          <View
            style={[
              styles.actionIconCircleSec,
              { backgroundColor: colors.primarySubtle },
            ]}
          >
            <Ionicons
              name="cube-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={styles.actionTitleSec}>Nouvel article</Text>
            <Text style={styles.actionSubSec}>Catalogue produits</Text>
          </View>
        </Pressable>
      </View>

      {/* 3. CHIFFRES CLÉS / KPIS REELS */}
      <SectionHeader title="Indicateurs clés" />

      {stats && (
        <View style={styles.statsGrid}>
          {/* Factures à encaisser */}
          <View style={[styles.statCard, { borderTopColor: colors.accent }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>À encaisser</Text>
              <View
                style={[
                  styles.statIconBadge,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={colors.accentDark}
                />
              </View>
            </View>
            <Text
              style={[styles.statValue, { color: colors.accentDark }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatFCFA(stats.unpaidAmount)}
            </Text>
            <Text style={styles.statSub}>
              {stats.invoicesUnpaid > 0
                ? `${stats.invoicesUnpaid} facture(s) en attente`
                : "Aucune facture impayée"}
            </Text>
          </View>

          {/* Encaissé ce mois */}
          <View style={[styles.statCard, { borderTopColor: colors.success }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Encaissé ce mois</Text>
              <View
                style={[
                  styles.statIconBadge,
                  { backgroundColor: colors.successBg },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={15}
                  color={colors.success}
                />
              </View>
            </View>
            <Text
              style={[styles.statValue, { color: colors.success }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatFCFA(stats.paidThisMonth)}
            </Text>
            <Text style={styles.statSub}>
              Règlements en {getMonthNameFR()}
            </Text>
          </View>

          {/* Devis en cours */}
          <View style={[styles.statCard, { borderTopColor: colors.secondary }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Devis en cours</Text>
              <View
                style={[
                  styles.statIconBadge,
                  { backgroundColor: colors.secondaryLight },
                ]}
              >
                <Ionicons
                  name="document-outline"
                  size={15}
                  color={colors.secondaryDark}
                />
              </View>
            </View>
            <Text style={[styles.statValue, { color: colors.secondaryDark }]}>
              {stats.quotesOpen}
            </Text>
            <Text style={styles.statSub}>Brouillons ou envoyés</Text>
          </View>

          {/* Total Clients */}
          <View style={[styles.statCard, { borderTopColor: colors.primary }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Clients actifs</Text>
              <View
                style={[
                  styles.statIconBadge,
                  { backgroundColor: colors.primarySubtle },
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={15}
                  color={colors.primary}
                />
              </View>
            </View>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.clients}
            </Text>
            <Text style={styles.statSub}>Enregistrés au carnet</Text>
          </View>
        </View>
      )}

      {/* 4. DERNIERS DOCUMENTS */}
      <View style={{ marginTop: 14 }}>
        <SectionHeader
          title="Derniers documents"
          actionLabel="Tout voir →"
          onAction={() => router.push("/documents")}
        />

        {recentDocs.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="receipt-outline"
              title="Aucun document"
              text="Créez votre premier devis ou facture professionnelle en quelques secondes."
              actionLabel="Créer un devis"
              onAction={() => router.push("/documents/new?type=devis")}
            />
          </View>
        ) : (
          recentDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)
        )}
      </View>
    </ScrollView>
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
    paddingBottom: 40,
  },

  // Marque AMEG
  brandCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    paddingTop: 18,
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  brandLogo: {
    width: "72%",
    height: undefined,
    aspectRatio: 720 / 224,
    marginBottom: 16,
  },
  brandBand: {
    flexDirection: "row",
    height: 5,
    alignSelf: "stretch",
  },
  brandBandPart: { flex: 1 },

  // Hero
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: 20,
    marginBottom: 16,
    ...shadows.md,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroGreeting: {
    color: "#9BB3D6",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 0.2,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
  },
  heroBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  setupPrompt: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(242, 140, 40, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(242, 140, 40, 0.4)",
    borderRadius: radii.md,
    padding: 10,
    marginTop: 14,
    gap: 8,
  },
  setupPromptText: {
    color: colors.accentLight,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },

  // Quick Actions Grid (2x2)
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    width: "48%",
    flexGrow: 1,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  actionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  actionSub: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 1,
  },
  actionCardSecondary: {
    width: "48%",
    flexGrow: 1,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  actionIconCircleSec: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitleSec: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  actionSubSec: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },

  // Stats Grid (2x2)
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    padding: 14,
    ...shadows.sm,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  statSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: "500",
  },

  // Empty Card Container
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
});
