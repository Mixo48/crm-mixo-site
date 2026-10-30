import { useState } from 'react'
import {
  CANAUX, DEMANDES, PAYS, STATUTS, TYPES_BOUTIQUE, TYPES_BROUILLON, adresseComplete, dateLongue, demander,
  emailValide, jourCourt, notesSansSources, pastille, q, sourcesDe, supabase, useCharge,
} from '../lib.js'
import { Cadenas, Entete, Erreur, Retour, Score } from '../ui.jsx'
import FormBoutique from '../FormBoutique.jsx'
import Debloquer from '../Debloquer.jsx'

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

const DEJA_CONTACTEE = ['contacte', 'relance', 'interesse', 'a_rappeler', 'echantillon']

// Type d'e-mail le plus probable, d'après l'historique. Une boutique reprise de l'ancien CRM est déjà
// contactée sans e-mail envoyé d'ici : on propose une relance plutôt qu'un premier contact.
function typeProbable(b, echanges, brouillons) {
  const dernierEntrant = echanges.find((e) => e.sens === 'entrant' && e.canal === 'email')
  const envoyes = brouillons.filter((x) => x.statut === 'envoye')
  if (dernierEntrant && (!envoyes[0] || new Date(dernierEntrant.le) > new Date(envoyes[0].envoye_le))) return 'reponse'
  if (!envoyes.length) return DEJA_CONTACTEE.includes(b.statut) ? 'relance_1' : 'premier'
  if (!envoyes.some((x) => x.type === 'relance_1')) return 'relance_1'
  return 'relance_2'
}

const LIBELLES = { site_web: 'Site', email: 'E-mail', telephone: 'Téléphone', instagram: 'Instagram', contact_nom: 'Gérant',
  adresse: 'Adresse', code_postal: 'Code postal', type: 'Type', nb_boutiques: 'Nombre de boutiques' }
const date = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : null)

