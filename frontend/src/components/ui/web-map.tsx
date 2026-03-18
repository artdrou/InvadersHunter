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
    const el = document.createElement("div");

    el.style.width = "36px";
    el.style.height = "20px";
    el.style.display = "grid";
    el.style.gridTemplateColumns = "repeat(9, 1fr)";
    el.style.gridTemplateRows = "repeat(5, 1fr)";
    el.style.gap = "1px";
    el.style.cursor = "pointer";
    el.style.filter = "drop-shadow(0 0 6px rgba(0, 114, 146, 0.9))";

    const pixels = [
        0, 0, 0, 1, 0, 1, 0, 0, 0,
        0, 0, 1, 1, 1, 1, 1, 0, 0,
        0, 0, 1, 0, 1, 0, 1, 0, 0,
        0, 1, 1, 1, 1, 1, 1, 1, 0,
        1, 1, 0, 1, 0, 1, 0, 1, 1,
    ];

    pixels.forEach((value) => {
    const pixel = document.createElement("div");
    pixel.style.backgroundColor = value ? "#1cffb7" : "transparent";
    pixel.style.outline = value ? "0.01px solid #00b7e0" : "none";
    el.appendChild(pixel);
});

    new maplibregl.Marker({ element: el })
        .setLngLat([invader.longitude, invader.latitude])
        .setPopup(
        new maplibregl.Popup().setText(invader.name)
        )
        .addTo(mapRef.current!);
});
  }, [invaders]);

  return <div style={{ width: "100%", height: "100%" }} ref={mapContainer} />;
}