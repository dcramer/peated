"use client";

import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvent,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const markerIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24">
  <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
</svg>`,
  className: "svg-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 0],
});

function LocationMarker({
  initialPosition,
  editable = false,
  children,
}: {
  initialPosition?: LatLngTuple | null;
  editable?: boolean;
  children?: ReactNode | null;
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
  return (
    <Marker position={position} icon={markerIcon}>
      <Popup>{children}</Popup>
    </Marker>
  );
}

const DEFAULT_POSITION: LatLngTuple = [51.505, -0.09] as const;

export function Map({
  width,
  height,
  position = DEFAULT_POSITION,
  editable = false,
  markerContent,
}: {
  width: string;
  height: string;
  position?: LatLngTuple | null;
  editable?: boolean;
  markerContent?: ReactNode | null;
}) {
  return (
    <div style={{ height, width }}>
      <MapContainer
        style={{
          height: "100%",
        }}
        className="rounded"
        center={position || DEFAULT_POSITION}
        zoom={10}
        dragging={editable}
        doubleClickZoom={editable}
        scrollWheelZoom={editable}
        attributionControl={editable}
        zoomControl={editable}
      >
        <TileLayer
          attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
          url={
            "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}" +
            (L.Browser.retina ? "@2x.png" : ".png")
          }
          subdomains="abcd"
          maxZoom={20}
          minZoom={0}
        />
        <LocationMarker initialPosition={position} editable={editable}>
          {markerContent}
        </LocationMarker>
      </MapContainer>
    </div>
  );
}
