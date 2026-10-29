import { useEffect, useRef, useState } from 'react'
import { messageErreur, pastille, pastillesScore, q, supabase, useCharge } from './lib.js'

// ------------------------------------------------------------------ icônes (traits de 1,5 px)

const I = ({ children, t = 16, w = 1.5 }) => (
  <svg width={t} height={t} viewBox={`0 0 ${t} ${t}`} fill="none" stroke="currentColor" strokeWidth={w} aria-hidden="true">{children}</svg>
)
export const Fleche = () => <I><path d="M4 12L12 4M5 4h7v7" /></I>
export const Retour = () => <I w={1.6}><path d="M13 8H3M7 4L3 8l4 4" /></I>
export const Plus = () => <I w={1.6}><path d="M8 3v10M3 8h10" /></I>
export const Envoyer = () => <I w={1.6}><path d="M2 8l12-5-5 12-2-5-5-2z" /></I>
export const Loupe = () => <I t={18}><circle cx="8" cy="8" r="5.5" /><path d="M12.5 12.5L16 16" /></I>
export const Soleil = () => <I t={18}><path d="M9 2v3M9 13v3M2 9h3M13 9h3M4 4l2 2M12 12l2 2M4 14l2-2M12 6l2-2" /></I>
export const Cadenas = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#F0938F" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 016 0V9" /></svg>
)
const IcoMatinee = () => <I t={20}><rect x="3" y="3" width="14" height="14" rx="4" /><path d="M7 8h6M7 12h4" /></I>
const IcoProspects = () => <I t={20}><circle cx="7.5" cy="7" r="3" /><circle cx="14" cy="8" r="2.2" /><path d="M2.5 16c.5-2.6 2.6-4 5-4s4.5 1.4 5 4M13 12.2c2 0 3.6 1.2 4 3.3" /></I>
const IcoEnvois = () => <I t={20}><path d="M3 10l14-6-6 14-2-6-6-2z" /></I>
const IcoCalendrier = () => <I t={20}><rect x="3" y="4.5" width="14" height="12.5" rx="3" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" /></I>
const IcoClients = () => <I t={20}><path d="M3.5 8.5L5 4h10l1.5 4.5M3.5 8.5h13M3.5 8.5V16h13V8.5M8 16v-4h4v4" /></I>
const IcoClaude = () => <I t={20}><path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.7 4.7l2.1 2.1M13.2 13.2l2.1 2.1M4.7 15.3l2.1-2.1M13.2 6.8l2.1-2.1" /></I>
const IcoReponses = () => <I t={20}><path d="M3 5.5A2.5 2.5 0 015.5 3h9A2.5 2.5 0 0117 5.5v6a2.5 2.5 0 01-2.5 2.5H9l-4 3v-3h0A2 2 0 013 12V5.5z" /></I>

// ------------------------------------------------------------------ petits composants

export const Score = ({ score, sansLibelle }) => {
  const n = pastillesScore(score)
  const C = ['#F0938F', '#F2A65E', '#F2D46B', '#B6E35A', '#7FD96B']
  return (
    <>
      {!sansLibelle && <span className="lbl">{score == null ? 'Pas encore de score' : `Score ${score}`}</span>}
      <span className="points" role="img" aria-label={score == null ? 'Pas de score' : `Score ${score} sur 100`}>
        {C.map((c, i) => <span key={c} className="point" style={i < n ? { background: c } : undefined} />)}
      </span>
    </>
  )
}

export const Statut = ({ code, libelle }) => <span className={`statut ${pastille(code)}`}>{libelle}</span>

export const Titre = ({ texte, lettre }) => {
  // Une lettre du titre en couleur d'accent : le É de MATINÉE, le O de PROSPECTS…
  const i = texte.indexOf(lettre)
  if (i < 0) return <h1 className="titre-page">{texte}</h1>
  return <h1 className="titre-page">{texte.slice(0, i)}<span className="a">{lettre}</span>{texte.slice(i + 1)}</h1>
}

export const Erreur = ({ e }) => (e ? <div className="avis erreur" role="alert">{messageErreur(e)}</div> : null)

