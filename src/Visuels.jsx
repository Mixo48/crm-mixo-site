import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fondCarte } from './fondCarte.js'

// Visuels renvoyés par Claude dans le chat (resultat.visuels), vérifiés par le veilleur :
// une seule série à chaque fois, donc une seule teinte (l'accent), sans légende.
const nombre = (v) => (typeof v === 'number' ? v.toLocaleString('fr-BE') : '')

function Barres({ v }) {
  const max = Math.max(...v.elements.map((e) => e.valeur || 0), 1)
  return (
    <figure className="visuel">
      <figcaption>{v.titre}</figcaption>
      <div className="barres" role="table" aria-label={v.titre}>
        {v.elements.map((e, i) => (
          <div key={i} className="barre" role="row" title={e.note ? `${e.libelle} : ${nombre(e.valeur)} · ${e.note}` : `${e.libelle} : ${nombre(e.valeur)}`}>
            <span className="lib" role="rowheader">{e.libelle}</span>
            <span className="piste" role="cell" aria-label={nombre(e.valeur)}>
              <span className="plein" style={{ width: `${Math.max(2, (100 * (e.valeur || 0)) / max)}%` }} />
            </span>
            <span className="val">{nombre(e.valeur)}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

function Chiffres({ v }) {
  return (
    <figure className="visuel">
      {v.titre && <figcaption>{v.titre}</figcaption>}
      <div className="tuiles">
        {v.elements.map((e, i) => (
          <div key={i} className="tuile">
            <b>{nombre(e.valeur) || '—'}</b>
            <span>{e.libelle}</span>
            {e.note && <small>{e.note}</small>}
          </div>
        ))}
      </div>
    </figure>
  )
}

function CarteZones({ v }) {
  const ref = useRef(null)
  useEffect(() => {
    const carte = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true })
    fondCarte(carte)
    const max = Math.max(...v.elements.map((e) => e.valeur || 0), 1)
    const points = v.elements.map((e) => {
      // Surface du cercle proportionnelle à la valeur : rayon en racine carrée.
      const rayon = e.valeur ? 8 + 22 * Math.sqrt(e.valeur / max) : 8
      const m = L.circleMarker([e.lat, e.lng], { radius: rayon, color: '#1A1A1A', weight: 2, fillColor: '#C8F56E', fillOpacity: 0.8 })
      const div = document.createElement('div')
      const t = document.createElement('strong'); t.textContent = e.libelle; div.append(t)
      if (e.valeur != null) { div.append(document.createElement('br'), `${nombre(e.valeur)}`) }
      if (e.note) { div.append(document.createElement('br'), e.note) }
      m.bindPopup(div)
      m.bindTooltip(e.libelle, { direction: 'top', offset: [0, -rayon], className: 'bulle-carte' })
      return m.addTo(carte)
    })
    const groupe = L.featureGroup(points)
    carte.fitBounds(groupe.getBounds(), { padding: [30, 30], maxZoom: 8 })
    return () => carte.remove()
  }, [v])
  return (
    <figure className="visuel">
      <figcaption>{v.titre}</figcaption>
      <div ref={ref} className="carte-geo carte-visuel" aria-label={v.titre} />
    </figure>
  )
}

export default function Visuels({ visuels }) {
  if (!visuels?.length) return null
  return visuels.map((v, i) => (v.type === 'carte' ? <CarteZones key={i} v={v} /> : v.type === 'barres' ? <Barres key={i} v={v} /> : <Chiffres key={i} v={v} />))
}
