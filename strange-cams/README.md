# Strange Cams

App mobile (iOS + Android) : un feed vertical façon TikTok qui ne montre **que des événements insolites** captés sur des caméras publiques **officielles**.

- `docs/01-audit-sources.md` : audit des sources (type de flux, URL, licence, verdict)
- `docs/02-stack-architecture.md` : stack, architecture, coûts, plan par étapes
- `app/` : application Expo (React Native, TypeScript)
- `supabase/` : schéma de la base (migrations), caméras de départ (`seed.sql`), tests SQL

## Brancher Supabase

Sans configuration, l'app tourne en **mode démo** (données locales, bandeau « Données de démonstration »).

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** : exécuter `supabase/migrations/20261011000000_init.sql`, puis `supabase/seed.sql`.
   (Ou, avec la CLI Supabase : `supabase link` puis `supabase db push`.)
3. **Authentication → Sign In / Providers** : activer **Allow anonymous sign-ins**.
4. **Database → Publications** : vérifier que la table `events` est cochée dans `supabase_realtime`
   (la migration l'ajoute automatiquement si la publication existe).
5. Copier `app/.env.example` en `app/.env.local` et y mettre l'URL et la clé publique
   (**Project Settings → API**). Relancer `npx expo start --clear`.

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
- [ ] Étape 4 : worker d'ingestion (images → clips time-lapse, relais HLS)
- [ ] Phase 2 : détection IA, alertes collectives, floutage
