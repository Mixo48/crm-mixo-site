import { useEffect, useMemo, useState } from 'react'
import { TYPES_BROUILLON, contientStop, demander, heure, jourCourt, messageErreur, q, supabase, useCharge } from '../lib.js'
import { Entete, Envoyer, Erreur, Titre } from '../ui.jsx'

const SANS_ENVOI = ['bloque', 'client', 'refus']
const BOUTIQUE = 'boutiques(id,nom,ville,email,statut)'

async function charger() {
  const [brouillons, attente, erreurs, reglages, facteur, reecritures] = await Promise.all([
    q(supabase.from('brouillons').select(`id,type,objet,corps,pieces_jointes,cree_le,maj_le,boutique_id,${BOUTIQUE}`).eq('statut', 'a_valider').order('cree_le')),
    q(supabase.from('brouillons').select(`id,type,statut,valide_le,${BOUTIQUE}`).in('statut', ['valide', 'en_envoi']).order('valide_le')),
    q(supabase.from('brouillons').select(`id,type,erreur,maj_le,${BOUTIQUE}`).eq('statut', 'erreur').order('maj_le', { ascending: false }).limit(10)),
    q(supabase.from('reglages').select('cle,valeur')),
    q(supabase.from('services_etat').select('info').eq('service', 'facteur').maybeSingle()),
    q(supabase.from('file_claude').select('id,brouillon_id,statut,erreur').eq('type', 'reecrire').in('statut', ['en_attente', 'en_cours', 'erreur']).order('cree_le', { ascending: false }).limit(30)),
  ])
  return { brouillons, attente, erreurs, reglages: Object.fromEntries(reglages.map((r) => [r.cle, r.valeur])), facteur: facteur?.info || {}, reecritures }
}

// Prochain instant où le facteur a le droit d'envoyer (heure du navigateur, supposée être celle de Bruxelles).
function prochainCreneau(d, heures) {
  const { debut = 9, fin = 18, jours = [1, 2, 3, 4, 5] } = heures || {}
  const t = new Date(d)
  for (let i = 0; i < 8; i++) {
    const iso = t.getDay() === 0 ? 7 : t.getDay()
    if (jours.includes(iso)) {
      if (t.getHours() < debut) { t.setHours(debut, 0, 0, 0); return t }
      if (t.getHours() < fin) return t
    }
    t.setDate(t.getDate() + 1)
    t.setHours(debut, 0, 0, 0)
  }
  return t
}

function estimation(n, attente, r, facteur) {
  if (!n) return ''
  const intervalle = Number(r.envoi_intervalle_secondes) || 120
  const maxJour = Number(r.envoi_max_par_jour) || 40
  const total = attente + n
  const restant = Math.max(0, maxJour - (facteur.envois_aujourdhui || 0))
  const min = Math.round(intervalle / 60)
  const rythme = min >= 1 ? `Un e-mail toutes les ${min} minute${min > 1 ? 's' : ''}` : `Un e-mail toutes les ${intervalle} secondes`
  if (r.envoi_pause === true) return `${rythme} · envois en pause : rien ne part avant la reprise`
  const depart = prochainCreneau(new Date(), r.envoi_heures)
  const demain = depart.toDateString() !== new Date().toDateString()
  if (total > restant) return `${rythme} · ${restant} encore possible${restant > 1 ? 's' : ''} aujourd’hui (plafond ${maxJour}), la suite part les jours suivants`
  const finVers = new Date(depart.getTime() + (total - 1) * intervalle * 1000)
  return `${rythme}, fini vers ${heure(finVers.toISOString())}${demain ? ` le ${jourCourt(depart.toISOString())}` : ''} · plafond OVH d’environ 200 par heure`
}

