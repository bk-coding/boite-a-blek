# La Boîte à Blek — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'application mobile Expo/TypeScript « La Boîte à Blek », qui joue un son quand l'utilisateur fait pivoter le téléphone (vertical, écran face à lui) de haut en bas, et un autre son (désactivable) au retour de bas en haut, avec une illustration animée et un menu de paramètres.

**Architecture:** Une seule base de code Expo managé (iOS + Android). La détection du geste repose sur l'accéléromètre (`expo-sensors`) combiné à une machine à états pure et testable. L'app est structurée en modules isolés (logique de détection, audio, paramètres persistés, composants d'UI) assemblés dans `App.tsx`. Pas de librairie de navigation : un écran principal + une modale de paramètres.

**Tech Stack:** Expo (managed workflow), TypeScript, `expo-sensors`, `expo-av`, `expo-haptics`, `@react-native-async-storage/async-storage`, `@react-native-community/slider`, `@expo/vector-icons`, Jest + `jest-expo` + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-09-20-boite-a-blek-design.md`

## Global Constraints

- Détection du geste par accéléromètre uniquement (pas de magnétomètre/`DeviceMotion`), angle = `atan2(x, y)` normalisé sur `(-180, 180]`.
- Zones : HAUT = angle ∈ [-30°, 30°] ; BAS = |angle| ≥ 150° ; entre les deux = TRANSITION. Délai de stabilisation avant confirmation d'une transition : 120 ms. Ces valeurs sont des points de départ à affiner empiriquement sur device réel, pas un contrat figé.
- Cooldown après un déclenchement = durée réelle du fichier audio joué (dynamique, jamais une constante). Les transitions détectées pendant le cooldown sont ignorées, sans mise en file d'attente.
- L'animation de glissement de l'illustration démarre en même temps que le son et dure exactement la même durée que lui (même valeur que le cooldown).
- Le son BAS → HAUT est désactivable indépendamment dans les paramètres ; le son HAUT → BAS reste toujours actif. **Décision de conception (résout une ambiguïté de la spec) :** quand le son BAS → HAUT est désactivé, le fichier reste chargé et sa durée connue continue de piloter l'animation et le cooldown — seule la lecture audio elle-même est court-circuitée.
- La vibration (réglage indépendant) s'applique aux deux sens de rotation et n'est pas affectée par la désactivation du son BAS → HAUT.
- Lecture audio forcée même en mode silencieux iOS (`playsInSilentModeIOS: true`).
- Un seul écran principal + une modale de paramètres native (`Modal`), pas de librairie de navigation.
- Application verrouillée en orientation `portrait`.
- Paramètres persistés localement (`AsyncStorage`), pas de backend, pas de compte utilisateur.

---

### Task 1: Scaffolding du projet Expo (TypeScript) + outillage de test

**Files:**
- Create (générés par la CLI puis déplacés) : `package.json`, `tsconfig.json`, `babel.config.js`, `App.tsx`, `.gitignore`
- Modify: `package.json` (ajout du script `test` et de la config `jest`)
- Test: `src/__tests__/sanity.test.ts`

**Interfaces:**
- Produces: un projet Expo TypeScript exécutable (`npx expo start`) et un runner de tests (`npm test`) fonctionnels, utilisés par toutes les tâches suivantes.

- [ ] **Step 1: Scaffolder le projet dans un dossier temporaire puis le fusionner**

```bash
TMP_DIR=$(mktemp -d)
npx create-expo-app@latest "$TMP_DIR" --template blank-typescript
rsync -a --exclude='.git' "$TMP_DIR"/ /Users/bastien/Developpement/boite-a-blek/
rm -rf "$TMP_DIR"
```

Si des invites interactives apparaissent pendant `create-expo-app`, accepter les valeurs par défaut.

- [ ] **Step 2: Installer les dépendances runtime du projet**

```bash
cd /Users/bastien/Developpement/boite-a-blek
npx expo install expo-sensors expo-av expo-haptics @react-native-async-storage/async-storage @react-native-community/slider
```

- [ ] **Step 3: Installer l'outillage de test**

```bash
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest
```

- [ ] **Step 4: Ajouter le script `test` et la config Jest dans `package.json`**

Éditer `package.json` pour ajouter (en conservant les scripts existants `start`/`android`/`ios`/`web`) :

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 5: Écrire un test de sanité**

Créer `src/__tests__/sanity.test.ts` :

```typescript
test('jest-expo est correctement configuré', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Vérifier que TypeScript compile et que les tests passent**

```bash
npx tsc --noEmit
npm test
```

Attendu : `tsc` ne remonte aucune erreur, `npm test` affiche 1 test réussi.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold du projet Expo TypeScript + outillage de test"
```

---

### Task 2: Génération des assets placeholders

**Files:**
- Create: `scripts/assetGenerators.js`
- Create: `scripts/assetGenerators.test.js`
- Create: `scripts/generate-placeholder-assets.js`
- Create (générés par le script) : `assets/images/illustration.png`, `assets/icon.png`, `assets/splash.png`, `assets/sounds/haut-vers-bas.wav`, `assets/sounds/bas-vers-haut.wav`

**Interfaces:**
- Produces: `makeSolidPng(width, height, [r,g,b]) -> Buffer`, `makeToneWav(durationSeconds, frequencyHz) -> Buffer`, utilisées uniquement par le script de génération (le reste de l'app consomme les fichiers via `require()`).

Ces fichiers sont des **placeholders temporaires**. L'utilisateur remplacera plus tard `assets/images/illustration.png`, `assets/sounds/haut-vers-bas.wav` et `assets/sounds/bas-vers-haut.wav` par ses propres fichiers (mêmes noms/emplacements ; si l'extension change, mettre à jour les `require()` dans `src/audio/soundPlayer.ts` et `App.tsx`).

- [ ] **Step 1: Écrire les tests des générateurs**

Créer `scripts/assetGenerators.test.js` :

```javascript
const { makeSolidPng, makeToneWav } = require('./assetGenerators');

describe('makeSolidPng', () => {
  test('produit un PNG valide avec les bonnes dimensions', () => {
    const buf = makeSolidPng(64, 32, [255, 0, 0]);
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(buf.subarray(0, 8)).toEqual(pngSignature);
    expect(buf.readUInt32BE(16)).toBe(64); // largeur (IHDR)
    expect(buf.readUInt32BE(20)).toBe(32); // hauteur (IHDR)
  });
});

describe('makeToneWav', () => {
  test('produit un WAV avec la bonne durée et le bon en-tête', () => {
    const buf = makeToneWav(0.5, 440);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    const sampleRate = 44100;
    const expectedSamples = Math.floor(sampleRate * 0.5);
    expect(buf.length).toBe(44 + expectedSamples * 2);
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- scripts/assetGenerators.test.js
```

Attendu : FAIL avec « Cannot find module './assetGenerators' ».

- [ ] **Step 3: Implémenter les générateurs**

Créer `scripts/assetGenerators.js` :

```javascript
const zlib = require('zlib');

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makeSolidPng(width, height, rgb) {
  const [r, g, b] = rgb;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // pas de filtre
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeToneWav(durationSeconds, frequencyHz) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2; // 16 bits mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const fadeSamples = Math.floor(sampleRate * 0.01); // 10 ms fade in/out
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, Math.min(i, numSamples - i) / fadeSamples);
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * 0.5;
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

module.exports = { makeSolidPng, makeToneWav };
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- scripts/assetGenerators.test.js
```

Attendu : PASS (2 tests).

- [ ] **Step 5: Écrire le script de génération des fichiers**

Créer `scripts/generate-placeholder-assets.js` :

```javascript
const fs = require('fs');
const path = require('path');
const { makeSolidPng, makeToneWav } = require('./assetGenerators');

const ROOT = path.join(__dirname, '..');

function writeFile(relativePath, buffer) {
  const fullPath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  console.log(`Écrit : ${relativePath} (${buffer.length} octets)`);
}

const BLEK_ORANGE = [255, 176, 59];

writeFile('assets/images/illustration.png', makeSolidPng(400, 400, BLEK_ORANGE));
writeFile('assets/icon.png', makeSolidPng(1024, 1024, BLEK_ORANGE));
writeFile('assets/splash.png', makeSolidPng(1284, 2778, BLEK_ORANGE));
writeFile('assets/sounds/haut-vers-bas.wav', makeToneWav(0.6, 440));
writeFile('assets/sounds/bas-vers-haut.wav', makeToneWav(0.6, 660));
```

- [ ] **Step 6: Exécuter le script et vérifier les fichiers produits**

```bash
node scripts/generate-placeholder-assets.js
ls -la assets/images assets/sounds
```

Attendu : les 5 fichiers listés existent avec une taille > 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: génère des assets placeholders (illustration, icônes, sons)"
```

---

### Task 3: Machine à états de détection du geste

**Files:**
- Create: `src/constants/config.ts`
- Create: `src/logic/flipStateMachine.ts`
- Test: `src/logic/flipStateMachine.test.ts`

**Interfaces:**
- Produces: `FlipZone = 'HAUT' | 'BAS' | 'TRANSITION'`, `FlipEvent = 'haut-vers-bas' | 'bas-vers-haut' | null`, `FlipStateMachineState`, `createInitialFlipState(initialZone: 'HAUT' | 'BAS'): FlipStateMachineState`, `stepFlipStateMachine(state, angleDeg: number, timestampMs: number, config: FlipStateMachineConfig): { state: FlipStateMachineState; event: FlipEvent }`, `FLIP_CONFIG` (depuis `src/constants/config.ts`). Consommé par la Task 4.

- [ ] **Step 1: Créer le fichier de constantes**

Créer `src/constants/config.ts` :

```typescript
export const FLIP_CONFIG = {
  hautMinDeg: -30,
  hautMaxDeg: 30,
  basThresholdDeg: 150,
  stabilizationMs: 120,
};

export const ACCELEROMETER_UPDATE_INTERVAL_MS = 16;
```

- [ ] **Step 2: Écrire les tests de la machine à états**

Créer `src/logic/flipStateMachine.test.ts` :

```typescript
import {
  classifyAngle,
  createInitialFlipState,
  stepFlipStateMachine,
  FlipStateMachineConfig,
} from './flipStateMachine';

const CONFIG: FlipStateMachineConfig = {
  hautMinDeg: -30,
  hautMaxDeg: 30,
  basThresholdDeg: 150,
  stabilizationMs: 120,
};

describe('classifyAngle', () => {
  test('0° est classé HAUT', () => {
    expect(classifyAngle(0, CONFIG)).toBe('HAUT');
  });

  test('180° est classé BAS', () => {
    expect(classifyAngle(180, CONFIG)).toBe('BAS');
  });

  test('-180° est classé BAS', () => {
    expect(classifyAngle(-180, CONFIG)).toBe('BAS');
  });

  test('90° est classé TRANSITION', () => {
    expect(classifyAngle(90, CONFIG)).toBe('TRANSITION');
  });
});

describe('stepFlipStateMachine', () => {
  test('reste stable sans évènement tant que HAUT est confirmé', () => {
    let state = createInitialFlipState('HAUT');
    const result = stepFlipStateMachine(state, 5, 0, CONFIG);
    expect(result.event).toBeNull();
    expect(result.state.confirmedZone).toBe('HAUT');
  });

  test('confirme HAUT -> BAS après le délai de stabilisation', () => {
    let state = createInitialFlipState('HAUT');
    let result = stepFlipStateMachine(state, 180, 0, CONFIG);
    expect(result.event).toBeNull(); // pas encore stabilisé
    state = result.state;

    result = stepFlipStateMachine(state, 180, 100, CONFIG);
    expect(result.event).toBeNull(); // 100ms < 120ms
    state = result.state;

    result = stepFlipStateMachine(state, 180, 130, CONFIG);
    expect(result.event).toBe('haut-vers-bas'); // 130ms >= 120ms
    expect(result.state.confirmedZone).toBe('BAS');
  });

  test('un rebond en TRANSITION annule la stabilisation en cours', () => {
    let state = createInitialFlipState('HAUT');

    let result = stepFlipStateMachine(state, 180, 0, CONFIG); // candidat BAS démarre à t=0
    state = result.state;

    result = stepFlipStateMachine(state, 90, 50, CONFIG); // rebond en TRANSITION -> annule
    expect(result.event).toBeNull();
    state = result.state;

    result = stepFlipStateMachine(state, 180, 60, CONFIG); // candidat BAS redémarre à t=60
    state = result.state;

    result = stepFlipStateMachine(state, 180, 170, CONFIG); // 170-60=110ms < 120ms
    expect(result.event).toBeNull();
    state = result.state;

    result = stepFlipStateMachine(state, 180, 190, CONFIG); // 190-60=130ms >= 120ms
    expect(result.event).toBe('haut-vers-bas');
  });

  test('confirme BAS -> HAUT après une première transition HAUT -> BAS', () => {
    let state = createInitialFlipState('HAUT');
    let result = stepFlipStateMachine(state, 180, 0, CONFIG);
    state = result.state;
    result = stepFlipStateMachine(state, 180, 130, CONFIG);
    expect(result.event).toBe('haut-vers-bas');
    state = result.state;

    result = stepFlipStateMachine(state, 0, 200, CONFIG);
    state = result.state;
    result = stepFlipStateMachine(state, 0, 330, CONFIG); // 330-200=130ms >= 120ms
    expect(result.event).toBe('bas-vers-haut');
  });
});
```

- [ ] **Step 3: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- src/logic/flipStateMachine.test.ts
```

Attendu : FAIL avec « Cannot find module './flipStateMachine' ».

- [ ] **Step 4: Implémenter la machine à états**

Créer `src/logic/flipStateMachine.ts` :

```typescript
export type FlipZone = 'HAUT' | 'BAS' | 'TRANSITION';
export type FlipEvent = 'haut-vers-bas' | 'bas-vers-haut' | null;

export interface FlipStateMachineConfig {
  hautMinDeg: number;
  hautMaxDeg: number;
  basThresholdDeg: number;
  stabilizationMs: number;
}

export interface FlipStateMachineState {
  zone: FlipZone;
  candidateZone: 'HAUT' | 'BAS' | null;
  candidateSinceMs: number | null;
  confirmedZone: 'HAUT' | 'BAS';
}

export function createInitialFlipState(
  initialZone: 'HAUT' | 'BAS' = 'HAUT'
): FlipStateMachineState {
  return {
    zone: initialZone,
    candidateZone: null,
    candidateSinceMs: null,
    confirmedZone: initialZone,
  };
}

function normalizeAngle(angleDeg: number): number {
  let a = angleDeg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

export function classifyAngle(angleDeg: number, config: FlipStateMachineConfig): FlipZone {
  const a = normalizeAngle(angleDeg);
  if (a >= config.hautMinDeg && a <= config.hautMaxDeg) {
    return 'HAUT';
  }
  if (Math.abs(a) >= config.basThresholdDeg) {
    return 'BAS';
  }
  return 'TRANSITION';
}

export function stepFlipStateMachine(
  state: FlipStateMachineState,
  angleDeg: number,
  timestampMs: number,
  config: FlipStateMachineConfig
): { state: FlipStateMachineState; event: FlipEvent } {
  const instantZone = classifyAngle(angleDeg, config);
  let { candidateZone, candidateSinceMs, confirmedZone } = state;
  let event: FlipEvent = null;

  const isOppositeZone =
    (instantZone === 'HAUT' || instantZone === 'BAS') && instantZone !== confirmedZone;

  if (isOppositeZone) {
    if (candidateZone !== instantZone) {
      candidateZone = instantZone;
      candidateSinceMs = timestampMs;
    } else if (
      candidateSinceMs !== null &&
      timestampMs - candidateSinceMs >= config.stabilizationMs
    ) {
      event = confirmedZone === 'HAUT' ? 'haut-vers-bas' : 'bas-vers-haut';
      confirmedZone = instantZone;
      candidateZone = null;
      candidateSinceMs = null;
    }
  } else {
    candidateZone = null;
    candidateSinceMs = null;
  }

  return {
    state: { zone: instantZone, candidateZone, candidateSinceMs, confirmedZone },
    event,
  };
}
```

- [ ] **Step 5: Vérifier que les tests passent**

```bash
npm test -- src/logic/flipStateMachine.test.ts
```

Attendu : PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: machine à états pure pour la détection du geste de retournement"
```

---

### Task 4: Hook `useFlipDetector` (accéléromètre + machine à états + cooldown)

**Files:**
- Create: `src/hooks/useFlipDetector.ts`
- Test: `src/hooks/useFlipDetector.test.tsx`

**Interfaces:**
- Consumes: `createInitialFlipState`, `stepFlipStateMachine`, `FlipZone` (Task 3), `FLIP_CONFIG`, `ACCELEROMETER_UPDATE_INTERVAL_MS` (Task 3).
- Produces: `useFlipDetector(onFlip: (event: 'haut-vers-bas' | 'bas-vers-haut') => void): { zone: FlipZone; notifyPlaybackStarted: (durationMs: number) => void }`. Consommé par la Task 9.

- [ ] **Step 1: Écrire le test du hook avec un accéléromètre simulé**

Créer `src/hooks/useFlipDetector.test.tsx` :

```typescript
import { renderHook, act } from '@testing-library/react-native';

jest.mock('expo-sensors', () => {
  let listener: ((data: { x: number; y: number; z: number }) => void) | null = null;
  return {
    Accelerometer: {
      setUpdateInterval: jest.fn(),
      addListener: jest.fn((cb: (data: { x: number; y: number; z: number }) => void) => {
        listener = cb;
        return { remove: jest.fn() };
      }),
      __emit: (data: { x: number; y: number; z: number }) => {
        if (listener) listener(data);
      },
    },
  };
});

import { Accelerometer } from 'expo-sensors';
import { useFlipDetector } from './useFlipDetector';

const emit = (Accelerometer as unknown as { __emit: (d: { x: number; y: number; z: number }) => void }).__emit;

const HAUT_SAMPLE = { x: 0, y: 1, z: 0 };
const BAS_SAMPLE = { x: 0, y: -1, z: 0 };

describe('useFlipDetector', () => {
  let now = 0;

  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('déclenche haut-vers-bas après stabilisation', () => {
    const onFlip = jest.fn();
    renderHook(() => useFlipDetector(onFlip));

    act(() => {
      now = 0;
      emit(BAS_SAMPLE);
    });
    expect(onFlip).not.toHaveBeenCalled();

    act(() => {
      now = 130;
      emit(BAS_SAMPLE);
    });
    expect(onFlip).toHaveBeenCalledWith('haut-vers-bas');
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  test('ignore les transitions détectées pendant le cooldown de lecture', () => {
    const onFlip = jest.fn();
    const { result } = renderHook(() => useFlipDetector(onFlip));

    act(() => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });
    expect(onFlip).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.notifyPlaybackStarted(600); // busy jusqu'à now=730
    });

    act(() => {
      now = 200;
      emit(HAUT_SAMPLE);
      now = 330;
      emit(HAUT_SAMPLE); // stabilisé, mais encore dans le cooldown (330 < 730)
    });
    expect(onFlip).toHaveBeenCalledTimes(1); // toujours 1, l'évènement a été ignoré

    act(() => {
      now = 800;
      emit(BAS_SAMPLE);
      now = 930;
      emit(BAS_SAMPLE); // cooldown terminé, nouvelle transition acceptée
    });
    expect(onFlip).toHaveBeenCalledTimes(2);
    expect(onFlip).toHaveBeenLastCalledWith('haut-vers-bas');
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- src/hooks/useFlipDetector.test.tsx
```

Attendu : FAIL avec « Cannot find module './useFlipDetector' ».

- [ ] **Step 3: Implémenter le hook**

Créer `src/hooks/useFlipDetector.ts` :

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import {
  createInitialFlipState,
  stepFlipStateMachine,
  FlipStateMachineState,
  FlipZone,
} from '../logic/flipStateMachine';
import { FLIP_CONFIG, ACCELEROMETER_UPDATE_INTERVAL_MS } from '../constants/config';

export type FlipEventType = 'haut-vers-bas' | 'bas-vers-haut';

export interface UseFlipDetectorResult {
  zone: FlipZone;
  notifyPlaybackStarted: (durationMs: number) => void;
}

export function useFlipDetector(
  onFlip: (event: FlipEventType) => void
): UseFlipDetectorResult {
  const machineStateRef = useRef<FlipStateMachineState>(createInitialFlipState('HAUT'));
  const busyUntilMsRef = useRef<number>(0);
  const onFlipRef = useRef(onFlip);
  onFlipRef.current = onFlip;
  const [zone, setZone] = useState<FlipZone>('HAUT');

  useEffect(() => {
    Accelerometer.setUpdateInterval(ACCELEROMETER_UPDATE_INTERVAL_MS);
    const subscription = Accelerometer.addListener(({ x, y }) => {
      const angleDeg = (Math.atan2(x, y) * 180) / Math.PI;
      const timestampMs = Date.now();
      const { state: nextState, event } = stepFlipStateMachine(
        machineStateRef.current,
        angleDeg,
        timestampMs,
        FLIP_CONFIG
      );
      machineStateRef.current = nextState;
      setZone(nextState.zone);

      if (event && timestampMs >= busyUntilMsRef.current) {
        onFlipRef.current(event);
      }
    });

    return () => subscription.remove();
  }, []);

  const notifyPlaybackStarted = useCallback((durationMs: number) => {
    busyUntilMsRef.current = Date.now() + durationMs;
  }, []);

  return { zone, notifyPlaybackStarted };
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- src/hooks/useFlipDetector.test.tsx
```

Attendu : PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: hook useFlipDetector (accéléromètre + cooldown de lecture)"
```

---

### Task 5: Hook `useSettings` (paramètres persistés)

**Files:**
- Create: `src/hooks/useSettings.ts`
- Test: `src/hooks/useSettings.test.tsx`

**Interfaces:**
- Produces: `interface Settings { sonBasVersHautActif: boolean; volume: number; vibrationActive: boolean }`, `DEFAULT_SETTINGS: Settings`, `useSettings(): { settings: Settings; isLoaded: boolean; updateSettings: (patch: Partial<Settings>) => void }`. Consommé par les Tasks 8 et 9.

- [ ] **Step 1: Écrire les tests**

Créer `src/hooks/useSettings.test.tsx` :

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSettings, DEFAULT_SETTINGS } from './useSettings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('useSettings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('retourne les valeurs par défaut puis isLoaded passe à true', async () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
  });

  test('persiste les modifications et les recharge au prochain montage', async () => {
    const { result, unmount } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.updateSettings({ sonBasVersHautActif: false, volume: 0.4 });
    });

    await waitFor(() =>
      expect(result.current.settings).toEqual({
        ...DEFAULT_SETTINGS,
        sonBasVersHautActif: false,
        volume: 0.4,
      })
    );

    unmount();

    const { result: secondResult } = renderHook(() => useSettings());
    await waitFor(() => expect(secondResult.current.isLoaded).toBe(true));
    expect(secondResult.current.settings).toEqual({
      ...DEFAULT_SETTINGS,
      sonBasVersHautActif: false,
      volume: 0.4,
    });
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- src/hooks/useSettings.test.tsx
```

Attendu : FAIL avec « Cannot find module './useSettings' ».

- [ ] **Step 3: Implémenter le hook**

Créer `src/hooks/useSettings.ts` :

```typescript
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  sonBasVersHautActif: boolean;
  volume: number;
  vibrationActive: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sonBasVersHautActif: true,
  volume: 1,
  vibrationActive: true,
};

const STORAGE_KEY = '@boite-a-blek/settings';

export interface UseSettingsResult {
  settings: Settings;
  isLoaded: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!isMounted) return;
      if (raw) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
        } catch {
          setSettings(DEFAULT_SETTINGS);
        }
      }
      setIsLoaded(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, isLoaded, updateSettings };
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- src/hooks/useSettings.test.tsx
```

Attendu : PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: hook useSettings avec persistance AsyncStorage"
```

---

### Task 6: Module `soundPlayer`

**Files:**
- Create: `src/audio/soundPlayer.ts`
- Test: `src/audio/soundPlayer.test.ts`

**Interfaces:**
- Produces: `type SoundKey = 'hautVersBas' | 'basVersHaut'`, `createSoundPlayer(): { loadAll(): Promise<void>; getDurationMs(key: SoundKey): number; play(key: SoundKey, volume: number): Promise<void>; unloadAll(): Promise<void> }`. Consommé par la Task 9.
- Consumes: fichiers `assets/sounds/haut-vers-bas.wav` et `assets/sounds/bas-vers-haut.wav` (Task 2).

- [ ] **Step 1: Écrire les tests avec `expo-av` simulé**

Créer `src/audio/soundPlayer.test.ts` :

```typescript
jest.mock('expo-av', () => {
  const mockSound = {
    setVolumeAsync: jest.fn(() => Promise.resolve()),
    setPositionAsync: jest.fn(() => Promise.resolve()),
    playAsync: jest.fn(() => Promise.resolve()),
    unloadAsync: jest.fn(() => Promise.resolve()),
  };
  return {
    Audio: {
      setAudioModeAsync: jest.fn(() => Promise.resolve()),
      Sound: {
        createAsync: jest.fn(() =>
          Promise.resolve({
            sound: mockSound,
            status: { isLoaded: true, durationMillis: 650 },
          })
        ),
      },
    },
    __mockSound: mockSound,
  };
});

import { Audio } from 'expo-av';
import { createSoundPlayer } from './soundPlayer';

describe('soundPlayer', () => {
  test('loadAll configure le mode audio et charge les deux sons', async () => {
    const player = createSoundPlayer();
    await player.loadAll();

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentModeIOS: true });
    expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(2);
    expect(player.getDurationMs('hautVersBas')).toBe(650);
    expect(player.getDurationMs('basVersHaut')).toBe(650);
  });

  test('play règle le volume et lance la lecture depuis le début', async () => {
    const player = createSoundPlayer();
    await player.loadAll();
    const mockSound = (Audio as unknown as { __mockSound: any }).__mockSound;

    await player.play('hautVersBas', 0.75);

    expect(mockSound.setVolumeAsync).toHaveBeenCalledWith(0.75);
    expect(mockSound.setPositionAsync).toHaveBeenCalledWith(0);
    expect(mockSound.playAsync).toHaveBeenCalledTimes(1);
  });

  test('play rejette si le son demandé n’a pas été chargé', async () => {
    const player = createSoundPlayer();
    await expect(player.play('hautVersBas', 1)).rejects.toThrow('Son non chargé');
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- src/audio/soundPlayer.test.ts
```

Attendu : FAIL avec « Cannot find module './soundPlayer' ».

- [ ] **Step 3: Implémenter le module**

Créer `src/audio/soundPlayer.ts` :

```typescript
import { Audio } from 'expo-av';

export type SoundKey = 'hautVersBas' | 'basVersHaut';

const SOUND_SOURCES: Record<SoundKey, number> = {
  hautVersBas: require('../../assets/sounds/haut-vers-bas.wav'),
  basVersHaut: require('../../assets/sounds/bas-vers-haut.wav'),
};

export interface SoundPlayer {
  loadAll(): Promise<void>;
  getDurationMs(key: SoundKey): number;
  play(key: SoundKey, volume: number): Promise<void>;
  unloadAll(): Promise<void>;
}

export function createSoundPlayer(): SoundPlayer {
  const sounds: Partial<Record<SoundKey, Audio.Sound>> = {};
  const durations: Partial<Record<SoundKey, number>> = {};

  async function loadAll(): Promise<void> {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    for (const key of Object.keys(SOUND_SOURCES) as SoundKey[]) {
      const { sound, status } = await Audio.Sound.createAsync(SOUND_SOURCES[key]);
      sounds[key] = sound;
      durations[key] =
        status.isLoaded && status.durationMillis ? status.durationMillis : 0;
    }
  }

  function getDurationMs(key: SoundKey): number {
    return durations[key] ?? 0;
  }

  async function play(key: SoundKey, volume: number): Promise<void> {
    const sound = sounds[key];
    if (!sound) {
      throw new Error(`Son non chargé : ${key}`);
    }
    await sound.setVolumeAsync(volume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  }

  async function unloadAll(): Promise<void> {
    for (const key of Object.keys(sounds) as SoundKey[]) {
      await sounds[key]?.unloadAsync();
      delete sounds[key];
    }
  }

  return { loadAll, getDurationMs, play, unloadAll };
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- src/audio/soundPlayer.test.ts
```

Attendu : PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: module soundPlayer (chargement et lecture audio via expo-av)"
```

---

### Task 7: Composant `MainScreen`

**Files:**
- Modify: `src/constants/config.ts` (ajout de `ILLUSTRATION_TRAVEL_DISTANCE`)
- Create: `src/components/MainScreen.tsx`
- Test: `src/components/MainScreen.test.tsx`

**Interfaces:**
- Consumes: `FlipZone` (Task 3).
- Produces: `interface FlipAnimationTrigger { id: number; toZone: 'HAUT' | 'BAS'; durationMs: number }`, `MainScreen(props: { illustrationSource: ImageSourcePropType; initialZone: FlipZone; flipTrigger: FlipAnimationTrigger | null; onOpenSettings: () => void })`. Consommé par la Task 9.

- [ ] **Step 1: Ajouter la constante de distance de glissement**

Modifier `src/constants/config.ts` en ajoutant à la fin :

```typescript
export const ILLUSTRATION_TRAVEL_DISTANCE = 200;
```

- [ ] **Step 2: Écrire les tests du composant**

Créer `src/components/MainScreen.test.tsx` :

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MainScreen } from './MainScreen';

const dummySource = { uri: 'test' };

describe('MainScreen', () => {
  test('appelle onOpenSettings au clic sur la roue dentée', () => {
    const onOpenSettings = jest.fn();
    const { getByTestId } = render(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={null}
        onOpenSettings={onOpenSettings}
      />
    );

    fireEvent.press(getByTestId('settings-button'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test('affiche l’illustration sans planter au changement de flipTrigger', () => {
    const { getByTestId, rerender } = render(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={null}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();

    rerender(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 500 }}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();

    // Rejouer le même id ne doit pas provoquer d'erreur (pas de re-déclenchement).
    rerender(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 500 }}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- src/components/MainScreen.test.tsx
```

Attendu : FAIL avec « Cannot find module './MainScreen' ».

- [ ] **Step 4: Implémenter le composant**

Créer `src/components/MainScreen.tsx` :

```typescript
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ILLUSTRATION_TRAVEL_DISTANCE } from '../constants/config';
import { FlipZone } from '../logic/flipStateMachine';

export interface FlipAnimationTrigger {
  id: number;
  toZone: 'HAUT' | 'BAS';
  durationMs: number;
}

export interface MainScreenProps {
  illustrationSource: ImageSourcePropType;
  initialZone: FlipZone;
  flipTrigger: FlipAnimationTrigger | null;
  onOpenSettings: () => void;
}

function zoneToTranslateY(zone: 'HAUT' | 'BAS'): number {
  return zone === 'HAUT' ? 0 : ILLUSTRATION_TRAVEL_DISTANCE;
}

export function MainScreen({
  illustrationSource,
  initialZone,
  flipTrigger,
  onOpenSettings,
}: MainScreenProps) {
  const translateY = useRef(
    new Animated.Value(zoneToTranslateY(initialZone === 'BAS' ? 'BAS' : 'HAUT'))
  ).current;
  const lastTriggerId = useRef<number | null>(null);

  useEffect(() => {
    if (!flipTrigger || flipTrigger.id === lastTriggerId.current) {
      return;
    }
    lastTriggerId.current = flipTrigger.id;
    Animated.timing(translateY, {
      toValue: zoneToTranslateY(flipTrigger.toZone),
      duration: flipTrigger.durationMs,
      useNativeDriver: true,
    }).start();
  }, [flipTrigger, translateY]);

  return (
    <View style={styles.container} testID="main-screen">
      <Animated.Image
        testID="illustration"
        source={illustrationSource}
        style={[styles.illustration, { transform: [{ translateY }] }]}
        resizeMode="contain"
      />
      <Pressable
        testID="settings-button"
        onPress={onOpenSettings}
        style={styles.settingsButton}
      >
        <Ionicons name="settings-outline" size={32} color="#333" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  illustration: { width: 200, height: 200 },
  settingsButton: { position: 'absolute', top: 48, right: 24 },
});
```

- [ ] **Step 5: Vérifier que les tests passent**

```bash
npm test -- src/components/MainScreen.test.tsx
```

Attendu : PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: composant MainScreen avec illustration animée"
```

---

### Task 8: Composant `SettingsModal`

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Test: `src/components/SettingsModal.test.tsx`

**Interfaces:**
- Consumes: `Settings`, `DEFAULT_SETTINGS` (Task 5).
- Produces: `SettingsModal(props: { visible: boolean; settings: Settings; onChangeSettings: (patch: Partial<Settings>) => void; onClose: () => void })`. Consommé par la Task 9.

- [ ] **Step 1: Écrire les tests**

Créer `src/components/SettingsModal.test.tsx` :

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsModal } from './SettingsModal';
import { DEFAULT_SETTINGS } from '../hooks/useSettings';

jest.mock('@react-native-community/slider', () => {
  const ReactActual = require('react');
  return (props: any) => ReactActual.createElement('Slider', props);
});

describe('SettingsModal', () => {
  test('bascule le son bas-vers-haut', () => {
    const onChangeSettings = jest.fn();
    const { getByTestId } = render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={onChangeSettings}
        onClose={() => {}}
      />
    );

    fireEvent(getByTestId('switch-son-bas-vers-haut'), 'valueChange', false);

    expect(onChangeSettings).toHaveBeenCalledWith({ sonBasVersHautActif: false });
  });

  test('bascule la vibration', () => {
    const onChangeSettings = jest.fn();
    const { getByTestId } = render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={onChangeSettings}
        onClose={() => {}}
      />
    );

    fireEvent(getByTestId('switch-vibration'), 'valueChange', false);

    expect(onChangeSettings).toHaveBeenCalledWith({ vibrationActive: false });
  });

  test('change le volume via le curseur', () => {
    const onChangeSettings = jest.fn();
    const { getByTestId } = render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={onChangeSettings}
        onClose={() => {}}
      />
    );

    fireEvent(getByTestId('slider-volume'), 'slidingComplete', 0.3);

    expect(onChangeSettings).toHaveBeenCalledWith({ volume: 0.3 });
  });

  test('ferme la modale', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={() => {}}
        onClose={onClose}
      />
    );

    fireEvent.press(getByTestId('close-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- src/components/SettingsModal.test.tsx
```

Attendu : FAIL avec « Cannot find module './SettingsModal' ».

- [ ] **Step 3: Implémenter le composant**

Créer `src/components/SettingsModal.tsx` :

```typescript
import React from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings } from '../hooks/useSettings';

export interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  onChangeSettings: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsModal({
  visible,
  settings,
  onChangeSettings,
  onClose,
}: SettingsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Paramètres</Text>

        <View style={styles.row}>
          <Text>Son au retour en position haute</Text>
          <Switch
            testID="switch-son-bas-vers-haut"
            value={settings.sonBasVersHautActif}
            onValueChange={(value) => onChangeSettings({ sonBasVersHautActif: value })}
          />
        </View>

        <View style={styles.row}>
          <Text>Volume</Text>
          <Slider
            testID="slider-volume"
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={settings.volume}
            onSlidingComplete={(value: number) => onChangeSettings({ volume: value })}
          />
        </View>

        <View style={styles.row}>
          <Text>Vibration</Text>
          <Switch
            testID="switch-vibration"
            value={settings.vibrationActive}
            onValueChange={(value) => onChangeSettings({ vibrationActive: value })}
          />
        </View>

        <Pressable testID="close-button" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Fermer</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  slider: { width: 160 },
  closeButton: { marginTop: 'auto', alignSelf: 'center', padding: 12 },
  closeButtonText: { fontSize: 16, fontWeight: '500' },
});
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- src/components/SettingsModal.test.tsx
```

Attendu : PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: composant SettingsModal (son, volume, vibration)"
```

---

### Task 9: Assemblage `App.tsx`

**Files:**
- Modify: `App.tsx`
- Test: `App.test.tsx`

**Interfaces:**
- Consumes: `useFlipDetector` (Task 4), `useSettings`, `DEFAULT_SETTINGS` (Task 5), `createSoundPlayer` (Task 6), `MainScreen`, `FlipAnimationTrigger` (Task 7), `SettingsModal` (Task 8).

- [ ] **Step 1: Écrire le test d'assemblage**

Créer `App.test.tsx` :

```typescript
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/slider', () => {
  const ReactActual = require('react');
  return (props: any) => ReactActual.createElement('Slider', props);
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('expo-av', () => {
  const mockSound = {
    setVolumeAsync: jest.fn(() => Promise.resolve()),
    setPositionAsync: jest.fn(() => Promise.resolve()),
    playAsync: jest.fn(() => Promise.resolve()),
    unloadAsync: jest.fn(() => Promise.resolve()),
  };
  return {
    Audio: {
      setAudioModeAsync: jest.fn(() => Promise.resolve()),
      Sound: {
        createAsync: jest.fn(() =>
          Promise.resolve({ sound: mockSound, status: { isLoaded: true, durationMillis: 600 } })
        ),
      },
    },
    __mockSound: mockSound,
  };
});

jest.mock('expo-sensors', () => {
  let listener: ((data: { x: number; y: number; z: number }) => void) | null = null;
  return {
    Accelerometer: {
      setUpdateInterval: jest.fn(),
      addListener: jest.fn((cb: (data: { x: number; y: number; z: number }) => void) => {
        listener = cb;
        return { remove: jest.fn() };
      }),
      __emit: (data: { x: number; y: number; z: number }) => {
        if (listener) listener(data);
      },
    },
  };
});

import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import App from './App';

const emit = (Accelerometer as unknown as { __emit: (d: { x: number; y: number; z: number }) => void }).__emit;
const HAUT_SAMPLE = { x: 0, y: 1, z: 0 };
const BAS_SAMPLE = { x: 0, y: -1, z: 0 };

describe('App', () => {
  let now = 0;

  beforeEach(async () => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('joue le son et vibre sur un flip haut-vers-bas', async () => {
    render(<App />);
    await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(2));

    const mockSound = (Audio as unknown as { __mockSound: any }).__mockSound;

    act(() => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });

    await waitFor(() => expect(mockSound.playAsync).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test('ne joue pas le son bas-vers-haut si désactivé, mais vibre quand même', async () => {
    await AsyncStorage.setItem(
      '@boite-a-blek/settings',
      JSON.stringify({ sonBasVersHautActif: false, volume: 1, vibrationActive: true })
    );

    render(<App />);
    await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(2));

    const mockSound = (Audio as unknown as { __mockSound: any }).__mockSound;

    // haut-vers-bas d'abord (toujours actif)
    act(() => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });
    await waitFor(() => expect(mockSound.playAsync).toHaveBeenCalledTimes(1));

    // puis bas-vers-haut (désactivé)
    act(() => {
      now = 800;
      emit(HAUT_SAMPLE);
      now = 930;
      emit(HAUT_SAMPLE);
    });

    await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalledTimes(2));
    expect(mockSound.playAsync).toHaveBeenCalledTimes(1); // pas de second appel
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
npm test -- App.test.tsx
```

Attendu : FAIL (le `App.tsx` actuel est encore le template par défaut, sans le comportement attendu).

- [ ] **Step 3: Implémenter `App.tsx`**

Remplacer entièrement le contenu de `App.tsx` par :

```typescript
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { MainScreen, FlipAnimationTrigger } from './src/components/MainScreen';
import { SettingsModal } from './src/components/SettingsModal';
import { useFlipDetector, FlipEventType } from './src/hooks/useFlipDetector';
import { useSettings } from './src/hooks/useSettings';
import { createSoundPlayer, SoundKey } from './src/audio/soundPlayer';

const illustrationSource = require('./assets/images/illustration.png');

export default function App() {
  const { settings, isLoaded, updateSettings } = useSettings();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [flipTrigger, setFlipTrigger] = useState<FlipAnimationTrigger | null>(null);
  const soundPlayerRef = useRef(createSoundPlayer());
  const triggerIdRef = useRef(0);
  const settingsRef = useRef(settings);
  const notifyPlaybackStartedRef = useRef<(durationMs: number) => void>(() => {});
  settingsRef.current = settings;

  useEffect(() => {
    soundPlayerRef.current.loadAll().catch((error) => {
      console.warn('Chargement des sons impossible, l’app reste utilisable sans son :', error);
    });
    return () => {
      soundPlayerRef.current.unloadAll();
    };
  }, []);

  const handleFlip = useCallback((event: FlipEventType) => {
    const currentSettings = settingsRef.current;
    const soundKey: SoundKey = event === 'haut-vers-bas' ? 'hautVersBas' : 'basVersHaut';
    const shouldPlaySound = event === 'haut-vers-bas' || currentSettings.sonBasVersHautActif;
    const toZone: 'HAUT' | 'BAS' = event === 'haut-vers-bas' ? 'BAS' : 'HAUT';
    const durationMs = soundPlayerRef.current.getDurationMs(soundKey);

    triggerIdRef.current += 1;
    setFlipTrigger({ id: triggerIdRef.current, toZone, durationMs });
    notifyPlaybackStartedRef.current(durationMs);

    if (shouldPlaySound) {
      soundPlayerRef.current.play(soundKey, currentSettings.volume).catch((error) => {
        console.warn('Lecture du son impossible :', error);
      });
    }
    if (currentSettings.vibrationActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const { zone, notifyPlaybackStarted } = useFlipDetector(handleFlip);
  notifyPlaybackStartedRef.current = notifyPlaybackStarted;

  if (!isLoaded) {
    return null;
  }

  return (
    <>
      <MainScreen
        illustrationSource={illustrationSource}
        initialZone={zone}
        flipTrigger={flipTrigger}
        onOpenSettings={() => setSettingsVisible(true)}
      />
      <SettingsModal
        visible={settingsVisible}
        settings={settings}
        onChangeSettings={updateSettings}
        onClose={() => setSettingsVisible(false)}
      />
      <StatusBar style="auto" />
    </>
  );
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- App.test.tsx
npx tsc --noEmit
```

Attendu : PASS (2 tests) et aucune erreur TypeScript.

- [ ] **Step 5: Lancer toute la suite de tests**

```bash
npm test
```

Attendu : tous les tests de toutes les tâches précédentes passent toujours (aucune régression).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: assemble App.tsx (détection, audio, vibration, paramètres)"
```

---

### Task 10: Configuration `app.config.ts` et `eas.json`

**Files:**
- Delete: `app.json` (remplacé par `app.config.ts`)
- Create: `app.config.ts`
- Create: `eas.json`

**Interfaces:** Aucune (configuration statique, pas de code consommé par d'autres tâches).

- [ ] **Step 1: Supprimer `app.json` et créer `app.config.ts`**

```bash
rm app.json
```

Créer `app.config.ts` :

```typescript
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'La Boîte à Blek',
  slug: 'boite-a-blek',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffb03b',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'net.agylus.boiteablek',
  },
  android: {
    package: 'net.agylus.boiteablek',
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#ffb03b',
    },
  },
};

export default config;
```

**Note :** `net.agylus.boiteablek` est un identifiant provisoire. À remplacer par l'identifiant définitif souhaité avant toute soumission sur l'App Store / Google Play (aucun impact sur le développement ou les tests avec Expo Go entre-temps).

- [ ] **Step 2: Vérifier que la configuration est valide**

```bash
npx expo config --type public | grep "La Boîte à Blek"
```

Attendu : le nom de l'app apparaît dans la sortie, sans erreur.

- [ ] **Step 3: Créer `eas.json`**

```json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 4: Vérifier la validité du JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('eas.json', 'utf8')); console.log('eas.json valide')"
```

Attendu : affiche « eas.json valide » sans erreur.

- [ ] **Step 5: Vérification manuelle finale**

```bash
npx tsc --noEmit
npm test
npx expo start
```

Lancer l'app dans Expo Go ou un simulateur, vérifier :
- L'app démarre sans erreur et affiche l'illustration placeholder.
- L'icône de roue dentée ouvre la modale de paramètres, qui se ferme correctement.
- Sur un device réel (obligatoire, l'accéléromètre n'est pas simulé correctement en simulateur) : faire pivoter le téléphone haut→bas déclenche un son et un glissement de l'illustration ; bas→haut déclenche l'autre son (désactivable dans les paramètres) ; la vibration suit le réglage correspondant. Ajuster `FLIP_CONFIG` dans `src/constants/config.ts` si le geste se déclenche trop ou pas assez facilement.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configuration app.config.ts et eas.json"
```
