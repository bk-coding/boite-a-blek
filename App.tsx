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
    const soundPlayer = soundPlayerRef.current;
    return () => {
      soundPlayer.unloadAll().catch((error) => {
        console.warn('Libération des sons impossible :', error);
      });
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
      // Rejette sur les appareils dépourvus de moteur haptique : on dégrade
      // silencieusement plutôt que de laisser une promesse non gérée.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((error) => {
        console.warn('Retour haptique indisponible :', error);
      });
    }
  }, []);

  const { confirmedZone, notifyPlaybackStarted } = useFlipDetector(handleFlip);
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
