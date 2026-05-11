import { $, debounce } from "./core/utils.js";
import { sb } from "./core/supabase.js";
import { appState } from "./core/state.js";
import { getFollowupsCount } from "./core/followups-count.js";

import {
  initMap,
  setMapStyle,
  toggle3D,
  renderPropertyMarkers,
  highlightSelectedMarker,
  focusPropertyOnMap,
  fitPropertiesBounds
} from "./map/map-controller.js";

import {
  fetchProperties,
  addDemoProperty,
  seedDemoProperties
} from "./properties/properties-service.js";

import {
  renderPropertiesList,
  updateResultsCount,
  renderPropertyDetail,
  renderEmptyPropertyDetail,
  highlightSelectedPropertyCard,
  scrollSelectedPropertyCardIntoView,
  restorePropertyDetail
} from "./properties/properties-ui.js";

import {
  openPropertyForm,
  closePropertyForm,
  getPropertyFormData,
  clearPropertyForm,
  fillPropertyForm,
  validatePropertyForm,
  setPropertyFormMessage,
  bindPropertyImagePreview
} from "./properties/property-form-ui.js";

import {
  createPropertyLead,
  fetchPropertyLeads,
  updateLeadStage,
  deletePropertyLead
} from "./leads/property-leads-service.js";

import {
  openLeadModal,
  closeLeadModal,
  openLeadListModal,
  closeLeadListModal,
  setLeadFormMessage,
  setLeadListMessage,
  clearLeadForm,
  getLeadFormData,
  validateLeadForm,
  renderLeadList,
  buildWhatsAppLeadUrl
} from "./leads/property-leads-ui.js";

import { fetchMyProfile } from "./core/profile-service.js";

import {
  initPropertyFormMap,
  resetPropertyFormMap
} from "./properties/property-form-map.js";

import { createProperty } from "./properties/property-form-service.js";

import {
  appendPropertyGallery,
  fetchPropertyImages,
  deletePropertyImage,
  setPropertyCoverImage
} from "./properties/property-gallery-service.js";

import {
  openGalleryAdminModal,
  closeGalleryAdminModal,
  setGalleryAdminMessage,
  getGalleryAdminFiles,
  clearGalleryAdminInput,
  renderGalleryAdmin
} from "./properties/property-gallery-ui.js";

import {
  updateProperty,
  deleteProperty
} from "./properties/property-admin-service.js";

async function init() {
  try {
    wireUI();

    const { data: { session }, error } = await sb.auth.getSession();

    if (error) {
      console.error("Error obteniendo sesión:", error);
    }

    if (!session) {
      $("authPanel")?.classList.remove("hidden");
      $("appShell")?.classList.add("hidden");
      return;
    }

    const profileData = await fetchMyProfile();
    appState.currentUser = profileData?.user || null;
    appState.currentProfile = profileData?.profile || null;

    renderCurrentUserBadge();
    await renderFollowupAlerts();

    $("authPanel")?.classList.add("hidden");
    $("appShell")?.classList.remove("hidden");

    initMap();
    await loadAndRender();
  } catch (err) {
    console.error("Error fatal en init():", err);
  }
}

