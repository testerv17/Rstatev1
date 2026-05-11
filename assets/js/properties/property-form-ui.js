import { $, propertyTypeLabel } from "../core/utils.js";
import { appState } from "../core/state.js";
import { setPropertyCoordinates, setPropertyMarker } from "./property-form-map.js";

export function openPropertyForm() {
  const modal = $("propertyModal");
  if (!modal) return;
  modal.classList.remove("hidden");
}

export function closePropertyForm() {
  const modal = $("propertyModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

export function getPropertyFormData() {
  return {
    title: $("propTitle")?.value.trim() || "",
    price: Number($("propPrice")?.value || 0),
    listing_type: $("propListingType")?.value || "sale",
    property_type: $("propType")?.value || "house",
    city: $("propCity")?.value.trim() || "",
    state: $("propState")?.value.trim() || "",
    address: $("propAddress")?.value.trim() || "",
    lat: $("propLat")?.value ? Number($("propLat").value) : null,
    lng: $("propLng")?.value ? Number($("propLng").value) : null,
    beds: Number($("propBeds")?.value || 0),
    baths: Number($("propBaths")?.value || 0),
    sqft: Number($("propSqft")?.value || 0),
    description: $("propDescription")?.value.trim() || "",
    broker_name: $("propBroker")?.value.trim() || "",
    imageFiles: Array.from($("propImage")?.files || [])
  };
}
export function bindPropertyImagePreview() {
  $("propImage")?.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    renderPropertyImagePreview(files);
  });
}

export function renderPropertyImagePreview(files = []) {
  const el = $("propImagePreview");
  if (!el) return;

  el.innerHTML = "";

  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement("div");
    div.className = "property-upload-thumb";
    div.style.backgroundImage = `url('${url}')`;
    el.appendChild(div);
  });
}

export function clearPropertyForm() {
  [
    "propTitle",
    "propPrice",
    "propCity",
    "propState",
    "propAddress",
    "propLat",
    "propLng",
    "propBeds",
    "propBaths",
    "propSqft",
    "propDescription",
    "propBroker",
    "propImage"
  ].forEach((id) => {
    if ($(id)) $(id).value = "";
  });

  if ($("propListingType")) $("propListingType").value = "sale";
  if ($("propType")) $("propType").value = "house";

  appState.editingPropertyId = null;
  setPropertyFormMode("create");
  renderPropertyImagePreview([]);
}

export function fillPropertyForm(property) {
  if (!property) return;

  if ($("propTitle")) $("propTitle").value = property.title || "";
  if ($("propPrice")) $("propPrice").value = property.price || "";
  if ($("propListingType")) $("propListingType").value = property.listing_type || "sale";
  if ($("propType")) $("propType").value = property.property_type || "house";
  if ($("propCity")) $("propCity").value = property.city || "";
  if ($("propState")) $("propState").value = property.state || "";
  if ($("propAddress")) $("propAddress").value = property.address || "";
  if ($("propBeds")) $("propBeds").value = property.beds || 0;
  if ($("propBaths")) $("propBaths").value = property.baths || 0;
  if ($("propSqft")) $("propSqft").value = property.sqft || 0;
  if ($("propDescription")) $("propDescription").value = property.description || "";
  if ($("propBroker")) $("propBroker").value = property.broker_name || "";

  if (property.lat != null && property.lng != null) {
    setPropertyCoordinates(property.lat, property.lng);
    setTimeout(() => {
      setPropertyMarker(property.lat, property.lng);
    }, 120);
  }

  appState.editingPropertyId = property.id;
  setPropertyFormMode("edit");
}

export function validatePropertyForm(data) {
  if (!data.title) {
    return "Captura el título de la propiedad.";
  }

  if (!data.price || Number(data.price) <= 0) {
    return "Captura un precio válido.";
  }

  if (data.lat == null || data.lng == null) {
    return "Selecciona la ubicación exacta en el mapa.";
  }

  return null;
}

export function setPropertyFormMessage(message, isError = false) {
  const el = $("propertyFormMsg");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#c73636" : "#11b67a";
}

export function setPropertyFormMode(mode = "create") {
  const title = $("propertyModalTitle");
  const saveBtn = $("btnSaveProperty");

  if (title) {
    title.textContent = mode === "edit" ? "Editar Propiedad" : "Nueva Propiedad";
  }

  if (saveBtn) {
    saveBtn.textContent = mode === "edit" ? "Actualizar propiedad" : "Guardar propiedad";
  }
}