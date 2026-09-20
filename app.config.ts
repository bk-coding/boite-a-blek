import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'La Boîte à Blek',
  slug: 'boite-a-blek',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
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
  plugins: [
    'expo-asset',
    'expo-font',
    // L'app ne fait que lire deux sons courts : ni micro, ni lecture en
    // arrière-plan, donc aucune permission d'enregistrement demandée.
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/illustration.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    ],
  ],
};

export default config;