function wireUI() {
  bindPropertyImagePreview();

  $("btnOpenPropertyModal")?.addEventListener("click", () => {
    clearPropertyForm();
    setPropertyFormMessage("");
    openPropertyForm();
    setTimeout(() => {
      initPropertyFormMap();
      resetPropertyFormMap();
    }, 80);
  });

  $("btnClosePropertyModal")?.addEventListener("click", () => {
    closePropertyForm();
  });

  $("btnSaveProperty")?.addEventListener("click", async () => {
    try {
      const formData = getPropertyFormData();
      const validationError = validatePropertyForm(formData);

      if (validationError) {
        setPropertyFormMessage(validationError, true);
        return;
      }

      setPropertyFormMessage(
        appState.editingPropertyId ? "Actualizando propiedad..." : "Guardando propiedad..."
      );

      if (appState.editingPropertyId) {
        await updateProperty(appState.editingPropertyId, formData);
        setPropertyFormMessage("Propiedad actualizada correctamente.");
      } else {
        await createProperty(formData);
        setPropertyFormMessage("Propiedad guardada correctamente.");
      }

      closePropertyForm();
      await loadAndRender(true);
    } catch (err) {
      console.error(err);
      setPropertyFormMessage(err.message || "Error guardando propiedad.", true);
    }
  });

  $("btnCloseLeadModal")?.addEventListener("click", () => {
    closeLeadModal();
  });

  $("btnCloseLeadListModal")?.addEventListener("click", () => {
    closeLeadListModal();
  });

  $("btnOpenLeadModal")?.addEventListener("click", () => {
    clearLeadForm();
    setLeadFormMessage("");
    openLeadModal();
  });

  $("btnSaveLead")?.addEventListener("click", async () => {
    try {
      if (!appState.selectedPropertyId) {
        setLeadFormMessage("No hay propiedad seleccionada.", true);
        return;
      }

      const formData = getLeadFormData();
      const validationError = validateLeadForm(formData);

      if (validationError) {
        setLeadFormMessage(validationError, true);
        return;
      }

      setLeadFormMessage("Guardando lead...");

      await createPropertyLead(appState.selectedPropertyId, formData);

      clearLeadForm();
      closeLeadModal();
      await refreshPropertyLeads(appState.selectedPropertyId);
      setLeadListMessage("Lead guardado correctamente.");
    } catch (err) {
      console.error(err);
      setLeadFormMessage(err.message || "Error guardando lead.", true);
    }
  });

  $("btnLogin")?.addEventListener("click", login);
  $("btnLogout")?.addEventListener("click", logout);

  $("btnRestoreDetail")?.addEventListener("click", () => {
    restorePropertyDetail();
  });

  $("searchInput")?.addEventListener("input", debounce(() => {
    loadAndRender(true);
  }, 300));

  ["filterListing", "filterType", "filterPrice"].forEach((id) => {
    $(id)?.addEventListener("change", () => {
      loadAndRender(true);
    });
  });

  $("mapStyle")?.addEventListener("change", (e) => {
    setMapStyle(e.target.value);
    setTimeout(() => {
      renderPropertyMarkers(appState.properties, selectProperty);
      if (appState.properties.length) {
        fitPropertiesBounds(appState.properties);
      }
    }, 250);
  });

  $("btnCloseGalleryAdmin")?.addEventListener("click", () => {
    closeGalleryAdminModal();
  });

  $("btnUploadGalleryImages")?.addEventListener("click", async () => {
    try {
      if (!appState.selectedPropertyId) {
        setGalleryAdminMessage("No hay propiedad seleccionada.", true);
        return;
      }

      const files = getGalleryAdminFiles();
      if (!files.length) {
        setGalleryAdminMessage("Selecciona una o más imágenes.", true);
        return;
      }

      setGalleryAdminMessage("Subiendo imágenes...");
      await appendPropertyGallery(appState.selectedPropertyId, files);
      clearGalleryAdminInput();
      await refreshGalleryAdmin(appState.selectedPropertyId);
      await loadAndRender(false);
      setGalleryAdminMessage("Imágenes agregadas correctamente.");
    } catch (err) {
      console.error(err);
      setGalleryAdminMessage(err.message || "Error agregando imágenes.", true);
    }
  });

  $("btn3D")?.addEventListener("click", () => {
    const state3D = toggle3D();
    if ($("btn3D")) {
      $("btn3D").textContent = state3D ? "3D: ON" : "3D: OFF";
    }
  });

  $("btnAddDemo")?.addEventListener("click", async () => {
    try {
      await addDemoProperty();
      await loadAndRender(true);
    } catch (err) {
      console.error(err);
      alert(err.message || "Error insertando demo.");
    }
  });

  $("btnSeedDemo")?.addEventListener("click", async () => {
    try {
      await seedDemoProperties();
      alert("Demo realista cargado.");
      await loadAndRender(true);
    } catch (err) {
      console.error(err);
      alert(err.message || "Error cargando demo realista.");
    }
  });
}

