import { useState } from 'react'
import { STATUTS, demander, heure, jourCourt, metaBoutique, q, supabase, useCharge } from '../lib.js'
import { Entete, Envoyer, Erreur, Fleche, Plus, Score, Statut, Titre } from '../ui.jsx'

const EN_COURS = ['en_attente', 'en_cours']
const SUGGESTIONS = [
  'Qui dois-je appeler en priorité cette semaine ?',
  'Trouve-moi 5 vape shops indépendants à Lyon qui ne sont pas encore dans le CRM, et ajoute-les.',
  'Montre-moi les boutiques intéressées.',
  'Résume les réponses reçues cette semaine.',
]

// Chaque message passe par la file de Claude (file_claude, type chat) avec sa conversation ;
// le veilleur de condor répond, affiche des fiches et fait les actions autorisées.
const chargerConversations = () => q(supabase.from('conversations').select('id,titre,maj_le').order('maj_le', { ascending: false }).limit(100))

async function chargerMessages(conversation) {
  const messages = await q(supabase.from('file_claude').select('id,consigne,statut,resultat,erreur,cree_le')
    .eq('type', 'chat').eq('conversation_id', conversation).order('cree_le', { ascending: false }).limit(60))
  const ids = [...new Set(messages.flatMap((m) => m.resultat?.fiches || []))]
  const fiches = ids.length
    ? await q(supabase.from('boutiques').select('id,nom,ville,pays,type,nb_boutiques,statut,score,bloque_raison,prochaine_action').in('id', ids))
    : []
  return { messages, fiches: Object.fromEntries(fiches.map((b) => [b.id, b])) }
}

function CarteFiche({ b }) {
  return (
    <a className={`carte${b.statut === 'bloque' ? ' bloquee' : ''}`} href={`#/boutique/${b.id}`} style={{ minWidth: 0 }}>
      <span className="icone encoche" aria-hidden="true"><Fleche /></span>
      <div className="tete"><h3>{b.nom}</h3><span className="meta">{metaBoutique(b)}</span></div>
      {b.statut === 'bloque' ? <p>{b.bloque_raison}</p> : b.prochaine_action && <p>{b.prochaine_action}</p>}
      <div className="pied">
        <div><span className="lbl">Statut</span><Statut code={b.statut} libelle={STATUTS[b.statut]} /></div>
        <div><Score score={b.score} /></div>
      </div>
    </a>
  )
}

function Echange({ m, fiches }) {
  const r = m.resultat || {}
  const cartes = (r.fiches || []).map((id) => fiches[id]).filter(Boolean)
  return (
    <div className="echange-chat">
      <div className="bulle moi">{m.consigne}<span className="h">{jourCourt(m.cree_le)} · {heure(m.cree_le)}</span></div>
      {EN_COURS.includes(m.statut) && <div className="bulle claude"><span className="travail">Claude réfléchit…</span></div>}
      {m.statut === 'erreur' && <div className="bulle claude" style={{ color: '#F0B3AF' }}>Pas de réponse : {m.erreur}</div>}
      {m.statut === 'fait' && (
        <>
          <div className="bulle claude">{r.reponse}</div>
          {!!r.actions?.length && (
            <div className="actions-chat">
              {r.actions.map((a, i) => <span key={i} className={`statut ${a.ok ? 'p-accent' : 'p-rouge'}`}>{a.ok ? '✓' : '✗'} {a.texte}</span>)}
            </div>
          )}
          {!!cartes.length && <div className="grille">{cartes.map((b) => <CarteFiche key={b.id} b={b} />)}</div>}
        </>
      )}
    </div>
  )
}

