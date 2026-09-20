import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { MainScreen, FlipAnimationTrigger } from './src/components/MainScreen';
import { SettingsModal } from './src/components/SettingsModal';
import { useFlipDetector, FlipEventType } from './src/hooks/useFlipDetector';
import { useSettings } from './src/hooks/useSettings';
import { createSoundPlayer, HAUT_VERS_BAS_KEY } from './src/audio/soundPlayer';

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
    const soundPlayer = soundPlayerRef.current;
    return () => {
      soundPlayer.unloadAll().catch((error) => {
        console.warn('Libération des sons impossible :', error);
      });
    };
  }, []);

  const handleFlip = useCallback((event: FlipEventType) => {
    const currentSettings = settingsRef.current;
    const isHautVersBas = event === 'haut-vers-bas';
    const toZone: 'HAUT' | 'BAS' = isHautVersBas ? 'BAS' : 'HAUT';
    // « bas vers haut » n'a plus d'interrupteur on/off : le son joué (s'il y
    // en a un) est celui choisi dans les paramètres, `null` valant « Aucun ».
    const soundKey = isHautVersBas ? HAUT_VERS_BAS_KEY : currentSettings.basVersHautSoundKey;
    // Quand « Aucun » est sélectionné, il n'existe plus de fichier de
    // référence pour le rythme visuel/le cooldown — on retombe sur la durée
    // du son haut-vers-bas (toujours chargé) pour garder un anti-rebond
    // cohérent plutôt que de le désactiver (durée nulle).
    const durationMs = soundKey
      ? soundPlayerRef.current.getDurationMs(soundKey)
      : soundPlayerRef.current.getDurationMs(HAUT_VERS_BAS_KEY);

    triggerIdRef.current += 1;
    setFlipTrigger({ id: triggerIdRef.current, toZone, durationMs });
    notifyPlaybackStartedRef.current(durationMs);

    if (soundKey) {
      soundPlayerRef.current.play(soundKey, currentSettings.volume).catch((error) => {
        console.warn('Lecture du son impossible :', error);
      });
    }
    if (currentSettings.vibrationActive) {
      // Rejette sur les appareils dépourvus de moteur haptique : on dégrade
      // silencieusement plutôt que de laisser une promesse non gérée.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((error) => {
        console.warn('Retour haptique indisponible :', error);
      });
    }
  }, []);

  const { confirmedZone, angleDeg, notifyPlaybackStarted } = useFlipDetector(handleFlip);
  notifyPlaybackStartedRef.current = notifyPlaybackStarted;

  if (!isLoaded) {
    return null;
  }

  return (
    <>
      <MainScreen
        illustrationSource={illustrationSource}
        restZone={confirmedZone}
        flipTrigger={flipTrigger}
        angleDeg={angleDeg}
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
