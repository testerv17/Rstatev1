import { sb } from "./supabase.js";
import { appState } from "./state.js";

export async function getFollowupsCount(){

  let query = sb
    .from("property_leads")
    .select("id, follow_up_at");

  if(appState.currentProfile?.role !== "admin"){
    query = query.eq("created_by", appState.currentUser.id);
  }

  const { data, error } = await query;

  if(error){
    console.error(error);
    return { overdue:0, today:0 };
  }

  const now = new Date();

  let overdue = 0;
  let today = 0;

  data.forEach(l => {

    if(!l.follow_up_at) return;

    const d = new Date(l.follow_up_at);

    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if(d < now && !sameDay){
      overdue++;
    } else if(sameDay){
      today++;
    }
  });

  return { overdue, today };
}