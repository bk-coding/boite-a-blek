import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings } from '../hooks/useSettings';
import { BAS_VERS_HAUT_SOUNDS } from '../audio/soundManifest';
import { THEMES } from '../theme/themeManifest';

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

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>Son au retour en position haute</Text>
          <View testID="bas-vers-haut-selector" style={styles.selector}>
            <SelectableOption
              testID="sound-option-none"
              label="Aucun"
              selected={settings.basVersHautSoundKey === null}
              onPress={() => onChangeSettings({ basVersHautSoundKey: null })}
            />
            {BAS_VERS_HAUT_SOUNDS.map((sound) => (
              <SelectableOption
                key={sound.key}
                testID={`sound-option-${sound.key}`}
                label={sound.label}
                selected={settings.basVersHautSoundKey === sound.key}
                onPress={() => onChangeSettings({ basVersHautSoundKey: sound.key })}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>Thème</Text>
          <View testID="theme-selector" style={styles.selector}>
            <SelectableOption
              testID="theme-option-none"
              label="Aucun (fond blanc)"
              selected={settings.themeKey === null}
              onPress={() => onChangeSettings({ themeKey: null })}
            />
            {THEMES.map((theme) => (
              <SelectableOption
                key={theme.key}
                testID={`theme-option-${theme.key}`}
                label={theme.label}
                selected={settings.themeKey === theme.key}
                onPress={() => onChangeSettings({ themeKey: theme.key })}
              />
            ))}
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
        </ScrollView>

        <Pressable testID="close-button" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Fermer</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

interface SelectableOptionProps {
  testID: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}

function SelectableOption({ testID, label, selected, onPress }: SelectableOptionProps) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.optionRow}>
      <Text style={selected ? styles.optionLabelSelected : styles.optionLabel}>{label}</Text>
      {selected ? (
        <Text testID={`${testID}-check`} style={styles.optionCheck}>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  sectionLabel: { marginBottom: 8 },
  selector: { marginBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  optionLabel: { fontSize: 16, color: '#333' },
  optionLabelSelected: { fontSize: 16, color: '#333', fontWeight: '600' },
  optionCheck: { fontSize: 16, fontWeight: '600' },
  slider: { width: 160 },
  closeButton: { alignSelf: 'center', padding: 12 },
  closeButtonText: { fontSize: 16, fontWeight: '500' },
});
