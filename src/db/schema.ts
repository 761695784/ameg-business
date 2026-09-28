import type { SQLiteDatabase } from "expo-sqlite";
import { AMEG_LOGO } from "../constants/amegLogo";

const DB_VERSION = 3;

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let version = row?.user_version ?? 0;
  if (version >= DB_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS company (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        ninea TEXT NOT NULL DEFAULT '',
        rc TEXT NOT NULL DEFAULT '',
        logo TEXT NOT NULL DEFAULT '',
        footer TEXT NOT NULL DEFAULT '',
        tva_default INTEGER NOT NULL DEFAULT 1,
        next_quote INTEGER NOT NULL DEFAULT 1,
        next_invoice INTEGER NOT NULL DEFAULT 1
      );
      INSERT OR IGNORE INTO company (id) VALUES (1);

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        unit_price INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('devis', 'facture')),
        number TEXT NOT NULL UNIQUE,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'brouillon',
        tva_enabled INTEGER NOT NULL DEFAULT 1,
        notes TEXT NOT NULL DEFAULT '',
        source_quote_id INTEGER REFERENCES documents(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS document_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      );
    `);
    version = 1;
  }

  if (version === 1) {
    // v2 : champs du modèle de facture AMEG International
    await db.execAsync(`
      ALTER TABLE company ADD COLUMN website TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN iban TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN bic TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN invoice_prefix TEXT NOT NULL DEFAULT 'AMEG';
      ALTER TABLE company ADD COLUMN quote_prefix TEXT NOT NULL DEFAULT 'DEV';
      ALTER TABLE company ADD COLUMN default_contact TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN default_payment_terms TEXT NOT NULL DEFAULT '100% à la commande';
      ALTER TABLE company ADD COLUMN default_payment_method TEXT NOT NULL DEFAULT 'Virement bancaire';
      ALTER TABLE company ADD COLUMN default_incoterm TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN penalty_rate TEXT NOT NULL DEFAULT '1,5';
      ALTER TABLE company ADD COLUMN recovery_fee TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN cgv_url TEXT NOT NULL DEFAULT '';

      ALTER TABLE clients ADD COLUMN city TEXT NOT NULL DEFAULT '';
      ALTER TABLE clients ADD COLUMN tax_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE clients ADD COLUMN contact TEXT NOT NULL DEFAULT '';

      ALTER TABLE items ADD COLUMN reference TEXT NOT NULL DEFAULT '';
      ALTER TABLE items ADD COLUMN details TEXT NOT NULL DEFAULT '';
      ALTER TABLE items ADD COLUMN unit TEXT NOT NULL DEFAULT 'PCS';
      ALTER TABLE items ADD COLUMN weight TEXT NOT NULL DEFAULT '';
      ALTER TABLE items ADD COLUMN hs_code TEXT NOT NULL DEFAULT '';

      ALTER TABLE documents ADD COLUMN contact TEXT NOT NULL DEFAULT '';
      ALTER TABLE documents ADD COLUMN client_ref TEXT NOT NULL DEFAULT '';
      ALTER TABLE documents ADD COLUMN internal_ref TEXT NOT NULL DEFAULT '';
      ALTER TABLE documents ADD COLUMN incoterm TEXT NOT NULL DEFAULT '';
      ALTER TABLE documents ADD COLUMN payment_terms TEXT NOT NULL DEFAULT '';
      ALTER TABLE documents ADD COLUMN payment_method TEXT NOT NULL DEFAULT '';
      ALTER TABLE documents ADD COLUMN discount INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE documents ADD COLUMN tax_code TEXT NOT NULL DEFAULT '';

      ALTER TABLE document_lines ADD COLUMN reference TEXT NOT NULL DEFAULT '';
      ALTER TABLE document_lines ADD COLUMN details TEXT NOT NULL DEFAULT '';
      ALTER TABLE document_lines ADD COLUMN unit TEXT NOT NULL DEFAULT 'PCS';
      ALTER TABLE document_lines ADD COLUMN weight TEXT NOT NULL DEFAULT '';
      ALTER TABLE document_lines ADD COLUMN hs_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE document_lines ADD COLUMN tva_rate REAL NOT NULL DEFAULT 0;

      -- Reprise de l'ancien interrupteur TVA global sur chaque ligne
      UPDATE document_lines SET tva_rate = 18
        WHERE document_id IN (SELECT id FROM documents WHERE tva_enabled = 1);
    `);

    // Pré-remplissage avec les informations d'AMEG International (si non configuré)
    await db.runAsync(
      `UPDATE company SET
         name = CASE WHEN name = '' THEN ? ELSE name END,
         address = CASE WHEN address = '' THEN ? ELSE address END,
         phone = CASE WHEN phone = '' THEN ? ELSE phone END,
         email = CASE WHEN email = '' THEN ? ELSE email END,
         website = CASE WHEN website = '' THEN ? ELSE website END,
         logo = CASE WHEN logo = '' THEN ? ELSE logo END
       WHERE id = 1`,
      [
        "AMEG International",
        "Dakar, Point E, Rue P-170, Sénégal",
        "+221 33 824 77 63 / +221 77 646 43 41",
        "info@ameginternational.com",
        "ameginternational.com",
        AMEG_LOGO,
      ],
    );
    version = 2;
  }

  if (version === 2) {
    // v3 : connexion au site AMEG (catalogue synchronisé + demandes de devis web)
    await db.execAsync(`
      ALTER TABLE company ADD COLUMN api_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN api_user TEXT NOT NULL DEFAULT '';
      ALTER TABLE company ADD COLUMN last_catalog_sync TEXT NOT NULL DEFAULT '';

      ALTER TABLE items ADD COLUMN remote_id INTEGER;
      ALTER TABLE items ADD COLUMN brand TEXT NOT NULL DEFAULT '';
      ALTER TABLE items ADD COLUMN category TEXT NOT NULL DEFAULT '';
      ALTER TABLE items ADD COLUMN availability TEXT NOT NULL DEFAULT '';
      ALTER TABLE items ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_items_remote_id ON items(remote_id);

      ALTER TABLE documents ADD COLUMN remote_request_id INTEGER;
    `);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}
