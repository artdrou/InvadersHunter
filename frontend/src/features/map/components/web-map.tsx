import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createInvaderMarker } from "./invader-marker";
import type { InvaderWithState } from "@/features/invaders";

type Props = {
  invaders: InvaderWithState[];
  onInvaderClick: (invader: InvaderWithState) => void;
};

export default function WebMap({ invaders, onInvaderClick }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/dark",
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

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    invaders.forEach((invader) => {
      const el = createInvaderMarker(invader);
      el.addEventListener("click", () => {
        mapRef.current?.easeTo({
          center: [invader.longitude, invader.latitude],
          duration: 350,
        });
        onInvaderClick(invader);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([invader.longitude, invader.latitude])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [invaders, onInvaderClick]);

  return <div style={{ width: "100%", height: "100%" }} ref={mapContainer} />;
}
