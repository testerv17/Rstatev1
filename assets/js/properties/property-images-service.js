import { sb } from "../core/supabase.js";

export async function uploadPropertyImage(file, userId) {
  if (!file) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
  const fileName = `property_${userId}_${Date.now()}.${safeExt}`;
  const filePath = `covers/${fileName}`;

  const { error: uploadError } = await sb.storage
    .from("property-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) {
    throw uploadError;
  }

  return filePath;
}

export async function getPropertyImageUrl(filePath) {
  if (!filePath) return null;

  const { data, error } = await sb.storage
    .from("property-images")
    .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 días

  if (error) {
    console.error("Error creando signed URL:", error);
    return null;
  }

  return data?.signedUrl || null;
}