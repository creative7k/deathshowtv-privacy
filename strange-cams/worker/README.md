# Worker d'ingestion

Service Node.js (+ ffmpeg) qui tourne en continu à côté de Supabase :

1. **Caméras « image »** : télécharge l'image de chaque caméra à son rythme (jamais plus d'une fois
   toutes les 10 s), ignore les images identiques et garde un historique glissant sur disque.
2. **Caméras live (HLS)** : garde les ~3 dernières minutes du flux (anneau de segments, sans
   ré-encodage). Une seule connexion vers l'institution, quel que soit le nombre de spectateurs.
3. **Événements** : toutes les 10 s, cherche les événements publiés sans clip. Une fois la fenêtre
   après l'événement capturée, fabrique le clip (time-lapse 720p à 6 images/s, ou replay du live
   de 30 s avant à 15 s après), le publie avec sa miniature dans le stockage Supabase, puis renseigne
   `clip_url` / `poster_url`. L'app joue alors le clip en boucle.
4. **Nettoyage** : supprime chaque heure les clips de plus de `CLIP_RETENTION_DAYS` jours (3 par défaut)
   pour rester sous le 1 Go gratuit.

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
