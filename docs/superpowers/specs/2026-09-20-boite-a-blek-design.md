# La Boîte à Blek — Design

Date : 2026-09-20
Statut : Validé (architecture) — en attente de relecture finale de ce document

## 1. Contexte et objectif

Application mobile iOS/Android (Expo, une seule base de code) reprenant le
principe d'une « boîte à meuh » : l'utilisateur tient le téléphone à la
verticale, écran face à lui, et le fait pivoter sur lui-même (comme un
volant, vers la droite ou la gauche) autour de l'axe qui sort de l'écran.
Deux transitions d'état sont détectées :

- **HAUT → BAS** (le haut du téléphone passe en bas) : joue le son A.
- **BAS → HAUT** (retour à la position initiale) : joue le son B, désactivable
  dans un menu de paramètres.

L'écran ne se retourne jamais dos à l'utilisateur : on parle d'une rotation
de type « roulis » (roll), pas d'un flip façon pièce de monnaie.

## 2. Portée (scope)

Inclus :
- Détection du geste par capteurs de mouvement.
- Lecture de deux sons fournis par l'utilisateur (fichiers déposés dans le
  projet), avec lecture forcée même en mode silencieux iOS.
- Écran principal avec illustration animée (fournie par l'utilisateur) qui
  suit visuellement l'état haut/bas.
- Menu de paramètres (modale) accessible via une icône de roue dentée :
  - Interrupteur : activer/désactiver le son BAS → HAUT.
  - Réglage du volume.
  - Interrupteur : vibration (retour haptique) au déclenchement.
- Persistance locale des réglages (hors ligne, pas de compte utilisateur).
- Build iOS + Android via un unique projet Expo (EAS Build).

Hors scope (YAGNI, à ne pas implémenter sans nouvelle demande) :
- Réglage de sensibilité du geste (retenu comme non nécessaire pour le
  premier jet).
- Historique, statistiques, comptage des déclenchements.
- Compte utilisateur, backend, synchronisation.
- Sons multiples / bibliothèque de sons.
- Navigation multi-écrans (React Navigation / expo-router) : un seul écran
  principal + une modale suffisent.

## 3. Approche technique : détection du geste

### Choix retenu : accéléromètre brut (`expo-sensors` → `Accelerometer`)

Alternatives écartées :
- **API d'orientation système** (`expo-screen-orientation` / orientation
  UIKit-Android) : quantifiée par paliers de 90°, latence trop élevée,
  inadaptée à un geste continu et fluide.
- **Gyroscope seul** : mesure une vitesse angulaire, pas un angle absolu ;
  dérive dans le temps sans fusion avec l'accéléromètre. Reviendrait à
  réimplémenter un `DeviceMotion` maison.
- **`DeviceMotion` (rotation alpha/beta/gamma)** : plus précis en théorie
  mais le composant « alpha » (cap) dépend du magnétomètre, moins fiable et
  plus sujet à variations Android/iOS. Non nécessaire ici puisqu'on ne suit
  qu'un roulis autour de l'axe perpendiculaire à l'écran — l'accéléromètre
  seul y suffit et est plus simple à raisonner.

### Principe de calcul

Avec le téléphone vertical face à l'utilisateur, le vecteur de gravité se
répartit entre les axes X et Y du repère de l'appareil selon l'angle de
rotation autour de l'axe Z (perpendiculaire à l'écran, sortant vers
l'utilisateur). On calcule en continu :

```
angle = atan2(x, y)  // en radians, converti en degrés, normalisé sur [0, 360)
```

