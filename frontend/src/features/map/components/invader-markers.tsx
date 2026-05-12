import markerCaptured   from '../../../../assets/images/marker-captured-bloom-x3.png';
import markerUncaptured from '../../../../assets/images/marker-uncaptured-bloom-x2.png';
import markerGrey       from '../../../../assets/images/marker-grey.png';
import marker10pts      from '../../../../assets/images/marker-10pts.png';
import marker20pts      from '../../../../assets/images/marker-20pts.png';
import marker30pts      from '../../../../assets/images/marker-30pts.png';
import marker40pts      from '../../../../assets/images/marker-40pts.png';
import marker50pts      from '../../../../assets/images/marker-50pts.png';
import marker100pts     from '../../../../assets/images/marker-100pts.png';

export const MARKER_IMAGES = {
  'marker-captured':   markerCaptured,
  'marker-uncaptured': markerUncaptured,
  'marker-grey':       markerGrey,
  'marker-10pts':      marker10pts,
  'marker-20pts':      marker20pts,
  'marker-30pts':      marker30pts,
  'marker-40pts':      marker40pts,
  'marker-50pts':      marker50pts,
  'marker-100pts':     marker100pts,
};

export const MARKER_LAYER_STYLE = {
  iconImage: ["get", "iconKey"],
  iconSize: ["get", "iconSize"],
  iconOpacity: ["case",
    ["==", ["get", "pending"], 1], 0.45,
    1.0,
  ],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

export const MARKER_LAYER_FILTER = ["!", ["has", "point_count"]] as const;