// Pièces jointes : les fichiers sont sur condor (documents/), la liste dans reglages.documents.
// Jamais dans un premier contact, sauf un document marqué premier_contact (le catalogue).
function PiecesJointes({ d, documents, onChange }) {
  const [erreur, setErreur] = useState(null)
  if (!documents.length) return null
  const choisies = new Set(d.pieces_jointes || [])
  const basculer = async (id) => {
    const s = new Set(choisies)
    s.has(id) ? s.delete(id) : s.add(id)
    setErreur(null)
    try {
      await q(supabase.from('brouillons').update({ pieces_jointes: [...s] }).eq('id', d.id).eq('statut', 'a_valider'))
      onChange()
    } catch (e) { setErreur(e) }
  }
  return (
    <div className="bloc" style={{ gap: 8 }}>
      <strong style={{ fontSize: 15 }}>Pièces jointes</strong>
      {d.type === 'premier' && <span className="petit">Premier contact : pas de pièce jointe, sauf le catalogue si tu le veux.</span>}
      {documents.map((doc) => {
        const interdit = d.type === 'premier' && !doc.premier_contact
        return (
          <label key={doc.id} className="rangee" style={{ gap: 10, cursor: interdit ? 'not-allowed' : 'pointer', opacity: interdit ? 0.45 : 1 }} title={doc.usage}>
            <input type="checkbox" checked={choisies.has(doc.id)} disabled={interdit && !choisies.has(doc.id)} onChange={() => basculer(doc.id)}
              style={{ width: 20, height: 20, accentColor: '#141414', colorScheme: 'light' }} />
            <span style={{ fontSize: 14 }}>{doc.nom} <span className="petit">· {doc.fichier}</span></span>
          </label>
        )
      })}
      <Erreur e={erreur} />
    </div>
  )
}

function Apercu({ d, modeTest, reecriture, documents, onChange }) {
  const [edition, setEdition] = useState(false)
  const [objet, setObjet] = useState(d.objet)
  const [corps, setCorps] = useState(d.corps)
  const [consigne, setConsigne] = useState(null)
  const [erreur, setErreur] = useState(null)
  useEffect(() => { setObjet(d.objet); setCorps(d.corps); setEdition(false); setConsigne(null) }, [d.id, d.maj_le, d.objet, d.corps])

  const agir = async (fn) => {
    setErreur(null)
    try { await fn(); onChange() } catch (e) { setErreur(e) }
  }
  const enregistrer = () => agir(async () => {
    if (!contientStop(corps)) throw new Error('La ligne « STOP » doit rester dans l’e-mail, sinon le facteur refusera de l’envoyer.')
    await q(supabase.from('brouillons').update({ objet: objet.trim(), corps }).eq('id', d.id).eq('statut', 'a_valider'))
    setEdition(false)
  })
  const reecrire = (e) => {
    e.preventDefault()
    agir(async () => { await demander('reecrire', { brouillon_id: d.id, boutique_id: d.boutique_id, consigne: consigne.trim() }); setConsigne(null) })
  }
  const ecarter = () => {
    if (!window.confirm(`Écarter le brouillon pour ${d.boutiques?.nom} ? Il ne partira pas.`)) return
    agir(() => q(supabase.from('brouillons').update({ statut: 'annule' }).eq('id', d.id).eq('statut', 'a_valider')))
  }
  const bloque = SANS_ENVOI.includes(d.boutiques?.statut)
  const enCours = reecriture && reecriture.statut !== 'erreur'

  return (
    <section id="apercu" aria-label="Aperçu de l’e-mail" className="panneau" style={{ flex: '999 1 560px', padding: 24 }}>
      <div className="rangee" style={{ justifyContent: 'space-between', gap: 12 }}>
        <h2>Aperçu</h2>
        {!edition && !enCours && (
          <div className="rangee">
            <button className="btn blanc" type="button" onClick={() => setEdition(true)}>Modifier</button>
            <button className="btn noir" type="button" onClick={() => setConsigne('')}>Réécrire avec Claude</button>
          </div>
        )}
      </div>
      {bloque && <div className="avis erreur">Cette boutique est {d.boutiques.statut === 'bloque' ? 'bloquée' : `au statut « ${d.boutiques.statut} »`} : ce brouillon ne partira pas. Écarte-le.</div>}
      {enCours && <span className="travail">Claude réécrit cet e-mail…</span>}
      {reecriture?.statut === 'erreur' && <div className="avis erreur">La réécriture a échoué : {reecriture.erreur}</div>}
      {consigne !== null && (
        <form onSubmit={reecrire} className="bloc" style={{ gap: 10 }}>
          <label htmlFor="consigne" className="petit">Que doit changer Claude ?</label>
          <textarea id="consigne" rows="3" value={consigne} onChange={(e) => setConsigne(e.target.value)} placeholder="Ex. : plus court, parler des échantillons, vouvoyer" required />
          <div className="rangee">
            <button className="btn noir" type="submit" disabled={!consigne.trim()}>Demander</button>
            <button className="btn blanc" type="button" onClick={() => setConsigne(null)}>Annuler</button>
          </div>
        </form>
      )}
      <div className="mail">
        <dl>
          <dt>De</dt><dd>Nathan Gillet &lt;nathan@le-mixologue.com&gt;</dd>
          <dt>À</dt><dd>{modeTest ? <>nathan@le-mixologue.com <span style={{ color: '#5E5E58' }}>(mode test · prévu pour {d.boutiques?.email || 'adresse inconnue'})</span></> : d.boutiques?.email || <b style={{ color: '#7A2620' }}>adresse manquante</b>}</dd>
          <dt>Objet</dt>
          <dd style={{ fontWeight: 600 }}>
            {edition ? <input aria-label="Objet" value={objet} onChange={(e) => setObjet(e.target.value)} style={{ width: '100%', border: '1px solid #CFCFC9', borderRadius: 10, padding: '6px 10px', font: 'inherit' }} />
              : `${modeTest ? '[TEST] ' : ''}${d.objet}`}
          </dd>
        </dl>
        {edition
          ? <textarea aria-label="Texte de l’e-mail" rows="16" value={corps} onChange={(e) => setCorps(e.target.value)} style={{ border: '1px solid #CFCFC9', borderRadius: 14, padding: 12, font: 'inherit', fontSize: 15, lineHeight: 1.6 }} />
          : <p className="corps">{d.corps}</p>}
      </div>
      {!edition && <PiecesJointes d={d} documents={documents} onChange={onChange} />}
      {!contientStop(edition ? corps : d.corps) && <div className="avis attention">La ligne « STOP » manque : le facteur refusera d’envoyer cet e-mail.</div>}
      <Erreur e={erreur} />
      {edition
        ? <div className="rangee"><button className="btn noir" onClick={enregistrer}>Enregistrer</button><button className="btn blanc" onClick={() => setEdition(false)}>Annuler</button></div>
        : <div className="rangee" style={{ justifyContent: 'space-between' }}>
            <span className="petit">Texte simple, sans image ni mise en page : il arrive comme un e-mail écrit à la main.</span>
            <button className="btn blanc" onClick={ecarter}>Écarter</button>
          </div>}
    </section>
  )
}

