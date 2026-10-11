# Strange Cams — Étape 1 : audit des sources

Audit réalisé le 11/10/2026. Les pages officielles ont été lues une par une ; le niveau de certitude est indiqué partout où je n'ai pas pu tout vérifier.

## Le point important

**Parmi les 7 sources, une seule fournit vraiment de la vidéo live directement depuis un serveur officiel : Caltrans.**
Les autres sont dans l'un de ces trois cas :

1. **Une image fixe rafraîchie** toutes les 30 s à 10 min (NPS hors Old Faithful, NYC DOT, UAF, USAP, Australian Antarctic Division).
2. **Une vraie vidéo, mais diffusée uniquement sur YouTube** (USGS Kīlauea, NOAA Okeanos, NASA ISS). C'est exclu par ta contrainte « jamais YouTube ».
3. **Une vraie vidéo, mais servie par un prestataire commercial tiers** (Old Faithful : player Pixelcaster, financé par Canon et Yellowstone Forever). Il faut un accord.

Pour la plupart des catégories, le produit « vidéo live » n'est donc pas réalisable tel quel en respectant la contrainte légale. Trois options sont possibles, et il faudra choisir (voir les questions en fin de document) :

- **A. Clips time-lapse** générés par nous à partir des séquences d'images. C'est légal pour les sources du domaine public, et c'est même idéal pour la détection IA, qui travaille de toute façon image par image.
- **B. Demander un flux direct** (HLS/RTSP) aux institutions (USGS, NOAA, NASA, Yellowstone Forever). C'est la bonne démarche, mais c'est lent et incertain.
- **C. Se limiter aux sources qui ont une vraie vidéo** : DOT (Caltrans et autres 511 d'États). Le catalogue devient alors très pauvre.

Ma recommandation : **A pour le MVP, B en parallèle**. Le player affiche un vrai live quand il existe (Caltrans) et un time-lapse « quasi-live » sinon.

## Tableau

| # | Source | Type de flux réel | URL technique (vérifiée) | Licence / réutilisation | Verdict |
|---|---|---|---|---|---|
| 1a | **NPS – Yellowstone (webcams fixes)** | Image JPEG, rafraîchie toutes les **30 à 60 s** (FAQ de la page) | `nps.gov/media/webcam/view.htm?id=…`, liste disponible via l'API NPS `developer.nps.gov/api/v1/webcams` (clé gratuite) | Œuvre fédérale US = domaine public en général. Certaines caméras sont opérées par des partenaires : à vérifier caméra par caméra (champ crédit de l'API) | ✅ **OK (images)** |
| 1b | **NPS – Old Faithful livestream** | **Vraie vidéo**, mais servie par **Pixelcaster** (`cdn.pixelcaster.com/.../yellowstone-old-faithful/`), sponsorisée par Canon USA et Yellowstone Forever | Player JS Pixelcaster, pas de HLS publié | Le flux est la propriété d'un tiers commercial ou d'un partenaire, même si l'USGS le répertorie comme « Public Domain ». Le relayer sans accord est risqué | ⚠️ **Non sans accord écrit** (Yellowstone Forever / Pixelcaster). La snapshot `latest_1920x.jpg` est utilisable comme image, sous la même réserve |
| 1c | **NPS – Rocky Mountain** | Images fixes (~10 min selon un site tiers, non confirmé sur la page NPS) | `nps.gov/romo/learn/photosmultimedia/webcams.htm` | Domaine public fédéral | ✅ **OK (images, peu dynamique)** |
| 2 | **USGS – HVO Kīlauea** | **Vraie vidéo pour V1/V2/V3cam, mais uniquement sur YouTube** (`youtube.com/@usgs/streams`). Les autres webcams HVO sont des **snapshots périodiques** | Pages `usgs.gov/volcanoes/kilauea/summit-webcams` ; images JPEG par caméra | « Sources/Usage: Public Domain » écrit sur chaque page | ✅ **OK (images)** · ❌ **vidéo live (YouTube)**. À demander à l'HVO : un flux HLS direct |
| 3 | **UAF – Allsky Poker Flat** | Images fixes (historiquement ~1/min), **saisonnier** : seulement de nuit noire, environ d'août à avril, caméra hors ligne sinon. Le « live vidéo » UAF est sur **Explore.org**, donc exclu | `allsky.gi.alaska.edu` (Poker Flat, Toolik, Gakona) | **Université : pas de domaine public**, aucune licence affichée | ⚠️ **Non sans autorisation écrite** de l'UAF Geophysical Institute (contacts : D. Hampton, J. Ahrns) |
| 4a | **DOT – Caltrans** | ✅ **Vraie vidéo HLS** pour la plupart des caméras, plus une image fixe toutes les 2 min | JSON officiel : `cwwp2.dot.ca.gov/data/d{N}/cctv/cctvStatusD{NN}.json` → champ `streamingVideoURL` = `https://wzmedia.dot.ca.gov/D7/CCTV-196.stream/playlist.m3u8` (vérifié) | Conditions d'usage Caltrans : « public domain unless otherwise indicated ». Une « fair use policy » s'applique au streaming CCTV : il faut **relayer** le flux, ne pas faire pointer des milliers de clients sur leur serveur | ✅ **OK**, via notre relais |
| 4b | **DOT – NYC DOT** | Images fixes « fréquemment mises à jour » (quelques secondes) | `webcams.nyctmc.org` (API JSON non documentée) | Aucune licence publiée. **NYC DOT a déjà envoyé une mise en demeure** à un projet artistique qui utilisait ces images (2024) | ❌ **Non** sans accord écrit du NYC DOT |
| 5 | **NASA – ISS / lancements** | Vraie vidéo, mais sur **YouTube** et sur **NASA+**. NASA+ a son propre player, sans HLS publié pour des tiers | `nasa.gov/live`, `plus.nasa.gov` | Contenu NASA réutilisable, y compris commercialement, **sans suggérer d'endorsement**. **Logo NASA interdit**, et le mot « NASA » est interdit dans un nom de produit ou dans la pub | ⚠️ **Licence OK, technique non.** Extraire le HLS de NASA+ est une zone grise : il faut demander un flux à la NASA |
| 6 | **NOAA – Okeanos Explorer** | Vraie vidéo, mais **YouTube uniquement** (Camera 2/3 sur le canal NOAA Ocean Exploration). **Saisonnier** : seulement pendant les expéditions, de 8 h à 20 h locales. Aujourd'hui le navire est en transit vers les Fidji : pas de plongée ROV | `oceanexplorer.noaa.gov/livestreams/` | Œuvre fédérale = domaine public | ❌ **Non (YouTube)**. À demander à la NOAA : un flux direct. NB : E/V *Nautilus* (Ocean Exploration Trust) est privé, donc exclu |
| 7a | **USAP – McMurdo / Palmer / South Pole** | Images fixes (page rafraîchie toutes les 30 s). South Pole n'émet que **~9 h/jour** (fenêtre satellite) | `usap.gov/videoclipsandmaps/mcmwebcam.cfm` → JPEG `usap.gov/videoclipsandmaps/SouthPoleWebcam/McM00008.jpg` | Métadonnée `copyright: public domain` (site NSF) | ✅ **OK (images)** |
| 7b | **Australian Antarctic Division** | Images fixes (Mawson, Casey, Davis, Macquarie, navire *Nuyina*, « krillcam ») + time-lapse | `antarctica.gov.au/antarctic-operations/webcams/` | © Commonwealth of Australia. Les jeux de données AAD sont en **CC BY 4.0** ; la licence des webcams du site est **à confirmer** (probablement CC BY, avec **attribution textuelle** obligatoire, sans logo) | ⚠️ **Probablement OK avec crédit**, à confirmer |
| 8 | **Paranormal** | Aucune source propre : agrège les autres catégories | — | Hérite de la licence de chaque source | ✅ |

