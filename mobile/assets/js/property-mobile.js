/**
 * Rstatev1 — Property Experience Mobile V3 FIX PROPERTY LOOKUP
 *
 * Mejora:
 * - Acepta ?id=, ?property_id= o ?pid=
 * - Si el ID no existe, cae a la propiedad activa más reciente
 * - Si tampoco existe, intenta cualquier propiedad más reciente
 * - Log detallado en consola
 */

import { sb } from "../../../assets/js/core/supabase.js";

const qs = new URLSearchParams(location.search);
const requestedId =
  qs.get("id") ||
  qs.get("property_id") ||
  qs.get("pid");

const STORAGE_BUCKET = "property-images";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

let property = null;
let media = [];

const $ = (selector) => document.querySelector(selector);

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogg|ogv)(?:\?|#|$)/i;
const PANORAMA_HINT = /(360|panorama|pano|equirect)/i;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function formatMoney(value, currency = "MXN") {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-MX", {
    style: "currency",
    currency: currency || "MXN",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function isHttpUrl(value = "") {
  return /^https?:\/\//i.test(String(value));
}

function classifyMedia(path = "") {
  if (VIDEO_EXTENSIONS.test(String(path))) return "video";
  if (PANORAMA_HINT.test(String(path))) return "360";
  return "image";
}

async function signStoragePath(path) {
  if (!path) return null;
  if (isHttpUrl(path)) return path;

  const cleanPath = String(path).replace(/^\/+/, "");

  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(cleanPath, SIGNED_URL_SECONDS);

  if (error) {
    console.warn("No se pudo firmar:", cleanPath, error);
    return null;
  }

  return data?.signedUrl || null;
}

async function querySingleById(id) {
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function queryLatestActive() {
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Si la columna status no existe, no queremos abortar aquí.
  if (error) {
    console.warn("No se pudo consultar status=active:", error.message);
    return null;
  }

  return data || null;
}

async function queryLatestAny() {
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchProperty() {
  console.group("Property lookup");
  console.log("URL:", location.href);
  console.log("ID solicitado:", requestedId || "(sin id)");

  if (requestedId) {
    const byId = await querySingleById(requestedId);

    if (byId) {
      console.log("Propiedad encontrada por ID:", byId.id);
      console.groupEnd();
      return byId;
    }

    console.warn("No existe una propiedad visible con ese ID. Intentando fallback...");
  }

  const latestActive = await queryLatestActive();

  if (latestActive) {
    console.log("Usando propiedad activa más reciente:", latestActive.id);
    console.groupEnd();
    return latestActive;
  }

  const latestAny = await queryLatestAny();

  if (latestAny) {
    console.log("Usando propiedad más reciente sin filtrar status:", latestAny.id);
    console.groupEnd();
    return latestAny;
  }

  console.groupEnd();
  throw new Error(
    "Supabase no devolvió propiedades desde la tabla 'properties'. " +
    "Revisa que existan registros visibles para la sesión actual y las políticas RLS."
  );
}

async function fetchPropertyMedia() {
  const { data, error } = await sb
    .from("property_images")
    .select("*")
    .eq("property_id", property.id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("No se pudo leer property_images:", error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];

  const signed = await Promise.all(
    rows.map(async (row, index) => {
      const rawPath =
        row.image_url ||
        row.url ||
        row.path ||
        row.file_path ||
        "";

      const signedUrl = await signStoragePath(rawPath);
      if (!signedUrl) return null;

      return {
        ...row,
        raw_path: rawPath,
        image_url: signedUrl,
        type: classifyMedia(rawPath),
        order: Number(row.sort_order ?? index),
        title:
          row.title ||
          row.room ||
          row.category ||
          `Espacio ${index + 1}`
      };
    })
  );

  return signed.filter(Boolean);
}

async function resolveCover() {
  if (property.cover_url) {
    const signed = await signStoragePath(property.cover_url);
    if (signed) return signed;
  }

  const cover = media.find((item) => item.is_cover && item.type === "image");
  if (cover) return cover.image_url;

  return media.find((item) => item.type === "image")?.image_url || null;
}

async function renderProperty() {
  const images = media.filter((item) => item.type === "image");
  const videos = media.filter((item) => item.type === "video");
  const panoramas = media.filter((item) => item.type === "360");

  const cover = await resolveCover();

  const title = property.title || "Propiedad";
  const locationText = [property.city, property.state].filter(Boolean).join(", ");
  const area = property.area_m2 ?? property.sqft ?? "—";

  $("#propertyTitle").textContent = title;
  $("#propertyLocation").textContent = locationText;
  $("#propertyPrice").textContent = formatMoney(property.price, property.currency || "MXN");
  $("#stickyPrice").textContent = formatMoney(property.price, property.currency || "MXN");

  $("#listingType").textContent =
    property.listing_type === "rent" ? "RENTA" : "VENTA";

  $("#heroBeds").textContent = property.beds ?? "—";
  $("#heroBaths").textContent = property.baths ?? "—";
  $("#heroArea").textContent = area;

  $("#factConstruction").textContent = area;
  $("#factLand").textContent = property.land_m2 ?? property.lot_m2 ?? "—";
  $("#factBeds").textContent = property.beds ?? "—";
  $("#factBaths").textContent = property.baths ?? "—";

  $("#propertyDescription").textContent =
    property.description || "Propiedad premium en excelente ubicación.";

  $("#locationTitle").textContent = locationText || "Ubicación";
  $("#locationAddress").textContent = property.address || "";

  if (cover) {
    $("#heroImage").src = cover;
    $("#galleryCover").src = images[1]?.image_url || cover;
    $("#videoCover").src = images[2]?.image_url || cover;
  }

  $("#galleryCount").textContent =
    `${images.length} foto${images.length === 1 ? "" : "s"}`;

  const videoMeta = document.querySelector('[data-action="video"] em');
  if (videoMeta) {
    videoMeta.textContent = videos.length
      ? `▶ ${videos.length} video${videos.length === 1 ? "" : "s"}`
      : "Sin video";
  }

  const tourMeta = document.querySelector('[data-action="tour360"] em');
  if (tourMeta) {
    tourMeta.textContent = panoramas.length
      ? `${panoramas.length} escena${panoramas.length === 1 ? "" : "s"} 360°`
      : "Próximamente";
  }

  renderSpaces(images);
  renderAmenities(property.amenities);
}

function renderSpaces(images) {
  const rail = $("#spaceRail");
  if (!rail) return;

  if (!images.length) {
    rail.innerHTML = `<div class="amenity">Sin fotografías disponibles</div>`;
    return;
  }

  rail.innerHTML = images.slice(0, 12).map((item, index) => `
    <button class="space-card" data-action="gallery" data-index="${index}" type="button">
      <img src="${item.image_url}" alt="Foto ${index + 1}" loading="lazy">
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>Explorar</small>
      </span>
    </button>
  `).join("");
}

function renderAmenities(raw) {
  const target = $("#amenities");
  if (!target) return;

  let amenities = raw;

  if (typeof amenities === "string") {
    try {
      amenities = JSON.parse(amenities);
    } catch {
      amenities = amenities.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(amenities) || !amenities.length) {
    target.innerHTML = `<span class="amenity">Información por confirmar</span>`;
    return;
  }

  target.innerHTML = amenities
    .map((item) => `<span class="amenity">${escapeHtml(item)}</span>`)
    .join("");
}

function openNotice(title, message) {
  $("#dialogContent").innerHTML = `
    <div class="tour-placeholder">
      <div>
        <div class="tour-orb">✦</div>
        <h2>${escapeHtml(title)}</h2>
        <p style="color:#a6a9b2;max-width:360px">${escapeHtml(message)}</p>
      </div>
    </div>
  `;

  $("#mediaDialog").showModal();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;

    const action = trigger.dataset.action;

    if (action === "gallery") {
      const images = media.filter((item) => item.type === "image");
      if (!images.length) return openNotice("Galería", "No hay fotos disponibles.");

      $("#dialogContent").innerHTML = `
        <div class="gallery-view">
          ${images.map((item, index) => `
            <figure>
              <img src="${item.image_url}" alt="Foto ${index + 1}">
              <figcaption>${escapeHtml(item.title)} · ${index + 1}/${images.length}</figcaption>
            </figure>
          `).join("")}
        </div>
      `;
      $("#mediaDialog").showModal();
    }

    if (action === "video") {
      const videos = media.filter((item) => item.type === "video");
      if (!videos.length) return openNotice("Video", "No encontré videos asociados.");

      $("#dialogContent").innerHTML = `
        <div class="video-view">
          <video controls autoplay playsinline src="${videos[0].image_url}"></video>
        </div>
      `;
      $("#mediaDialog").showModal();
    }

    if (action === "tour360") {
      openNotice("Tour 360°", "El visor 360° se conectará en la siguiente fase.");
    }
  });

  $("#closeDialog")?.addEventListener("click", () => $("#mediaDialog").close());
}

async function init() {
  try {
    bindEvents();

    property = await fetchProperty();
    media = await fetchPropertyMedia();

    console.group("Property Experience Mobile");
    console.log("Propiedad final:", property);
    console.log("Medios totales:", media.length);
    console.log("Fotos:", media.filter((item) => item.type === "image").length);
    console.log("Videos:", media.filter((item) => item.type === "video").length);
    console.groupEnd();

    await renderProperty();
  } catch (error) {
    console.error("Error inicializando Property Mobile:", error);

    setTimeout(() => {
      openNotice(
        "No pudimos abrir la propiedad",
        error.message || "Ocurrió un error cargando la información."
      );
    }, 100);
  }
}

init();
