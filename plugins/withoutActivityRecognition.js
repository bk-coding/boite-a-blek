const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const PERMISSION = 'android.permission.ACTIVITY_RECOGNITION';

/**
 * expo-sensors déclare inconditionnellement ACTIVITY_RECOGNITION dans son
 * propre AndroidManifest.xml (requis par son API Pedometer), que nous
 * n'utilisons pas — seul l'accéléromètre brut (Accelerometer) sert à
 * détecter l'orientation du téléphone. Cette permission soumet l'app aux
 * exigences du règlement Google Play sur les applis de santé pour rien ;
 * on la retire explicitement du manifeste fusionné final.
 */
function withoutActivityRecognition(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
      (entry) => entry.$['android:name'] !== PERMISSION
    );
    manifest['uses-permission'].push({
      $: {
        'android:name': PERMISSION,
        'tools:node': 'remove',
      },
    });
    AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    return config;
  });
}

module.exports = withoutActivityRecognition;
