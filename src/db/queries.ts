import type { SQLiteDatabase } from "expo-sqlite";

/** Taux de TVA standard au Sénégal (en %). */
export const TVA_STANDARD = 18;
/** @deprecated utiliser TVA_STANDARD (en %) */
export const TVA_RATE = TVA_STANDARD / 100;

export type DocType = "devis" | "facture";

export type Company = {
  name: string;
  address: string;
  phone: string;
  email: string;
  ninea: string;
  rc: string;
  logo: string;
  footer: string;
  tva_default: number;
  next_quote: number;
  next_invoice: number;
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
  api_url: string;
  api_user: string;
  last_catalog_sync: string;
};

export type Client = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  /** Ville — Pays */
  city: string;
  /** N° TVA / NINEA du client */
  tax_id: string;
  /** Interlocuteur chez le client */
  contact: string;
};

export type ClientInput = Omit<Client, "id" | "city" | "tax_id" | "contact"> &
  Partial<Pick<Client, "city" | "tax_id" | "contact">> & { id?: number };

export type Item = {
  id: number;
  label: string;
  unit_price: number;
  reference: string;
  details: string;
  unit: string;
  weight: string;
  hs_code: string;
  /** id du produit sur le site AMEG (null = article saisi dans l'app) */
  remote_id?: number | null;
  brand?: string;
  category?: string;
  availability?: string;
};

export type ItemInput = Pick<Item, "label" | "unit_price"> &
  Partial<Omit<Item, "id" | "label" | "unit_price">> & { id?: number };

export type DocStatus =
  "brouillon" | "envoye" | "accepte" | "refuse" | "paye" | "annule";

export type Doc = {
  id: number;
  type: DocType;
  number: string;
  client_id: number | null;
  date: string;
  due_date: string | null;
  status: DocStatus;
  tva_enabled: number;
  notes: string;
  source_quote_id: number | null;
  /** Votre interlocuteur AMEG */
  contact: string;
  client_ref: string;
  internal_ref: string;
  incoterm: string;
  payment_terms: string;
  payment_method: string;
  /** Remise éventuelle, en FCFA (sur le HT) */
  discount: number;
  /** Code taxe / motif d'exonération (lignes à 0 %) */
  tax_code: string;
};

export type DocLine = {
  /** Désignation */
  description: string;
  quantity: number;
  unit_price: number;
  reference?: string;
  /** Description technique longue */
  details?: string;
  unit?: string;
  weight?: string;
  /** N° douane (code SH) */
  hs_code?: string;
  /** Taux de TVA en % (0, 18…) */
  tva_rate?: number;
};

export type DocListRow = Doc & {
  client_name: string | null;
  total_ht: number;
  total_ttc: number;
};

// ---------- Statuts ----------

export const STATUSES: Record<DocType, DocStatus[]> = {
  devis: ["brouillon", "envoye", "accepte", "refuse"],
  facture: ["brouillon", "envoye", "paye", "annule"],
};

export function statusLabel(type: DocType, s: DocStatus): string {
  const fem = type === "facture";
  switch (s) {
    case "brouillon":
      return "Brouillon";
    case "envoye":
      return fem ? "Envoyée" : "Envoyé";
    case "accepte":
      return "Accepté";
    case "refuse":
      return "Refusé";
    case "paye":
      return "Payée";
    case "annule":
      return "Annulée";
  }
}

export const STATUS_COLORS: Record<DocStatus, string> = {
  brouillon: "#64748B",
  envoye: "#0284C7",
  accepte: "#0D9488",
  refuse: "#DC2626",
  paye: "#16A34A",
  annule: "#DC2626",
};

// ---------- Calculs ----------

export function lineTotal(l: DocLine): number {
  return Math.round(l.quantity * l.unit_price);
}

export type VatGroup = { rate: number; base: number; amount: number };

/**
 * Totaux du document : sous-total, remise, HT net, TVA par taux, TTC.
 * La remise est répartie au prorata sur chaque taux de TVA.
 */
export function computeTotals(lines: DocLine[], discount = 0) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const disc = Math.max(0, Math.min(Math.round(discount || 0), subtotal));
  const ht = subtotal - disc;

  const byRate = new Map<number, number>();
  for (const l of lines) {
    const r = l.tva_rate ?? 0;
    byRate.set(r, (byRate.get(r) ?? 0) + lineTotal(l));
  }
  const rates = [...byRate.keys()].sort((a, b) => b - a);
  const groups: VatGroup[] = [];
  let allocated = 0;
  rates.forEach((rate, i) => {
    const gross = byRate.get(rate) ?? 0;
    const base =
      i === rates.length - 1
        ? ht - allocated
        : subtotal > 0
          ? Math.round((gross * ht) / subtotal)
          : 0;
    allocated += base;
    groups.push({ rate, base, amount: Math.round((base * rate) / 100) });
  });
  const tva = groups.reduce((s, g) => s + g.amount, 0);
  return { subtotal, discount: disc, ht, tva, ttc: ht + tva, groups };
}

