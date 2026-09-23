import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  /**
   * Clé (voir `BAS_VERS_HAUT_SOUNDS` dans `src/audio/soundManifest.ts`) du
   * son choisi pour le retour en position haute, ou `null` pour « Aucun ».
   * Remplace l'ancien interrupteur booléen `sonBasVersHautActif`.
   */
  basVersHautSoundKey: string | null;
  volume: number;
  vibrationActive: boolean;
  /**
   * Clé (voir `THEMES` dans `src/theme/themeManifest.ts`) de l'image de fond
   * choisie pour l'écran principal, ou `null` pour le fond blanc par défaut.
   */
  themeKey: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  basVersHautSoundKey: null,
  volume: 1,
  vibrationActive: true,
  themeKey: null,
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
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!isMounted) return;
        if (raw) {
          try {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
          } catch {
            setSettings(DEFAULT_SETTINGS);
          }
        }
        setIsLoaded(true);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.warn('useSettings: échec du chargement des paramètres, utilisation des valeurs par défaut', error);
        setSettings(DEFAULT_SETTINGS);
        setIsLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
        console.warn('useSettings: échec de la sauvegarde des paramètres', error);
      });
      return next;
    });
  }, []);

  return { settings, isLoaded, updateSettings };
}
