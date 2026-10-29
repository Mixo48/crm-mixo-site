import { useState } from 'react'
import {
  CANAUX, DEMANDES, PAYS, STATUTS, TYPES_BOUTIQUE, TYPES_BROUILLON, adresseComplete, dateLongue, demander,
  emailValide, jourCourt, notesSansSources, pastille, q, sourcesDe, supabase, useCharge,
} from '../lib.js'
import { Cadenas, Entete, Erreur, Retour, Score } from '../ui.jsx'
import FormBoutique from '../FormBoutique.jsx'

const SANS_ENVOI = ['bloque', 'client', 'refus']
const EN_COURS = ['en_attente', 'en_cours']

async function charger(id) {
  const [b, echanges, brouillons, demandes] = await Promise.all([
    q(supabase.from('boutiques').select('*').eq('id', id).maybeSingle()),
    q(supabase.from('echanges').select('id,canal,sens,objet,corps,resume,statut_detecte,le').eq('boutique_id', id).order('le', { ascending: false }).limit(50)),
    q(supabase.from('brouillons').select('id,type,objet,statut,erreur,cree_le,envoye_le').eq('boutique_id', id).neq('statut', 'annule').order('cree_le', { ascending: false })),
    q(supabase.from('file_claude').select('id,type,statut,erreur,cree_le,fini_le').eq('boutique_id', id).order('cree_le', { ascending: false }).limit(10)),
  ])
  return { b, echanges, brouillons, demandes }
}

// Type d'e-mail le plus probable, d'après l'historique ; le veilleur le recalcule de toute façon.
function typeProbable(echanges, brouillons) {
  const dernierEntrant = echanges.find((e) => e.sens === 'entrant' && e.canal === 'email')
  const envoyes = brouillons.filter((x) => x.statut === 'envoye')
  if (dernierEntrant && (!envoyes[0] || new Date(dernierEntrant.le) > new Date(envoyes[0].envoye_le))) return 'reponse'
  if (!envoyes.length) return 'premier'
  if (!envoyes.some((x) => x.type === 'relance_1')) return 'relance_1'
  return 'relance_2'
}

const titreEchange = (e) => {
  if (e.canal === 'systeme') return 'Claude'
  if (e.canal === 'note') return 'Note'
  if (e.sens === 'entrant') return e.objet ? `Réponse : ${e.objet}` : 'Réponse reçue'
  if (e.sens === 'sortant') return e.objet || 'E-mail envoyé'
  return e.objet || CANAUX[e.canal]
}
const texteEchange = (e) => {
  const t = (e.resume || e.corps || '').replace(/\n{2,}/g, '\n')
  return t.length > 400 ? `${t.slice(0, 400).replace(/\s+\S*$/, '')}…` : t
}

