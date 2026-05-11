import { sb } from "../core/supabase.js";
import { uploadPropertyImage } from "./property-images-service.js";

export async function updateProperty(propertyId, payload) {
  const { data: { user }, error: userError } = await sb.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Primero inicia sesión.");
  if (!propertyId) throw new Error("No se encontró el ID de la propiedad a editar.");

  let coverPath = null;

  if (payload.imageFile) {
    coverPath = await uploadPropertyImage(payload.imageFile, user.id);
  }

  const row = {
    title: payload.title,
    description: payload.description || null,
    listing_type: payload.listing_type || "sale",
    property_type: payload.property_type || "house",
    price: Number(payload.price || 0),
    city: payload.city || null,
    state: payload.state || null,
    address: payload.address || null,
    lat: payload.lat,
    lng: payload.lng,
    beds: Number(payload.beds || 0),
    baths: Number(payload.baths || 0),
    sqft: Number(payload.sqft || 0),
    broker_name: payload.broker_name || null
  };

  if (coverPath) {
    row.cover_url = coverPath;
  }

  console.log("updateProperty -> propertyId:", propertyId);
  console.log("updateProperty -> row:", row);

  const { data, error } = await sb
    .from("properties")
    .update(row)
    .eq("id", propertyId)
    .select();

  if (error) {
    throw error;
  }

  if (!data || !data.length) {
    throw new Error("No se encontró la propiedad para actualizar o no tienes permiso para editarla.");
  }

  return data[0];
}

export async function deleteProperty(propertyId) {
  if (!propertyId) throw new Error("No se encontró el ID de la propiedad a eliminar.");

  const { error } = await sb
    .from("properties")
    .delete()
    .eq("id", propertyId);

  if (error) throw error;
  return true;
}