export default function Envois({ choisi }) {
  const { data, error, recharger } = useCharge(charger, [], { toutes: 10000 })
  const [coches, setCoches] = useState(null)
  const [ouvert, setOuvert] = useState(choisi || null)
  const [resultat, setResultat] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  const brouillons = data?.brouillons || []
  const envoyables = useMemo(() => brouillons.filter((d) => !SANS_ENVOI.includes(d.boutiques?.statut)), [brouillons])
  // Par défaut : rien de coché. Nathan coche ce qu'il a relu ; s'il arrive depuis une carte, ce brouillon-là est coché.
  const selection = coches ?? new Set(choisi ? [choisi] : [])
  const cocher = (id) => { const s = new Set(selection); s.has(id) ? s.delete(id) : s.add(id); setCoches(s) }
  const choisis = envoyables.filter((d) => selection.has(d.id))
  const tous = envoyables.length > 0 && choisis.length === envoyables.length
  const courant = brouillons.find((d) => d.id === ouvert) || brouillons[0]
  const modeTest = data?.facteur?.mode_test !== false
  const reecriture = (id) => data?.reecritures.find((r) => r.brouillon_id === id)

  const envoyer = async () => {
    const n = choisis.length
    if (!window.confirm(`Valider ${n} e-mail${n > 1 ? 's' : ''} ? ${modeTest ? 'Mode test : ils partiront vers ta propre adresse.' : 'Ils partiront de ta boîte vers les boutiques.'}`)) return
    setEnvoi(true)
    setResultat(null)
    const echecs = []
    for (const d of choisis) {
      // Un par un : la base refuse ceux d'une boutique bloquée sans faire échouer les autres.
      const { data: fait, error: e } = await supabase.from('brouillons').update({ statut: 'valide' }).eq('id', d.id).eq('statut', 'a_valider').select('id')
      if (e) echecs.push(`${d.boutiques?.nom} : ${messageErreur(e)}`)
      else if (!fait?.length) echecs.push(`${d.boutiques?.nom} : déjà traité ailleurs`)
    }
    setResultat({ ok: n - echecs.length, echecs })
    setCoches(new Set())
    setEnvoi(false)
    recharger()
  }

  return (
    <div className="page" style={{ gap: 32 }}>
      <Entete actif="envois" />
      <section className="titre-bloc" style={{ gap: '16px 40px' }}>
        <Titre texte="ENVOI" lettre="O" />
        <p style={{ margin: 0, maxWidth: '60ch' }} className="sous">Relis chaque e-mail, coche ceux qui partent. Ils partent de ta boîte, un par un, espacés dans le temps.</p>
      </section>

      <Erreur e={error} />
      {resultat && (
        <div className={`avis ${resultat.echecs.length ? 'attention' : 'info'}`} role="status">
          {resultat.ok > 0 && `${resultat.ok} e-mail${resultat.ok > 1 ? 's' : ''} validé${resultat.ok > 1 ? 's' : ''} : le facteur les envoie dans l’ordre. `}
          {resultat.echecs.map((e) => <div key={e}>{e}</div>)}
        </div>
      )}

      {data && !brouillons.length && <div className="vide">Aucun brouillon à relire. Les nouveaux arrivent ici dès que Claude les a rédigés.</div>}

      {!!brouillons.length && (
        <div className="colonnes" style={{ gap: 28 }}>
          <section aria-label="Brouillons à valider" style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="rangee" style={{ justifyContent: 'space-between', padding: '0 4px 6px' }}>
              <h2 className="m">Brouillons</h2>
              <button className="pilule" onClick={() => setCoches(new Set(tous ? [] : envoyables.map((d) => d.id)))}>{tous ? 'Tout décocher' : 'Tout cocher'}</button>
            </div>
            {brouillons.map((d) => {
              const bloque = SANS_ENVOI.includes(d.boutiques?.statut)
              return (
                <div key={d.id} className={`choix${courant?.id === d.id ? ' ouvert' : ''}`}>
                  <input type="checkbox" id={`c-${d.id}`} checked={selection.has(d.id)} disabled={bloque} onChange={() => cocher(d.id)} />
                  <label htmlFor={`c-${d.id}`} className="sr">Sélectionner {d.boutiques?.nom}</label>
                  <button type="button" onClick={() => { setOuvert(d.id); if (window.innerWidth < 720) setTimeout(() => document.getElementById('apercu')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>
                    <span className="nom">{d.boutiques?.nom}</span>
                    <span className="meta">{bloque ? 'Bloquée : ne partira pas' : [d.boutiques?.ville, d.objet].filter(Boolean).join(' · ')}</span>
                  </button>
                  <span className="puce">{TYPES_BROUILLON[d.type]}{d.pieces_jointes?.length ? ` · ${d.pieces_jointes.length} PJ` : ''}</span>
                </div>
              )
            })}
          </section>
          {courant && <Apercu d={courant} modeTest={modeTest} reecriture={reecriture(courant.id)} documents={data?.reglages?.documents || []} onChange={recharger} />}
        </div>
      )}

      {!!data?.attente.length && (
        <section className="section" style={{ gap: 12 }}>
          <h2 className="m">Validés, en cours d’envoi</h2>
          <div className="lignes">
            {data.attente.map((d) => (
              <div key={d.id} className="ligne">
                <span className="nom">{d.boutiques?.nom}</span>
                <span className="texte">{TYPES_BROUILLON[d.type]} · validé à {heure(d.valide_le)}</span>
                <span className="travail lbl">{d.statut === 'en_envoi' ? 'en train de partir' : 'en file'}</span>
              </div>
            ))}
          </div>
          {data.facteur.en_attente_parce_que && <span className="sous" style={{ fontSize: 14 }}>Le facteur attend : {data.facteur.en_attente_parce_que}</span>}
        </section>
      )}

      {!!data?.erreurs.length && (
        <section className="section" style={{ gap: 12 }}>
          <h2 className="m">Non envoyés</h2>
          <div className="lignes">
            {data.erreurs.map((d) => (
              <a key={d.id} className="ligne" href={`#/boutique/${d.boutiques?.id}`}>
                <span className="nom">{d.boutiques?.nom}</span>
                <span className="texte">{d.erreur}</span>
                <span className="lbl">{jourCourt(d.maj_le)}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {!!brouillons.length && (
        <div className="barre-envoi">
          <strong style={{ fontSize: 16 }}>{choisis.length} sélectionné{choisis.length > 1 ? 's' : ''}</strong>
          <span>{estimation(choisis.length, data?.attente.length || 0, data?.reglages || {}, data?.facteur || {}) || 'Coche les e-mails relus.'}</span>
          <button className="btn accent" type="button" disabled={!choisis.length || envoi} onClick={envoyer}><Envoyer />{envoi ? 'Validation…' : 'Envoyer la sélection'}</button>
        </div>
      )}
    </div>
  )
}