function Infos({ b }) {
  const lignes = [
    ['E-mail', b.email && <a href={`mailto:${b.email}`}>{b.email}</a>],
    ['Téléphone', b.telephone && <a href={`tel:${b.telephone.replace(/\s/g, '')}`}>{b.telephone}</a>],
    ['Site', b.site_web && <a href={b.site_web} target="_blank" rel="noreferrer noopener">{b.site_web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>],
    ['Instagram', b.instagram && <a href={`https://instagram.com/${b.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}`} target="_blank" rel="noreferrer noopener">{b.instagram}</a>],
    ['Marques vendues', b.marques?.join(', ')],
    ['Contact', b.contact_nom],
    ['Adresse', adresseComplete(b)],
    ['Angle', b.angle],
  ].filter(([, v]) => v)
  if (!lignes.length) return <p className="sous" style={{ margin: 0 }}>Rien de connu pour l’instant.</p>
  return (
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px 24px' }}>
      {lignes.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <dt className="lbl">{k}</dt>
          <dd style={{ margin: 0, fontSize: 16, overflowWrap: 'anywhere' }}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Rediger({ b, echanges, brouillons, onDemande }) {
  const [ouvert, setOuvert] = useState(false)
  const [type, setType] = useState(() => typeProbable(echanges, brouillons))
  const [consigne, setConsigne] = useState('')
  const [erreur, setErreur] = useState(null)
  if (!ouvert) return <button className="btn noir" onClick={() => setOuvert(true)}>Préparer un e-mail</button>
  const envoyer = async (e) => {
    e.preventDefault()
    setErreur(null)
    try {
      // Le préfixe [type] dit au veilleur quel e-mail écrire (convention des services de condor).
      await demander('rediger', { boutique_id: b.id, consigne: `[${type}] ${consigne.trim()}`.trim() })
      setOuvert(false)
      setConsigne('')
      onDemande()
    } catch (e2) { setErreur(e2) }
  }
  return (
    <form onSubmit={envoyer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label htmlFor="r-type" className="petit">Quel e-mail ?</label>
      <select id="r-type" value={type} onChange={(e) => setType(e.target.value)}>
        {Object.entries(TYPES_BROUILLON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <label htmlFor="r-consigne" className="petit">Une consigne pour Claude ? (facultatif)</label>
      <textarea id="r-consigne" rows="3" value={consigne} onChange={(e) => setConsigne(e.target.value)}
        placeholder="Ex. : proposer 5 échantillons fruités, parler du 60 ml" />
      <Erreur e={erreur} />
      <div className="rangee">
        <button className="btn noir" type="submit">Demander à Claude</button>
        <button className="btn blanc" type="button" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
    </form>
  )
}

export default function Fiche({ id }) {
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const [edition, setEdition] = useState(false)
  const { data, error, recharger } = useCharge(() => charger(id), [id], { toutes: 5000 })

  if (error && !data) return <div className="page"><Entete actif="prospects" /><Erreur e={error} /></div>
  if (!data) return <div className="page"><Entete actif="prospects" /></div>
  const { b, echanges, brouillons, demandes } = data
  if (!b) return <div className="page"><Entete actif="prospects" /><div className="vide">Cette boutique n’existe pas ou a été supprimée. <a href="#/prospects">Retour aux prospects</a></div></div>

  const sources = sourcesDe(b.notes)
  const notes = notesSansSources(b.notes)
  const attente = demandes.filter((d) => EN_COURS.includes(d.statut))
  const echec = demandes.find((d) => d.statut === 'erreur' && !attente.some((a) => a.type === d.type))
  const aRelire = brouillons.find((x) => x.statut === 'a_valider')
  const reponse = echanges.find((e) => e.sens === 'entrant' && e.resume)
  const bloque = SANS_ENVOI.includes(b.statut)

  const agir = async (fn) => {
    setErreur(null)
    setEnCours(true)
    try { await fn() } catch (e) { setErreur(e) }
    setEnCours(false)
    recharger()
  }
  const changerStatut = (statut) => agir(async () => {
    await q(supabase.from('boutiques').update({ statut }).eq('id', b.id))
  })
  const enrichir = () => agir(() => demander('enrichir', { boutique_id: b.id }))
  const noter = (e) => {
    e.preventDefault()
    if (!note.trim()) return
    agir(async () => { await demander('note', { boutique_id: b.id, consigne: note.trim() }); setNote('') })
  }

  return (
    <div className="page">
      <Entete actif="prospects" />

      <section className="rangee" style={{ gap: '20px 28px' }}>
        <a className="icone" href="#/prospects" aria-label="Retour aux prospects"><Retour /></a>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 300px' }}>
          <h1 className="titre-boutique">{b.nom}</h1>
          <span className="sous">
            {[TYPES_BOUTIQUE[b.type], adresseComplete(b), b.pays !== 'FR' && PAYS[b.pays],
              b.nb_boutiques > 1 ? `${b.nb_boutiques} boutiques` : '1 boutique'].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="rangee" style={{ gap: 10, marginLeft: 'auto' }}>
          <Score score={b.score} sansLibelle />
          <span className="sous" style={{ fontSize: 14 }}>{b.score == null ? 'Pas de score' : `Score ${b.score}`}</span>
          <label htmlFor="statut" className="sr">Statut</label>
          <select id="statut" className={`statut-choix ${pastille(b.statut)}`} value={b.statut} disabled={enCours || b.statut === 'bloque'}
            onChange={(e) => changerStatut(e.target.value)}>
            {Object.entries(STATUTS).filter(([k]) => k !== 'bloque' || b.statut === 'bloque').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </section>

      {b.email && !emailValide(b.email) && (
        <div className="avis attention">L’adresse e-mail « {b.email} » est incomplète : aucun e-mail ne pourra partir. <button className="btn contour" style={{ height: 32, marginLeft: 8 }} onClick={() => setEdition(true)}>La corriger</button></div>
      )}
      {b.statut === 'bloque' && (
        <div className="avis erreur rangee" style={{ gap: 10 }}>
          <Cadenas /><span>Bloquée : {b.bloque_raison || 'raison inconnue'}. Aucun e-mail ne peut partir vers cette boutique.</span>
        </div>
      )}
      <Erreur e={erreur} />

      <div className="colonnes" style={{ gap: 28 }}>
        <main className="principal" style={{ gap: 28 }}>
          <section className="carte" style={{ padding: 24, gap: 18 }} aria-labelledby="t-infos">
            <div className="rangee" style={{ justifyContent: 'space-between', gap: 12 }}>
              <h2 id="t-infos" className="m">Ce que Claude a trouvé</h2>
              {b.enrichi_le
                ? <span className="puce" style={{ background: '#3B4A1E', color: 'var(--accent)' }}>Vérifiée le {jourCourt(b.enrichi_le)}</span>
                : <span className="puce">Pas encore complétée</span>}
            </div>
            <Infos b={b} />
            <div className="rangee">
              {!!sources.length && <span className="lbl">Sources</span>}
              {sources.map((s) => <a key={s.url} className="puce" href={s.url} target="_blank" rel="noreferrer noopener" title={s.champs.join(', ')}>{s.hote}</a>)}
              {!bloque && (
                <span className="puce" style={{ background: '#2B3A2A', color: '#9FE58C' }}>
                  {b.dernier_contact_le ? `Dernier contact le ${jourCourt(b.dernier_contact_le)}` : 'Pas cliente · jamais contactée'}
                </span>
              )}
            </div>
            <div className="rangee">
              <button className="btn contour" onClick={() => setEdition(true)}>Modifier la fiche</button>
              {b.statut !== 'bloque' && !attente.some((d) => d.type === 'enrichir') && (
                <button className="btn contour" onClick={enrichir} disabled={enCours}>
                  {b.enrichi_le ? 'Revérifier avec Claude' : 'Compléter avec Claude'}
                </button>
              )}
            </div>
            {notes && <details><summary className="lbl" style={{ cursor: 'pointer' }}>Notes</summary><p style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--texte-3)' }}>{notes}</p></details>}
          </section>

          <section className="section" style={{ gap: 16 }} aria-labelledby="t-hist">
            <h2 id="t-hist" className="m">Échanges</h2>
            {!echanges.length && <div className="vide">Aucun échange pour l’instant.</div>}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {echanges.map((e) => (
                <li key={e.id} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: 14 }}>
                  <span className="sous" style={{ fontSize: 14, paddingTop: 18 }}>{jourCourt(e.le)}</span>
                  <div className="ligne" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <div className="rangee"><strong style={{ fontSize: 16, fontWeight: 600 }}>{titreEchange(e)}</strong><span className="puce">{CANAUX[e.canal]}</span></div>
                    <span style={{ fontSize: 15, color: 'var(--texte-3)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{texteEchange(e)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <aside aria-label="Résumé de Claude" className="panneau cote" style={{ flexBasis: 340 }}>
          <h2>Résumé</h2>
          {reponse
            ? <div className="bloc"><span className="petit">Réponse du {jourCourt(reponse.le)}, lue par Claude</span><p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{reponse.resume}</p></div>
            : <div className="bloc"><span className="petit">Pas encore de réponse de cette boutique.</span></div>}

          <div className="bloc accent" style={{ gap: 10 }}>
            <span className="petit" style={{ color: '#3A4A16' }}>Prochaine action{b.prochaine_action_le ? ` · ${dateLongue(b.prochaine_action_le)}` : ''}</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>
              {b.prochaine_action || (bloque ? 'Rien : aucun e-mail ne doit partir vers cette boutique.' : 'Aucune action prévue.')}
            </p>
            {aRelire && <a className="btn noir" href={`#/envois/${aRelire.id}`}>Relire le brouillon ({TYPES_BROUILLON[aRelire.type]})</a>}
            {!aRelire && !bloque && !attente.some((d) => d.type === 'rediger') && <Rediger b={b} echanges={echanges} brouillons={brouillons} onDemande={recharger} />}
          </div>

          {attente.map((d) => <span key={d.id} className="travail">Claude : {DEMANDES[d.type].toLowerCase()}{d.statut === 'en_cours' ? ' (en cours)' : ' (en attente)'}</span>)}
          {echec && <div className="avis erreur">{DEMANDES[echec.type]} a échoué : {echec.erreur}</div>}
          {brouillons.filter((x) => x.statut === 'erreur').slice(0, 1).map((x) => (
            <div key={x.id} className="avis erreur">Envoi bloqué ({TYPES_BROUILLON[x.type]}) : {x.erreur}</div>
          ))}

          <form onSubmit={noter} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="note" style={{ fontSize: 14, fontWeight: 600 }}>Note rapide</label>
            <textarea id="note" rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : appelé, intéressé, rappeler le 21/11" />
            <span className="petit">Claude met à jour le statut et l’historique à partir de ta note.</span>
            <button className="btn noir" type="submit" style={{ alignSelf: 'flex-start' }} disabled={enCours || !note.trim()}>Enregistrer la note</button>
          </form>
        </aside>
      </div>
      {edition && <FormBoutique boutique={b} onFermer={() => setEdition(false)} onFini={() => { setEdition(false); recharger() }} />}
    </div>
  )
}
