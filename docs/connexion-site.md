# Connexion de l'app au site AMEG International

L'app récupère le **catalogue** et les **demandes de devis** depuis l'API Laravel du site
(`ameg-api`), avec un jeton Sanctum. Tout fonctionne dans **Expo Go**, sans build ni Play Store.

## 1. Côté API Laravel (dossier `ameg-api`)

Fichiers modifiés / ajoutés :

- `app/Models/User.php` — ajout du trait `HasApiTokens` (jetons Sanctum)
- `app/Http/Controllers/MobileController.php` — nouveau
- `routes/api.php` — routes `/api/mobile/*` + `/api/catalog-import` désormais protégée

Routes ajoutées :

| Méthode | URL | Rôle |
|---|---|---|
| POST | `/api/mobile/login` | email + mot de passe admin → jeton |
| POST | `/api/mobile/logout` | révoque le jeton |
| GET | `/api/mobile/catalog?updated_since=…` | catalogue complet ou modifié depuis une date |
| GET | `/api/mobile/quote-requests?status=…` | 50 dernières demandes de devis |
| PATCH | `/api/mobile/quote-requests/{id}` | changer le statut (nouveau / en_cours / traite) |

Commandes (en local puis sur Hostinger) :

```bash
php artisan migrate        # crée la table personal_access_tokens si elle n'existe pas
php artisan route:clear
php artisan route:list --path=mobile   # vérifier que les 6 routes apparaissent
```

## 2. Tester en local avec Expo Go

1. Lancer l'API accessible depuis le téléphone :
   ```bash
   php artisan serve --host=0.0.0.0 --port=8000
   ```
   (autoriser PHP dans le pare-feu Windows si demandé)
2. Dans le projet de l'app : `npm install` puis `npx expo start -c`
3. Dans l'app : **Paramètres › Connexion au site AMEG**
   - Adresse de l'API : `http://192.168.1.25:8000` (IP du PC, même Wi-Fi que le téléphone)
   - Email / mot de passe : le compte administrateur du site
4. **Articles › Synchroniser** : importe le catalogue (les prix vides sur le site gardent le prix saisi dans l'app)
5. **Documents › Demandes de devis du site web** : ouvrir une demande › **Créer le devis**
   → client créé/retrouvé, lignes pré-remplies, la demande passe « en cours » sur le site.

## 3. En production (Hostinger)

1. Déployer les 3 fichiers ci-dessus, puis `php artisan migrate` et `php artisan route:clear`.
2. Dans l'app, se déconnecter puis se reconnecter avec l'adresse HTTPS de l'API.

## Sécurité

- Le mot de passe n'est jamais stocké : seul le jeton est gardé, chiffré (expo-secure-store).
- La connexion est limitée à 10 tentatives / minute.
- `/api/catalog-import` exige désormais d'être connecté (elle était publique).
