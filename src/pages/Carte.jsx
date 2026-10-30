import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { STATUTS, cleVille, q, supabase, useCharge } from '../lib.js'
import { Entete, Erreur, Titre } from '../ui.jsx'

// Trois calques, couleurs du cahier de design.
const CALQUES = {
  prospection: { nom: 'En prospection', couleur: '#C8F56E' },
  clients: { nom: 'Clients', couleur: '#F0938F' },
  ancien: { nom: 'Ancien CRM', couleur: '#A9A9A3' },
}
const ACTIFS = ['a_enrichir', 'a_contacter', 'contacte', 'relance', 'interesse', 'a_rappeler', 'echantillon']

async function tout(table, colonnes, ordre, filtre) {
  const lignes = []
  for (let de = 0; ; de += 1000) {
    let r = supabase.from(table).select(colonnes).order(ordre).range(de, de + 999)
    if (filtre) r = filtre(r)
    const page = await q(r)
    lignes.push(...page)
    if (page.length < 1000) return lignes
  }
}

async function charger() {
  const [geo, boutiques, clients] = await Promise.all([
    tout('geocodage', 'cle,lat,lng', 'cle'),
    tout('boutiques', 'id,nom,ville,statut,source,prochaine_action', 'id'),
    tout('blocages', 'id,nom,ville,email', 'id', (r) => r.eq('type', 'client')),
  ])
  const points = Object.fromEntries(geo.filter((g) => g.lat != null).map((g) => [g.cle, [g.lat, g.lng]]))
  const marqueurs = []
  for (const b of boutiques) {
    const calque = b.source === 'Ancien CRM' ? 'ancien' : ACTIFS.includes(b.statut) ? 'prospection' : null
    if (calque) marqueurs.push({ calque, nom: b.nom, ville: b.ville, detail: STATUTS[b.statut] + (b.prochaine_action ? ` · ${b.prochaine_action}` : ''), lien: `#/boutique/${b.id}` })
  }
  // Une société Odoo a souvent plusieurs contacts : un seul point par nom et ville.
  const vus = new Set()
  for (const c of clients) {
    const k = `${(c.nom || c.email || '').toLowerCase()}|${(c.ville || '').toLowerCase()}`
    if (vus.has(k)) continue
    vus.add(k)
    marqueurs.push({ calque: 'clients', nom: c.nom || c.email, ville: c.ville, detail: 'Client Odoo', lien: null })
  }
  for (const m of marqueurs) m.point = points[cleVille(m.ville)] || null
  return marqueurs
}

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export default function Carte() {
  const [calques, setCalques] = useState(new Set(Object.keys(CALQUES)))
  const { data, error } = useCharge(charger, [])
  const conteneur = useRef(null)
  const carte = useRef(null)
  const groupe = useRef(null)
  const cadree = useRef(false)
  const marqueurs = data || []

  const compte = useMemo(() => Object.fromEntries(Object.keys(CALQUES).map((c) => {
    const l = marqueurs.filter((m) => m.calque === c)
    return [c, { total: l.length, places: l.filter((m) => m.point).length }]
  })), [marqueurs])

  useEffect(() => {
    if (carte.current || !conteneur.current) return
    carte.current = L.map(conteneur.current, { zoomControl: true, attributionControl: true }).setView([47.5, 3.5], 6)
    // Fond OpenStreetMap, assombri en CSS (.carte-geo .leaflet-tile-pane) pour suivre le site.
    // OpenStreetMap refuse les tuiles demandées sans site d'origine : le site envoie Referrer-Policy: same-origin
    // (public/_headers), on autorise donc ici l'envoi de la seule adresse du site, sans le chemin.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(carte.current)
    return () => { carte.current?.remove(); carte.current = null }
  }, [])

  useEffect(() => {
    if (!carte.current) return
    groupe.current?.remove()
    // Regroupement par couleur dominante : un rond sombre avec le nombre, bordé de la couleur du calque.
    groupe.current = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 45, spiderfyOnMaxZoom: true,
      iconCreateFunction: (cl) => {
        const enfants = cl.getAllChildMarkers()
        const n = enfants.length
        const parCalque = {}
        enfants.forEach((m) => { parCalque[m.options.calque] = (parCalque[m.options.calque] || 0) + 1 })
        const dominant = Object.entries(parCalque).sort((a, b) => b[1] - a[1])[0][0]
        const t = n < 10 ? 34 : n < 100 ? 42 : 50
        return L.divIcon({ html: `<span style="border-color:${CALQUES[dominant].couleur}">${n}</span>`, className: 'grappe', iconSize: [t, t] })
      },
    })
    for (const m of marqueurs) {
      if (!m.point || !calques.has(m.calque)) continue
      const c = CALQUES[m.calque].couleur
      const point = L.circleMarker(m.point, { radius: 7, color: '#1A1A1A', weight: 2, fillColor: c, fillOpacity: 1, calque: m.calque })
      point.bindPopup(`<strong>${echapper(m.nom)}</strong><br><span>${echapper(m.ville || '')}</span><br><span>${echapper(m.detail)}</span>`
        + (m.lien ? `<br><a href="${m.lien}">Ouvrir la fiche</a>` : ''))
      groupe.current.addLayer(point)
    }
    carte.current.addLayer(groupe.current)
    // Au premier chargement, la carte se cadre sur l'ensemble des boutiques placées.
    if (!cadree.current && groupe.current.getLayers().length) {
      carte.current.fitBounds(groupe.current.getBounds(), { padding: [30, 30], maxZoom: 9 })
      cadree.current = true
    }
  }, [marqueurs, calques])

  const basculer = (c) => { const s = new Set(calques); s.has(c) ? s.delete(c) : s.add(c); setCalques(s) }
  const nonPlaces = Object.values(compte).reduce((s, c) => s + c.total - c.places, 0)

  return (
    <div className="page">
      <Entete actif="carte" />
      <section className="titre-bloc">
        <Titre texte="CARTE" lettre="A" />
        <div className="chiffres">
          {Object.entries(CALQUES).map(([c, v]) => (
            <div key={c} className="chiffre"><b>{compte[c]?.total ?? 0}</b><span>{v.nom.toLowerCase()}</span></div>
          ))}
        </div>
      </section>
      <Erreur e={error} />
      <div className="rangee" role="group" aria-label="Calques">
        {Object.entries(CALQUES).map(([c, v]) => (
          <button key={c} className="pilule" aria-pressed={calques.has(c)} onClick={() => basculer(c)}>
            <span className="point" style={{ width: 10, height: 10, background: v.couleur }} aria-hidden="true" />{v.nom}
          </button>
        ))}
        {data && nonPlaces > 0 && <span className="lbl">{nonPlaces} sans ville connue ou pas encore placées</span>}
        {!data && !error && <span className="travail lbl">Chargement de la carte…</span>}
      </div>
      <div ref={conteneur} className="carte-geo" aria-label="Carte des boutiques" />
    </div>
  )
}
