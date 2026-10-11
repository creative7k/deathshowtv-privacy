# Strange Cams

App mobile (iOS + Android) : un feed vertical façon TikTok qui ne montre **que des événements insolites** captés sur des caméras publiques **officielles**.

- `docs/01-audit-sources.md` : audit des sources (type de flux, URL, licence, verdict)
- `docs/02-stack-architecture.md` : stack, architecture, coûts, plan par étapes
- `app/` : application Expo (React Native, TypeScript)

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
npm test              # tests de l'ordre du feed (node:test)
```

## Avancement

- [x] Étape 1 : feed vertical plein écran, 8 catégories, lecteur HLS natif / images rafraîchies, vote et signalement (état local, données de démo)
- [ ] Étape 2 : Supabase (schéma, auth anonyme, API du feed)
- [ ] Étape 3 : signalement et vote branchés sur le backend, temps réel
- [ ] Étape 4 : worker d'ingestion (images → clips time-lapse, relais HLS)
- [ ] Phase 2 : détection IA, alertes collectives, floutage
