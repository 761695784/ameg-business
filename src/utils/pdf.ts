import type { Client, Company, Doc, DocLine } from "@/db/queries";
import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { buildDocumentHtml } from "./documentHtml";

/** Génère le PDF puis ouvre la feuille de partage (WhatsApp, email, etc.). */
export async function shareDocumentPdf(
  company: Company,
  doc: Doc,
  client: Client | null,
  lines: DocLine[],
) {
  const html = buildDocumentHtml(company, doc, client, lines);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  // On demande le PDF en base64 puis on l'écrit NOUS-MÊMES dans le cache de l'app :
  // le fichier temporaire d'expo-print n'est pas lisible par le partage (Expo Go).
  const { uri: tmpUri, base64 } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    margins: { top: 40, bottom: 40, left: 36, right: 36 },
    base64: true,
  });
  let uri = tmpUri;
  if (base64) {
    const dir = new Directory(Paths.cache, "pdf");
    if (!dir.exists) dir.create({ intermediates: true });
    const safeName = doc.number.replace(/[^\w.-]+/g, "_");
    const out = new File(dir, `${safeName}.pdf`);
    if (out.exists) out.delete();
    out.create();
    out.write(base64, { encoding: "base64" });
    uri = out.uri;
  }

  const title = `${doc.type === "facture" ? "Facture" : "Devis"} ${doc.number}`;
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ html });
    return;
  }
  const options = { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title };
  try {
    await Sharing.shareAsync(uri, options);
  } catch {
    // Dernier recours : boîte d'impression Android/iOS (« Enregistrer en PDF » puis partager).
    await Print.printAsync({ html });
  }
}

export async function printDocument(
  company: Company,
  doc: Doc,
  client: Client | null,
  lines: DocLine[],
) {
  await Print.printAsync({
    html: buildDocumentHtml(company, doc, client, lines),
  });
}
