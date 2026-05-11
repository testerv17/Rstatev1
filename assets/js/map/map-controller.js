import { CONFIG } from "../core/config.js";
import { appState } from "../core/state.js";
import { shortPrice } from "../core/utils.js";

mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

export function initMap() {
  if (appState.map) return appState.map;

  const mapContainer = document.getElementById("map");
  if (!mapContainer) {
    console.error('No existe el contenedor #map');
    return null;
  }

  const map = new mapboxgl.Map({
    container: "map",
    style: CONFIG.MAP_STYLES[appState.currentStyleKey],
    center: CONFIG.MONTERREY_CENTER,
    zoom: CONFIG.DEFAULT_ZOOM
  });

  map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

  map.on("load", () => {
    apply3DBuildings();
  });

  appState.map = map;
  return map;
}

export function setMapStyle(styleKey) {
  const map = appState.map;
  if (!map) return;

  appState.currentStyleKey = styleKey;

  const styleUrl = CONFIG.MAP_STYLES[styleKey] || CONFIG.MAP_STYLES.streets;
  const center = map.getCenter();
  const zoom = map.getZoom();
  const pitch = map.getPitch();
  const bearing = map.getBearing();

  map.setStyle(styleUrl);

  map.once("styledata", () => {
    map.setCenter(center);
    map.setZoom(zoom);
    map.setPitch(pitch);
    map.setBearing(bearing);
    apply3DBuildings();
  });
}

export function toggle3D() {
  appState.is3D = !appState.is3D;
  apply3DBuildings();
  return appState.is3D;
}

export function apply3DBuildings() {
  const map = appState.map;
  if (!map) return;

  if (appState.is3D) {
    map.easeTo({ pitch: 60, bearing: -20, duration: 600 });
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }

  const tryAdd = () => {
    if (!appState.is3D) {
      if (map.getLayer("3d-buildings")) {
        map.removeLayer("3d-buildings");
      }
      return;
    }

    if (map.getLayer("3d-buildings")) return;
    if (!map.getSource("composite")) return;

    const layers = map.getStyle().layers || [];
    const labelLayerId = layers.find(
      (layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]
    )?.id;

    map.addLayer(
      {
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": [
            "case",
            [">", ["coalesce", ["get", "height"], 0], 80], "#c7dbff",
            [">", ["coalesce", ["get", "height"], 0], 40], "#d9e7fb",
            "#edf4ff"
          ],
          "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
          "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
          "fill-extrusion-opacity": 0.82
        }
      },
      labelLayerId
    );
  };

  if (map.isStyleLoaded()) {
    tryAdd();
  } else {
    map.once("idle", tryAdd);
  }
}

export function clearMarkers() {
  appState.markers.forEach((entry) => entry.marker.remove());
  appState.markers = [];
}

export function renderPropertyMarkers(properties, onSelectProperty) {
  const map = appState.map;
  if (!map) return;

  clearMarkers();

  properties.forEach((property) => {
    if (property.lat == null || property.lng == null) return;

    const node = document.createElement("div");
    node.className =
      "price-marker" +
      (String(property.id) === String(appState.selectedPropertyId) ? " active" : "");

    node.textContent = shortPrice(property.price, property.currency || "MXN");

    const marker = new mapboxgl.Marker(node)
      .setLngLat([Number(property.lng), Number(property.lat)])
      .addTo(map);

    node.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof onSelectProperty === "function") {
        onSelectProperty(property, true);
      }
    });

    appState.markers.push({
      id: property.id,
      marker,
      node
    });
  });

  highlightSelectedMarker();
}

export function highlightSelectedMarker() {
  appState.markers.forEach((entry) => {
    entry.node.classList.toggle(
      "active",
      String(entry.id) === String(appState.selectedPropertyId)
    );
  });
}

export function focusPropertyOnMap(property) {
  const map = appState.map;
  if (!map) return;
  if (!property || property.lng == null || property.lat == null) return;

  map.flyTo({
    center: [Number(property.lng), Number(property.lat)],
    zoom: Math.max(map.getZoom(), 14),
    speed: 1.1
  });
}

export function fitPropertiesBounds(properties) {
  const map = appState.map;
  if (!map) return;

  const coords = properties
    .filter((property) => property.lat != null && property.lng != null)
    .map((property) => [Number(property.lng), Number(property.lat)]);

  if (coords.length >= 2) {
    const bounds = coords.reduce(
      (acc, coord) => acc.extend(coord),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );

    map.fitBounds(bounds, { padding: 70, duration: 700 });
  } else if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: 14, duration: 700 });
  } else {
    map.flyTo({
      center: CONFIG.MONTERREY_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
      duration: 700
    });
  }
}