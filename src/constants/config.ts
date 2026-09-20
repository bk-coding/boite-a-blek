export const FLIP_CONFIG = {
  hautMinDeg: -30,
  hautMaxDeg: 30,
  basThresholdDeg: 150,
  stabilizationMs: 120,
  /**
   * Filtre de verticalité (spec §3) : au-delà de cette composante |z| (en g,
   * l'axe z sortant de l'écran), le téléphone est posé à plat ou trop incliné
   * vers l'avant/arrière et l'angle calculé sur x/y n'est plus fiable.
   * 0,7 g ≈ 45° d'inclinaison par rapport à la verticale.
   */
  maxAbsZ: 0.7,
  /**
   * Complément du filtre précédent : si la composante horizontale de la
   * gravité (hypot(x, y)) est quasi nulle, `atan2(x, y)` n'est plus que du
   * bruit — cas du téléphone à plat, ou d'un échantillon aberrant.
   */
  minHorizontalMagnitude: 0.35,
};

export const ACCELEROMETER_UPDATE_INTERVAL_MS = 16;

export const ILLUSTRATION_SIZE = 280;
/** Marge sous l'en-tête (titre + roue dentée) pour la position « HAUT ». */
export const ILLUSTRATION_TOP_MARGIN = 110;
/** Marge au-dessus du bord bas de l'écran pour la position « BAS ». */
export const ILLUSTRATION_BOTTOM_MARGIN = 40;