/** @deprecated conservé pour compatibilité — préférer DocListRow.total_ttc */
export function ttcFromHt(ht: number, tvaEnabled: number | boolean): number {
  return tvaEnabled ? ht + Math.round(ht * TVA_RATE) : ht;
}

// ---------- Entreprise ----------

export function getCompany(db: SQLiteDatabase) {
  return db.getFirstAsync<Company>("SELECT * FROM company WHERE id = 1");
}

// ---------- Clients ----------

export function listClients(db: SQLiteDatabase) {
  return db.getAllAsync<Client>(
    "SELECT id, name, phone, email, address, city, tax_id, contact FROM clients ORDER BY name COLLATE NOCASE",
  );
}

export async function saveClient(
  db: SQLiteDatabase,
  c: ClientInput,
) {
  const extra = [c.city ?? "", c.tax_id ?? "", c.contact ?? ""];
  if (c.id) {
    await db.runAsync(
      "UPDATE clients SET name = ?, phone = ?, email = ?, address = ?, city = ?, tax_id = ?, contact = ? WHERE id = ?",
      [c.name, c.phone, c.email, c.address, ...extra, c.id],
    );
    return c.id;
  }
  const r = await db.runAsync(
    "INSERT INTO clients (name, phone, email, address, city, tax_id, contact) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [c.name, c.phone, c.email, c.address, ...extra],
  );
  return r.lastInsertRowId;
}

export function deleteClient(db: SQLiteDatabase, id: number) {
  return db.runAsync("DELETE FROM clients WHERE id = ?", [id]);
}

// ---------- Articles ----------

export function listItems(db: SQLiteDatabase) {
  return db.getAllAsync<Item>(
    `SELECT id, label, unit_price, reference, details, unit, weight, hs_code,
            remote_id, brand, category, availability
     FROM items WHERE is_active = 1 ORDER BY label COLLATE NOCASE`,
  );
}

export async function saveItem(
  db: SQLiteDatabase,
  it: ItemInput,
) {
  const extra = [
    it.reference ?? "",
    it.details ?? "",
    it.unit?.trim() || "PCS",
    it.weight ?? "",
    it.hs_code ?? "",
  ];
  if (it.id) {
    await db.runAsync(
      "UPDATE items SET label = ?, unit_price = ?, reference = ?, details = ?, unit = ?, weight = ?, hs_code = ? WHERE id = ?",
      [it.label, it.unit_price, ...extra, it.id],
    );
    return it.id;
  }
  const r = await db.runAsync(
    "INSERT INTO items (label, unit_price, reference, details, unit, weight, hs_code) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [it.label, it.unit_price, ...extra],
  );
  return r.lastInsertRowId;
}

export function deleteItem(db: SQLiteDatabase, id: number) {
  return db.runAsync("DELETE FROM items WHERE id = ?", [id]);
}

// ---------- Documents ----------

const LIST_SQL = `
  SELECT d.*, c.name AS client_name
  FROM documents d LEFT JOIN clients c ON c.id = d.client_id`;

type RawListRow = Omit<DocListRow, "total_ht" | "total_ttc">;

/** Ajoute les totaux HT/TTC (mêmes règles de calcul que le PDF). */
async function withTotals(db: SQLiteDatabase, docs: RawListRow[]): Promise<DocListRow[]> {
  if (docs.length === 0) return [];
  const rows = await db.getAllAsync<DocLine & { document_id: number }>(
    `SELECT document_id, quantity, unit_price, tva_rate FROM document_lines
     WHERE document_id IN (${docs.map(() => "?").join(",")})`,
    docs.map((d) => d.id),
  );
  const byDoc = new Map<number, DocLine[]>();
  for (const r of rows) {
    const arr = byDoc.get(r.document_id) ?? [];
    arr.push(r);
    byDoc.set(r.document_id, arr);
  }
  return docs.map((d) => {
    const t = computeTotals(byDoc.get(d.id) ?? [], d.discount);
    return { ...d, total_ht: t.ht, total_ttc: t.ttc };
  });
}