export function Fenetre({ titre, onFermer, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const echap = (ev) => ev.key === 'Escape' && onFermer()
    document.addEventListener('keydown', echap)
    ref.current?.querySelector('input, textarea, select, button')?.focus()
    return () => document.removeEventListener('keydown', echap)
  }, [onFermer])
  return (
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="fenetre" role="dialog" aria-modal="true" aria-label={titre} ref={ref}>
        <h2>{titre}</h2>
        {children}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ état de condor et pause des envois

const FRAIS_MS = 2 * 60 * 1000

function EtatCondor() {
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState(null)
  const { data, recharger } = useCharge(async () => {
    const [services, pause] = await Promise.all([
      q(supabase.from('services_etat').select('service,vu_le,info')),
      q(supabase.from('reglages').select('valeur').eq('cle', 'envoi_pause').maybeSingle()),
    ])
    return { services, pause: pause?.valeur === true }
  }, [], { toutes: 30000 })

  if (!data) return null
  const parNom = Object.fromEntries(data.services.map((s) => [s.service, s]))
  const muets = ['veilleur', 'facteur'].filter((s) => !parNom[s] || Date.now() - new Date(parNom[s].vu_le) > FRAIS_MS)
  const modeTest = data.services.some((s) => s.info?.mode_test)
  const attente = parNom.facteur?.info?.en_attente_parce_que

  let classe = ''
  let texte = 'condor en marche'
  if (muets.length) { classe = 'ko'; texte = `condor : ${muets.join(' et ')} muet${muets.length > 1 ? 's' : ''}` }
  else if (data.pause) { classe = 'pause'; texte = 'Envois en pause' }
  else if (modeTest) texte = 'condor en marche · test'

  const basculer = async (e) => {
    const pause = e.target.checked
    setErreur(null)
    const { error } = await supabase.from('reglages').update({ valeur: pause }).eq('cle', 'envoi_pause')
    if (error) setErreur(error)
    recharger()
  }

  return (
    <div className="ancre">
      <button className={`etat ${classe}`} onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        <span className="voyant" aria-hidden="true" />{texte}
      </button>
      {ouvert && (
        <div className="tiroir panneau" role="region" aria-label="État des services">
          <label className="interrupteur">
            <span><strong>Mettre les envois en pause</strong><br /><span className="petit">Les e-mails validés attendent la reprise.</span></span>
            <input type="checkbox" checked={data.pause} onChange={basculer} />
          </label>
          <Erreur e={erreur} />
          {['veilleur', 'facteur'].map((s) => (
            <div key={s} className="bloc">
              <strong>{s === 'veilleur' ? 'Veilleur (Claude)' : 'Facteur (e-mails)'}</strong>
              <span className="petit">
                {parNom[s] ? `Dernier signe de vie : ${new Date(parNom[s].vu_le).toLocaleTimeString('fr-BE')}` : 'Jamais vu'}
                {muets.includes(s) && ' · ne répond plus'}
              </span>
            </div>
          ))}
          {attente && <span className="petit">Envois en attente : {attente}</span>}
          {modeTest && <div className="avis attention">Mode test : tous les e-mails partent vers ta propre adresse, avec [TEST] dans l’objet.</div>}
          <button className="btn blanc seulement-mobile" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ en-tête et navigation

const LIENS = [
  { href: '#/', nom: 'Ta matinée', ico: IcoMatinee, cle: 'matinee' },
  { href: '#/prospects', nom: 'Prospects', ico: IcoProspects, cle: 'prospects' },
  { href: '#/envois', nom: 'Envois', ico: IcoEnvois, cle: 'envois' },
  { href: '#/reponses', nom: 'Réponses', ico: IcoReponses, cle: 'reponses' },
  { href: '#/calendrier', nom: 'Calendrier', ico: IcoCalendrier, cle: 'calendrier' },
  { href: '#/clients', nom: 'Clients', ico: IcoClients, cle: 'clients' },
  { href: '#/claude', nom: 'Claude', ico: IcoClaude, cle: 'claude' },
]

export function Entete({ actif, children }) {
  return (
    <>
      <header className="entete">
        <a className="logo" href="#/" aria-label="Le Mixologue, accueil du CRM">
          <img src="/mixo-logo-blanc.png" alt="Le Mixologue" />
          <span>CRM</span>
        </a>
        <nav className="nav" aria-label="Navigation principale">
          {LIENS.map((l) => (
            <a key={l.cle} className="pilule" href={l.href} aria-current={actif === l.cle ? 'page' : undefined}>{l.nom}</a>
          ))}
        </nav>
        {children}
        <div className="entete-droite">
          <EtatCondor />
          <button className="pilule sans-mobile" onClick={() => supabase.auth.signOut()}>Quitter</button>
        </div>
      </header>
      <nav className="nav-mobile" aria-label="Navigation">
        {LIENS.map(({ cle, href, nom, ico: Ico }) => (
          <a key={cle} href={href} aria-label={nom} aria-current={actif === cle ? 'page' : undefined}><Ico /></a>
        ))}
      </nav>
    </>
  )
}

// ------------------------------------------------------------------ carte boutique (prospects, matinée)

export function CarteBloquee({ b }) {
  return (
    <a className="carte bloquee" href={`#/boutique/${b.id}`}>
      <div className="rangee"><Cadenas /><h3>{b.nom}</h3></div>
      <p>{b.bloque_raison ? `Bloquée automatiquement : ${b.bloque_raison}.` : 'Bloquée.'} Aucun e-mail de prospection ne peut partir vers cette boutique.</p>
      <span className="puce" style={{ alignSelf: 'flex-start', background: '#3A2A29', color: '#F0B3AF' }}>
        {/client/i.test(b.bloque_raison || '') ? 'Déjà cliente' : 'Bloquée'}
      </span>
    </a>
  )
}
