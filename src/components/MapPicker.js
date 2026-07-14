"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getClientMapCenter, getClientTileConfig } from "../lib/config";

// Fix default Leaflet icon issue in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export default function MapPicker({ defaultLat, defaultLng, onChange }) {
  const [position, setPosition] = useState(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null
  );

  // Map center is sourced from configuration, not hardcoded (Req 13.4).
  const { lat, lng } = getClientMapCenter();
  const tile = getClientTileConfig();
  const center = [lat, lng];

  useEffect(() => {
    if (position) {
      onChange(position.lat, position.lng);
    }
  }, [position, onChange]);

  return (
    <MapContainer
      center={position ? [position.lat, position.lng] : center}
      zoom={position ? 20 : 18}
      maxZoom={24}
      style={{ height: "300px", width: "100%", borderRadius: "var(--radius-md)", zIndex: 0 }}
    >
      {tile.url && (
        <TileLayer
          attribution={tile.attribution}
          url={tile.url}
          maxZoom={24}
          maxNativeZoom={19}
        />
      )}
      <LocationMarker position={position} setPosition={setPosition} />
    </MapContainer>
  );
}
