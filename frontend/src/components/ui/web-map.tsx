import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Invader = {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
};

type Props = {
  invaders: Invader[];
};

export default function WebMap({ invaders }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [2.3522, 48.8566],
      zoom: 12,
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // 👉 ajout des markers
  useEffect(() => {
    if (!mapRef.current) return;

    invaders.forEach((invader) => {
      new maplibregl.Marker()
        .setLngLat([invader.longitude, invader.latitude])
        .setPopup(
          new maplibregl.Popup().setText(invader.name)
        )
        .addTo(mapRef.current!);
    });
  }, [invaders]);

  return <div style={{ width: "100%", height: "100%" }} ref={mapContainer} />;
}