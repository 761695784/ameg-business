/**
 * Client de l'API Laravel du site AMEG International.
 *
 * - Authentification : jeton Sanctum obtenu via POST /api/mobile/login,
 *   conservé de façon chiffrée sur le téléphone (expo-secure-store).
 * - L'adresse de l'API est enregistrée dans la table `company` (api_url).
 */
import * as SecureStore from "expo-secure-store";
import type { SQLiteDatabase } from "expo-sqlite";

const TOKEN_KEY = "ameg_api_token";
const TIMEOUT_MS = 20000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

// ---------- Types renvoyés par l'API ----------

export type RemoteProduct = {
  id: number;
  reference: string;
  name: string;
  description: string;
  price_fcfa: number | null;
  availability: "en_stock" | "sur_commande" | "rupture" | string;
  is_active: boolean;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  characteristics: string;
  updated_at: string | null;
};

export type CatalogResponse = {
  server_time: string;
  count: number;
  products: RemoteProduct[];
};

export type RemoteRequestStatus = "nouveau" | "en_cours" | "traite";

export type RemoteQuoteRequestItem = {
  id: number;
  product_id: number | null;
  product_reference: string;
  product_name: string;
  quantity: number;
};

export type RemoteQuoteRequest = {
  id: number;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string;
  email: string;
  city: string | null;
  comment: string | null;
  status: RemoteRequestStatus;
  admin_reply: string | null;
  created_at: string;
  items: RemoteQuoteRequestItem[];
};

// ---------- Configuration ----------

/**
 * "192.168.1.25:8000"         -> "http://192.168.1.25:8000"
 * "api.ameginternational.com" -> "https://api.ameginternational.com"
 * Retire le "/" et "/api" finaux.
 */
export function normalizeBaseUrl(url: string): string {
  let u = url.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    // IP locale / localhost -> http (tests) ; nom de domaine -> https (production)
    const isLocal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u);
    u = `${isLocal ? "http" : "https"}://${u}`;
  }
  u = u.replace(/\/+$/, "").replace(/\/api$/i, "");
  return u;
}

export async function getBaseUrl(db: SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ api_url: string }>(
    "SELECT api_url FROM company WHERE id = 1",
  );
  return normalizeBaseUrl(row?.api_url ?? "");
}

export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function isConnected(db: SQLiteDatabase): Promise<boolean> {
  const [url, token] = await Promise.all([getBaseUrl(db), getToken()]);
  return !!url && !!token;
}

// ---------- Requêtes ----------

async function request<T>(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  if (!baseUrl) {
    throw new ApiError(
      "Adresse du site non configurée. Renseignez-la dans Paramètres › Connexion au site AMEG.",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    throw new ApiError(
      aborted
        ? "Le serveur ne répond pas (délai dépassé). Vérifiez l'adresse et votre connexion."
        : `Impossible de joindre le serveur ${baseUrl}. Vérifiez l'adresse, le Wi-Fi/4G et que l'API est démarrée.`,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const d = data as { message?: string; errors?: Record<string, string[]> } | null;
    const firstError = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined;
    let msg = firstError || d?.message || `Erreur serveur (${res.status}).`;
    if (res.status === 401) msg = "Session expirée ou jeton invalide. Reconnectez-vous dans les Paramètres.";
    if (res.status === 404) msg = "Adresse introuvable sur le serveur. L'API mobile est-elle bien déployée ?";
    if (res.status === 429) msg = "Trop de tentatives. Patientez une minute puis réessayez.";
    throw new ApiError(msg, res.status);
  }
  if (data === null) {
    throw new ApiError("Réponse inattendue du serveur (pas du JSON). Vérifiez l'adresse de l'API.");
  }
  return data as T;
}

async function authed<T>(
  db: SQLiteDatabase,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const [baseUrl, token] = await Promise.all([getBaseUrl(db), getToken()]);
  if (!token) {
    throw new ApiError("Non connecté au site. Connectez-vous dans Paramètres › Connexion au site AMEG.", 401);
  }
  return request<T>(baseUrl, path, { ...options, token });
}

// ---------- Authentification ----------

export async function login(
  db: SQLiteDatabase,
  apiUrl: string,
  email: string,
  password: string,
) {
  const baseUrl = normalizeBaseUrl(apiUrl);
  const res = await request<{ token: string; user: { id: number; name: string; email: string } }>(
    baseUrl,
    "/mobile/login",
    { method: "POST", body: { email: email.trim(), password, device_name: "Ameg Business (mobile)" } },
  );
  await SecureStore.setItemAsync(TOKEN_KEY, res.token);
  await db.runAsync("UPDATE company SET api_url = ?, api_user = ? WHERE id = 1", [
    baseUrl,
    res.user.name || res.user.email,
  ]);
  return res.user;
}

export async function logout(db: SQLiteDatabase) {
  try {
    await authed(db, "/mobile/logout", { method: "POST" });
  } catch {
    // on déconnecte localement même si le serveur est injoignable
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await db.runAsync("UPDATE company SET api_user = '' WHERE id = 1");
}

// ---------- Catalogue & demandes ----------

export function fetchCatalog(db: SQLiteDatabase, updatedSince?: string) {
  const qs = updatedSince ? `?updated_since=${encodeURIComponent(updatedSince)}` : "";
  return authed<CatalogResponse>(db, `/mobile/catalog${qs}`);
}

export async function fetchQuoteRequests(db: SQLiteDatabase, status?: RemoteRequestStatus) {
  const qs = status ? `?status=${status}` : "";
  const res = await authed<{ data: RemoteQuoteRequest[] }>(db, `/mobile/quote-requests${qs}`);
  return res.data;
}

export function updateQuoteRequestStatus(
  db: SQLiteDatabase,
  id: number,
  status: RemoteRequestStatus,
) {
  return authed<RemoteQuoteRequest>(db, `/mobile/quote-requests/${id}`, {
    method: "PATCH",
    body: { status },
  });
}
