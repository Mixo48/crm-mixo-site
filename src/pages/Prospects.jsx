import { useMemo, useState } from 'react'
import { PAYS, STATUTS, TYPES_BOUTIQUE, demander, metaBoutique, q, supabase, useCharge } from '../lib.js'
import { CarteBloquee, Entete, Erreur, Fenetre, Fleche, Loupe, Plus, Score, Statut, Titre } from '../ui.jsx'

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

const VIDE = { nom: '', ville: '', code_postal: '', adresse: '', pays: 'FR', type: 'vape_shop', email: '', site_web: '', instagram: '', telephone: '', contact_nom: '', nb_boutiques: '', source: '' }

function Ajouter({ onFermer, onAjoutee }) {
  const [f, setF] = useState(VIDE)
  const [enrichir, setEnrichir] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [attente, setAttente] = useState(false)
  const champ = (k) => ({ id: `a-${k}`, value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) })

  const enregistrer = async (e) => {
    e.preventDefault()
    setErreur(null)
    setAttente(true)
    try {
      const ligne = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
      ligne.email = ligne.email?.toLowerCase() || null
      ligne.nb_boutiques = ligne.nb_boutiques ? Number(ligne.nb_boutiques) : 1
      ligne.source = ligne.source || 'Manuel'
      ligne.statut = enrichir ? 'a_enrichir' : 'a_contacter'
      // Le déclencheur de la base passe la boutique en « bloque » si elle est déjà cliente ou désinscrite.
      const b = await q(supabase.from('boutiques').insert(ligne).select('id,statut,bloque_raison').single())
      if (enrichir && b.statut !== 'bloque') await demander('enrichir', { boutique_id: b.id })
      onAjoutee(b)
    } catch (e2) {
      setErreur(/duplicate|unique/i.test(e2.message || '') ? new Error('Cette boutique existe déjà.') : e2)
      setAttente(false)
    }
  }

  return (
    <Fenetre titre="Ajouter une boutique" onFermer={onFermer}>
      <form onSubmit={enregistrer} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="grille-champs">
          <div className="champ"><label htmlFor="a-nom">Nom *</label><input required {...champ('nom')} /></div>
          <div className="champ"><label htmlFor="a-ville">Ville</label><input {...champ('ville')} /></div>
          <div className="champ"><label htmlFor="a-pays">Pays</label>
            <select {...champ('pays')}>{Object.entries(PAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="champ"><label htmlFor="a-type">Type</label>
            <select {...champ('type')}>{Object.entries(TYPES_BOUTIQUE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="champ"><label htmlFor="a-email">E-mail</label><input type="email" {...champ('email')} /></div>
          <div className="champ"><label htmlFor="a-site_web">Site</label><input type="url" placeholder="https://" {...champ('site_web')} /></div>
          <div className="champ"><label htmlFor="a-instagram">Instagram</label><input placeholder="@" {...champ('instagram')} /></div>
          <div className="champ"><label htmlFor="a-telephone">Téléphone</label><input type="tel" {...champ('telephone')} /></div>
          <div className="champ"><label htmlFor="a-contact_nom">Contact</label><input placeholder="Prénom, rôle" {...champ('contact_nom')} /></div>
          <div className="champ"><label htmlFor="a-adresse">Adresse</label><input {...champ('adresse')} /></div>
          <div className="champ"><label htmlFor="a-code_postal">Code postal</label><input {...champ('code_postal')} /></div>
          <div className="champ"><label htmlFor="a-nb_boutiques">Nombre de boutiques</label><input type="number" min="1" {...champ('nb_boutiques')} /></div>
          <div className="champ"><label htmlFor="a-source">Où l’as-tu trouvée ?</label><input placeholder="Annuaire, Instagram, salon…" {...champ('source')} /></div>
        </div>
        <label className="rangee" style={{ gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={enrichir} onChange={(e) => setEnrichir(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
          <span>Demander à Claude de compléter la fiche (site, e-mail, marques vendues, score)</span>
        </label>
        <Erreur e={erreur} />
        <div className="rangee" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn contour" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn accent" disabled={attente}>{attente ? 'Enregistrement…' : 'Ajouter'}</button>
        </div>
      </form>
    </Fenetre>
  )
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

      {ajout && <Ajouter onFermer={() => setAjout(false)} onAjoutee={ajoutee} />}
    </div>
  )
}
