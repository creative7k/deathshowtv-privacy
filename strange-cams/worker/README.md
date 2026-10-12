# Worker d'ingestion

Service Node.js (+ ffmpeg) qui tourne en continu à côté de Supabase :

0. **Catalogue** : importe au démarrage (puis chaque jour) toutes les caméras officielles Caltrans
   (12 districts de Californie), avec leur position GPS.
1. **Alertes officielles**, interrogées en continu :
   | Source | Quoi | Fréquence | Caméra choisie |
   |---|---|---|---|
   | CHP (police routière de Californie) | accidents, incendies, routes inondées, dangers | 1 min | la plus proche, à moins de 1 à 2 km |
   | USGS | séismes de magnitude ≥ 4 | 1 min | la plus proche, à moins de 100 km |
   | NOAA / NWS | alertes météo sévères et extrêmes (tornade, orage violent, crue…) | 2 min | une caméra dans la zone (vidéo en priorité) |
   | NOAA / SWPC | tempêtes magnétiques (Kp ≥ 6) : aurores probables | 10 min | caméra Aurores |

   Dès qu'une alerte tombe : l'événement est **publié tout de suite** (l'app montre la caméra en
   direct, en tête du feed, badge ALERTE), la caméra est **enregistrée** pendant 4 minutes, puis le
   clip **rediffusé** remplace le direct. Une même alerte ne crée jamais deux événements. Seuls le
   type d'incident et le lieu sont repris : les détails libres de la CHP (véhicules, personnes) ne le
   sont jamais.

2. **Caméras vedettes** (`featured`, enregistrées en continu) — **caméras « image »** : télécharge l'image de chaque caméra à son rythme (jamais plus d'une fois
   toutes les 10 s), ignore les images identiques et garde un historique glissant sur disque.
   — **caméras live (HLS)** : garde les ~3 dernières minutes du flux (anneau de segments, sans
   ré-encodage). Une seule connexion vers l'institution, quel que soit le nombre de spectateurs.
3. **Événements** : toutes les 10 s, cherche les événements publiés sans clip. Une fois la fenêtre
   après l'événement capturée, fabrique le clip (time-lapse 720p à 6 images/s, ou replay du live
   de 30 s avant à 15 s après), le publie avec sa miniature dans le stockage Supabase, puis renseigne
   `clip_url` / `poster_url`. L'app joue alors le clip en boucle.
4. **Nettoyage** : supprime chaque heure les clips de plus de `CLIP_RETENTION_DAYS` jours (3 par défaut)
   pour rester sous le 1 Go gratuit.

## Relais CHP (si le worker tourne hors des États-Unis)

Le serveur de la CHP ne répond pas aux connexions venant d'Europe. Le worker passe donc par l'Edge
Function `supabase/functions/chp-feed`, exécutée en Californie (gratuit : 500 000 appels/mois).
Déploiement depuis le tableau de bord Supabase : **Edge Functions → Deploy a new function → Via
Editor**, nom `chp-feed`, coller le contenu de `index.ts`, **Deploy**, puis dans les réglages de la
fonction désactiver **Verify JWT** (elle ne relaie qu'un flux public). Test :
`https://<projet>.supabase.co/functions/v1/chp-feed?forceFunctionRegion=us-west-1`

## Lancer gratuitement sur ton propre PC

Le worker n'a besoin que d'une machine allumée : ton PC suffit (gratuit). Il consomme peu
(quelques images par minute et 3 flux vidéo sans ré-encodage).

**Windows** (PowerShell) :
```powershell
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
# fermer et rouvrir PowerShell, puis dans le dossier worker :
copy .env.example .env     # puis remplir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

**macOS / Linux** :
```bash
brew install node ffmpeg        # ou : sudo apt install nodejs ffmpeg
cp .env.example .env            # puis remplir
npm install
npm start
```

**Docker** (n'importe quelle machine) :
```bash
docker build -t strange-cams-worker .
docker run -d --restart unless-stopped --env-file .env -v sc-data:/data strange-cams-worker
```

Prérequis : Node ≥ 22.9 et `ffmpeg` dans le PATH (inclus dans l'image Docker).
Quand le PC est éteint, l'app continue de fonctionner (feed, votes, signalements) ; seuls les
nouveaux clips ne sont pas fabriqués.

## Tests

```bash
npm test        # génère des images et un flux HLS de test avec ffmpeg, aucun accès réseau requis
npm run typecheck
```
