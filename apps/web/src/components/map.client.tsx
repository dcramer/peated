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
  useAsPosition = false,
  children,
}: {
  initialPosition?: LatLngTuple | null;
  useAsPosition?: boolean;
  children?: ReactNode | null;
}) {
  // const markerRef = useRe(null);

  const [position, setPosition] = useState<LatLngTuple>(
    initialPosition || DEFAULT_POSITION,
  );

  useMapEvent("click", (e) => {
    if (useAsPosition) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
    }
  });

  return (
    <Marker position={position} icon={markerIcon}>
      {children ? <Popup>{children}</Popup> : null}
    </Marker>
  );
}

const DEFAULT_POSITION: LatLngTuple = [51.505, -0.09] as const;

type Props = {
  width: string;
  height: string;
  position?: LatLngTuple | null;
  controls?: boolean;
  markers?: {
    position: LatLngTuple;
    name?: string | null;
    address?: string | null;
    useAsPosition?: boolean;
  }[];
  initialZoom?: number; // max 20
};

export default function MapClient({
  width,
  height,
  position = DEFAULT_POSITION,
  markers = [],
  controls = true,
  initialZoom = 10,
}: Props) {
  return (
    <div style={{ height, width }}>
      <MapContainer
        style={{
          height: "100%",
        }}
        className="rounded"
        center={position || DEFAULT_POSITION}
        zoom={initialZoom}
        dragging={controls}
        doubleClickZoom={controls}
        scrollWheelZoom={controls}
        attributionControl={controls}
        zoomControl={controls}
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
        {markers.map((m) => {
          return (
            <LocationMarker
              initialPosition={m.position}
              useAsPosition={m.useAsPosition}
              key={m.position.join(",")}
            >
              {m.name && m.address ? (
                <div className="flex flex-row items-center gap-x-2">
                  <a
                    href={`http://maps.google.com/?q=${encodeURIComponent(`${m.name}, ${m.address}`)}`}
                    target="_blank"
                    className="text-highlight"
                  >
                    {m.name}
                    <br />
                    {m.address}
                  </a>
                </div>
              ) : null}
            </LocationMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
