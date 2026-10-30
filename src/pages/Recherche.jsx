import { useState } from 'react'
import { TYPES_BOUTIQUE, demander, emailValide, heure, jourCourt, metaBoutique, q, supabase, useCharge } from '../lib.js'
import { Entete, Erreur, Fleche, Loupe, Titre } from '../ui.jsx'

const EN_COURS = ['en_attente', 'en_cours']

// Une recherche = une demande « recherche » dans la file de Claude. Le veilleur cherche sur le web et
// écarte ce qui est déjà dans le CRM ou bloqué (clients, ancien CRM) ; rien n'est ajouté sans Nathan.
async function charger() {
  const recherches = await q(supabase.from('file_claude').select('id,consigne,statut,resultat,erreur,cree_le')
    .eq('type', 'recherche').order('cree_le', { ascending: false }).limit(20))
  const boutiques = await q(supabase.from('boutiques').select('id,nom,ville,email').eq('source', 'Recherche Claude'))
  return { recherches, boutiques }
}

const lireParams = (r) => { try { return JSON.parse(r.consigne || '{}') } catch { return { zone: r.consigne } } }

function Candidat({ c, ajoutee, onAjout }) {
  const [attente, setAttente] = useState(false)
  const [erreur, setErreur] = useState(null)
  const ajouter = async (enrichir) => {
    setErreur(null)
    setAttente(true)
    try {
      const ligne = {
        nom: c.nom, ville: c.ville || null, code_postal: c.code_postal || null, adresse: c.adresse || null,
        pays: c.pays || 'FR', type: c.type || 'vape_shop', email: emailValide(c.email) ? c.email.toLowerCase() : null,
        site_web: c.site_web || null, instagram: c.instagram || null, telephone: c.telephone || null,
        nb_boutiques: c.nb_boutiques || 1, marques: c.marques || [], source: 'Recherche Claude',
        statut: enrichir ? 'a_enrichir' : 'a_contacter',
        notes: [c.pourquoi && `Pourquoi : ${c.pourquoi}`, c.source_url && `Trouvée sur : ${c.source_url}`].filter(Boolean).join('\n'),
      }
      const b = await q(supabase.from('boutiques').insert(ligne).select('id,statut').single())
      if (enrichir && b.statut !== 'bloque') await demander('enrichir', { boutique_id: b.id })
      onAjout()
    } catch (e) {
      setErreur(/duplicate|unique/i.test(e.message || '') ? new Error('Une boutique a déjà cet e-mail dans le CRM.') : e)
      setAttente(false)
    }
  }
  return (
    <article className={`carte${ajoutee ? ' vedette' : ''}`}>
      {c.source_url && <a className="icone encoche" href={c.source_url} target="_blank" rel="noreferrer noopener" aria-label={`Voir la source de ${c.nom}`}><Fleche /></a>}
      <div className="tete"><h3>{c.nom}</h3><span className="meta">{metaBoutique(c)}{c.adresse ? ` · ${c.adresse}` : ''}</span></div>
      {c.pourquoi && <p>{c.pourquoi}</p>}
      <div className="rangee" style={{ gap: 6 }}>
        {c.email ? <span className="puce">{c.email}</span>
          : <span className="puce" style={{ background: '#3D3520', color: '#F2D46B' }} title="« Ajouter et enrichir » pour que Claude la cherche">Sans e-mail</span>}
        {c.telephone && <span className="puce">{c.telephone}</span>}
        {c.instagram && <span className="puce">{c.instagram}</span>}
        {c.site_web && <a className="puce" href={c.site_web} target="_blank" rel="noreferrer noopener">{c.site_web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>}
        {(c.marques || []).slice(0, 3).map((m) => <span key={m} className="puce">{m}</span>)}
      </div>
      <Erreur e={erreur} />
      {ajoutee
        ? <a className="btn noir" href={`#/boutique/${ajoutee.id}`}>Dans le CRM · ouvrir la fiche</a>
        : (
          <div className="rangee">
            <button className="btn accent" disabled={attente} onClick={() => ajouter(true)}>Ajouter et enrichir</button>
            <button className="btn gris" disabled={attente} onClick={() => ajouter(false)}>Ajouter</button>
          </div>
        )}
    </article>
  )
}

export default function Recherche() {
  const [zone, setZone] = useState('')
  const [type, setType] = useState('vape_shop')
  const [nombre, setNombre] = useState(10)
  const [criteres, setCriteres] = useState('')
  const [erreur, setErreur] = useState(null)
  const { data, error, recharger } = useCharge(charger, [], { toutes: 5000 })
  const recherches = data?.recherches || []

  const lancer = async (e) => {
    e.preventDefault()
    if (!zone.trim()) return
    setErreur(null)
    try {
      await demander('recherche', { consigne: JSON.stringify({ zone: zone.trim(), type, nombre, criteres: criteres.trim() }) })
      setZone('')
      setCriteres('')
      recharger()
    } catch (e2) { setErreur(e2) }
  }
  const dejaAjoutee = (c) => (data?.boutiques || []).find((b) =>
    (c.email && b.email === c.email.toLowerCase()) || (b.nom.toLowerCase() === c.nom.toLowerCase() && (b.ville || '').toLowerCase() === (c.ville || '').toLowerCase()))

  return (
    <div className="page">
      <Entete actif="recherche" />
      <section className="titre-bloc" style={{ gap: '16px 40px' }}>
        <Titre texte="RECHERCHE" lettre="E" />
        <p className="sous" style={{ margin: 0, maxWidth: '60ch' }}>
          Claude cherche sur le web de nouvelles boutiques dans la zone choisie. Les clients, l’ancien CRM et les boutiques déjà connues sont écartés.
          Tu choisis celles qui entrent dans le CRM.
        </p>
      </section>

      <form className="carte" onSubmit={lancer} style={{ gap: 16 }}>
        <div className="grille-champs">
          <div className="champ">
            <label htmlFor="r-zone">Zone</label>
            <input id="r-zone" required value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Lyon, Nord (59), Bretagne, Bruxelles…" />
          </div>
          <div className="champ">
            <label htmlFor="r-type">Type</label>
            <select id="r-type" value={type} onChange={(e) => setType(e.target.value)}>
              {['vape_shop', 'chaine', 'grossiste', 'distributeur'].map((t) => <option key={t} value={t}>{TYPES_BOUTIQUE[t]}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="r-nombre">Combien</label>
            <select id="r-nombre" value={nombre} onChange={(e) => setNombre(Number(e.target.value))}>
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} boutiques</option>)}
            </select>
          </div>
        </div>
        <div className="champ">
          <label htmlFor="r-crit">Critères (facultatif)</label>
          <input id="r-crit" value={criteres} onChange={(e) => setCriteres(e.target.value)} placeholder="Indépendants, rayon DIY, plusieurs boutiques…" />
        </div>
        <Erreur e={erreur || error} />
        <div className="rangee" style={{ justifyContent: 'space-between' }}>
          <span className="lbl">Compte 2 à 6 minutes par recherche. Tu peux quitter la page, les résultats restent ici.</span>
          <button className="btn accent" type="submit" disabled={!zone.trim()}><Loupe />Lancer la recherche</button>
        </div>
      </form>

      {data && !recherches.length && <div className="vide">Aucune recherche pour l’instant.</div>}
      {recherches.map((r) => {
        const p = lireParams(r)
        const res = r.resultat || {}
        return (
          <section key={r.id} className="section" style={{ gap: 14 }}>
            <div className="section-tete">
              <h2 className="s">{p.zone}</h2>
              <span className="lbl">{TYPES_BOUTIQUE[p.type] || 'Vape shop'} · {jourCourt(r.cree_le)} à {heure(r.cree_le)}{p.criteres ? ` · ${p.criteres}` : ''}</span>
            </div>
            {EN_COURS.includes(r.statut) && <div className="vide"><span className="travail">Claude cherche sur le web…</span></div>}
            {r.statut === 'erreur' && <div className="avis erreur">La recherche a échoué : {r.erreur}</div>}
            {r.statut === 'fait' && (
              <>
                {(res.remarque || res.ecartes?.length > 0) && (
                  <p className="sous" style={{ margin: 0, fontSize: 14 }}>
                    {res.remarque}{res.ecartes?.length ? ` ${res.ecartes.length} écartée${res.ecartes.length > 1 ? 's' : ''} : ${res.ecartes.map((x) => x.nom).join(', ')}.` : ''}
                  </p>
                )}
                {!res.candidats?.length && <div className="vide">Aucune nouvelle boutique trouvée dans cette zone.</div>}
                <div className="grille-large">
                  {(res.candidats || []).map((c, i) => <Candidat key={`${r.id}-${i}`} c={c} ajoutee={dejaAjoutee(c)} onAjout={recharger} />)}
                </div>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
