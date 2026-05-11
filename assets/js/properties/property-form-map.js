import { CONFIG } from "../core/config.js";
import { $ } from "../core/utils.js";

mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

let propertyFormMap = null;
let propertyFormMarker = null;

export function initPropertyFormMap() {
  const mapEl = $("propertyPickerMap");
  if (!mapEl) return;

  if (propertyFormMap) {
    setTimeout(() => propertyFormMap.resize(), 120);
    return;
  }

  propertyFormMap = new mapboxgl.Map({
    container: "propertyPickerMap",
    style: CONFIG.MAP_STYLES.streets,
    center: CONFIG.MONTERREY_CENTER,
    zoom: 11
  });

  propertyFormMap.addControl(
    new mapboxgl.NavigationControl(),
    "bottom-right"
  );

  propertyFormMap.on("load", () => {
    setTimeout(() => propertyFormMap.resize(), 120);
  });

  propertyFormMap.on("click", async (e) => {
    const lat = Number(e.lngLat.lat);
    const lng = Number(e.lngLat.lng);

    setPropertyCoordinates(lat, lng);
    setPropertyMarker(lat, lng);

    try {
      setAddressLoadingState(true);
      const place = await reverseGeocodePoint(lat, lng);
      applyReverseGeocodeToForm(place, lat, lng);
    } catch (err) {
      console.error("Error haciendo reverse geocoding:", err);
      // aunque falle la dirección, las coordenadas sí se quedan
    } finally {
      setAddressLoadingState(false);
    }
  });
}

export function setPropertyCoordinates(lat, lng) {
  if ($("propLat")) $("propLat").value = Number(lat).toFixed(6);
  if ($("propLng")) $("propLng").value = Number(lng).toFixed(6);
}

export function setPropertyMarker(lat, lng) {
  if (!propertyFormMap) return;

  if (propertyFormMarker) {
    propertyFormMarker.remove();
  }

  propertyFormMarker = new mapboxgl.Marker({
    color: "#0a66ff"
  })
    .setLngLat([Number(lng), Number(lat)])
    .addTo(propertyFormMap);

  propertyFormMap.flyTo({
    center: [Number(lng), Number(lat)],
    zoom: Math.max(propertyFormMap.getZoom(), 15),
    speed: 1.05
  });
}

export function resetPropertyFormMap() {
  if ($("propLat")) $("propLat").value = "";
  if ($("propLng")) $("propLng").value = "";

  if (propertyFormMarker) {
    propertyFormMarker.remove();
    propertyFormMarker = null;
  }

  if (propertyFormMap) {
    propertyFormMap.flyTo({
      center: CONFIG.MONTERREY_CENTER,
      zoom: 11,
      speed: 1
    });

    setTimeout(() => {
      propertyFormMap.resize();
    }, 120);
  }
}

async function reverseGeocodePoint(lat, lng) {
  const token = CONFIG.MAPBOX_TOKEN;

  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${encodeURIComponent(
    lng
  )}&latitude=${encodeURIComponent(lat)}&language=es&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Reverse geocoding falló (${res.status})`);
  }

  const data = await res.json();
  const feature = data?.features?.[0] || null;

  return feature;
}

function applyReverseGeocodeToForm(feature, lat, lng) {
  if (!feature) {
    // si no encontró dirección, al menos dejamos una referencia mínima
    if ($("propAddress")) $("propAddress").value = `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
    return;
  }

  const context = feature.properties?.context || {};
  const address = buildBestAddress(feature);
  const city = context.place?.name || context.locality?.name || $("propCity")?.value || "";
  const state = context.region?.name || $("propState")?.value || "";

  if ($("propAddress")) $("propAddress").value = address;
  if ($("propCity")) $("propCity").value = city;
  if ($("propState")) $("propState").value = state;
}

function buildBestAddress(feature) {
  const props = feature.properties || {};
  const context = props.context || {};

  // Priorizamos dirección legible
  if (feature.properties?.full_address) {
    return feature.properties.full_address;
  }

  if (feature.place_name) {
    return feature.place_name;
  }

  const street = context.street?.name || "";
  const number = props.address_number || "";
  const neighborhood = context.neighborhood?.name || "";

  const firstLine = [street, number].filter(Boolean).join(" ").trim();
  const secondLine = neighborhood;

  return [firstLine, secondLine].filter(Boolean).join(", ").trim() || feature.name || "";
}

function setAddressLoadingState(isLoading) {
  const addressInput = $("propAddress");
  if (!addressInput) return;

  if (isLoading) {
    addressInput.dataset.prevPlaceholder = addressInput.placeholder || "";
    addressInput.placeholder = "Buscando dirección...";
  } else {
    addressInput.placeholder = addressInput.dataset.prevPlaceholder || "Dirección";
  }
}