async function login() {
  try {
    const email = $("loginEmail")?.value.trim() || "";
    const password = $("loginPassword")?.value.trim() || "";

    if ($("authMsg")) $("authMsg").textContent = "";

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      if ($("authMsg")) $("authMsg").textContent = error.message;
      return;
    }

    location.reload();
  } catch (err) {
    console.error("Error en login:", err);
  }
}

async function logout() {
  try {
    await sb.auth.signOut();
    location.reload();
  } catch (err) {
    console.error("Error en logout:", err);
  }
}

async function loadAndRender(autoselectFirst = true) {
  try {
    const filters = {
      search: $("searchInput")?.value?.trim() || "",
      listing: $("filterListing")?.value || "all",
      type: $("filterType")?.value || "all",
      priceRange: $("filterPrice")?.value || "all"
    };

    const properties = await fetchProperties(filters);

    updateResultsCount(properties.length);

    if (!properties.length) {
      appState.selectedPropertyId = null;
      renderPropertiesList([], selectProperty);
      renderPropertyMarkers([], selectProperty);
      renderEmptyPropertyDetail();
      return;
    }

    const selectedExists = properties.some(
      (property) => String(property.id) === String(appState.selectedPropertyId)
    );

    if (!selectedExists && autoselectFirst) {
      appState.selectedPropertyId = properties[0].id;
    }

    renderPropertiesList(properties, selectProperty);
    renderPropertyMarkers(properties, selectProperty);

    const selectedProperty =
      properties.find(
        (property) => String(property.id) === String(appState.selectedPropertyId)
      ) || properties[0];

    if (selectedProperty) {
      appState.selectedPropertyId = selectedProperty.id;
      renderPropertyDetail(selectedProperty, {
  onEdit: handleEditProperty,
  onDelete: handleDeleteProperty,
  onManageGallery: handleManageGallery,
  onManageLeads: handleManageLeads,
  onPropertyWhatsApp: handlePropertyWhatsApp
});
      highlightSelectedPropertyCard();
      highlightSelectedMarker();
      fitPropertiesBounds(properties);
    }
  } catch (err) {
    console.error("Error en loadAndRender():", err);
    updateResultsCount(0);
    renderPropertiesList([], selectProperty);
    renderEmptyPropertyDetail();
  }
}

function selectProperty(property, flyToMap = true) {
  if (!property) return;

  appState.selectedPropertyId = property.id;

  highlightSelectedPropertyCard();
  highlightSelectedMarker();

  renderPropertyDetail(property, {
    onEdit: handleEditProperty,
    onDelete: handleDeleteProperty,
    onManageGallery: handleManageGallery,
    onManageLeads: handleManageLeads,
    onPropertyWhatsApp: handlePropertyWhatsApp
  });

  restorePropertyDetail();
  scrollSelectedPropertyCardIntoView();

  if (flyToMap) {
    focusPropertyOnMap(property);
  }
}

function handleEditProperty(property) {
  if (!property) return;

  clearPropertyForm();
  setPropertyFormMessage("");
  openPropertyForm();

  setTimeout(() => {
    initPropertyFormMap();
    fillPropertyForm(property);
  }, 100);
}

async function handleManageGallery(property) {
  if (!property) return;

  appState.selectedPropertyId = property.id;
  openGalleryAdminModal();
  await refreshGalleryAdmin(property.id);
}

async function refreshGalleryAdmin(propertyId) {
  try {
    setGalleryAdminMessage("");
    const items = await fetchPropertyImages([propertyId]);

    renderGalleryAdmin(items, {
      onSetCover: async (item) => {
        try {
          setGalleryAdminMessage("Actualizando portada...");
          await setPropertyCoverImage(propertyId, item.id);
          await refreshGalleryAdmin(propertyId);
          await loadAndRender(false);
          setGalleryAdminMessage("Portada actualizada.");
        } catch (err) {
          console.error(err);
          setGalleryAdminMessage(err.message || "Error actualizando portada.", true);
        }
      },
      onDelete: async (item) => {
        const ok = window.confirm("¿Eliminar esta imagen?");
        if (!ok) return;

        try {
          setGalleryAdminMessage("Eliminando imagen...");
          await deletePropertyImage(item.id);
          await refreshGalleryAdmin(propertyId);
          await loadAndRender(false);
          setGalleryAdminMessage("Imagen eliminada.");
        } catch (err) {
          console.error(err);
          setGalleryAdminMessage(err.message || "Error eliminando imagen.", true);
        }
      }
    });
  } catch (err) {
    console.error(err);
    setGalleryAdminMessage(err.message || "Error cargando galería.", true);
  }
}

