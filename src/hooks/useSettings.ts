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
