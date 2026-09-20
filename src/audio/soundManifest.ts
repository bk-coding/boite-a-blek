// Fichier généré automatiquement par scripts/generate-sound-manifest.js.
// Ne pas modifier à la main : après avoir ajouté ou retiré un fichier dans
// assets/sounds/ (autre que blek.m4a, réservé au son haut-vers-bas),
// relancer `node scripts/generate-sound-manifest.js`.

export interface SoundManifestEntry {
  key: string;
  label: string;
  source: number;
}

export const BAS_VERS_HAUT_SOUNDS: SoundManifestEntry[] = [
  { key: "10-minutes", label: "10-minutes", source: require('../../assets/sounds/10-minutes.m4a') },
];
