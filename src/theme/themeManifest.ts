// Fichier généré automatiquement par scripts/generate-theme-manifest.js.
// Ne pas modifier à la main : après avoir ajouté ou retiré une image dans
// assets/images/themes/, relancer `npm run generate:themes`.

export interface ThemeManifestEntry {
  key: string;
  label: string;
  source: number;
}

export const THEMES: ThemeManifestEntry[] = [
  { key: "clair", label: "clair", source: require('../../assets/images/themes/clair.png') },
  { key: "orange", label: "orange", source: require('../../assets/images/themes/orange.png') },
  { key: "sombre", label: "sombre", source: require('../../assets/images/themes/sombre.png') },
  { key: "vert", label: "vert", source: require('../../assets/images/themes/vert.png') },
];
