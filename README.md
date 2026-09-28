# Ameg Business

Application mobile de **devis et factures** (Expo SDK 57 / React Native), développée par Majeli Connect.
Fonctionne 100 % hors ligne : les données sont stockées sur le téléphone (SQLite).

## Fonctionnalités

- **Accueil** : chiffres clés (à encaisser, payé ce mois, devis en cours, clients) + derniers documents
- **Documents** : devis (`DEV-2026-0001`) et factures (`FAC-2026-0001`) numérotés automatiquement
  - lignes libres ou depuis le catalogue, quantités décimales, TVA 18 % activable
  - statuts : brouillon, envoyé, accepté/refusé (devis), payée/annulée (facture)
  - **PDF** partagé via WhatsApp, email… (montant en lettres, NINEA, RC, logo)
  - impression, duplication, **transformation devis → facture**
- **Clients** et **Articles** (catalogue de produits/services)
- **Paramètres** : identité de l'entreprise, logo, mentions de bas de page, TVA par défaut

## Structure

```
src/app/            écrans (Expo Router)
  _layout.tsx       onglets + base SQLite
  index.tsx         tableau de bord
  documents/        liste + éditeur ([id].tsx, "new" pour créer)
  clients.tsx, items.tsx, settings.tsx
src/components/     composants UI réutilisables
src/db/             schéma (migrations) + requêtes
src/utils/          formatage FCFA/dates, gabarit HTML du PDF, export PDF
```

---

## Étape 1 — Installer et lancer sur votre téléphone

```bash
npm install
npx expo start
```

Scannez le QR code avec l'application **Expo Go** (Android / iPhone), sur le même réseau Wi-Fi que le PC.
Si le réseau bloque la connexion : `npx expo start --tunnel`.

Premier test conseillé :
1. Paramètres → nom de l'entreprise, logo, NINEA, RC → Enregistrer
2. Articles → ajoutez 2-3 prestations
3. Documents → + → Devis → client, lignes → **Partager en PDF**
4. Ouvrez le devis → **Transformer en facture** → statut « Payée »

Vérifications avant chaque commit : `npm run typecheck` et `npm run lint`.

## Étape 2 — Personnaliser l'identité visuelle

Remplacez les images Expo par défaut dans `assets/images/` (mêmes noms de fichiers) :

| Fichier | Taille | Usage |
|---|---|---|
| `icon.png` | 1024×1024, sans transparence | icône iOS / Play Store |
| `android-icon-foreground.png` | 1024×1024, logo centré (zone sûre ~66 %) | icône adaptative Android |
| `android-icon-background.png` | 1024×1024 | fond de l'icône Android |
| `android-icon-monochrome.png` | 1024×1024, blanc sur transparent | icône à thème Android 13+ |
| `splash-icon.png` | ~400×400, transparent | écran de démarrage (fond #0F2D52) |

## Étape 3 — Créer le compte EAS et lier le projet

```bash
npm install -g eas-cli      # ou utilisez npx eas-cli@latest
eas login                   # compte expo.dev (celui de Majeli Connect)
eas init                    # ajoute l'ID du projet dans app.json
```

## Étape 4 — Build de test Android (APK à installer directement)

```bash
eas build -p android --profile preview
```

Téléchargez l'APK depuis le lien fourni et installez-le sur plusieurs téléphones pour tester en conditions réelles.

## Étape 5 — Publication Google Play

1. Compte **Google Play Console** (25 $ une fois) — au nom de Majeli Connect.
2. Créez l'application « Ameg Business » (langue : français, gratuite).
3. Build de production (format AAB) :
   ```bash
   eas build -p android --profile production
   ```
4. Premier envoi : téléversez le `.aab` à la main dans *Tests → Test interne*.
   Ensuite `eas submit -p android` (clé de compte de service Google à configurer).
5. Remplissez la fiche : description, captures d'écran (min. 2), icône 512×512, image de présentation 1024×500,
   **politique de confidentialité** (URL obligatoire), classification du contenu, « Sécurité des données »
   (déclarer : aucune donnée collectée, tout reste sur l'appareil).
6. ⚠️ Compte personnel créé après nov. 2023 : **test fermé avec 12 testeurs pendant 14 jours** obligatoire
   avant la production. Un compte **Organisation** (avec numéro D-U-N-S) en est dispensé.

## Étape 6 — Publication App Store (iPhone)

1. Compte **Apple Developer Program** (99 $/an) — en Organisation pour afficher « Majeli Connect » (D-U-N-S requis).
2. Pas besoin de Mac : EAS gère certificats et profils.
   ```bash
   eas build -p ios --profile production
   eas submit -p ios
   ```
3. Dans **App Store Connect** : captures iPhone 6,9" (et iPad car `supportsTablet` est activé),
   description, mots-clés, URL de confidentialité, « Confidentialité de l'app » → aucune donnée collectée.
4. Testez via **TestFlight**, puis « Soumettre pour vérification » (1 à 3 jours en général).

## Étape 7 — Mises à jour

- Changement JS/UI uniquement : `eas update` (mise à jour instantanée, après installation de `expo-updates`).
- Changement natif ou nouvelle version store : incrémentez `version` dans `app.json`, puis `eas build` + `eas submit`
  (les numéros de build sont incrémentés automatiquement par EAS).

## À prévoir ensuite (V2)

- Sauvegarde / restauration des données (export du fichier SQLite vers Google Drive, WhatsApp…)
- Suivi des paiements partiels et relances
- Plusieurs taux de TVA / remises par ligne
- Numérotation personnalisable depuis les Paramètres
