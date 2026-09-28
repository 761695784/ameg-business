/**
 * Synchronisation avec le site AMEG International :
 *  - catalogue produits  -> table locale `items`
 *  - demande de devis web -> devis local pré-rempli
 */
import {
  fetchCatalog,
  updateQuoteRequestStatus,
  type RemoteProduct,
  type RemoteQuoteRequest,
} from "@/utils/api";
import { addDaysISO, todayISO } from "@/utils/format";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  getCompany,
  saveClient,
  saveDocument,
  TVA_STANDARD,
  type DocLine,
} from "./queries";

export type SyncResult = {
  added: number;
  updated: number;
  disabled: number;
  total: number;
  full: boolean;
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  en_stock: "En stock",
  sur_commande: "Sur commande",
  rupture: "Rupture",
};

function productDetails(p: RemoteProduct): string {
  const parts = [p.brand ? `Marque : ${p.brand}` : "", p.characteristics || p.description]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  return parts.join("\n");
}

/**
 * Récupère le catalogue du site et met à jour les articles locaux.
 * - correspondance par id du site, sinon par référence (articles saisis à la main avant)
 * - si le site n'a pas de prix, le prix local est conservé
 * - synchro complète : les produits retirés du site sont masqués localement
 */
export async function syncCatalog(db: SQLiteDatabase, full = false): Promise<SyncResult> {
  const company = await getCompany(db);
  const since = !full && company?.last_catalog_sync ? company.last_catalog_sync : undefined;
  const res = await fetchCatalog(db, since);

  let added = 0;
  let updated = 0;
  let disabled = 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const p of res.products) {
      const existing =
        (await txn.getFirstAsync<{ id: number }>("SELECT id FROM items WHERE remote_id = ?", [p.id])) ??
        (p.reference
          ? await txn.getFirstAsync<{ id: number }>(
              "SELECT id FROM items WHERE remote_id IS NULL AND reference <> '' AND UPPER(reference) = UPPER(?)",
              [p.reference],
            )
          : null);

      const values = [
        p.name,
        p.reference ?? "",
        productDetails(p),
        p.brand ?? "",
        [p.category, p.subcategory].filter(Boolean).join(" › "),
        p.availability ?? "",
        p.is_active ? 1 : 0,
        p.id,
      ];

      if (existing) {
        await txn.runAsync(
          `UPDATE items SET label = ?, reference = ?, details = ?, brand = ?, category = ?,
             availability = ?, is_active = ?, remote_id = ?,
             unit_price = COALESCE(?, unit_price)
           WHERE id = ?`,
          [...values, p.price_fcfa, existing.id],
        );
        updated++;
      } else {
        await txn.runAsync(
          `INSERT INTO items (label, reference, details, brand, category, availability, is_active,
             remote_id, unit_price, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PCS')`,
          [...values, p.price_fcfa ?? 0],
        );
        added++;
      }
    }

    if (!since) {
      // Synchro complète : masquer les articles du site qui n'existent plus
      const ids = res.products.map((p) => p.id);
      const r = await txn.runAsync(
        ids.length
          ? `UPDATE items SET is_active = 0 WHERE remote_id IS NOT NULL AND is_active = 1
               AND remote_id NOT IN (${ids.map(() => "?").join(",")})`
          : "UPDATE items SET is_active = 0 WHERE remote_id IS NOT NULL AND is_active = 1",
        ids,
      );
      disabled = r.changes;
    }

    await txn.runAsync("UPDATE company SET last_catalog_sync = ? WHERE id = 1", [res.server_time]);
  });

  return { added, updated, disabled, total: res.count, full: !since };
}

/** Devis déjà créé à partir d'une demande web ? */
export function findDocForRequest(db: SQLiteDatabase, requestId: number) {
  return db.getFirstAsync<{ id: number; number: string }>(
    "SELECT id, number FROM documents WHERE remote_request_id = ? ORDER BY id DESC",
    [requestId],
  );
}

/** Trouve le client (email ou téléphone) ou le crée à partir de la demande. */
async function upsertClientFromRequest(db: SQLiteDatabase, r: RemoteQuoteRequest) {
  const fullName = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
  const name = r.company?.trim() || fullName || r.email;
  const phoneDigits = (r.phone ?? "").replace(/\D/g, "");

  const found = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM clients
     WHERE (email <> '' AND LOWER(email) = LOWER(?))
        OR (? <> '' AND REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') LIKE '%' || ?)
     ORDER BY id LIMIT 1`,
    [r.email ?? "", phoneDigits.slice(-9), phoneDigits.slice(-9)],
  );
  if (found) return found.id;

  return saveClient(db, {
    name,
    phone: r.phone ?? "",
    email: r.email ?? "",
    address: "",
    city: r.city ?? "",
    tax_id: "",
    contact: r.company?.trim() ? fullName : "",
  });
}

/**
 * Crée un devis brouillon à partir d'une demande du site, puis passe la
 * demande en « en cours » sur le site (sans bloquer si le réseau échoue).
 */
export async function createQuoteFromRequest(db: SQLiteDatabase, r: RemoteQuoteRequest) {
  const existing = await findDocForRequest(db, r.id);
  if (existing) return { id: existing.id, created: false, statusUpdated: false };

  const company = await getCompany(db);
  const rate = (company?.tva_default ?? 1) === 1 ? TVA_STANDARD : 0;
  const clientId = await upsertClientFromRequest(db, r);

  const lines: DocLine[] = [];
  for (const it of r.items) {
    const local =
      (it.product_id
        ? await db.getFirstAsync<{
            label: string; reference: string; details: string; unit: string;
            weight: string; hs_code: string; unit_price: number;
          }>("SELECT * FROM items WHERE remote_id = ?", [it.product_id])
        : null) ??
      (it.product_reference
        ? await db.getFirstAsync<{
            label: string; reference: string; details: string; unit: string;
            weight: string; hs_code: string; unit_price: number;
          }>("SELECT * FROM items WHERE reference <> '' AND UPPER(reference) = UPPER(?)", [
            it.product_reference,
          ])
        : null);

    lines.push({
      reference: it.product_reference || local?.reference || "",
      description: it.product_name || local?.label || "Article",
      details: local?.details ?? "",
      quantity: it.quantity || 1,
      unit: local?.unit || "PCS",
      weight: local?.weight ?? "",
      hs_code: local?.hs_code ?? "",
      unit_price: local?.unit_price ?? 0,
      tva_rate: rate,
    });
  }

  const today = todayISO();
  const notes = [
    `Demande de devis n° ${r.id} reçue via le site web.`,
    r.comment?.trim() ? `Message du client : ${r.comment.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const docId = await saveDocument(db, {
    type: "devis",
    client_id: clientId,
    date: today,
    due_date: addDaysISO(today, 30),
    status: "brouillon",
    notes,
    contact: company?.default_contact ?? "",
    client_ref: `WEB-${r.id}`,
    internal_ref: "",
    incoterm: company?.default_incoterm ?? "",
    payment_terms: company?.default_payment_terms ?? "",
    payment_method: company?.default_payment_method ?? "",
    discount: 0,
    tax_code: "",
    lines,
  });
  await db.runAsync("UPDATE documents SET remote_request_id = ? WHERE id = ?", [r.id, docId]);

  let statusUpdated = false;
  if (r.status === "nouveau") {
    try {
      await updateQuoteRequestStatus(db, r.id, "en_cours");
      statusUpdated = true;
    } catch {
      statusUpdated = false;
    }
  }
  return { id: docId, created: true, statusUpdated };
}
