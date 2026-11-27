"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { DEFAULT_INDIA_MAP_CENTER } from "@/lib/india-data";
import "leaflet/dist/leaflet.css";

export const JALANDHAR_CENTER = [
  DEFAULT_INDIA_MAP_CENTER.latitude,
  DEFAULT_INDIA_MAP_CENTER.longitude,
];
export const DEFAULT_MAP_ZOOM = DEFAULT_INDIA_MAP_CENTER.zoom;
const FOCUSED_MAP_ZOOM = 16;

function createPinIcon(disabled) {
  const fill = disabled ? "#777B70" : "#A65F45";
  const ring = disabled ? "#292D2A" : "#233B32";

  return L.divIcon({
    className: "roadguard-map-pin bg-transparent border-0",
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    html: `
      <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M15 1C7.82 1 2 6.82 2 14C2 23.62 15 37 15 37C15 37 28 23.62 28 14C28 6.82 22.18 1 15 1Z" fill="${fill}" stroke="${ring}" stroke-width="2"/>
        <circle cx="15" cy="14" r="5" fill="#FAF8F2" stroke="${ring}" stroke-width="1.5"/>
      </svg>
    `,
  });
}

function MapClickHandler({ disabled, onSelectCoordinates }) {
  useMapEvents({
    click(event) {
      if (disabled) return;
      const { lat, lng } = event.latlng;
      onSelectCoordinates(
        Number(lat.toFixed(6)),
        Number(lng.toFixed(6))
      );
    },
  });

  return null;
}

function MapViewportSync({ centerTarget }) {
  const map = useMap();

  useEffect(() => {
    if (!centerTarget) return;
    const nextZoom = Math.max(map.getZoom(), FOCUSED_MAP_ZOOM);
    map.flyTo([centerTarget.latitude, centerTarget.longitude], nextZoom, {
      duration: 0.6,
    });
  }, [map, centerTarget]);

  return null;
}

/**
 * Client-only Leaflet map canvas for placing or dragging a pothole marker.
 *
 * @param {{
 *   coordinates: { latitude: number, longitude: number } | null,
 *   centerTarget: { latitude: number, longitude: number, seq: number } | null,
 *   disabled?: boolean,
 *   onSelectCoordinates: (latitude: number, longitude: number) => void,
 * }} props
 */
export default function LocationPickerMap({
  coordinates,
  centerTarget,
  disabled = false,
  onSelectCoordinates,
}) {
  const pinIcon = useMemo(() => createPinIcon(disabled), [disabled]);

  const markerPosition = coordinates
    ? [coordinates.latitude, coordinates.longitude]
    : null;

  const markerHandlers = useMemo(
    () => ({
      dragend(event) {
        if (disabled) return;
        const pos = event.target.getLatLng();
        onSelectCoordinates(
          Number(pos.lat.toFixed(6)),
          Number(pos.lng.toFixed(6))
        );
      },
    }),
    [disabled, onSelectCoordinates]
  );

  return (
    <div className="relative isolate h-72 w-full overflow-hidden border border-[#DEDCCF] bg-[#EFECE1] sm:h-80">
      <MapContainer
        center={markerPosition || JALANDHAR_CENTER}
        zoom={markerPosition ? FOCUSED_MAP_ZOOM : DEFAULT_MAP_ZOOM}
        zoomControl={true}
        scrollWheelZoom={true}
        className={`h-full w-full ${disabled ? "cursor-not-allowed opacity-80" : "cursor-crosshair"}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler
          disabled={disabled}
          onSelectCoordinates={onSelectCoordinates}
        />

        <MapViewportSync centerTarget={centerTarget} />

        {markerPosition && (
          <Marker
            position={markerPosition}
            icon={pinIcon}
            draggable={!disabled}
            eventHandlers={markerHandlers}
          />
        )}
      </MapContainer>
    </div>
  );
}