- Échantillonnage à ~60 Hz (`Accelerometer.setUpdateInterval(16)`).
- On ignore/filtre les échantillons où `|z|` est trop élevé (téléphone posé
  à plat ou fortement incliné vers l'avant/arrière) : le geste n'est
  fiable que si le téléphone reste raisonnablement vertical.
- Les valeurs exactes des seuils ci-dessous sont des points de départ à
  affiner empiriquement sur device réel pendant l'implémentation — ce n'est
  pas un contrat figé.

### Machine à états

États : `HAUT`, `BAS`, `TRANSITION`.

- Zone HAUT : angle dans `[-30°, +30°]` (autour de 0°).
- Zone BAS : angle dans `[150°, 210°]` (autour de 180°).
- Entre les deux : `TRANSITION`.

Règles :
1. Un changement d'état n'est confirmé que si l'angle reste stable dans la
   nouvelle zone pendant un court délai (~100–150 ms) — anti-rebond lié au
   bruit du capteur (hystérésis).
2. Le déclenchement du son n'a lieu que sur une transition confirmée
   `HAUT → BAS` ou `BAS → HAUT`, jamais en boucle depuis `TRANSITION`.
3. **Cooldown dynamique** : après un déclenchement, aucun nouveau
   déclenchement n'est possible tant que le son en cours de lecture n'est
   pas terminé. La durée du cooldown est donc égale à la durée réelle du
   fichier audio joué (récupérée via le statut de lecture `expo-av`,
   évènement `didJustFinish` ou durée du média une fois chargé), et non une
   constante arbitraire. Si l'utilisateur continue à faire tourner le
   téléphone pendant qu'un son joue, les transitions détectées pendant ce
   laps de temps sont ignorées (pas de mise en file d'attente).

Le hook expose :
- L'état courant (`HAUT` / `BAS` / `TRANSITION`) et l'angle brut, pour
  piloter l'animation de l'illustration en continu (pas seulement au
  moment du déclenchement).
- Un évènement de déclenchement (`onFlip: 'haut-vers-bas' | 'bas-vers-haut'`).

## 4. Structure du projet

```
boite-a-blek/
  app.config.ts            # nom, icônes, orientation verrouillée "portrait"
  App.tsx
  package.json
  tsconfig.json
  src/
    components/
      MainScreen.tsx        # illustration animée + icône réglages
      SettingsModal.tsx      # modale de paramètres (glissement depuis le bas)
      GearIcon.tsx            # ou usage direct de @expo/vector-icons
    hooks/
      useFlipDetector.ts      # lecture accéléromètre + machine à états
      useSettings.ts          # lecture/écriture AsyncStorage
    audio/
      soundPlayer.ts          # chargement/lecture des sons, config iOS silencieux
    constants/
      config.ts               # seuils d'angle, zones, délai de stabilisation
    types/
      index.ts
  assets/
    sounds/
      haut-vers-bas.<ext>      # fourni par l'utilisateur
      bas-vers-haut.<ext>      # fourni par l'utilisateur
    images/
      illustration.<ext>       # fournie par l'utilisateur
    icon.png, splash.png       # placeholders temporaires si non fournis
  docs/superpowers/specs/      # ce document et les suivants
```

## 5. Écrans et composants

### Écran principal (`MainScreen`)
- Illustration positionnée via `Animated.Value`, interpolée en continu à
  partir de l'angle mesuré par `useFlipDetector` (translation verticale
  fluide entre la position « haut » et la position « bas », pas un simple
  saut au moment du déclenchement).
- Icône de roue dentée (coin supérieur, `@expo/vector-icons`) ouvrant la
  modale de paramètres.

### Modale de paramètres (`SettingsModal`)
- Composant `Modal` natif React Native (`animationType="slide"`,
  `presentationStyle="pageSheet"` sur iOS) — pas de librairie de navigation.
- Contenu :
  - Interrupteur « Son au retour en position haute » (`Switch`).
  - Curseur de volume (0–100 %).
  - Interrupteur « Vibration » (retour haptique via `expo-haptics`).
  - Bouton de fermeture.
- Les changements sont persistés immédiatement (pas de bouton
  « enregistrer » séparé).

### Persistance (`useSettings`)
- `@react-native-async-storage/async-storage`.
- Clé unique JSON regroupant : `sonBasVersHautActif` (bool, défaut `true`),
  `volume` (0–1, défaut `1`), `vibrationActive` (bool, défaut `true`).
- Chargement au démarrage de l'app (état par défaut appliqué le temps du
  chargement asynchrone).

## 6. Audio et haptique

- Librairie `expo-av` pour la lecture (chargement des deux sons au
  démarrage pour éviter toute latence au déclenchement).
- Configuration audio (`Audio.setAudioModeAsync`) avec
  `playsInSilentModeIOS: true` : le son doit toujours jouer, même si le
  switch silencieux iOS est activé (comportement « jouet », pas
  « notification »).
- Le volume réglé dans les paramètres s'applique aux deux sons.
- Vibration : `expo-haptics` (`Haptics.impactAsync`) déclenchée en même
  temps que le son, si le réglage est activé — s'applique aux deux sons
  (haut→bas et bas→haut), la désactivation ne concerne que le son
  BAS → HAUT, pas la vibration.

## 7. Gestion des erreurs

- Capteur indisponible (rare : simulateur sans capteurs, device
  incompatible) : dégradation silencieuse, aucun crash ; un message
  discret peut informer que le geste n'est pas disponible sur cet
  appareil.
- Échec de chargement d'un fichier son (fichier manquant/corrompu) : erreur
  loguée en développement, l'app reste utilisable (réglages fonctionnels),
  pas de crash.
- Permissions : la lecture de l'accéléromètre ne nécessite pas de
  permission explicite via `expo-sensors` sur iOS/Android ; à revérifier
  lors de l'implémentation si le comportement diffère selon la version
  d'Expo utilisée.

## 8. Tests

- **Unitaires (Jest)** :
  - Machine à états de détection (`useFlipDetector` ou fonction pure
    extraite) : entrée = séquence d'angles simulés dans le temps, sortie =
    séquence d'évènements de déclenchement attendus. Ne nécessite pas de
    device réel.
  - Logique de paramètres (`useSettings`) avec `AsyncStorage` mocké.
- **Manuels (obligatoires avant toute mise en production)** :
  - Test sur device réel iOS et Android pour valider le ressenti du geste
    et ajuster les seuils d'angle / délai de stabilisation / cooldown.
  - Vérification du comportement en mode silencieux iOS.
  - Vérification de la fluidité de l'animation de l'illustration.

## 9. Build et distribution

- Projet Expo managé, TypeScript.
- `app.config.ts` : orientation verrouillée `portrait` (le concept ne
  fonctionne qu'à la verticale).
- EAS Build pour générer les binaires iOS (.ipa) et Android (.apk/.aab).
- Icône et splash screen : placeholders temporaires tant que l'utilisateur
  ne fournit pas ses propres assets graphiques (illustration, sons, icône
  d'app).

## 10. Éléments en attente (fournis par l'utilisateur avant/pendant l'implémentation)

- Fichier audio du son HAUT → BAS.
- Fichier audio du son BAS → HAUT.
- Illustration à animer sur l'écran principal.
- (Optionnel) Icône d'application et écran de démarrage personnalisés —
  sinon des placeholders temporaires seront utilisés.
