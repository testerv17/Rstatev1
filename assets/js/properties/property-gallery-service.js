import { sb } from "../core/supabase.js";
import { uploadPropertyImage, getPropertyImageUrl } from "./property-images-service.js";

export async function uploadMultiplePropertyImages(files, userId) {
  const validFiles = Array.from(files || []).filter(Boolean);
  const uploadedPaths = [];

  for (const file of validFiles) {
    const filePath = await uploadPropertyImage(file, userId);
    if (filePath) uploadedPaths.push(filePath);
  }

  return uploadedPaths;
}

export async function savePropertyGallery(propertyId, imagePaths = []) {
  if (!propertyId || !imagePaths.length) return [];

  const rows = imagePaths.map((path, index) => ({
    property_id: propertyId,
    image_url: path,
    sort_order: index,
    is_cover: index === 0
  }));

  const { data, error } = await sb
    .from("property_images")
    .insert(rows)
    .select();

  if (error) throw error;
  return data || [];
}

export async function fetchPropertyImages(propertyIds = []) {
  const ids = Array.from(new Set((propertyIds || []).filter(Boolean)));
  if (!ids.length) return [];

  const { data, error } = await sb
    .from("property_images")
    .select("*")
    .in("property_id", ids)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const rows = data || [];

  return await Promise.all(
    rows.map(async (row) => {
      let url = row.image_url;
      if (url && !/^https?:\/\//i.test(url)) {
        url = await getPropertyImageUrl(url);
      }
      return { ...row, image_url: url };
    })
  );
}

export async function appendPropertyGallery(propertyId, files = []) {
  const { data: { user }, error: userError } = await sb.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Primero inicia sesión.");
  if (!propertyId) throw new Error("No se encontró la propiedad.");

  const existing = await fetchPropertyImages([propertyId]);
  const uploadedPaths = await uploadMultiplePropertyImages(files, user.id);

  if (!uploadedPaths.length) return [];

  const startOrder = existing.length;

  const rows = uploadedPaths.map((path, index) => ({
    property_id: propertyId,
    image_url: path,
    sort_order: startOrder + index,
    is_cover: false
  }));

  const { data, error } = await sb
    .from("property_images")
    .insert(rows)
    .select();

  if (error) throw error;
  return data || [];
}

export async function deletePropertyImage(imageId) {
  const { error } = await sb
    .from("property_images")
    .delete()
    .eq("id", imageId);

  if (error) throw error;
  return true;
}

export async function setPropertyCoverImage(propertyId, imageId) {
  if (!propertyId || !imageId) {
    throw new Error("Faltan datos para definir portada.");
  }

  const { error: resetError } = await sb
    .from("property_images")
    .update({ is_cover: false })
    .eq("property_id", propertyId);

  if (resetError) throw resetError;

  const { data: updatedRows, error: markError } = await sb
    .from("property_images")
    .update({ is_cover: true, sort_order: 0 })
    .eq("id", imageId)
    .eq("property_id", propertyId)
    .select()
    .limit(1);

  if (markError) throw markError;

  const selected = updatedRows?.[0];
  if (!selected) throw new Error("No se pudo marcar la portada.");

  const rawPath = selected.image_url;
  const publicOrSigned = /^https?:\/\//i.test(rawPath)
    ? rawPath
    : await getPropertyImageUrl(rawPath);

  const { error: propertyUpdateError } = await sb
    .from("properties")
    .update({ cover_url: rawPath })
    .eq("id", propertyId);

  if (propertyUpdateError) throw propertyUpdateError;

  return {
    ...selected,
    image_url: publicOrSigned || rawPath
  };
}