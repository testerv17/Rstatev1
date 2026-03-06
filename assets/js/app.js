import { CONFIG } from "./config.js";
import { DEMO_PROPERTIES } from "./demo-properties.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

let map = null;
let markers = [];
let currentStyleKey = "streets";
let is3D = false;

const MONTERREY_CENTER = [-100.3161, 25.6866];

async function init() {
  console.log("APP FINAL CARGADO");

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
}

function wireUI() {
  console.log("wireUI ejecutado");

  $("btnLogin")?.addEventListener("click", login);
  $("btnLogout")?.addEventListener("click", logout);

  $("searchInput")?.addEventListener("input", debounce(loadAndRender, 350));

  ["filterListing", "filterType", "filterPrice"].forEach((id) => {
    $(id)?.addEventListener("change", loadAndRender);
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

  $("btnSeedDemo")?.addEventListener("click", async () => {
    console.log("Click en btnSeedDemo detectado");
    await seedDemoProperties();
  });
}

async function login() {
  const email = $("loginEmail")?.value.trim() || "";
  const password = $("loginPassword")?.value.trim() || "";

  if ($("authMsg")) $("authMsg").textContent = "";

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Error login:", error);
    if ($("authMsg")) $("authMsg").textContent = error.message;
    return;
  }

  location.reload();
}

async function logout() {
  await sb.auth.signOut();
  location.reload();
}

function initMap() {
  if (map) return;

  map = new mapboxgl.Map({
    container: "map",
    style: CONFIG.MAP_STYLES[currentStyleKey],
    center: MONTERREY_CENTER,
    zoom: 11
  });

  map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

  map.on("load", () => {
    console.log("Mapa cargado en Monterrey");
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
    await loadAndRender();
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

async function loadAndRender() {
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

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      console.error("Error cargando propiedades:", error);
      if ($("resultsCount")) $("resultsCount").textContent = "Error cargando";
      return;
    }

    const filtered = (data || []).filter((p) => {
      if (!q) return true;
      const hay =
        `${p.title || ""} ${p.city || ""} ${p.state || ""} ${p.address || ""}`.toLowerCase();
      return hay.includes(q);
    });

    if ($("resultsCount")) {
      $("resultsCount").textContent = `${filtered.length} resultados`;
    }

    renderList(filtered);
    renderMap(filtered);
  } catch (err) {
    console.error("Fallo general en loadAndRender:", err);
  }
}

function renderList(items) {
  const el = $("resultsList");
  if (!el) return;

  el.innerHTML = "";

  items.forEach((p) => {
    const card = document.createElement("div");
    card.className = "prop-card";
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

    card.addEventListener("click", () => focusProperty(p));
    el.appendChild(card);
  });
}

function renderMap(items) {
  if (!map) return;

  markers.forEach((m) => m.remove());
  markers = [];

  items.forEach((p) => {
    if (p.lat == null || p.lng == null) return;

    const node = document.createElement("div");
    node.className = "price-marker";
    node.textContent = shortPrice(p.price, p.currency || "MXN");

    const marker = new mapboxgl.Marker(node)
      .setLngLat([Number(p.lng), Number(p.lat)])
      .addTo(map);

    node.addEventListener("click", (e) => {
      e.stopPropagation();
      focusProperty(p);
    });

    markers.push(marker);
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
}

function focusProperty(p) {
  if (map && p.lng != null && p.lat != null) {
    map.flyTo({
      center: [Number(p.lng), Number(p.lat)],
      zoom: Math.max(map.getZoom(), 14),
      speed: 1.2
    });
  }

  if (!$("selectedCard")) return;

  $("selectedCard").innerHTML = `
    <div class="selected-wrap">
      <div class="selected-img" style="background-image:url('${escapeAttr(p.cover_url || defaultCover())}')"></div>
      <div class="selected-info">
        <div class="selected-price">${formatPrice(p.price, p.currency || "MXN")}</div>
        <div class="selected-title">${escapeHtml(p.title)}</div>
        <div class="selected-meta">${escapeHtml(p.address || "")}</div>
        <div class="selected-actions">
          <button class="btn btn-primary" type="button">Ver detalle</button>
          <button class="btn btn-ghost" type="button">Compartir</button>
        </div>
      </div>
    </div>
  `;
}

async function addDemoProperty() {
  try {
    const { data: { user }, error: userError } = await sb.auth.getUser();

    if (userError) {
      console.error("Error obteniendo usuario:", userError);
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
      cover_url:
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1400&q=80",
      description: "Demo listing"
    };

    const { data, error } = await sb.from("properties").insert(demo).select();

    console.log("Insert demo data:", data);
    console.log("Insert demo error:", error);

    if (error) {
      alert("Error insertando demo: " + error.message);
      return;
    }

    await loadAndRender();
  } catch (err) {
    console.error("Fallo general addDemoProperty:", err);
    alert("Fallo general addDemoProperty: " + err.message);
  }
}

async function seedDemoProperties() {
  try {
    console.log("seedDemoProperties ejecutándose...");

    const { data: { user }, error: userError } = await sb.auth.getUser();

    console.log("USER:", user);
    console.log("USER ERROR:", userError);

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

    console.log("ROWS A INSERTAR:", rows);

    const { data, error } = await sb.from("properties").insert(rows).select();

    console.log("INSERT DATA:", data);
    console.log("INSERT ERROR:", error);

    if (error) {
      alert("Error cargando demo realista: " + error.message);
      return;
    }

    alert("Demo realista cargado.");
    await loadAndRender();
  } catch (err) {
    console.error("Fallo general seedDemoProperties:", err);
    alert("Fallo general seedDemoProperties: " + err.message);
  }
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("es-MX", {
    maximumFractionDigits: 0
  });
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
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function escapeAttr(str) {
  return String(str ?? "").replace(/'/g, "&#39;");
}

function defaultCover() {
  return "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80";
}

init();
