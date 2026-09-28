export function formatFCFA(amount: number): string {
  const n = Math.round(amount || 0);
  const sign = n < 0 ? "-" : "";
  return (
    sign +
    Math.abs(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ") +
    " FCFA"
  );
}

export function parseAmount(text: string): number {
  const n = parseInt(text.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Accepte "2", "1,5" ou "1.5" ; renvoie 0 si invalide. */
export function parseQuantity(text: string): number {
  const n = parseFloat(text.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : String(q).replace(".", ",");
}

/** Date du jour au format ISO (AAAA-MM-JJ), en heure locale. */
export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromISO(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function fromISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-09-26" -> "26/09/2026" */
export function formatDate(iso: string | null | undefined): string {
  const d = fromISO(iso);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

/** "26/09/2026" -> "2026-09-26" (null si invalide) */
export function parseDateFR(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (
    d.getFullYear() !== Number(m[3]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[1])
  )
    return null;
  return toISO(d);
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

// ---------- Montant en lettres (français) ----------

const UNITS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];
const TENS = [
  "",
  "",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "soixante",
  "quatre-vingt",
  "quatre-vingt",
];

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  let u = n % 10;
  if (t === 7 || t === 9) u += 10; // 70-79 et 90-99
  let word = TENS[t];
  if (u === 0) return t === 8 ? word + "s" : word;
  const sep = (u === 1 || u === 11) && t !== 8 && t !== 9 ? " et " : "-";
  return word + sep + UNITS[u];
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let word = "";
  if (h > 0) {
    word = h === 1 ? "cent" : UNITS[h] + " cent";
    if (rest === 0 && h > 1) word += "s";
  }
  if (rest > 0) word += (word ? " " : "") + below100(rest);
  return word;
}

export function numberToWordsFr(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const scales: [number, string][] = [
    [1_000_000_000, "milliard"],
    [1_000_000, "million"],
  ];
  for (const [size, name] of scales) {
    const q = Math.floor(n / size);
    if (q > 0) {
      parts.push(below1000(q) + " " + name + (q > 1 ? "s" : ""));
      n %= size;
    }
  }
  const th = Math.floor(n / 1000);
  if (th > 0) {
    // "cent" et "vingt" ne prennent pas de s devant "mille"
    const w = th === 1 ? "mille" : below1000(th).replace(/s$/, "") + " mille";
    parts.push(w);
    n %= 1000;
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(" ");
}
