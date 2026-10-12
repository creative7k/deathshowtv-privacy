# Strange Cams

App mobile (iOS + Android) : un feed vertical façon TikTok qui ne montre **que des événements insolites** captés sur des caméras publiques **officielles**.

- `docs/01-audit-sources.md` : audit des sources (type de flux, URL, licence, verdict)
- `docs/02-stack-architecture.md` : stack, architecture, coûts, plan par étapes
- `docs/03-plan-gratuit.md` : faire tourner le MVP à 0 € (Supabase Free, worker sur ton PC, Expo)
- `app/` : application Expo (React Native, TypeScript)
- `supabase/` : schéma de la base (migrations), caméras de départ (`seed.sql`), tests SQL
- `worker/` : service d'ingestion (images, enregistrement des flux live, fabrication des clips) — voir `worker/README.md`

## Brancher Supabase

Sans configuration, l'app tourne en **mode démo** (données locales, bandeau « Données de démonstration »).

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** : exécuter, dans l'ordre, `supabase/migrations/20261011000000_init.sql`,
   `supabase/migrations/20261012000000_alerts.sql`, puis `supabase/seed.sql`.
   (Ou, avec la CLI Supabase : `supabase link` puis `supabase db push`.)
3. **Authentication → Sign In / Providers** : activer **Allow anonymous sign-ins**.
4. **Database → Publications** : vérifier que la table `events` est cochée dans `supabase_realtime`
   (la migration l'ajoute automatiquement si la publication existe).
5. `app/.env` contient déjà l'URL et la clé publique du projet Strange Cams. Pour un autre projet,
   remplacer ces deux valeurs.
6. Pour le worker : voir `worker/README.md` (tourne gratuitement sur ton PC ; les clips vont dans le
   stockage Supabase, bucket `media` créé par la migration).
   Relancer `npx expo start --clear` après tout changement de `.env`.

Règle de création d'un événement : **3 personnes différentes** signalent la même caméra en moins de
2 minutes. Un signalement suivant (dans les 10 minutes) rejoint l'événement existant. Une personne
ne peut signaler la même caméra qu'une fois toutes les 2 minutes.

## Lancer l'app

```bash
cd app
npm install
npx expo start        # puis scanner le QR code (Expo Go) ou ouvrir un simulateur
```

`expo-video` est inclus dans Expo Go. Pour un build natif : `npx eas-cli@latest build --profile development`.

## Vérifications

```bash
cd app
npm run typecheck
npx expo lint
npm test              # tests unitaires (node:test)
cd ..
supabase/tests/run-local.sh   # tests du schéma sur un Postgres local (createdb/psql requis)
```

## Avancement

- [x] Étape 1 : feed vertical plein écran, 8 catégories, lecteur HLS natif / images rafraîchies, vote et signalement (état local, données de démo)
- [x] Étape 2 : Supabase (schéma, RLS, auth anonyme, API du feed), testé sur Postgres local
- [x] Étape 3 : signalement → événement, vote vrai/faux, compteurs en temps réel (code prêt, à valider sur un vrai projet Supabase)
- [x] Étape 4 : worker d'ingestion (images → clips time-lapse, replay des flux live), testé avec des sources simulées
- [x] Phase 2a : milliers de caméras (catalogue Caltrans) + alertes officielles (CHP, USGS, NOAA) → publication immédiate, enregistrement, rediffusion
- [ ] Floutage automatique des visages et plaques sur les clips d'accident
- [ ] Phase 2b : détection de changement d'image sur les caméras vedettes
- [ ] Relais live pour les spectateurs : l'app lit encore les flux HLS directement chez Caltrans / OOI (à faire passer par notre relais avant la mise en prod)
- [ ] Phase 2 : détection IA, alertes collectives, floutage
