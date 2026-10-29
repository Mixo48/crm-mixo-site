import { useMemo, useState } from 'react'
import { q, supabase, useCharge } from '../lib.js'
import { Entete, Erreur, Loupe, Titre } from '../ui.jsx'

const PAR_PAGE = 60

async function tout(table, colonnes, filtre) {
  const lignes = []
  for (let de = 0; ; de += 1000) {
    let r = supabase.from(table).select(colonnes).order('id').range(de, de + 999)
    if (filtre) r = filtre(r)
    const page = await q(r)
    lignes.push(...page)
    if (page.length < 1000) return lignes
  }
}

// Un client = les blocages « client » regroupés par nom et ville (une société Odoo a souvent plusieurs
// contacts), plus les boutiques du CRM passées en « Client » ou bloquées comme clientes.
async function charger() {
  const [blocages, boutiques] = await Promise.all([
    tout('blocages', 'id,email,nom,ville,raison,cree_le', (r) => r.eq('type', 'client')),
    tout('boutiques', 'id,nom,ville,email,statut,source,bloque_raison', (r) => r.or('statut.eq.client,and(statut.eq.bloque,bloque_raison.ilike.client*)')),
  ])
  const groupes = new Map()
  for (const b of blocages) {
    const cle = `${(b.nom || b.email || '').toLowerCase()}|${(b.ville || '').toLowerCase()}`
    const g = groupes.get(cle) || { cle, nom: b.nom || b.email, ville: b.ville, emails: [], odoo: false, fiche: null }
    if (b.email) g.emails.push(b.email)
    if (/^client Odoo/.test(b.raison || '')) g.odoo = true
    groupes.set(cle, g)
  }
  const parEmail = new Map()
  for (const g of groupes.values()) for (const e of g.emails) parEmail.set(e, g)
  for (const f of boutiques) {
    const g = (f.email && parEmail.get(f.email.toLowerCase()))
      || groupes.get(`${f.nom.toLowerCase()}|${(f.ville || '').toLowerCase()}`)
      || [...groupes.values()].find((x) => x.nom?.toLowerCase() === f.nom.toLowerCase())
    if (g) g.fiche = f
    else groupes.set(`fiche-${f.id}`, { cle: `fiche-${f.id}`, nom: f.nom, ville: f.ville, emails: f.email ? [f.email] : [], odoo: false, fiche: f })
  }
  return [...groupes.values()].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' }))
}

const FILTRES = {
  Tous: () => true,
  'Odoo': (c) => c.odoo,
  'Ancien CRM': (c) => c.fiche?.source === 'Ancien CRM',
  'Dans le CRM': (c) => !!c.fiche,
}

export default function Clients() {
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('Tous')
  const [nb, setNb] = useState(PAR_PAGE)
  const { data, error } = useCharge(charger, [])
  const clients = data || []
  const visibles = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    return clients.filter((c) => FILTRES[filtre](c) && (!r || [c.nom, c.ville, ...c.emails].some((v) => v?.toLowerCase().includes(r))))
  }, [clients, recherche, filtre])

  return (
    <div className="page">
      <Entete actif="clients" />
      <section className="titre-bloc">
        <Titre texte="CLIENTS" lettre="I" />
        <div className="chiffres">
          <div className="chiffre"><b>{clients.length}</b><span>clients</span></div>
          <div className="chiffre"><b>{clients.filter(FILTRES.Odoo).length}</b><span>dans Odoo</span></div>
          <div className="chiffre"><b>{clients.filter(FILTRES['Ancien CRM']).length}</b><span>de l’ancien CRM</span></div>
        </div>
      </section>
      <p className="sous" style={{ margin: 0, maxWidth: '70ch' }}>
        Aucun e-mail de prospection ne peut partir vers ces boutiques : leur e-mail, leur domaine et leur nom sont bloqués.
      </p>
      <Erreur e={error} />

      <div className="rangee" style={{ gap: 10 }}>
        <label htmlFor="qc" className="sr">Rechercher un client</label>
        <div className="recherche">
          <Loupe />
          <input id="qc" type="search" placeholder="Nom, ville, e-mail…" value={recherche} onChange={(e) => { setRecherche(e.target.value); setNb(PAR_PAGE) }} />
        </div>
        <div className="rangee" role="group" aria-label="Origine">
          {Object.keys(FILTRES).map((f) => (
            <button key={f} className="pilule" aria-pressed={filtre === f} onClick={() => { setFiltre(f); setNb(PAR_PAGE) }}>{f}</button>
          ))}
        </div>
      </div>

      {data && !visibles.length && <div className="vide">Aucun client ne correspond.</div>}
      {!data && !error && <div className="vide">Chargement des clients…</div>}
      <div className="lignes">
        {visibles.slice(0, nb).map((c) => {
          const contenu = (
            <>
              <span className="nom">{c.nom}<br /><span className="lbl">{c.ville || 'Ville inconnue'}</span></span>
              <span className="texte">{c.emails.length ? c.emails.slice(0, 3).join(' · ') + (c.emails.length > 3 ? ` · +${c.emails.length - 3}` : '') : 'Pas d’e-mail : bloqué par son nom'}</span>
              <span className="rangee" style={{ gap: 6 }}>
                {c.odoo && <span className="puce">Odoo</span>}
                {c.fiche?.source === 'Ancien CRM' && <span className="puce">Ancien CRM</span>}
                {c.fiche && <span className="statut p-rouge" style={{ height: 28 }}>Fiche</span>}
              </span>
            </>
          )
          return c.fiche
            ? <a key={c.cle} className="ligne" href={`#/boutique/${c.fiche.id}`}>{contenu}</a>
            : <div key={c.cle} className="ligne">{contenu}</div>
        })}
      </div>
      {visibles.length > nb && (
        <button className="pilule" style={{ alignSelf: 'center' }} onClick={() => setNb(nb + PAR_PAGE * 3)}>
          Afficher plus ({visibles.length - nb} restants)
        </button>
      )}
    </div>
  )
}
