import { sb } from "../core/supabase.js";
import { uploadPropertyImage } from "./property-images-service.js";
import { uploadMultiplePropertyImages, savePropertyGallery } from "./property-gallery-service.js";

export async function createProperty(payload) {
  const { data: { user }, error: userError } = await sb.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Primero inicia sesión.");

  const files = Array.isArray(payload.imageFiles) ? payload.imageFiles : [];

  let coverPath = null;

  // Primera imagen = portada
  if (files.length > 0) {
    coverPath = await uploadPropertyImage(files[0], user.id);
  }

  const row = {
    created_by: user.id,
    title: payload.title,
    description: payload.description || null,
    listing_type: payload.listing_type || "sale",
    property_type: payload.property_type || "house",
    status: "active",
    price: Number(payload.price || 0),
    currency: "MXN",
    city: payload.city || null,
    state: payload.state || null,
    address: payload.address || null,
    lat: payload.lat,
    lng: payload.lng,
    beds: Number(payload.beds || 0),
    baths: Number(payload.baths || 0),
    sqft: Number(payload.sqft || 0),
    broker_name: payload.broker_name || null,
    cover_url: coverPath
  };

  console.log("createProperty payload:", payload);
  console.log("files:", files);
  console.log("coverPath:", coverPath);

  const { data, error } = await sb
    .from("properties")
    .insert(row)
    .select()
    .single();

  if (error) throw error;

  console.log("property inserted:", data);

  // Guardar galería completa
  if (files.length > 0) {
    const remainingFiles = files.slice(1);
    const remainingPaths = remainingFiles.length
      ? await uploadMultiplePropertyImages(remainingFiles, user.id)
      : [];

    const allPaths = [
      ...(coverPath ? [coverPath] : []),
      ...remainingPaths
    ];

    console.log("gallery paths to save:", allPaths);

    if (allPaths.length) {
      await savePropertyGallery(data.id, allPaths);
    }
  }

  return data;
}