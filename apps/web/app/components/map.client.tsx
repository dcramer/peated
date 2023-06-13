import type { LatLngTuple } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export function Map({
  position = [51.505, -0.09],
  height,
  width,
}: {
  position: LatLngTuple;
  height: string;
  width?: string;
}) {
  return (
    <div style={{ height, width }}>
      <MapContainer
        style={{
          height: "100%",
        }}
        className="rounded"
        center={position}
        zoom={13}
        dragging={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            A pretty CSS3 popup. <br /> Easily customizable.
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
