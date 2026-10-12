# Strange Cams — Plan à 0 €

Tout le MVP peut tourner sans payer. Les limites ci-dessous sont celles des offres gratuites (vérifiées le 11/10/2026).

| Brique | Solution gratuite | Limites de l'offre gratuite | Ce qui oblige à payer plus tard |
|---|---|---|---|
| Base de données, comptes, temps réel | **Supabase Free** | 500 Mo de base · 50 000 utilisateurs actifs/mois · 200 connexions temps réel simultanées · 2 M messages/mois · pause après 1 semaine d'inactivité | Plus de 200 spectateurs connectés en même temps, ou besoin d'éviter toute pause |
| Stockage des clips | **Supabase Storage** (bucket `media`) | 1 Go de stockage · 5 Go de bande passante/mois (≈ 3 000 à 5 000 vues de clips) | Audience qui dépasse ~5 000 vues de clips/mois → Cloudflare R2 (déjà prévu dans le code) |
| Worker d'ingestion | **Ton propre PC** (Windows, Mac ou Linux) | Les clips ne sont fabriqués que quand le PC est allumé | Besoin d'un service 24 h/24 → petit serveur (~5 €/mois) |
| Builds de l'app | **Expo EAS Free** | 15 builds Android + 15 builds iOS par mois | — |
| Test sur téléphone | **Expo Go** (gratuit, iOS et Android) | Pour développer et tester, pas pour publier | — |
| Distribution Android | **APK partagé directement** (lien de téléchargement) | Installation manuelle (« sources inconnues ») | Play Store : 25 $ une seule fois |
| Distribution iPhone | **Version web (PWA)** hébergée gratuitement (GitHub Pages, Cloudflare Pages, Netlify) | Pas d'App Store, pas de notifications natives | App Store / TestFlight : 99 $/an (aucune alternative gratuite chez Apple) |

## Ce qui reste payant de toute façon
- **Publication sur l'App Store** : Apple exige 99 $/an. Sans ça, les utilisateurs d'iPhone passent par Expo Go (tests) ou la version web.
- **Détection IA (phase 2)** : un modèle de vision a un coût par image. Version gratuite possible : détection de mouvement seule (OpenCV, sur le PC du worker), sans description automatique.

## Point de vigilance (live)
L'app lit encore les flux live directement chez Caltrans et OOI. À petite échelle (quelques spectateurs),
la charge sur leurs serveurs est négligeable. Avant d'avoir une vraie audience, il faudra un relais
(MediaMTX) : gratuit en logiciel, mais il demande une machine avec une bonne connexion montante.
