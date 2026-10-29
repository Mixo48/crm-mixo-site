import { useMemo, useState } from 'react'
import { PAYS, STATUTS, metaBoutique, q, supabase, useCharge } from '../lib.js'
import { CarteBloquee, Entete, Erreur, Fleche, Loupe, Plus, Score, Statut, Titre } from '../ui.jsx'
import FormBoutique from '../FormBoutique.jsx'

const GROUPES = {
  Tous: null,
  'À enrichir': ['a_enrichir'],
  'À contacter': ['a_contacter'],
  Contactés: ['contacte', 'relance'],
  Intéressés: ['interesse', 'a_rappeler', 'echantillon'],
  Clients: ['client'],
  Refus: ['refus'],
  Bloquées: ['bloque'],
}
const CONTACTES = ['contacte', 'relance', 'interesse', 'a_rappeler', 'echantillon']

async function toutes() {
  // PostgREST rend 1000 lignes au plus par appel : on pagine.
  const lignes = []
  for (let de = 0; ; de += 1000) {
    const page = await q(supabase.from('boutiques')
      .select('id,nom,ville,pays,type,nb_boutiques,email,marques,statut,score,bloque_raison,cree_le')
      .order('score', { ascending: false, nullsFirst: false }).order('nom').range(de, de + 999))
    lignes.push(...page)
    if (page.length < 1000) return lignes
  }
}

export default function Prospects() {
  const [recherche, setRecherche] = useState('')
  const [pays, setPays] = useState('Tous')
  const [groupe, setGroupe] = useState('Tous')
  const [ajout, setAjout] = useState(false)
  const [avis, setAvis] = useState(null)
  const { data, error, recharger } = useCharge(toutes, [])

  const boutiques = data || []
  const paysPresents = useMemo(() => [...new Set(boutiques.map((b) => b.pays).filter(Boolean))], [boutiques])
  const visibles = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    return boutiques.filter((b) =>
      (pays === 'Tous' || b.pays === pays) &&
      (!GROUPES[groupe] || GROUPES[groupe].includes(b.statut)) &&
      (!r || [b.nom, b.ville, b.email].some((v) => v?.toLowerCase().includes(r))))
  }, [boutiques, recherche, pays, groupe])
  const compte = (statuts) => boutiques.filter((b) => statuts.includes(b.statut)).length

  const ajoutee = (b) => {
    setAjout(false)
    setAvis(b.statut === 'bloque'
      ? { classe: 'attention', texte: `Boutique ajoutée mais bloquée : ${b.bloque_raison}.`, id: b.id }
      : { classe: 'info', texte: 'Boutique ajoutée.', id: b.id })
    recharger()
  }

  return (
    <div className="page">
      <Entete actif="prospects">
        <button className="pilule plein" onClick={() => setAjout(true)}><Plus />Ajouter une boutique</button>
      </Entete>

      <section className="titre-bloc">
        <Titre texte="PROSPECTS" lettre="O" />
        <div className="chiffres">
          <div className="chiffre"><b>{boutiques.length}</b><span>en base</span></div>
          <div className="chiffre"><b>{compte(['a_enrichir', 'a_contacter'])}</b><span>à contacter</span></div>
          <div className="chiffre"><b>{compte(CONTACTES)}</b><span>contactés</span></div>
          <div className="chiffre optionnel"><b>{compte(['bloque'])}</b><span>bloqués</span></div>
        </div>
      </section>

      {avis && <div className={`avis ${avis.classe}`}>{avis.texte} <a href={`#/boutique/${avis.id}`}>Ouvrir la fiche</a></div>}
      <Erreur e={error} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="rangee" style={{ gap: 10 }}>
          <label htmlFor="q" className="sr">Rechercher une boutique</label>
          <div className="recherche">
            <Loupe />
            <input id="q" type="search" placeholder="Nom, ville, e-mail…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          {paysPresents.length > 1 && (
            <div className="rangee" role="group" aria-label="Pays">
              {['Tous', ...paysPresents].map((p) => (
                <button key={p} className="pilule" aria-pressed={pays === p} onClick={() => setPays(p)}>{PAYS[p] || p}</button>
              ))}
            </div>
          )}
        </div>
        <div className="rangee" role="group" aria-label="Statut">
          {Object.keys(GROUPES).map((g) => (
            <button key={g} className="pilule" aria-pressed={groupe === g} onClick={() => setGroupe(g)}>{g}</button>
          ))}
        </div>
      </section>

      {data && !visibles.length && (
        <div className="vide">
          {boutiques.length ? 'Aucune boutique ne correspond.' : 'La base est vide. Commence par « Ajouter une boutique ».'}
        </div>
      )}

      <section aria-label="Liste des prospects" className="grille-large">
        {visibles.map((b) => (b.statut === 'bloque' ? <CarteBloquee key={b.id} b={b} /> : (
          <article key={b.id} className="carte">
            <a className="icone encoche" href={`#/boutique/${b.id}`} aria-label={`Ouvrir la fiche ${b.nom}`}><Fleche /></a>
            <div className="tete">
              <h3>{b.nom}</h3>
              <span className="meta">{metaBoutique(b)}</span>
            </div>
            {!!b.marques?.length && <div className="rangee" style={{ gap: 6 }}>{b.marques.slice(0, 3).map((m) => <span key={m} className="puce">{m}</span>)}</div>}
            <div className="pied">
              <div><span className="lbl">Statut</span><Statut code={b.statut} libelle={STATUTS[b.statut]} /></div>
              <div><Score score={b.score} /></div>
            </div>
          </article>
        )))}
      </section>

      {ajout && <FormBoutique onFermer={() => setAjout(false)} onFini={ajoutee} />}
    </div>
  )
}