export async function listDocuments(db: SQLiteDatabase, type?: DocType) {
  const docs = type
    ? await db.getAllAsync<RawListRow>(
        `${LIST_SQL} WHERE d.type = ? ORDER BY d.date DESC, d.id DESC`,
        [type],
      )
    : await db.getAllAsync<RawListRow>(`${LIST_SQL} ORDER BY d.date DESC, d.id DESC`);
  return withTotals(db, docs);
}

export async function listDocumentsForClient(db: SQLiteDatabase, clientId: number) {
  const docs = await db.getAllAsync<RawListRow>(
    `${LIST_SQL} WHERE d.client_id = ? ORDER BY d.date DESC, d.id DESC`,
    [clientId],
  );
  return withTotals(db, docs);
}

export async function getClientStats(db: SQLiteDatabase, clientId: number) {
  const docs = await listDocumentsForClient(db, clientId);
  let totalQuotes = 0;
  let totalInvoices = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;
  for (const d of docs) {
    const ttc = d.total_ttc;
    if (d.type === "devis") {
      totalQuotes++;
    } else {
      totalInvoices++;
      totalInvoiced += ttc;
      if (d.status === "paye") {
        totalPaid += ttc;
      }
    }
  }
  return { totalQuotes, totalInvoices, totalInvoiced, totalPaid, docsCount: docs.length };
}

export function getDocument(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Doc>("SELECT * FROM documents WHERE id = ?", [id]);
}

export function getLines(db: SQLiteDatabase, id: number) {
  return db.getAllAsync<DocLine>(
    `SELECT description, quantity, unit_price, reference, details, unit, weight, hs_code, tva_rate
     FROM document_lines WHERE document_id = ? ORDER BY position, id`,
    [id],
  );
}

export function getClient(db: SQLiteDatabase, id: number | null) {
  if (!id) return Promise.resolve(null);
  return db.getFirstAsync<Client>(
    "SELECT id, name, phone, email, address, city, tax_id, contact FROM clients WHERE id = ?",
    [id],
  );
}

/** Réserve le prochain numéro (AMEG-2026-0001 / DEV-2026-0001, préfixes réglables). À appeler dans une transaction. */
async function nextNumber(db: SQLiteDatabase, type: DocType, date: string) {
  const col = type === "devis" ? "next_quote" : "next_invoice";
  const row = await db.getFirstAsync<{ n: number; qp: string; ip: string }>(
    `SELECT ${col} AS n, quote_prefix AS qp, invoice_prefix AS ip FROM company WHERE id = 1`,
  );
  let n = row?.n ?? 1;
  const base =
    (type === "devis" ? row?.qp : row?.ip)?.trim() ||
    (type === "devis" ? "DEV" : "AMEG");
  const prefix = `${base}-${date.slice(0, 4)}-`;
  // Sécurité : saute les numéros déjà pris (ex. après restauration).
  while (
    await db.getFirstAsync("SELECT 1 FROM documents WHERE number = ?", [
      prefix + String(n).padStart(4, "0"),
    ])
  ) {
    n++;
  }
  await db.runAsync(`UPDATE company SET ${col} = ? WHERE id = 1`, [n + 1]);
  return prefix + String(n).padStart(4, "0");
}

export type DocInput = {
  type: DocType;
  client_id: number | null;
  date: string;
  due_date: string | null;
  status: DocStatus;
  notes: string;
  source_quote_id?: number | null;
  contact?: string;
  client_ref?: string;
  internal_ref?: string;
  incoterm?: string;
  payment_terms?: string;
  payment_method?: string;
  discount?: number;
  tax_code?: string;
  lines: DocLine[];
};

function docExtra(input: DocInput) {
  return [
    input.lines.some((l) => (l.tva_rate ?? 0) > 0) ? 1 : 0,
    input.notes,
    input.contact ?? "",
    input.client_ref ?? "",
    input.internal_ref ?? "",
    input.incoterm ?? "",
    input.payment_terms ?? "",
    input.payment_method ?? "",
    Math.max(0, Math.round(input.discount ?? 0)),
    input.tax_code ?? "",
  ];
}

