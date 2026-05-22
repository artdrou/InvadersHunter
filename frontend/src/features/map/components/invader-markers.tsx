import marker10ptsRarity         from '../../../../assets/images/marker-10pts-rarity.png';
import marker10ptsFlashCaptured  from '../../../../assets/images/marker-10pts-flash-captured.png';
import marker10ptsFlashUncaptured from '../../../../assets/images/marker-10pts-flash-uncaptured.png';
import marker10ptsGrey           from '../../../../assets/images/marker-10pts-grey.png';

import marker20ptsRarity         from '../../../../assets/images/marker-20pts-rarity.png';
import marker20ptsFlashCaptured  from '../../../../assets/images/marker-20pts-flash-captured.png';
import marker20ptsFlashUncaptured from '../../../../assets/images/marker-20pts-flash-uncaptured.png';
import marker20ptsGrey           from '../../../../assets/images/marker-20pts-grey.png';

import marker30ptsRarity         from '../../../../assets/images/marker-30pts-rarity.png';
import marker30ptsFlashCaptured  from '../../../../assets/images/marker-30pts-flash-captured.png';
import marker30ptsFlashUncaptured from '../../../../assets/images/marker-30pts-flash-uncaptured.png';
import marker30ptsGrey           from '../../../../assets/images/marker-30pts-grey.png';

import marker40ptsRarity         from '../../../../assets/images/marker-40pts-rarity.png';
import marker40ptsFlashCaptured  from '../../../../assets/images/marker-40pts-flash-captured.png';
import marker40ptsFlashUncaptured from '../../../../assets/images/marker-40pts-flash-uncaptured.png';
import marker40ptsGrey           from '../../../../assets/images/marker-40pts-grey.png';

import marker50ptsRarity         from '../../../../assets/images/marker-50pts-rarity.png';
import marker50ptsFlashCaptured  from '../../../../assets/images/marker-50pts-flash-captured.png';
import marker50ptsFlashUncaptured from '../../../../assets/images/marker-50pts-flash-uncaptured.png';
import marker50ptsGrey           from '../../../../assets/images/marker-50pts-grey.png';

import marker100ptsRarity         from '../../../../assets/images/marker-100pts-rarity.png';
import marker100ptsFlashCaptured  from '../../../../assets/images/marker-100pts-flash-captured.png';
import marker100ptsFlashUncaptured from '../../../../assets/images/marker-100pts-flash-uncaptured.png';
import marker100ptsGrey           from '../../../../assets/images/marker-100pts-grey.png';

export const MARKER_IMAGES = {
  'marker-10pts-rarity':           marker10ptsRarity,
  'marker-10pts-flash-captured':   marker10ptsFlashCaptured,
  'marker-10pts-flash-uncaptured': marker10ptsFlashUncaptured,
  'marker-10pts-grey':             marker10ptsGrey,

  'marker-20pts-rarity':           marker20ptsRarity,
  'marker-20pts-flash-captured':   marker20ptsFlashCaptured,
  'marker-20pts-flash-uncaptured': marker20ptsFlashUncaptured,
  'marker-20pts-grey':             marker20ptsGrey,

  'marker-30pts-rarity':           marker30ptsRarity,
  'marker-30pts-flash-captured':   marker30ptsFlashCaptured,
  'marker-30pts-flash-uncaptured': marker30ptsFlashUncaptured,
  'marker-30pts-grey':             marker30ptsGrey,

  'marker-40pts-rarity':           marker40ptsRarity,
  'marker-40pts-flash-captured':   marker40ptsFlashCaptured,
  'marker-40pts-flash-uncaptured': marker40ptsFlashUncaptured,
  'marker-40pts-grey':             marker40ptsGrey,

  'marker-50pts-rarity':           marker50ptsRarity,
  'marker-50pts-flash-captured':   marker50ptsFlashCaptured,
  'marker-50pts-flash-uncaptured': marker50ptsFlashUncaptured,
  'marker-50pts-grey':             marker50ptsGrey,

  'marker-100pts-rarity':           marker100ptsRarity,
  'marker-100pts-flash-captured':   marker100ptsFlashCaptured,
  'marker-100pts-flash-uncaptured': marker100ptsFlashUncaptured,
  'marker-100pts-grey':             marker100ptsGrey,
};

export const MARKER_LAYER_STYLE = {
  iconImage: ["get", "iconKey"],
  iconSize: ["get", "iconSize"],
  iconOpacity: ["case",
    ["==", ["get", "pending"], 1], 0.45,
    ["==", ["get", "grey"], 1],    0.7,
    1.0,
  ],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

export const MARKER_LAYER_FILTER = ["!", ["has", "point_count"]] as const;
