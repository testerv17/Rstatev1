import { sb } from "../core/supabase.js";
import { appState } from "../core/state.js";
import { DEMO_PROPERTIES } from "../core/demo-properties.js";
import { getPropertyImageUrl } from "./property-images-service.js";
import { fetchPropertyImages } from "./property-gallery-service.js";

export async function fetchProperties(filters = {}) {
  const {
    search = "",
    listing = "all",
    type = "all",
    priceRange = "all"
  } = filters;

  let query = sb.from("properties").select("*").eq("status", "active");

    const role = appState.currentProfile?.role || "asesor";
    const currentUserId = appState.currentUser?.id || null;

  if (role !== "admin" && currentUserId) {
    query = query.eq("created_by", currentUserId);
  }

  if (listing !== "all") {
    query = query.eq("listing_type", listing);
  }

  if (type !== "all") {
    query = query.eq("property_type", type);
  }

  if (priceRange !== "all") {
    const [min, max] = priceRange.split("-").map(Number);
    query = query.gte("price", min).lte("price", max);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) {
    console.error("Error cargando propiedades:", error);
    throw error;
  }

  const normalizedSearch = String(search || "").trim().toLowerCase();

  let filtered = (data || []).filter((property) => {
    if (!normalizedSearch) return true;

    const hay = `${property.title || ""} ${property.city || ""} ${property.state || ""} ${property.address || ""}`.toLowerCase();
    return hay.includes(normalizedSearch);
  });

  const propertyIds = filtered.map((p) => p.id);
  const galleryRows = await fetchPropertyImages(propertyIds);

  const galleryByProperty = {};
  for (const row of galleryRows) {
    if (!galleryByProperty[row.property_id]) {
      galleryByProperty[row.property_id] = [];
    }
    galleryByProperty[row.property_id].push(row);
  }

  filtered = await Promise.all(
    filtered.map(async (property) => {
      let cover = property.cover_url || null;

      if (cover && !/^https?:\/\//i.test(cover)) {
        cover = await getPropertyImageUrl(cover);
      }

      return {
        ...property,
        cover_url: cover || null,
        gallery: galleryByProperty[property.id] || []
      };
    })
  );

  appState.properties = filtered;
  return filtered;
}

export async function addDemoProperty() {
  const { data: { user }, error: userError } = await sb.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Primero inicia sesión.");
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
    console.error("Error insertando demo:", error);
    throw error;
  }

  return true;
}

export async function seedDemoProperties() {
  const { data: { user }, error: userError } = await sb.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Primero inicia sesión.");
  }

  const rows = DEMO_PROPERTIES.map((property) => ({
    created_by: user.id,
    title: property.title,
    price: Number(property.price),
    currency: property.currency || "MXN",
    city: property.city,
    state: property.state,
    address: property.address,
    beds: Number(property.beds || 0),
    baths: Number(property.baths || 0),
    sqft: Number(property.sqft || 0),
    status: property.status || "active",
    listing_type: property.listing_type || "sale",
    property_type: property.property_type || "house",
    lat: Number(property.lat),
    lng: Number(property.lng),
    cover_url: property.cover_url || null,
    description: property.description || null
  }));

  const { error } = await sb.from("properties").insert(rows);

  if (error) {
    console.error("Error cargando demo realista:", error);
    throw error;
  }

  return true;
}