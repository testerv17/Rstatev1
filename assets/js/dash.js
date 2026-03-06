import { CONFIG } from "../config.js";
import { DEMO_PROPERTIES } from "./demo-properties.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

let map = null;
let markers = [];
let currentStyleKey = "streets";
let is3D = false;
let selectedPropertyId = null;

const MONTERREY_CENTER = [-100.3161, 25.6866];

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

    $("authPanel")?.classList.add("hidden");
    $("appShell")?.classList.remove("hidden");

    initMap();
    await loadAndRender();
  } catch (err) {
    console.error("Error fatal en init:", err);
  }
}

function wireUI() {
  $("btnLogin")?.addEventListener("click", login);
  $("btnLogout")?.addEventListener("click", logout);

  $("searchInput")?.addEventListener("input", debounce(() => loadAndRender(), 300));

  ["filterListing", "filterType", "filterPrice"].forEach((id) => {
    $(id)?.addEventListener("change", () => loadAndRender());
  });

  $("mapStyle")?.addEventListener("change", (e) => {
    currentStyleKey = e.target.value;
    setMapStyle(currentStyleKey);
  });

  $("btn3D")?.addEventListener("click", () => {
    is3D = !is3D;
    apply3DBuildings();
    if ($("btn3D")) {
      $("btn3D").textContent = is3D ? "3D: ON" : "3D: OFF";
    }
  });

  $("btnAddDemo")?.addEventListener("click", addDemoProperty);
  $("btnSeedDemo")?.addEventListener("click", seedDemoProperties);
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

function initMap() {
  if (map) return;
  if (!$("map")) {
    console.error("No existe #map en el HTML");
    return;
  }

  map = new mapboxgl.Map({
    container: "map",
    style: CONFIG.MAP_STYLES[currentStyleKey],
    center: MONTERREY_CENTER,
    zoom: 11
  });

  map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

  map.on("load", () => {
    apply3DBuildings();
  });
}

function setMapStyle(key) {
  if (!map) return;

  const styleUrl = CONFIG.MAP_STYLES[key] || CONFIG.MAP_STYLES.streets;
  const center = map.getCenter();
  const zoom = map.getZoom();
  const pitch = map.getPitch();
  const bearing = map.getBearing();

  map.setStyle(styleUrl);

  map.once("styledata", async () => {
    map.setCenter(center);
    map.setZoom(zoom);
    map.setPitch(pitch);
    map.setBearing(bearing);
    apply3DBuildings();
    await loadAndRender(false);
  });
}

function apply3DBuildings() {
  if (!map) return;

  if (is3D) {
    map.easeTo({ pitch: 60, bearing: -20, duration: 600 });
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }

  const tryAdd = () => {
    if (!is3D) {
      if (map.getLayer("3d-buildings")) {
        map.removeLayer("3d-buildings");
      }
      return;
    }

    if (map.getLayer("3d-buildings")) return;
    if (!map.getSource("composite")) return;

    const layers = map.getStyle().layers || [];
    const labelLayerId = layers.find(
      (l) => l.type === "symbol" && l.layout && l.layout["text-field"]
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

async function loadAndRender(autoselectFirst = true) {
  try {
    const q = $("searchInput")?.value?.trim().toLowerCase() || "";
    const listing = $("filterListing")?.value || "all";
    const type = $("filterType")?.value || "all";
    const priceRange = $("filterPrice")?.value || "all";

    let query = sb.from("properties").select("*").eq("status", "active");

    if (listing !== "all") query = query.eq("listing_type", listing);
    if (type !== "all") query = query.eq("property_type", type);

    if (priceRange !== "all") {
      const [min, max] = priceRange.split("-").map(Number);
      query = query.gte("price", min).lte("price", max);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(150);

    if (error) {
      console.error("Error cargando propiedades:", error);
      if ($("resultsCount")) $("resultsCount").textContent = "Error cargando";
      return;
    }

    const filtered = (data || []).filter((p) => {
      if (!q) return true;
      const hay = `${p.title || ""} ${p.city || ""} ${p.state || ""} ${p.address || ""}`.toLowerCase();
      return hay.includes(q);
    });

    if ($("resultsCount")) $("resultsCount").textContent = `${filtered.length} resultados`;

    if (filtered.length === 0) {
      selectedPropertyId = null;
      renderList([]);
      renderMap([]);
      renderEmptyDetail();
      return;
    }

    const selectedExists = filtered.some((p) => String(p.id) === String(selectedPropertyId));

    if (!selectedExists && autoselectFirst) {
      selectedPropertyId = filtered[0].id;
    }

    renderList(filtered);
    renderMap(filtered);

    const selected = filtered.find((p) => String(p.id) === String(selectedPropertyId)) || filtered[0];
    if (selected) {
      selectedPropertyId = selected.id;
      renderDetail(selected);
    }
  } catch (err) {
    console.error("Fallo general en loadAndRender:", err);
  }
}

function renderList(items) {
  const el = $("resultsList");
  if (!el) return;

  el.innerHTML = "";

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">No se encontraron propiedades.</div>`;
    return;
  }

  items.forEach((p) => {
    const card = document.createElement("div");
    card.className = "prop-card" + (String(p.id) === String(selectedPropertyId) ? " active" : "");
    card.dataset.id = p.id;

    card.innerHTML = `
      <div class="prop-img" style="background-image:url('${escapeAttr(p.cover_url || defaultCover())}')">
        <span class="chip">${p.listing_type === "sale" ? "En venta" : "En renta"}</span>
      </div>
      <div class="prop-body">
        <div class="prop-price">${formatPrice(p.price, p.currency || "MXN")}</div>
        <div class="prop-title">${escapeHtml(p.title)}</div>
        <div class="prop-meta">${escapeHtml(p.city || "")}${p.state ? ", " + escapeHtml(p.state) : ""}</div>
        <div class="prop-spec">
          <span>${p.beds || 0} Rec</span>
          <span>${p.baths || 0} Baños</span>
          <span>${p.sqft ? formatMoney(p.sqft) + " sqft" : "—"}</span>
        </div>
        <div class="prop-actions">
          <button class="btn btn-primary" type="button">Ver</button>
          <button class="btn btn-ghost" type="button">Guardar</button>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      e.preventDefault();
      selectProperty(p, true);
    });

    el.appendChild(card);
  });
}

function renderMap(items) {
  if (!map) return;

  markers.forEach((entry) => entry.marker.remove());
  markers = [];

  items.forEach((p) => {
    if (p.lat == null || p.lng == null) return;

    const node = document.createElement("div");
    node.className = "price-marker" + (String(p.id) === String(selectedPropertyId) ? " active" : "");
    node.textContent = shortPrice(p.price, p.currency || "MXN");

    const marker = new mapboxgl.Marker(node)
      .setLngLat([Number(p.lng), Number(p.lat)])
      .addTo(map);

    node.addEventListener("click", (e) => {
      e.stopPropagation();
      selectProperty(p, true);
    });

    markers.push({ id: p.id, marker, node });
  });

  const coords = items
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => [Number(p.lng), Number(p.lat)]);

  if (coords.length >= 2) {
    const bounds = coords.reduce(
      (acc, coord) => acc.extend(coord),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 70, duration: 700 });
  } else if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: 14, duration: 700 });
  } else {
    map.flyTo({ center: MONTERREY_CENTER, zoom: 11, duration: 700 });
  }

  highlightSelectedMarker();
}

function selectProperty(property, flyToMap = true) {
  selectedPropertyId = property.id;
  highlightSelectedCard();
  highlightSelectedMarker();
  renderDetail(property);

  if (flyToMap && map && property.lng != null && property.lat != null) {
    map.flyTo({
      center: [Number(property.lng), Number(property.lat)],
      zoom: Math.max(map.getZoom(), 14),
      speed: 1.1
    });
  }

  scrollSelectedCardIntoView();
}

function highlightSelectedCard() {
  document.querySelectorAll(".prop-card").forEach((card) => {
    card.classList.toggle("active", String(card.dataset.id) === String(selectedPropertyId));
  });
}

function highlightSelectedMarker() {
  markers.forEach((entry) => {
    entry.node.classList.toggle("active", String(entry.id) === String(selectedPropertyId));
  });
}

function scrollSelectedCardIntoView() {
  const card = document.querySelector(`.prop-card[data-id="${selectedPropertyId}"]`);
  const list = $("resultsList");
  if (!card || !list) return;

  const cardTop = card.offsetTop;
  const cardBottom = cardTop + card.offsetHeight;
  const viewTop = list.scrollTop;
  const viewBottom = viewTop + list.clientHeight;

  if (cardTop < viewTop) {
    list.scrollTo({ top: cardTop - 12, behavior: "smooth" });
  } else if (cardBottom > viewBottom) {
    list.scrollTo({ top: cardBottom - list.clientHeight + 12, behavior: "smooth" });
  }
}

function renderDetail(p) {
  const target = $("selectedCard");
  if (!target) return;

  target.innerHTML = `
    <div class="detail-cover" style="background-image:url('${escapeAttr(p.cover_url || defaultCover())}')"></div>

    <div class="detail-badge-row">
      <span class="detail-badge">${p.listing_type === "sale" ? "Venta" : "Renta"}</span>
      <span class="detail-badge">${escapeHtml(propertyTypeLabel(p.property_type))}</span>
    </div>

    <div class="detail-price">${formatPrice(p.price, p.currency || "MXN")}</div>
    <div class="detail-title">${escapeHtml(p.title)}</div>
    <div class="detail-location">${escapeHtml(p.address || "")}</div>

    <div class="detail-grid">
      <div class="detail-stat">
        <div class="detail-stat-label">Recámaras</div>
        <div class="detail-stat-value">${p.beds || 0}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-label">Baños</div>
        <div class="detail-stat-value">${p.baths || 0}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-label">Superficie</div>
        <div class="detail-stat-value">${p.sqft ? formatMoney(p.sqft) + " sqft" : "—"}</div>
      </div>
    </div>

    <div class="detail-desc">
      ${escapeHtml(p.description || "Propiedad premium en excelente ubicación.")}
    </div>

    <div class="detail-actions">
      <button class="btn btn-primary" type="button">Ver detalle</button>
      <button class="btn btn-ghost" type="button">Compartir</button>
      <button class="btn btn-ghost" type="button">WhatsApp</button>
      <button class="btn btn-soft" type="button">Agendar visita</button>
    </div>
  `;
}

function renderEmptyDetail() {
  const target = $("selectedCard");
  if (!target) return;
  target.innerHTML = `Selecciona una propiedad para ver sus detalles completos.`;
}

async function addDemoProperty() {
  try {
    const { data: { user }, error: userError } = await sb.auth.getUser();

    if (userError) {
      alert("Error obteniendo usuario: " + userError.message);
      return;
    }

    if (!user) {
      alert("Primero inicia sesión.");
      return;
    }

    const demo = {
      created_by: user.id,
      title: "Casa demo Monterrey",
      price: 975000,
      currency: "MXN",
      city: "Monterrey",
      state: "Nuevo León",
      address: "Zona Sur, Monterrey, N.L.",
      beds: 3,
      baths: 2,
      sqft: 1850,
      status: "active",
      listing_type: "sale",
      property_type: "house",
      lat: 25.6866,
      lng: -100.3161,
      cover_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1400&q=80",
      description: "Demo listing"
    };

    const { error } = await sb.from("properties").insert(demo);

    if (error) {
      alert("Error insertando demo: " + error.message);
      return;
    }

    await loadAndRender();
  } catch (err) {
    console.error("Error en addDemoProperty:", err);
  }
}

async function seedDemoProperties() {
  try {
    const { data: { user }, error: userError } = await sb.auth.getUser();

    if (userError) {
      alert("Error obteniendo usuario: " + userError.message);
      return;
    }

    if (!user) {
      alert("Primero inicia sesión.");
      return;
    }

    const rows = DEMO_PROPERTIES.map((p) => ({
      created_by: user.id,
      title: p.title,
      price: Number(p.price),
      currency: p.currency || "MXN",
      city: p.city,
      state: p.state,
      address: p.address,
      beds: Number(p.beds || 0),
      baths: Number(p.baths || 0),
      sqft: Number(p.sqft || 0),
      status: p.status || "active",
      listing_type: p.listing_type || "sale",
      property_type: p.property_type || "house",
      lat: Number(p.lat),
      lng: Number(p.lng),
      cover_url: p.cover_url || null,
      description: p.description || null
    }));

    const { error } = await sb.from("properties").insert(rows);

    if (error) {
      alert("Error cargando demo realista: " + error.message);
      return;
    }

    alert("Demo realista cargado.");
    await loadAndRender();
  } catch (err) {
    console.error("Error en seedDemoProperties:", err);
  }
}

function propertyTypeLabel(type) {
  const labels = {
    house: "Casa",
    apartment: "Departamento",
    land: "Terreno",
    warehouse: "Bodega",
    industrial: "Nave industrial"
  };
  return labels[type] || "Propiedad";
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

function formatPrice(value, currency = "MXN") {
  const locale = currency === "USD" ? "en-US" : "es-MX";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function shortPrice(value, currency = "MXN") {
  const v = Number(value || 0);
  const prefix = currency === "USD" ? "US$" : "$";

  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `${prefix}${Math.round(v / 1_000)}k`;
  return `${prefix}${v}`;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

function escapeAttr(str) {
  return String(str ?? "").replace(/'/g, "&#39;");
}

function defaultCover() {
  return "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80";
}

init();
