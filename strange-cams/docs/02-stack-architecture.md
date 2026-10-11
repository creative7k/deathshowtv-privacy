# Strange Cams — Étape 2 : stack, architecture et coûts

## Stack proposée

| Couche | Choix | Pourquoi |
|---|---|---|
| Mobile | **React Native + Expo** (TypeScript), `expo-video` pour la lecture | Un seul code pour iOS et Android. `expo-video` utilise les lecteurs natifs AVPlayer et ExoPlayer : HLS natif, sans logo et sans dépendance tierce. Feed vertical en `FlatList` paginé : seul l'élément visible joue, les voisins sont préchargés |
| Backend données | **Supabase** (Postgres, auth anonyme, Realtime, Storage) | Signalements, votes et feed en SQL, plus le temps réel pour les compteurs de votes et, en phase 2, les alertes collectives. Aucun serveur à gérer pour le MVP |
| Ingestion (worker) | **Node.js (TypeScript) + ffmpeg**, sur un petit VPS (Fly.io, Railway ou Hetzner) | Interroge les sources « image » (toutes les 30 à 120 s), archive les images, fabrique les clips MP4/HLS. Pour Caltrans, enregistre les segments HLS autour d'un signalement |
| Stockage vidéo et CDN | **Cloudflare R2** (compatible S3, **egress gratuit**) | Les clips du feed sont servis depuis notre propre domaine : pas de hotlink vers les institutions, pas de logo tiers |
| Relais live (Caltrans) | **MediaMTX** auto-hébergé (open source) sur le même VPS, **ou** Castr | Respecte la « fair use » de Caltrans : 1 connexion vers eux par caméra, N spectateurs chez nous. MediaMTX coûte 0 € en plus du VPS ; Castr est plus simple, mais payant |
| Phase 2 – détection | **Worker Python** (OpenCV : soustraction de fond MOG2 et différence d'images), puis **modèle de vision** (API Claude) uniquement sur les images candidates | Le filtre OpenCV, gratuit, écarte 95 à 99 % des images. Le modèle de vision ne voit que les anomalies, ce qui maîtrise le coût |
| Phase 2 – alertes collectives | Supabase Realtime (broadcast) + **Expo Push Notifications** | « Tout le monde sur la même caméra » = un message broadcast `{eventId}`. Les apps ouvertes basculent, les autres reçoivent un push |

## Architecture

```
            ┌─────────────── Sources officielles ───────────────┐
            │ NPS / USGS / USAP / AAD (JPEG)   Caltrans (HLS)   │
            └──────────────┬───────────────────────┬────────────┘
                           │ poll 30–120 s          │ pull HLS
                    ┌──────▼───────────────────────▼──────┐
                    │  Worker d'ingestion (Node + ffmpeg)  │
                    │  - buffer d'images circulaire (1 h)  │
                    │  - génère clips MP4/HLS              │
                    │  - relais live MediaMTX (Caltrans)   │
                    └──────┬──────────────────────┬───────┘
                           │ clips                │ métadonnées
                    ┌──────▼──────┐        ┌──────▼──────────────────┐
                    │ Cloudflare  │        │ Supabase (Postgres)     │
                    │ R2 + CDN    │        │ cameras, events,        │
                    └──────┬──────┘        │ reports, votes, Realtime│
                           │               └──────┬──────────────────┘
                           │   HLS/MP4            │ API + temps réel
                    ┌──────▼──────────────────────▼──────┐
                    │   App Expo (iOS / Android)          │
                    │   feed vertical · signaler · voter  │
                    └─────────────────────────────────────┘
       Phase 2 : Worker Python (OpenCV → modèle de vision) lit le buffer
                 d'images et crée des events « ai » dans Supabase.
```

### Cycle de vie d'un événement (MVP)

1. Un utilisateur regarde une caméra et appuie sur **« Signaler »** (type, plus un commentaire optionnel).
2. Le backend agrège les signalements par caméra sur une fenêtre de 2 min. Au-delà d'un **seuil** (par exemple 3 signalements, ou 1 seul avec validation admin pour l'amorçage), un `event` est créé.
3. Le worker fabrique le clip : les N images avant et après le signalement en time-lapse, ou les segments HLS enregistrés pour Caltrans. Il l'envoie sur R2.
4. L'event apparaît dans le feed. Les utilisateurs votent 👍 ou 👎, et le score modifie le classement.
5. **Ordre du feed à l'ouverture** : l'événement le plus spectaculaire (score de votes pondéré par la fraîcheur), puis l'alerte en cours la plus haute, puis l'aléatoire. Les alertes arrivent en phase 2, mais le tri est prévu dès le MVP.

### Modèle de données (MVP)

- `cameras` (id, catégorie, source, nom, type `image|hls`, url, intervalle, crédit, actif)
- `events` (id, camera_id, catégorie, origine `user|ai`, titre, clip_url, poster_url, started_at, score, statut)
- `reports` (id, camera_id, user_id, type, note, created_at)
- `votes` (event_id, user_id, valeur ±1), avec une clé unique par utilisateur
- Utilisateurs : **auth anonyme Supabase** (aucune inscription pour le MVP)

## Estimation des coûts (ordres de grandeur, à confirmer)

| Poste | MVP (≤ 1 000 utilisateurs) | Croissance (~50 000 utilisateurs actifs/mois) |
|---|---|---|
| Comptes stores | Apple 99 $/an + Google 25 $ (une fois) | idem |
| Supabase | 0 $ (offre gratuite) → 25 $/mois (Pro) | 25 à 100 $/mois |
| VPS worker + relais | 5 à 20 $/mois | 40 à 150 $/mois (plusieurs workers) |
| Cloudflare R2 | ~0 à 5 $/mois (quelques Go, egress gratuit) | 10 à 50 $/mois (stockage + opérations) |
| Expo EAS (builds) | 0 $ (offre gratuite) | 0 à 99 $/mois |
| Castr (si choisi à la place de MediaMTX) | ~50 à 100 $/mois | plus, selon le nombre de flux |
| **Phase 2 – modèle de vision** | — | ≈ (nb caméras × candidats/jour × coût par image). Exemple : 60 caméras × 100 candidats = 6 000 appels/jour. Le coût dépend du modèle choisi ; je le chiffrerai précisément à l'entrée en phase 2 avec les tarifs du moment. Le filtre OpenCV en amont est ce qui rend ce poste supportable |
| **Total MVP** | **≈ 10 à 50 $/mois** + comptes stores | **≈ 150 à 500 $/mois** hors IA |

Les tarifs Castr, Supabase et EAS sont des ordres de grandeur issus de leurs grilles publiques habituelles. Ils seront revérifiés au moment de souscrire.

## Plan par étapes (MVP)

1. **Squelette Expo** : feed vertical plein écran, avec un catalogue de caméras en dur et des clips de démonstration. *→ je te montre une capture.*
2. **Supabase** : schéma, auth anonyme, API du feed. *→ démo du feed alimenté par la base.*
3. **Signalement + vote** dans l'app, compteurs en temps réel. *→ démo.*
4. **Worker d'ingestion** sur les 3 catégories retenues, et génération réelle des clips. *→ démo avec de vraies images.*
5. Polissage, builds de test (TestFlight / Play internal).

Phase 2 : détection IA, alertes collectives, catégorie Paranormal, floutage des visages et des plaques.