async function writeLines(db: SQLiteDatabase, docId: number, lines: DocLine[]) {
  await db.runAsync("DELETE FROM document_lines WHERE document_id = ?", [
    docId,
  ]);
  let pos = 0;
  for (const l of lines) {
    await db.runAsync(
      `INSERT INTO document_lines (document_id, description, quantity, unit_price, position,
         reference, details, unit, weight, hs_code, tva_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        l.description,
        l.quantity,
        l.unit_price,
        pos++,
        l.reference ?? "",
        l.details ?? "",
        l.unit?.trim() || "PCS",
        l.weight ?? "",
        l.hs_code ?? "",
        l.tva_rate ?? 0,
      ],
    );
  }
}

/** Crée ou met à jour un document et ses lignes. Renvoie l'id. */
export async function saveDocument(
  db: SQLiteDatabase,
  input: DocInput,
  id?: number,
) {
  let docId = id ?? 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (id) {
      await txn.runAsync(
        `UPDATE documents SET client_id = ?, date = ?, due_date = ?, status = ?,
         tva_enabled = ?, notes = ?, contact = ?, client_ref = ?, internal_ref = ?, incoterm = ?,
         payment_terms = ?, payment_method = ?, discount = ?, tax_code = ? WHERE id = ?`,
        [input.client_id, input.date, input.due_date, input.status, ...docExtra(input), id],
      );
    } else {
      const number = await nextNumber(txn, input.type, input.date);
      const r = await txn.runAsync(
        `INSERT INTO documents (type, number, client_id, date, due_date, status, source_quote_id,
           tva_enabled, notes, contact, client_ref, internal_ref, incoterm,
           payment_terms, payment_method, discount, tax_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.type,
          number,
          input.client_id,
          input.date,
          input.due_date,
          input.status,
          input.source_quote_id ?? null,
          ...docExtra(input),
        ],
      );
      docId = r.lastInsertRowId;
    }
    await writeLines(txn, docId, input.lines);
  });
  return docId;
}

export function setStatus(db: SQLiteDatabase, id: number, status: DocStatus) {
  return db.runAsync("UPDATE documents SET status = ? WHERE id = ?", [
    status,
    id,
  ]);
}

export async function deleteDocument(db: SQLiteDatabase, id: number) {
  // Détache les factures issues de ce devis avant suppression.
  await db.runAsync(
    "UPDATE documents SET source_quote_id = NULL WHERE source_quote_id = ?",
    [id],
  );
  await db.runAsync("DELETE FROM documents WHERE id = ?", [id]);
}

export function findInvoiceFromQuote(db: SQLiteDatabase, quoteId: number) {
  return db.getFirstAsync<{ id: number; number: string }>(
    "SELECT id, number FROM documents WHERE source_quote_id = ? AND type = 'facture'",
    [quoteId],
  );
}

/** Transforme un devis en facture (copie des lignes) et marque le devis comme accepté. */
export async function convertQuoteToInvoice(
  db: SQLiteDatabase,
  quoteId: number,
  today: string,
  dueDate: string,
) {
  const quote = await getDocument(db, quoteId);
  if (!quote || quote.type !== "devis") throw new Error("Devis introuvable");
  const lines = await getLines(db, quoteId);
  const invoiceId = await saveDocument(db, {
    type: "facture",
    client_id: quote.client_id,
    date: today,
    due_date: dueDate,
    status: "brouillon",
    notes: quote.notes,
    source_quote_id: quoteId,
    contact: quote.contact,
    client_ref: quote.client_ref,
    internal_ref: quote.internal_ref,
    incoterm: quote.incoterm,
    payment_terms: quote.payment_terms,
    payment_method: quote.payment_method,
    discount: quote.discount,
    tax_code: quote.tax_code,
    lines,
  });
  await setStatus(db, quoteId, "accepte");
  return invoiceId;
}

// ---------- Tableau de bord ----------

export type DashboardStats = {
  quotesOpen: number;
  invoicesUnpaid: number;
  unpaidAmount: number;
  paidThisMonth: number;
  clients: number;
};

export async function getDashboard(
  db: SQLiteDatabase,
  monthPrefix: string,
): Promise<DashboardStats> {
  const docs = await listDocuments(db);
  let quotesOpen = 0;
  let invoicesUnpaid = 0;
  let unpaidAmount = 0;
  let paidThisMonth = 0;
  for (const d of docs) {
    const ttc = d.total_ttc;
    if (
      d.type === "devis" &&
      (d.status === "brouillon" || d.status === "envoye")
    )
      quotesOpen++;
    if (d.type === "facture" && d.status === "envoye") {
      invoicesUnpaid++;
      unpaidAmount += ttc;
    }
    if (
      d.type === "facture" &&
      d.status === "paye" &&
      d.date.startsWith(monthPrefix)
    )
      paidThisMonth += ttc;
  }
  const c = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM clients",
  );
  return {
    quotesOpen,
    invoicesUnpaid,
    unpaidAmount,
    paidThisMonth,
    clients: c?.n ?? 0,
  };
}
