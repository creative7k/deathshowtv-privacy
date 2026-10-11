# Worker d'ingestion

Service Node.js (+ ffmpeg) qui tourne en continu à côté de Supabase :

1. **Caméras « image »** : télécharge l'image de chaque caméra à son rythme (jamais plus d'une fois
   toutes les 10 s), ignore les images identiques et garde un historique glissant sur disque.
2. **Caméras live (HLS)** : garde les ~3 dernières minutes du flux (anneau de segments, sans
   ré-encodage). Une seule connexion vers l'institution, quel que soit le nombre de spectateurs.
3. **Événements** : toutes les 10 s, cherche les événements publiés sans clip. Une fois la fenêtre
   après l'événement capturée, fabrique le clip (time-lapse 720p à 6 images/s, ou replay du live
   de 30 s avant à 15 s après), le publie avec sa miniature, puis renseigne `clip_url` / `poster_url`.
   L'app joue alors le clip en boucle.

## Lancer

```bash
cp .env.example .env    # puis remplir
npm install
node --env-file=.env --experimental-strip-types src/main.ts
# ou : docker build -t strange-cams-worker . && docker run --env-file .env -v sc-data:/data strange-cams-worker
```

Prérequis : Node ≥ 22.6 et `ffmpeg` dans le PATH (inclus dans l'image Docker).

## Tests

```bash
npm test        # génère des images et un flux HLS de test avec ffmpeg, aucun accès réseau requis
npm run typecheck
```
