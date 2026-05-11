import { sb } from "./core/supabase.js";
import { appState } from "./core/state.js";
import { fetchMyProfile } from "./core/profile-service.js";

async function init(){
  const p = await fetchMyProfile();
  appState.currentUser = p.user;
  appState.currentProfile = p.profile;

  loadFollowups();
}

async function loadFollowups(){

  let query = sb
    .from("property_leads")
    .select(`*, properties(title)`);

  if(appState.currentProfile.role !== "admin"){
    query = query.eq("created_by", appState.currentUser.id);
  }

  const {data,error} = await query;

  if(error){
    console.error(error);
    return;
  }

  render(data || []);
}

function render(leads){

  const now = new Date();

  const overdue = [];
  const today = [];
  const future = [];

  leads.forEach(l => {

    if(!l.follow_up_at){
      future.push(l);
      return;
    }

    const d = new Date(l.follow_up_at);

    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if(d < now && !sameDay){
      overdue.push(l);
    } else if(sameDay){
      today.push(l);
    } else {
      future.push(l);
    }
  });

  renderList("col-overdue", overdue);
  renderList("col-today", today);
  renderList("col-future", future);
}

function renderList(id, items){
  const el = document.getElementById(id);
  el.innerHTML = "";

  items.forEach(i => {
    const div = document.createElement("div");
    div.className = "follow-card";

    div.innerHTML = `
      <b>${i.full_name}</b><br>
      ${i.properties?.title || ""}<br>
      ${i.follow_up_at ? new Date(i.follow_up_at).toLocaleString() : "Sin fecha"}
    `;

    el.appendChild(div);
  });
}

init();