async function handleManageLeads(property) {
  if (!property) return;

  appState.selectedPropertyId = property.id;
  openLeadListModal();
  await refreshPropertyLeads(property.id);
}

async function refreshPropertyLeads(propertyId) {
  try {
    setLeadListMessage("");
    const items = await fetchPropertyLeads(propertyId);

    renderLeadList(items, {
      onStage: async (item, stage) => {
        try {
          setLeadListMessage("Actualizando etapa...");
          await updateLeadStage(item.id, stage);
          await refreshPropertyLeads(propertyId);
          setLeadListMessage("Etapa actualizada.");
        } catch (err) {
          console.error(err);
          setLeadListMessage(err.message || "Error actualizando etapa.", true);
        }
      },

      onWhatsApp: (item) => {
  const property = appState.properties.find(
    (p) => String(p.id) === String(propertyId)
  );

  const url = buildWhatsAppLeadUrl(item, property?.title || "");

  console.log("WhatsApp lead:", item);
  console.log("WhatsApp URL:", url);

  if (!url) {
    setLeadListMessage("Este lead no tiene teléfono válido.", true);
    return;
  }

  window.location.href = url;
},

      onDelete: async (item) => {
        const ok = window.confirm(`¿Eliminar lead "${item.full_name}"?`);
        if (!ok) return;

        try {
          setLeadListMessage("Eliminando lead...");
          await deletePropertyLead(item.id);
          await refreshPropertyLeads(propertyId);
          setLeadListMessage("Lead eliminado.");
        } catch (err) {
          console.error(err);
          setLeadListMessage(err.message || "Error eliminando lead.", true);
        }
      }
    });
  } catch (err) {
    console.error(err);
    setLeadListMessage(err.message || "Error cargando leads.", true);
  }
}

async function handleDeleteProperty(property) {
  if (!property) return;

  const ok = window.confirm(`¿Deseas eliminar la propiedad "${property.title}"?`);
  if (!ok) return;

  try {
    await deleteProperty(property.id);
    if (String(appState.selectedPropertyId) === String(property.id)) {
      appState.selectedPropertyId = null;
    }
    await loadAndRender(true);
  } catch (err) {
    console.error(err);
    alert(err.message || "Error eliminando propiedad.");
  }
}

async function renderFollowupAlerts(){

  const el = document.querySelector('.nav-link[href="followups.html"]');
  if(!el) return;

  const { overdue, today } = await getFollowupsCount();

  const total = overdue + today;

  if(total === 0){
    el.textContent = "Seguimiento";
    return;
  }

  el.innerHTML = `
    Seguimiento 
    <span class="badge-alert ${overdue ? "red" : "yellow"}">
      ${total}
    </span>
  `;
}

function renderCurrentUserBadge() {
  const badge = $("userBadge");
  if (!badge || !appState.currentProfile) return;

  const name = appState.currentProfile.full_name || "Usuario";
  const role = appState.currentProfile.role || "asesor";

  badge.textContent = `${name} · ${role}`;
  badge.classList.remove("hidden");
}
function handlePropertyWhatsApp(property) {
  if (!property) return;

  const message = `Hola, me interesa recibir más información de la propiedad "${property.title}" ubicada en ${property.address || property.city || "la zona indicada"}. Precio: ${Number(property.price || 0).toLocaleString("es-MX")} ${property.currency || "MXN"}.`;

  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;

  window.location.href = url;
}

init();