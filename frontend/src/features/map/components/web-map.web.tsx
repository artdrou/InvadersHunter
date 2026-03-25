import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createInvaderMarker } from "./invader-marker";
import type { InvaderWithState } from "@/features/invaders";
import { useTheme } from "@/contexts/theme-context";

const MAP_STYLES: Record<string, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

type Props = {
  invaders: InvaderWithState[];
  onInvaderClick: (invader: InvaderWithState) => void;
};

export type WebMapHandle = {
  /** Place [lat, lon] at `offsetY` pixels below the viewport center. */
  centerOn: (lat: number, lon: number, offsetY: number) => void;
};

const WebMap = forwardRef<WebMapHandle, Props>(function WebMap({ invaders, onInvaderClick }, ref) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { themeName } = useTheme();
  const mapStyle = MAP_STYLES[themeName] ?? MAP_STYLES.dark;

  useImperativeHandle(ref, () => ({
    centerOn: (lat, lon, offsetY) => {
      mapRef.current?.easeTo({
        center: [lon, lat],
        offset: [0, offsetY],
        duration: 300,
      });
    },
  }));

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [2.3522, 48.8566],
      zoom: 12,
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    invaders.forEach((invader) => {
      const el = createInvaderMarker(invader);
      el.addEventListener("click", () => {
        onInvaderClick(invader);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([invader.longitude, invader.latitude])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [invaders, onInvaderClick]);

  return <div style={{ width: "100%", height: "100%" }} ref={mapContainer} />;
});

export default WebMap;
