import { sb } from "../core/supabase.js";
import { appState } from "../core/state.js";

export async function createPropertyLead(propertyId, payload) {
  const { data: { user }, error: userError } = await sb.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Primero inicia sesión.");
  if (!propertyId) throw new Error("No se encontró la propiedad.");

  const row = {
    property_id: propertyId,
    created_by: user.id,
    full_name: payload.full_name,
    phone: payload.phone || null,
    email: payload.email || null,
    budget: payload.budget ? Number(payload.budget) : null,
    notes: payload.notes || null,
    stage: payload.stage || "nuevo",
    follow_up_at: payload.follow_up_at || null
  };

  const { data, error } = await sb
    .from("property_leads")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchPropertyLeads(propertyId) {
  if (!propertyId) return [];

  let query = sb
    .from("property_leads")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  const role = appState.currentProfile?.role || "asesor";
  const currentUserId = appState.currentUser?.id || null;

  if (role !== "admin" && currentUserId) {
    query = query.eq("created_by", currentUserId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function updateLeadStage(leadId, stage) {
  const { data, error } = await sb
    .from("property_leads")
    .update({ stage })
    .eq("id", leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePropertyLead(leadId) {
  const { error } = await sb
    .from("property_leads")
    .delete()
    .eq("id", leadId);

  if (error) throw error;
  return true;
}