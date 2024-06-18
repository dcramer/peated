import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvent } from "react-leaflet";

import "leaflet/dist/leaflet.css";

const markerIcon = L.divIcon({
  html: `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
</svg>`,
  className: "svg-icon",
  iconSize: [24, 40],
  iconAnchor: [12, 40],
});

function LocationMarker({
  initialPosition,
  editable = false,
}: {
  initialPosition?: LatLngTuple | null;
  editable?: boolean;
}) {
  // const markerRef = useRe(null);

  const [position, setPosition] = useState<LatLngTuple>(
    initialPosition || DEFAULT_POSITION,
  );

  const map = useMapEvent("click", (e) => {
    if (editable) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
    }
  });
  return <Marker position={position} icon={markerIcon} />;
}

const DEFAULT_POSITION: LatLngTuple = [51.505, -0.09] as const;

export function Map({
  width,
  height,
  position = DEFAULT_POSITION,
  editable = false,
}: {
  width: string;
  height: string;
  position?: LatLngTuple | null;
  editable?: boolean;
}) {
  return (
    <div style={{ height, width }}>
      <MapContainer
        style={{
          height: "100%",
        }}
        className="rounded"
        center={position || DEFAULT_POSITION}
        zoom={17}
        dragging={editable}
        doubleClickZoom={editable}
        scrollWheelZoom={editable}
        attributionControl={editable}
        zoomControl={editable}
      >
        <TileLayer
          attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
          url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
        />
        <LocationMarker initialPosition={position} editable={editable} />
      </MapContainer>
    </div>
  );
}
