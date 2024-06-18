import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvent } from "react-leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});

L.Marker.prototype.options.icon = DefaultIcon;
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
  return <Marker position={position} />;
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
        zoom={13}
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
