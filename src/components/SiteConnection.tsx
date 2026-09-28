/**
 * Blocs liés au site AMEG International :
 *  - SiteConnectionCard : connexion à l'API (Paramètres)
 *  - CatalogSyncBar     : synchronisation du catalogue (Articles)
 */
import { Button, Field } from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import { syncCatalog } from "@/db/siteSync";
import { getToken, login, logout, normalizeBaseUrl } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

type ConnState = { apiUrl: string; user: string; lastSync: string; connected: boolean };

async function readConnection(db: SQLiteDatabase): Promise<ConnState> {
  const row = await db.getFirstAsync<{ api_url: string; api_user: string; last_catalog_sync: string }>(
    "SELECT api_url, api_user, last_catalog_sync FROM company WHERE id = 1",
  );
  const token = await getToken();
  return {
    apiUrl: row?.api_url ?? "",
    user: row?.api_user ?? "",
    lastSync: row?.last_catalog_sync ?? "",
    connected: !!token && !!row?.api_url,
  };
}

function useConnection() {
  const db = useSQLiteContext();
  const [state, setState] = useState<ConnState | null>(null);

  const reload = useCallback(async () => {
    setState(await readConnection(db));
  }, [db]);

  // Relit l'état à chaque fois que l'écran reprend le focus
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      readConnection(db)
        .then((st) => {
          if (alive) setState(st);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [db]),
  );

  return { state, reload };
}

function formatSyncDate(iso: string): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ==========================================================
// Paramètres › Connexion au site AMEG
// ==========================================================
export function SiteConnectionCard() {
  const db = useSQLiteContext();
  const { state, reload } = useConnection();
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!state) return null;
  // Adresse de production proposée par défaut (modifiable pour les tests en local)
  const urlValue = apiUrl ?? (state.apiUrl || "https://api.ameginternational.com");

  const onLogin = async () => {
    if (!normalizeBaseUrl(urlValue)) {
      Alert.alert("Adresse manquante", "Indiquez l'adresse de l'API (ex. : http://192.168.1.25:8000).");
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert("Identifiants manquants", "Saisissez l'email et le mot de passe du compte administrateur du site.");
      return;
    }
    setBusy(true);
    try {
      const user = await login(db, urlValue, email, password);
      setPassword("");
      await reload();
      Alert.alert(
        "Connecté au site",
        `Bienvenue ${user.name || user.email}. Vous pouvez maintenant synchroniser le catalogue et voir les demandes de devis du site.`,
      );
    } catch (e) {
      Alert.alert("Connexion impossible", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = () => {
    Alert.alert("Se déconnecter du site ?", "Le catalogue déjà synchronisé reste disponible dans l'app.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await logout(db);
          await reload();
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      {state.connected ? (
        <>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={styles.statusText}>
              Connecté{state.user ? ` en tant que ${state.user}` : ""}
            </Text>
          </View>
          <Text style={styles.meta}>Serveur : {state.apiUrl}</Text>
          <Text style={styles.meta}>Dernière synchro du catalogue : {formatSyncDate(state.lastSync)}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                title="Demandes du site"
                icon="mail-unread-outline"
                variant="secondaryTeal"
                size="sm"
                onPress={() => router.push("/documents/requests")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Se déconnecter" icon="log-out-outline" variant="danger" size="sm" onPress={onLogout} />
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: colors.textLight }]} />
            <Text style={styles.statusText}>Non connecté</Text>
          </View>
          <Text style={styles.help}>
            Reliez l&apos;app au site ameginternational.com pour importer le catalogue produits et recevoir les
            demandes de devis. Utilisez le compte administrateur du site.
          </Text>
          <Field
            label="Adresse de l'API"
            value={urlValue}
            onChangeText={setApiUrl}
            placeholder="http://192.168.1.25:8000"
            icon="server-outline"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            helper="En test : l'adresse de votre PC (php artisan serve --host=0.0.0.0). En production : l'adresse de l'API sur Hostinger."
          />
          <Field
            label="Email administrateur"
            value={email}
            onChangeText={setEmail}
            placeholder="admin@ameginternational.com"
            icon="mail-outline"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            icon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
          />
          <Button title="Se connecter au site" icon="link-outline" onPress={onLogin} loading={busy} disabled={busy} />
        </>
      )}
    </View>
  );
}

// ==========================================================
// Articles › barre de synchronisation du catalogue
// ==========================================================
export function CatalogSyncBar({ onSynced }: { onSynced: () => void }) {
  const db = useSQLiteContext();
  const { state, reload } = useConnection();
  const [busy, setBusy] = useState(false);

  if (!state) return null;

  if (!state.connected) {
    return (
      <Pressable style={[styles.bar, styles.barMuted]} onPress={() => router.push("/settings")}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.textMuted} />
        <Text style={styles.barTextMuted}>
          Connectez l&apos;app au site AMEG pour importer le catalogue →
        </Text>
      </Pressable>
    );
  }

  const run = async (full: boolean) => {
    setBusy(true);
    try {
      const r = await syncCatalog(db, full);
      await reload();
      onSynced();
      Alert.alert(
        "Catalogue synchronisé",
        r.total === 0 && !r.full
          ? "Aucune modification sur le site depuis la dernière synchronisation."
          : `${r.added} article(s) ajouté(s), ${r.updated} mis à jour` +
              (r.disabled ? `, ${r.disabled} retiré(s) du site` : "") +
              ".",
      );
    } catch (e) {
      Alert.alert("Synchronisation impossible", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.bar}>
      <Ionicons name="cloud-done-outline" size={18} color={colors.secondaryDark} />
      <View style={{ flex: 1 }}>
        <Text style={styles.barText}>Catalogue du site</Text>
        <Text style={styles.barSub}>Dernière synchro : {formatSyncDate(state.lastSync)}</Text>
      </View>
      <Button
        title={busy ? "Synchro…" : "Synchroniser"}
        icon="sync-outline"
        size="sm"
        variant="secondaryTeal"
        onPress={() => run(false)}
        disabled={busy}
        loading={busy}
      />
      <Pressable
        hitSlop={10}
        disabled={busy}
        onPress={() =>
          Alert.alert(
            "Synchronisation complète ?",
            "Recharge tout le catalogue du site et masque les produits qui n'y sont plus.",
            [
              { text: "Annuler", style: "cancel" },
              { text: "Tout recharger", onPress: () => run(true) },
            ],
          )
        }
      >
        <Ionicons name="refresh-circle-outline" size={26} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
    ...shadows.sm,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: "800", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  help: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.secondaryLight,
    borderWidth: 1,
    borderColor: colors.secondarySubtle,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  barMuted: { backgroundColor: colors.cardSubdued, borderColor: colors.border },
  barText: { fontSize: 13, fontWeight: "800", color: colors.secondaryDark },
  barSub: { fontSize: 11, color: colors.textMuted },
  barTextMuted: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.textMuted },
});
