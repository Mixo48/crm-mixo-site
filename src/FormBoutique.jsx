import { useState } from 'react'
import { PAYS, TYPES_BOUTIQUE, demander, q, supabase } from './lib.js'
import { Erreur, Fenetre } from './ui.jsx'

const CHAMPS = ['nom', 'ville', 'code_postal', 'adresse', 'pays', 'type', 'email', 'site_web', 'instagram', 'telephone', 'contact_nom', 'nb_boutiques', 'source', 'angle', 'marques']
// Exige un domaine complet (contact@boutique.fr) : le navigateur accepte « contact@boutique » seul.
const MOTIF_EMAIL = '[^@\\s]+@[^@\\s]+\\.[A-Za-z]{2,}'

const versFormulaire = (b) => Object.fromEntries(CHAMPS.map((k) => {
  if (k === 'marques') return [k, (b?.marques || []).join(', ')]
  if (k === 'pays') return [k, b?.pays || 'FR']
  if (k === 'type') return [k, b?.type || 'vape_shop']
  return [k, b?.[k] == null ? '' : String(b[k])]
}))

function versLigne(f) {
  const l = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]))
  l.email = l.email?.toLowerCase() || null
  l.nb_boutiques = l.nb_boutiques ? Number(l.nb_boutiques) : 1
  l.marques = l.marques ? l.marques.split(',').map((m) => m.trim()).filter(Boolean) : []
  return l
}

// Ajout (boutique absente) ou modification d'une fiche. Le déclencheur de la base revérifie
// les blocages à chaque enregistrement : une adresse de cliente passe la boutique en « bloque ».
export default function FormBoutique({ boutique, onFermer, onFini }) {
  const modif = !!boutique
  const [f, setF] = useState(() => versFormulaire(boutique))
  const [enrichir, setEnrichir] = useState(!modif)
  const [erreur, setErreur] = useState(null)
  const [attente, setAttente] = useState(false)
  const champ = (k) => ({ id: `f-${k}`, value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) })

  const enregistrer = async (e) => {
    e.preventDefault()
    setErreur(null)
    setAttente(true)
    try {
      const ligne = versLigne(f)
      let b
      if (modif) {
        const avant = versLigne(versFormulaire(boutique))
        const changes = Object.fromEntries(Object.entries(ligne).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(avant[k])))
        if (!Object.keys(changes).length) { onFermer(); return }
        b = await q(supabase.from('boutiques').update(changes).eq('id', boutique.id).select('id,statut,bloque_raison').single())
      } else {
        ligne.source = ligne.source || 'Manuel'
        ligne.statut = enrichir ? 'a_enrichir' : 'a_contacter'
        b = await q(supabase.from('boutiques').insert(ligne).select('id,statut,bloque_raison').single())
        if (enrichir && b.statut !== 'bloque') await demander('enrichir', { boutique_id: b.id })
      }
      onFini(b)
    } catch (e2) {
      setErreur(/duplicate|unique/i.test(e2.message || '') ? new Error('Cette boutique existe déjà.') : e2)
      setAttente(false)
    }
  }

  return (
    <Fenetre titre={modif ? 'Modifier la fiche' : 'Ajouter une boutique'} onFermer={onFermer}>
      <form onSubmit={enregistrer} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="grille-champs">
          <div className="champ"><label htmlFor="f-nom">Nom *</label><input required {...champ('nom')} /></div>
          <div className="champ"><label htmlFor="f-ville">Ville</label><input {...champ('ville')} /></div>
          <div className="champ"><label htmlFor="f-pays">Pays</label>
            <select {...champ('pays')}>{Object.entries(PAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="champ"><label htmlFor="f-type">Type</label>
            <select {...champ('type')}>{Object.entries(TYPES_BOUTIQUE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="champ"><label htmlFor="f-email">E-mail</label>
            <input type="email" pattern={MOTIF_EMAIL} title="Adresse complète, par exemple contact@boutique.fr" placeholder="contact@boutique.fr" {...champ('email')} /></div>
          <div className="champ"><label htmlFor="f-site_web">Site</label><input type="url" placeholder="https://" {...champ('site_web')} /></div>
          <div className="champ"><label htmlFor="f-instagram">Instagram</label><input placeholder="@" {...champ('instagram')} /></div>
          <div className="champ"><label htmlFor="f-telephone">Téléphone</label><input type="tel" {...champ('telephone')} /></div>
          <div className="champ"><label htmlFor="f-contact_nom">Contact</label><input placeholder="Prénom, rôle" {...champ('contact_nom')} /></div>
          <div className="champ"><label htmlFor="f-adresse">Adresse</label><input placeholder="N° et rue" {...champ('adresse')} /></div>
          <div className="champ"><label htmlFor="f-code_postal">Code postal</label><input {...champ('code_postal')} /></div>
          <div className="champ"><label htmlFor="f-nb_boutiques">Nombre de boutiques</label><input type="number" min="1" {...champ('nb_boutiques')} /></div>
          <div className="champ"><label htmlFor="f-source">Où l’as-tu trouvée ?</label><input placeholder="Annuaire, Instagram, salon…" {...champ('source')} /></div>
          {modif && <div className="champ"><label htmlFor="f-marques">Marques vendues</label><input placeholder="Séparées par des virgules" {...champ('marques')} /></div>}
          {modif && <div className="champ"><label htmlFor="f-angle">Angle</label><input placeholder="Ce qui parlera à cette boutique" {...champ('angle')} /></div>}
        </div>
        {!modif && (
          <label className="rangee" style={{ gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={enrichir} onChange={(e) => setEnrichir(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
            <span>Demander à Claude de compléter la fiche (site, e-mail, marques vendues, score)</span>
          </label>
        )}
        <Erreur e={erreur} />
        <div className="rangee" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn contour" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn accent" disabled={attente}>{attente ? 'Enregistrement…' : modif ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Fenetre>
  )
}