function Entreprise({ i }) {
  if (!i.siren && !i.tva && !i.date_creation) return null
  const lignes = [
    ['SIREN', i.siren], ['SIRET (siège)', i.siret], ['TVA intracommunautaire', i.tva],
    ['Forme', i.forme_juridique], ['Création', date(i.date_creation)],
    ['Dirigeant', i.dirigeants?.map((d) => `${d.nom}${d.qualite ? ` (${d.qualite.toLowerCase()})` : ''}`).join(', ')],
    ['Code NAF', i.naf], ['Siège', i.siege_ailleurs || i.adresse_siege ? i.adresse_siege : null],
  ].filter(([, v]) => v)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: '1px solid var(--contour)' }}>
      <div className="rangee" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Entreprise</h3>
        <span className="rangee" style={{ gap: 6 }}>
          {i.etat && <span className={`statut ${i.etat === 'active' ? 'p-accent' : 'p-rouge'}`} style={{ height: 26, fontSize: 12 }}>{i.etat === 'active' ? 'Active' : 'Fermée'} au registre</span>}
          {i.fiche_officielle && <a className="puce" href={i.fiche_officielle} target="_blank" rel="noreferrer noopener">Fiche officielle</a>}
        </span>
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px 24px' }}>
        {lignes.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <dt className="lbl">{k}</dt>
            <dd style={{ margin: 0, fontSize: 15, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// Ce que Claude a trouvé de différent : jamais écrit seul, Nathan choisit.
function AVerifier({ b, onChange }) {
  const [erreur, setErreur] = useState(null)
  const liste = b.infos?.a_verifier || []
  if (!liste.length) return null
  const traiter = async (p, remplacer) => {
    setErreur(null)
    const infos = { ...b.infos, a_verifier: liste.filter((x) => x !== p) }
    try {
      await q(supabase.from('boutiques').update({ infos, ...(remplacer && { [p.champ]: p.propose }) }).eq('id', b.id))
      onChange()
    } catch (e) { setErreur(e) }
  }
  return (
    <div className="avis attention" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <strong>Claude a trouvé autre chose ({liste.length})</strong>
      {liste.map((p, n) => (
        <div key={n} className="rangee" style={{ justifyContent: 'space-between', gap: 10 }}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <b>{LIBELLES[p.champ] || p.champ}</b> : {String(p.actuel)} → <b>{String(p.propose)}</b>
            {p.source && <> · <a href={p.source} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }}>source</a></>}
          </span>
          <span className="rangee" style={{ gap: 6 }}>
            <button className="btn accent" style={{ height: 32 }} onClick={() => traiter(p, true)}>Remplacer</button>
            <button className="btn contour" style={{ height: 32 }} onClick={() => traiter(p, false)}>Ignorer</button>
          </span>
        </div>
      ))}
      <Erreur e={erreur} />
    </div>
  )
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
  const i = b.infos || {}
  const lignes = [
    ['E-mail', b.email && <a href={`mailto:${b.email}`}>{b.email}</a>],
    ['Téléphone', b.telephone && <a href={`tel:${b.telephone.replace(/\s/g, '')}`}>{b.telephone}</a>],
    ['Site', b.site_web && <a href={b.site_web} target="_blank" rel="noreferrer noopener">{b.site_web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>],
    ['Instagram', b.instagram && <a href={`https://instagram.com/${b.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}`} target="_blank" rel="noreferrer noopener">{b.instagram}</a>],
    ['Marques vendues', b.marques?.join(', ')],
    ['Facebook', i.facebook && <a href={i.facebook} target="_blank" rel="noreferrer noopener">{i.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\/$/, '')}</a>],
    ['TikTok', i.tiktok && <a href={i.tiktok.startsWith('@') ? `https://www.tiktok.com/${i.tiktok}` : i.tiktok} target="_blank" rel="noreferrer noopener">{i.tiktok.replace(/^https?:\/\/(www\.)?tiktok\.com\//, '')}</a>],
    ['Google', (i.google_maps || i.google_note != null) && (
      <span>{i.google_note != null && <b>{String(i.google_note).replace('.', ',')} ★</b>}{i.google_avis != null && ` · ${i.google_avis} avis`}{i.google_maps && <> · <a href={i.google_maps} target="_blank" rel="noreferrer noopener">voir la fiche</a></>}</span>)],
    ['Horaires', i.horaires],
    ['Gérant', b.contact_nom],
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
  const [type, setType] = useState(() => typeProbable(b, echanges, brouillons))
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
  const [deblocage, setDeblocage] = useState(false)
  const { data, error, recharger } = useCharge(() => charger(id), [id], { toutes: 5000 })

  if (error && !data) return <div className="page"><Entete actif="prospects" /><Erreur e={error} /></div>
  if (!data) return <div className="page"><Entete actif="prospects" /></div>
  const { b, echanges, brouillons, demandes } = data
  if (!b) return <div className="page"><Entete actif="prospects" /><div className="vide">Cette boutique n’existe pas ou a été supprimée. <a href="#/prospects">Retour aux prospects</a></div></div>

  // Sources de la dernière vérification ; à défaut, celles notées par les anciennes versions.
  const sources = b.infos?.sources?.length
    ? Object.values(b.infos.sources.reduce((m, s) => {
      let hote = s.url
      try { hote = new URL(s.url).hostname.replace(/^www\./, '') } catch { /* adresse brute */ }
      ;(m[s.url] ||= { url: s.url, hote, champs: [] }).champs.push(s.champ)
      return m
    }, {}))
    : sourcesDe(b.notes)
  const fermee = b.infos?.etat === 'fermée' || b.infos?.fermee_web
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

      {!b.email && !bloque && (
        // Règle : un prospect sans e-mail est signalé, aucun e-mail ne peut lui partir.
        <div className="avis attention rangee" style={{ gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>Pas d’adresse e-mail.</b>{' '}
            {b.infos?.verifie_le
              ? `Claude n’en a pas trouvé le ${jourCourt(b.infos.verifie_le)}. Passe par le téléphone, Instagram ou Facebook, ou ajoute-la à la main.`
              : 'Aucun e-mail ne pourra partir tant qu’elle manque.'}
          </span>
          {!b.infos?.verifie_le && !attente.some((d) => d.type === 'enrichir') && <button className="btn accent" style={{ height: 32 }} onClick={enrichir} disabled={enCours}>La chercher avec Claude</button>}
          <button className="btn contour" style={{ height: 32 }} onClick={() => setEdition(true)}>L’ajouter</button>
        </div>
      )}
      {b.email && !emailValide(b.email) && (
        <div className="avis attention">L’adresse e-mail « {b.email} » est incomplète : aucun e-mail ne pourra partir. <button className="btn contour" style={{ height: 32, marginLeft: 8 }} onClick={() => setEdition(true)}>La corriger</button></div>
      )}
      {b.statut === 'bloque' && (
        <div className="avis erreur rangee" style={{ gap: 10 }}>
          <Cadenas /><span style={{ flex: 1 }}>Bloquée : {b.bloque_raison || 'raison inconnue'}. Aucun e-mail ne peut partir vers cette boutique.</span>
          <button className="btn danger" style={{ height: 36 }} onClick={() => setDeblocage(true)}>Débloquer</button>
        </div>
      )}
      <Erreur e={erreur} />

      <div className="colonnes" style={{ gap: 28 }}>
        <main className="principal" style={{ gap: 28 }}>
          <section className="carte" style={{ padding: 24, gap: 18 }} aria-labelledby="t-infos">
            <div className="rangee" style={{ justifyContent: 'space-between', gap: 12 }}>
              <h2 id="t-infos" className="m">Ce que Claude a trouvé</h2>
              {attente.some((d) => d.type === 'enrichir') ? <span className="travail lbl">Claude vérifie toute la fiche (1 à 4 min)…</span> : b.enrichi_le
                ? <span className="puce" style={{ background: '#3B4A1E', color: 'var(--accent)' }}>Vérifiée le {jourCourt(b.enrichi_le)}</span>
                : <span className="puce">Pas encore complétée</span>}
            </div>
            {fermee && <div className="avis erreur">{b.infos?.etat === 'fermée' ? 'Entreprise fermée au registre officiel.' : 'Claude pense que la boutique est fermée (Google, site…).'} À vérifier avant de la contacter.</div>}
            <AVerifier b={b} onChange={recharger} />
            <Infos b={b} />
            <Entreprise i={b.infos || {}} />
            <div className="rangee">
              {!!sources.length && <span className="lbl">Sources</span>}
              {sources.map((s) => <a key={s.url} className="puce" href={s.url} target="_blank" rel="noreferrer noopener" title={s.champs.join(', ')}>{s.hote}</a>)}
              {!bloque && (
                <span className="puce" style={{ background: '#2B3A2A', color: '#9FE58C' }}>
                  {b.dernier_contact_le ? `Dernier contact le ${jourCourt(b.dernier_contact_le)}`
                    : DEJA_CONTACTEE.includes(b.statut) ? 'Déjà contactée (date inconnue)' : 'Pas cliente · jamais contactée'}
                </span>
              )}
            </div>
            <div className="rangee">
              <button className="btn contour" onClick={() => setEdition(true)}>Modifier la fiche</button>
              {b.statut !== 'bloque' && !attente.some((d) => d.type === 'enrichir') && (
                <button className="btn accent" onClick={enrichir} disabled={enCours} title="E-mail, réseaux, Google, gérant, SIREN, TVA, date de création… en un clic">
                  {b.enrichi_le ? 'Tout revérifier avec Claude' : 'Tout trouver avec Claude'}
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
            {!aRelire && !bloque && !attente.some((d) => d.type === 'rediger') && (emailValide(b.email)
              ? <Rediger b={b} echanges={echanges} brouillons={brouillons} onDemande={recharger} />
              : <span className="petit">Pas d’e-mail valide : ajoute-le avant de préparer un e-mail.</span>)}
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
      {deblocage && <Debloquer b={b} onFermer={() => setDeblocage(false)} onFini={() => { setDeblocage(false); recharger() }} />}
      {edition && <FormBoutique boutique={b} onFermer={() => setEdition(false)} onFini={() => { setEdition(false); recharger() }} />}
    </div>
  )
}
