// ✅ Pega aquí tus llaves (anon key es OK si RLS está bien)
// ⚠️ NO uses service_role en frontend.

export const CONFIG = {
  SUPABASE_URL: "https://qxdnbkflhxwtlgfukfow.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_UY9HQKWdAiSbPKqKrUySOw_BQQ1rH-W",
  MAPBOX_TOKEN: "pk.eyJ1IjoibWFycXVpbmhvIiwiYSI6ImNsbncydDkzNjA0MDEycWp5Y2hsZzNiZHoifQ.dUzSeWKWWe7R36yohDNb0g",

  MAP_STYLES: {
    streets: "mapbox://styles/mapbox/streets-v12",
    light: "mapbox://styles/mapbox/light-v11",
    dark: "mapbox://styles/mapbox/dark-v11",
    satellite: "mapbox://styles/mapbox/satellite-streets-v12"
  }
};
