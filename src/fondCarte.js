import L from 'leaflet'

// Fond OpenStreetMap, assombri en CSS (.carte-geo .leaflet-tile-pane) pour suivre le site.
// OpenStreetMap refuse les tuiles demandées sans site d'origine : le site envoie Referrer-Policy: same-origin
// (public/_headers), on autorise donc ici l'envoi de la seule adresse du site, sans le chemin.
export function fondCarte(carte) {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(carte)
}