### Ce qui n'a pas pu être vérifié à 100 %

- La présence de `isStreaming` dans l'API NPS `/webcams` (il faut une clé API pour tester).
- La « fair use policy » exacte du streaming Caltrans : à obtenir auprès de Caltrans avant la mise en prod.
- La licence exacte des webcams AAD et la fréquence de rafraîchissement d'HVO et d'UAF.
- Mon environnement ne peut pas appeler directement ces serveurs : la lecture des pages est passée par un service de scraping.

### Remarques légales à garder en tête

- « Domaine public » ne veut pas dire « droit d'utiliser la marque ». Pas de logo NPS, USGS, NASA ou NOAA dans l'app, et aucune formulation suggérant un partenariat. Une simple mention textuelle de la source (« Source : USGS ») est recommandée, et obligatoire pour les licences CC BY.
- **Intersections urbaines = des personnes filmables** (RGPD si l'app est distribuée dans l'UE). Les DOT filment en basse résolution, mais un clip « événement » qui zoome sur un piéton peut poser problème. Il faudra prévoir un floutage des visages et des plaques en phase 2.
- Les relais du type rtsp.me ou Castr ne servent à rien pour les sources « image ». Ils ne sont utiles que pour Caltrans. On peut même s'en passer (voir l'architecture).

