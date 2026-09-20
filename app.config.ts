import { ExpoConfig } from 'expo/config';

const config = {
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
  plugins: ['expo-asset', 'expo-font'],
} as ExpoConfig;

export default config;
