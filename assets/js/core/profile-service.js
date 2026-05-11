import { sb } from "./supabase.js";

export async function fetchMyProfile() {
  const { data: { user }, error: userError } = await sb.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    user,
    profile: data || {
      id: user.id,
      full_name: user.email || "Usuario",
      role: "asesor"
    }
  };
}