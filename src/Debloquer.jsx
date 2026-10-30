import { useEffect, useState } from 'react'
import { q, supabase } from './lib.js'
import { Erreur, Fenetre } from './ui.jsx'

const TYPES = { client: 'Client Odoo', desinscrit: 'Désinscription (STOP)', exclusivite: 'Exclusivité', manuel: 'Mis de côté' }

// Les blocages qui touchent cette boutique, selon les mêmes règles que public.est_bloquee :
// même e-mail ; même domaine (sauf messagerie grand public) ; même nom, avec la même ville ou sans ville.
async function blocagesDe(b) {
  const trouves = new Map()
  const garder = (l) => l.forEach((x) => trouves.set(x.id, x))
  const email = (b.email || '').trim().toLowerCase()
  const domaine = email.includes('@') ? email.split('@')[1] : null
  const champs = 'id,type,email,domaine,nom,ville,raison,cree_le'
  // ilike traite « _ » comme un joker : on revérifie l'égalité exacte.
  if (email) garder((await q(supabase.from('blocages').select(champs).ilike('email', email))).filter((x) => x.email?.toLowerCase() === email))
  if (domaine && !(await q(supabase.rpc('est_webmail', { d: domaine })))) {
    garder(await q(supabase.from('blocages').select(champs).ilike('domaine', domaine)))
    garder(await q(supabase.from('blocages').select(champs).ilike('email', `*@${domaine}`)))
  }
  const nom = b.nom.trim().toLowerCase()
  const ville = (b.ville || '').trim().toLowerCase()
  const parNom = await q(supabase.from('blocages').select(champs).ilike('nom', b.nom.trim()))
  garder(parNom.filter((x) => (x.nom || '').trim().toLowerCase() === nom && (!x.ville || !ville || x.ville.trim().toLowerCase() === ville)))
  return [...trouves.values()]
}

export default function Debloquer({ b, onFermer, onFini }) {
  const [liste, setListe] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [attente, setAttente] = useState(false)
  useEffect(() => { blocagesDe(b).then(setListe).catch(setErreur) }, [b])

  const stop = (liste || []).filter((x) => x.type === 'desinscrit')
  const clients = (liste || []).filter((x) => x.type === 'client')
  const autres = (liste || []).filter((x) => x.email && x.email.toLowerCase() !== (b.email || '').toLowerCase())

  const debloquer = async () => {
    if (clients.length && !window.confirm(`${b.nom} est enregistrée comme client Odoo. La débloquer permet de lui envoyer de la prospection. Continuer ?`)) return
    setErreur(null)
    setAttente(true)
    try {
      await q(supabase.from('blocages').delete().in('id', liste.map((x) => x.id)))
      // Le déclencheur de la base revérifie : s'il reste un blocage, la boutique reste bloquée.
      const apres = await q(supabase.from('boutiques').update({ statut: 'a_contacter', bloque_raison: null }).eq('id', b.id).select('statut,bloque_raison').single())
      await supabase.from('echanges').insert({ boutique_id: b.id, canal: 'systeme', sens: 'interne',
        resume: `Débloquée par Nathan (${liste.map((x) => x.raison || TYPES[x.type]).join(' ; ')}).` })
      if (apres.statut === 'bloque') throw new Error(`Toujours bloquée : ${apres.bloque_raison}`)
      onFini()
    } catch (e) { setErreur(e); setAttente(false) }
  }

  return (
    <Fenetre titre={`Débloquer ${b.nom}`} onFermer={onFermer}>
      {!liste && !erreur && <span className="travail lbl">Recherche des blocages…</span>}
      {liste && !liste.length && <div className="avis attention">Aucun blocage trouvé pour cette boutique : elle sera simplement remise « À contacter ».</div>}
      {!!liste?.length && (
        <>
          <p className="sous" style={{ margin: 0 }}>Ces blocages seront supprimés :</p>
          <div className="lignes">
            {liste.map((x) => (
              <div key={x.id} className="ligne" style={{ background: 'var(--fond)' }}>
                <span className="nom">{TYPES[x.type] || x.type}</span>
                <span className="texte">{x.raison || '—'}{x.email ? ` · ${x.email}` : ''}{x.domaine ? ` · domaine ${x.domaine}` : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {!!autres.length && !stop.length && <div className="avis attention">Certains blocages portent sur une autre adresse du même domaine : les supprimer débloque aussi ces contacts.</div>}
      {!!stop.length && <div className="avis erreur">Cette boutique a demandé à ne plus recevoir d’e-mails (STOP). Elle ne peut pas être débloquée.</div>}
      <Erreur e={erreur} />
      <div className="rangee" style={{ justifyContent: 'flex-end' }}>
        <button className="btn contour" onClick={onFermer}>Annuler</button>
        <button className="btn accent" disabled={!liste || !!stop.length || attente} onClick={debloquer}>{attente ? 'Déblocage…' : 'Débloquer'}</button>
      </div>
    </Fenetre>
  )
}
