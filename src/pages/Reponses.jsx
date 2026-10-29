import { useState } from 'react'
import { DETECTES, jourCourt, q, supabase, useCharge } from '../lib.js'
import { Entete, Erreur, Statut, Titre } from '../ui.jsx'

const charger = () => q(supabase.from('echanges')
  .select('id,objet,resume,corps,statut_detecte,de_email,le,boutiques(id,nom,ville)')
  .eq('sens', 'entrant').order('le', { ascending: false }).limit(200))

export default function Reponses() {
  const [filtre, setFiltre] = useState('tous')
  const { data, error } = useCharge(charger, [], { toutes: 60000 })
  const reponses = data || []
  const presents = [...new Set(reponses.map((r) => r.statut_detecte).filter(Boolean))]
  const visibles = reponses.filter((r) => filtre === 'tous' || r.statut_detecte === filtre)

  return (
    <div className="page">
      <Entete actif="reponses" />
      <section className="titre-bloc">
        <Titre texte="RÉPONSES" lettre="É" />
        <div className="chiffres">
          <div className="chiffre"><b>{reponses.length}</b><span>reçues</span></div>
          <div className="chiffre"><b>{reponses.filter((r) => r.statut_detecte === 'interesse').length}</b><span>intéressées</span></div>
          <div className="chiffre"><b>{reponses.filter((r) => ['question', 'a_rappeler'].includes(r.statut_detecte)).length}</b><span>à suivre</span></div>
        </div>
      </section>
      <Erreur e={error} />
      {presents.length > 1 && (
        <div className="rangee" role="group" aria-label="Filtrer les réponses">
          {['tous', ...presents].map((s) => (
            <button key={s} className="pilule" aria-pressed={filtre === s} onClick={() => setFiltre(s)}>{s === 'tous' ? 'Toutes' : DETECTES[s]}</button>
          ))}
        </div>
      )}
      {data && !visibles.length && <div className="vide">Aucune réponse pour l’instant. Le facteur lit ta boîte toutes les 3 minutes.</div>}
      <div className="lignes">
        {visibles.map((r) => {
          const contenu = (
            <>
              <span className="nom">{r.boutiques?.nom || r.de_email || 'Expéditeur inconnu'}<br /><span className="lbl">{jourCourt(r.le)}</span></span>
              <span className="texte">{r.resume || r.objet || 'Claude la lit…'}</span>
              {r.statut_detecte ? <Statut code={r.statut_detecte} libelle={DETECTES[r.statut_detecte]} /> : <span className="travail lbl">en lecture</span>}
            </>
          )
          return r.boutiques?.id
            ? <a key={r.id} className="ligne" href={`#/boutique/${r.boutiques.id}`}>{contenu}</a>
            : <div key={r.id} className="ligne">{contenu}</div>
        })}
      </div>
    </div>
  )
}
