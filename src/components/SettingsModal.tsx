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
