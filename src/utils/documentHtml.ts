/**
 * Gabarit PDF des devis et factures — reproduit le modèle Word
 * « Template_Facture_AMEG_International.docx ».
 */
import {
  computeTotals,
  lineTotal,
  type Client,
  type Company,
  type Doc,
  type DocLine,
} from "@/db/queries";
import { formatDate, formatQuantity } from "./format";

const NAVY = "#0F2D52";
const TEAL = "#00A8A8";
const ORANGE = "#F28C28";
const GREY = "#6B7280";
const LIGHT = "#F4F6F8";
const BORDER = "#D9DEE3";

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

/** 1234567 -> "1 234 567" (sans devise) */
function money(n: number): string {
  const v = Math.round(n || 0);
  return (
    (v < 0 ? "-" : "") +
    Math.abs(v)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  );
}

function qty(n: number): string {
  // Format du modèle : 1,00 / 2,50
  return n.toFixed(2).replace(".", ",");
}

function rate(r: number): string {
  return `${formatQuantity(r)}%`;
}

/** Libellé "valeur" : texte en gras, ou tiret si vide */
function val(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t ? `<b>${esc(t)}</b>` : `<span class="dash">—</span>`;
}

export function buildDocumentHtml(
  company: Company,
  doc: Doc,
  client: Client | null,
  lines: DocLine[],
): string {
  const isInvoice = doc.type === "facture";
  const title = isInvoice ? "FACTURE" : "DEVIS";
  const numLabel = isInvoice ? "N° facture" : "N° devis";
  const t = computeTotals(lines, doc.discount);
  const logo = company.logo;
  const shortName = company.name.trim() || "AMEG International";

  // Colonnes Poids / N° Douane affichées seulement si utilisées (prestations de service)
  const showWeight = lines.some((l) => (l.weight ?? "").trim());
  const showHs = lines.some((l) => (l.hs_code ?? "").trim());

  const rows = lines
    .map((l, i) => {
      const ref = (l.reference ?? "").trim();
      const head = ref
        ? `${esc(ref)} — ${esc(l.description)}`
        : esc(l.description);
      const weight = (l.weight ?? "").trim();
      return `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="des">
          <div class="des-title">${head}</div>
          ${l.details?.trim() ? `<div class="des-sub">${esc(l.details)}</div>` : ""}
        </td>
        <td class="c">${qty(l.quantity)}</td>
        <td class="c">${esc(l.unit?.trim() || "PCS")}</td>
        ${showWeight ? `<td class="c">${weight ? `${esc(weight)}${/[a-z]/i.test(weight) ? "" : " kg"}` : "—"}</td>` : ""}
        ${showHs ? `<td class="c">${esc(l.hs_code?.trim() || "—")}</td>` : ""}
        <td class="r">${money(l.unit_price)}</td>
        <td class="r"><b>${money(lineTotal(l))}</b></td>
        <td class="c">${rate(l.tva_rate ?? 0)}</td>
      </tr>`;
    })
    .join("");

  const vatLabel =
    t.groups.length === 1 ? `TVA (${rate(t.groups[0].rate).replace("%", " %")})` : "TVA";

  const vatRows = t.groups
    .map((g) => {
      const code =
        g.rate === 0
          ? doc.tax_code.trim() || "Exonération"
          : `TVA ${formatQuantity(g.rate)} %`;
      return `<tr>
        <td>${esc(code)}</td>
        <td class="c">${rate(g.rate)}</td>
        <td class="r">${money(g.base)}</td>
        <td class="r">${money(g.amount)}</td>
        <td class="c">FCFA</td>
      </tr>`;
    })
    .join("");

  const clientCity = client?.city?.trim();
  const penalty = company.penalty_rate?.trim();
  const fee = company.recovery_fee?.trim();

  const cgv = `Réglement à libeller à l'ordre d'${esc(shortName)} et à adresser aux coordonnées ci-dessus.
    Tout retard de paiement entraîne une pénalité calculée au taux de ${esc(penalty || "1,5")}% par mois${
      fee ? `, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de ${esc(fee)}` : ""
    }. Aucun escompte ne sera accordé en cas de paiement anticipé.`;

  const contactLine = [
    company.phone && `Tél : ${esc(company.phone)}`,
    company.email && `Email : ${esc(company.email)}`,
    company.website && `Web : ${esc(company.website)}`,
  ]
    .filter(Boolean)
    .join(" — ");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4; margin: 14mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #1F2937; font-size: 9.5px; margin: 0; line-height: 1.35; }
  b { color: ${NAVY}; }
  .dash { color: ${GREY}; }
  .muted { color: ${GREY}; }

  /* En-tête */
  .head { display: flex; justify-content: space-between; align-items: center; }
  .company-fallback { font-size: 18px; font-weight: 700; color: ${NAVY}; }
  .logo { height: 58px; max-width: 220px; object-fit: contain; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 24px; font-weight: 700; color: ${NAVY}; letter-spacing: 0.5px; }
  .title .meta { margin-top: 4px; font-size: 11px; color: ${GREY}; }
  .title .meta b { font-size: 11px; }
  .band { display: flex; height: 5px; margin-top: 14px; }
  .band div { flex: 1; }

  /* Bloc infos + adresse */
  .top { display: flex; gap: 14px; }
  .refs { flex: 1; padding-top: 8px; font-size: 10px; line-height: 1.75; color: ${GREY}; }
  .bill { flex: 1; border: 1px solid ${BORDER}; border-top: none; padding: 8px 12px 10px; font-size: 10px; }
  .bill .lbl { font-weight: 700; color: ${NAVY}; font-size: 9.5px; letter-spacing: 0.3px; margin-bottom: 4px; }
  .bill .nm { font-weight: 700; color: ${NAVY}; font-size: 11.5px; }
  .bill .ct { font-style: italic; color: ${GREY}; margin-top: 4px; }

  /* Conditions */
  .terms { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; margin-top: 26px; font-size: 10px; color: ${GREY}; }
  .terms .wide { grid-column: span 2; }

  /* Titres de section */
  h2 { font-size: 11.5px; color: ${NAVY}; margin: 18px 0 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  h2::before { content: ""; display: inline-block; width: 4px; height: 12px; background: ${ORANGE}; }

  /* Tableau des lignes */
  table { width: 100%; border-collapse: collapse; }
  .lines th { background: ${NAVY}; color: #fff; font-size: 9px; font-weight: 700; padding: 7px 4px; text-align: center; border: 1px solid #fff; }
  .lines td { padding: 6px 5px; border: 1px solid ${BORDER}; vertical-align: top; font-size: 9.5px; }
  .lines tr { page-break-inside: avoid; }
  .des-title { font-weight: 700; color: ${NAVY}; }
  .des-sub { color: ${GREY}; margin-top: 2px; }
  .r { text-align: right; white-space: nowrap; }
  .c { text-align: center; white-space: nowrap; }

  /* Totaux */
  .totals { width: 50%; margin: 18px 0 0 auto; }
  .totals td { padding: 4px 8px; font-weight: 700; color: ${NAVY}; font-size: 11px; }
  .totals td:first-child { text-align: right; }
  .totals td:last-child { text-align: right; white-space: nowrap; }
  .totals .ttc td { background: ${ORANGE}; color: #fff; font-size: 13px; padding: 7px 8px; }

  /* Détail TVA */
  .vat th { background: ${LIGHT}; color: ${NAVY}; font-weight: 700; text-align: left; padding: 5px 6px; border: 1px solid ${BORDER}; font-size: 9.5px; }
  .vat td { padding: 5px 6px; border: 1px solid ${BORDER}; font-size: 9.5px; }

  .cgv { color: ${GREY}; font-size: 9px; }
  .cgv p { margin: 0 0 6px; }
  .notes { margin-top: 8px; padding: 8px 10px; background: ${LIGHT}; font-size: 9.5px; }

  /* Signatures */
  .sign { display: flex; gap: 0; margin-top: 18px; page-break-inside: avoid; }
  .sign > div { flex: 1; }
  .sign .t { font-weight: 700; color: ${NAVY}; font-size: 10px; }
  .sign .line { margin-top: 42px; border-top: 1px solid ${BORDER}; padding-top: 3px; font-style: italic; color: ${GREY}; font-size: 8.5px; }

  /* Pied de page */
  .foot { margin-top: 28px; border-top: 2px solid ${BORDER}; padding-top: 6px; text-align: center; font-size: 8.5px; color: ${GREY}; line-height: 1.5; page-break-inside: avoid; }
</style></head>
<body>
  <div class="head">
    ${logo ? `<img class="logo" src="${logo}"/>` : `<div class="company-fallback">${esc(shortName)}</div>`}
    <div class="title">
      <h1>${title}</h1>
      <div class="meta">${numLabel} : <b>${esc(doc.number)}</b>&nbsp;&nbsp;&nbsp; Date : <b>${formatDate(doc.date)}</b></div>
    </div>
  </div>
  <div class="band"><div style="background:${NAVY}"></div><div style="background:${TEAL}"></div><div style="background:${ORANGE}"></div></div>

  <div class="top">
    <div class="refs">
      Votre interlocuteur ${esc(shortName.split(" ")[0])} : ${val(doc.contact)}<br/>
      Réf. commande client : ${val(doc.client_ref)}<br/>
      Réf. ${esc(shortName.split(" ")[0])} : ${val(doc.internal_ref)}<br/>
      Incoterm : ${val(doc.incoterm)}
    </div>
    <div class="bill">
      <div class="lbl">${isInvoice ? "ADRESSE DE FACTURATION" : "DESTINATAIRE"}</div>
      <div class="nm">${esc(client?.name ?? "—")}</div>
      ${client?.address ? `<div>${esc(client.address)}</div>` : ""}
      ${clientCity ? `<div>${esc(clientCity)}</div>` : ""}
      <div>N° TVA / NINEA client : ${esc(client?.tax_id?.trim() || "—")}</div>
      ${client?.contact?.trim() ? `<div class="ct">Interlocuteur client : ${esc(client.contact)}</div>` : ""}
    </div>
  </div>

  <div class="terms">
    <div>${isInvoice ? "Date d'échéance" : "Valable jusqu'au"} : ${doc.due_date ? `<b>${formatDate(doc.due_date)}</b>` : `<span class="dash">—</span>`}</div>
    <div>Conditions de paiement : ${val(doc.payment_terms)}</div>
    <div>Mode de règlement : ${val(doc.payment_method)}</div>
    <div>Devise : <b>FCFA</b></div>
    <div class="wide">IBAN / BIC : ${val(company.iban)} / ${val(company.bic)}</div>
  </div>

  <h2>Détail ${isInvoice ? "de la facture" : "du devis"}</h2>
  <table class="lines">
    <thead><tr>
      <th style="width:26px">N°</th>
      <th>Article / Désignation</th>
      <th style="width:42px">Qté</th>
      <th style="width:36px">Unité</th>
      ${showWeight ? `<th style="width:48px">Poids</th>` : ""}
      ${showHs ? `<th style="width:62px">N° Douane</th>` : ""}
      <th style="width:70px">PU Net<br/>(FCFA)</th>
      <th style="width:78px">Montant<br/>(FCFA)</th>
      <th style="width:34px">TVA</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Sous-total HT</td><td>${money(t.subtotal)} FCFA</td></tr>
    ${t.discount > 0 ? `<tr><td>Remise éventuelle</td><td>- ${money(t.discount)} FCFA</td></tr>` : ""}
    <tr><td>Total HT</td><td>${money(t.ht)} FCFA</td></tr>
    <tr><td>${vatLabel}</td><td>${money(t.tva)} FCFA</td></tr>
    <tr class="ttc"><td>TOTAL TTC</td><td>${money(t.ttc)} FCFA</td></tr>
  </table>

  <h2>Détail de la TVA</h2>
  <table class="vat">
    <thead><tr>
      <th style="width:38%">Code Taxe</th><th>Taux TVA</th><th>Base HT</th><th>Montant TVA</th><th>Devise</th>
    </tr></thead>
    <tbody>${vatRows}</tbody>
  </table>

  <h2>Conditions générales de vente</h2>
  <div class="cgv">
    <p>${cgv}</p>
    ${company.cgv_url?.trim() ? `<p>Les conditions générales de vente d'${esc(shortName)} sont consultables sur : ${esc(company.cgv_url)}</p>` : ""}
    ${company.footer?.trim() ? `<p>${esc(company.footer)}</p>` : ""}
  </div>
  ${doc.notes?.trim() ? `<div class="notes"><b>Notes :</b> ${esc(doc.notes)}</div>` : ""}

  <div class="sign">
    <div>
      <div class="t">Cachet et signature — ${esc(shortName)}</div>
      <div class="line">Emplacement cachet / signature</div>
    </div>
    <div>
      <div class="t">Bon pour accord — Signature du client</div>
      <div class="line">Nom, date et signature</div>
    </div>
  </div>

  <div class="foot">
    ${esc(shortName)}${company.address ? ` — ${esc(company.address)}` : ""}${contactLine ? ` — ${contactLine}` : ""}<br/>
    RCCM : ${esc(company.rc?.trim() || "—")} &nbsp;—&nbsp; NINEA : ${esc(company.ninea?.trim() || "—")}<br/>
    ${isInvoice ? "Facture" : "Devis"} N° ${esc(doc.number)}
  </div>
</body></html>`;
}