function Conversation({ id, onTitre }) {
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const { data, error, recharger } = useCharge(() => chargerMessages(id), [id], { toutes: 3000 })
  const messages = data?.messages || []
  const attend = messages.some((m) => EN_COURS.includes(m.statut))

  const envoyer = async (contenu) => {
    const m = (contenu ?? texte).trim()
    if (!m || envoi) return
    setErreur(null)
    setEnvoi(true)
    try {
      await demander('chat', { consigne: m, conversation_id: id })
      // Une conversation prend pour titre son premier message.
      const titre = messages.length ? null : m.length > 60 ? `${m.slice(0, 60).replace(/\s+\S*$/, '')}…` : m
      await q(supabase.from('conversations').update({ maj_le: new Date().toISOString(), ...(titre && { titre }) }).eq('id', id))
      setTexte('')
      if (titre) onTitre()
      recharger()
    } catch (e) { setErreur(e) }
    setEnvoi(false)
  }

  return (
    <section className="principal" style={{ gap: 18 }} aria-label="Conversation">
      {/* La saisie est en haut et les messages récents juste dessous : pas besoin de remonter. */}
      <form className="saisie" style={{ position: 'static' }} onSubmit={(e) => { e.preventDefault(); envoyer() }}>
        <label htmlFor="msg" className="sr">Message pour Claude</label>
        <textarea id="msg" rows={1} value={texte} placeholder={attend ? 'Claude répond…' : 'Écris à Claude…'}
          onChange={(e) => { setTexte(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer() } }} />
        <button className="btn accent" type="submit" disabled={!texte.trim() || envoi} aria-label="Envoyer"><Envoyer /></button>
      </form>
      <Erreur e={erreur || error} />
      {data && !messages.length && (
        <div className="vide" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span>Nouvelle conversation. Quelques idées :</span>
          <div className="suggestions">{SUGGESTIONS.map((s) => <button key={s} className="pilule" onClick={() => envoyer(s)}>{s}</button>)}</div>
        </div>
      )}
      <div className="chat" aria-live="polite">
        {messages.map((m) => <Echange key={m.id} m={m} fiches={data.fiches} />)}
      </div>
    </section>
  )
}

export default function Claude({ conversation }) {
  const [erreur, setErreur] = useState(null)
  const { data, error, recharger } = useCharge(chargerConversations, [], { toutes: 15000 })
  const conversations = data || []
  const active = conversation || conversations[0]?.id

  const nouvelle = async () => {
    setErreur(null)
    try {
      const c = await q(supabase.from('conversations').insert({}).select('id').single())
      await recharger()
      window.location.hash = `#/claude/${c.id}`
    } catch (e) { setErreur(e) }
  }
  const supprimer = async (c) => {
    if (!window.confirm(`Supprimer la conversation « ${c.titre} » et son historique ?`)) return
    await supabase.from('conversations').delete().eq('id', c.id)
    await recharger()
    window.location.hash = '#/claude'
  }

  return (
    <div className="page" style={{ gap: 28 }}>
      <Entete actif="claude" />
      <section className="titre-bloc" style={{ gap: '16px 40px' }}>
        <Titre texte="CLAUDE" lettre="A" />
        <p className="sous" style={{ margin: 0, maxWidth: '62ch' }}>
          Pose une question ou demande une action : changer un statut, bloquer, ajouter ou corriger une boutique, lancer un enrichissement ou un brouillon.
          Les envois restent à toi.
        </p>
      </section>
      <Erreur e={error || erreur} />

      <div className="colonnes" style={{ gap: 28 }}>
        <aside className="cote liste-conv" aria-label="Conversations" style={{ flex: '1 1 260px', maxWidth: 340 }}>
          <button className="pilule plein" onClick={nouvelle} style={{ width: '100%', justifyContent: 'center' }}><Plus />Nouvelle conversation</button>
          {conversations.map((c) => (
            <div key={c.id} className={`conv${c.id === active ? ' active' : ''}`}>
              <a href={`#/claude/${c.id}`}>
                <span className="t">{c.titre}</span>
                <span className="lbl">{jourCourt(c.maj_le)} · {heure(c.maj_le)}</span>
              </a>
              <button className="suppr" onClick={() => supprimer(c)} aria-label={`Supprimer ${c.titre}`}>×</button>
            </div>
          ))}
        </aside>
        {active
          ? <Conversation key={active} id={active} onTitre={recharger} />
          : data && <section className="principal"><div className="vide">Commence par « Nouvelle conversation ».</div></section>}
      </div>
    </div>
  )
}