## Sources consultées

- [NPS Yellowstone – Webcams](https://www.nps.gov/yell/learn/photosmultimedia/webcams.htm) · [NPS Data API](https://www.nps.gov/subjects/developer/get-started.htm) · [NPS Rocky Mountain – Webcams](https://www.nps.gov/romo/learn/photosmultimedia/webcams.htm)
- [USGS – Kīlauea Summit Webcams](https://www.usgs.gov/volcanoes/kilauea/summit-webcams) · [USGS – V1cam](https://www.usgs.gov/volcanoes/kilauea/v1cam-kilauea-volcano-hawaii-west-halemaumau-crater) · [HVO – V2cam livestream](https://usgs.gov/observatories/hvo/news/new-v2cam-livestream-available)
- [UAF Allsky – Poker Flat](https://allsky.gi.alaska.edu/poker-flat) · [UAF news (aurora cam sur Explore.org)](https://www.uaf.edu/news/archives/2024/uaf-aurora-scientist-to-appear-on-live-qa.php)
- [Caltrans CWWP2](https://cwwp2.dot.ca.gov) · [JSON CCTV D7](https://cwwp2.dot.ca.gov/data/d7/cctv/cctvStatusD07.json) · [Caltrans Conditions of Use](https://dot.ca.gov/conditions-of-use)
- [NYC DOT – Traffic cameras](https://www.nyc.gov/html/dot/html/motorist/atis.shtml) · [404 Media – mise en demeure Traffic Cam Photobooth](https://404media.co/traffic-cam-photobooth-cease-and-desist)
- [NASA Live](https://www.nasa.gov/live/) · [NASA Images and Media Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) · [NASA Advertising Guidelines](https://www.nasa.gov/nasa-brand-center/advertising-guidelines/)
- [NOAA Ocean Exploration – Livestreams](https://oceanexplorer.noaa.gov/livestreams/) · [NOAA – 2026 expeditions](https://oceanexplorer.noaa.gov/expedition-2026-expeditions/)
- [USAP – McMurdo Webcams](https://www.usap.gov/videoclipsandmaps/mcmwebcam.cfm) · [USAP – South Pole Webcams](https://www.usap.gov/videoclipsandmaps/spwebcam.cfm)
- [AAD – Antarctic webcams](https://www.antarctica.gov.au/antarctic-operations/webcams/) · [AAD Sky Imager dataset (CC BY 4.0)](https://cmr.earthdata.nasa.gov/search/concepts/C1214313009-AU_AADC)
