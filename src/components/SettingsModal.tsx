import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Settings } from '../hooks/useSettings';
import { BAS_VERS_HAUT_SOUNDS } from '../audio/soundManifest';
import { THEMES } from '../theme/themeManifest';

const NONE_LABEL_SOUND = 'Aucun';
const NONE_LABEL_THEME = 'Aucun (fond blanc)';

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
  const [soundOpen, setSoundOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  const selectedSoundLabel =
    BAS_VERS_HAUT_SOUNDS.find((sound) => sound.key === settings.basVersHautSoundKey)?.label ??
    NONE_LABEL_SOUND;
  const selectedThemeLabel =
    THEMES.find((theme) => theme.key === settings.themeKey)?.label ?? NONE_LABEL_THEME;

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
          <Dropdown
            testID="bas-vers-haut-selector"
            label="Son au retour en position haute"
            selectedLabel={selectedSoundLabel}
            open={soundOpen}
            onToggle={() => setSoundOpen((open) => !open)}
          >
            <SelectableOption
              testID="sound-option-none"
              label={NONE_LABEL_SOUND}
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
          </Dropdown>

          <Dropdown
            testID="theme-selector"
            label="Thème"
            selectedLabel={selectedThemeLabel}
            open={themeOpen}
            onToggle={() => setThemeOpen((open) => !open)}
          >
            <SelectableOption
              testID="theme-option-none"
              label={NONE_LABEL_THEME}
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
          </Dropdown>

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

interface DropdownProps {
  testID: string;
  label: string;
  selectedLabel: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * Replie la liste des choix derrière la valeur actuellement sélectionnée :
 * une longue liste de sons/thèmes prendrait sinon toute la place du panneau
 * de réglages.
 */
function Dropdown({ testID, label, selectedLabel, open, onToggle, children }: DropdownProps) {
  return (
    <View style={styles.dropdown}>
      <Pressable testID={`${testID}-toggle`} onPress={onToggle} style={styles.dropdownHeader}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.dropdownValue}>
          <Text style={styles.dropdownValueText}>{selectedLabel}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#333" />
        </View>
      </Pressable>
      {open ? (
        <View testID={`${testID}-options`} style={styles.dropdownOptions}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  sectionLabel: { fontSize: 16, color: '#333' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  dropdown: { marginBottom: 24 },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dropdownValue: { flexDirection: 'row', alignItems: 'center' },
  dropdownValueText: { fontSize: 16, color: '#666', marginRight: 6 },
  dropdownOptions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    paddingTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
  },
  optionLabel: { fontSize: 16, color: '#333' },
  optionLabelSelected: { fontSize: 16, color: '#333', fontWeight: '600' },
  optionCheck: { fontSize: 16, fontWeight: '600' },
  slider: { width: 160 },
  closeButton: { alignSelf: 'center', padding: 12 },
  closeButtonText: { fontSize: 16, fontWeight: '500' },
});
