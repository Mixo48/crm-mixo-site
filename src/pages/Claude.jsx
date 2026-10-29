import { useEffect, useRef, useState } from 'react'
import { demander, heure, jourCourt, q, supabase, useCharge } from '../lib.js'
import { Entete, Envoyer, Erreur, Titre } from '../ui.jsx'

const EN_COURS = ['en_attente', 'en_cours']
const SUGGESTIONS = [
  'Qui dois-je appeler en priorité cette semaine ?',
  'Combien de boutiques reste-t-il à contacter, par ville ?',
  'Trouve-moi 5 vape shops indépendants à Lyon qui ne sont pas encore dans le CRM.',
  'Résume les réponses reçues cette semaine.',
]

// Le chat passe par la file de Claude comme les autres demandes : le site dépose le message,
// le veilleur de condor répond. Claude lit le CRM mais ne modifie rien.
const charger = () => q(supabase.from('file_claude').select('id,consigne,statut,resultat,erreur,cree_le')
  .eq('type', 'chat').order('cree_le', { ascending: false }).limit(40))

export default function Claude() {
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const bas = useRef(null)
  const { data, error, recharger } = useCharge(charger, [], { toutes: 3000 })
  const messages = [...(data || [])].reverse()
  const attend = messages.some((m) => EN_COURS.includes(m.statut))

  useEffect(() => { bas.current?.scrollIntoView({ block: 'end' }) }, [messages.length, attend])

  const envoyer = async (contenu) => {
    const m = (contenu ?? texte).trim()
    if (!m || envoi) return
    setErreur(null)
    setEnvoi(true)
    try { await demander('chat', { consigne: m }); setTexte(''); recharger() } catch (e) { setErreur(e) }
    setEnvoi(false)
  }
  const clavier = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer() }
  }

  return (
    <div className="page" style={{ gap: 28 }}>
      <Entete actif="claude" />
      <section className="titre-bloc" style={{ gap: '16px 40px' }}>
        <Titre texte="CLAUDE" lettre="A" />
        <p className="sous" style={{ margin: 0, maxWidth: '60ch' }}>
          Pose une question sur tes boutiques, tes envois ou tes réponses. Claude lit le CRM et peut chercher sur le web, mais ne modifie rien.
        </p>
      </section>
      <Erreur e={error} />

      <div className="chat" aria-live="polite">
        {data && !messages.length && (
          <div className="vide" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span>Pas encore de conversation. Quelques idées :</span>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => <button key={s} className="pilule" onClick={() => envoyer(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'contents' }}>
            <div className="bulle moi">{m.consigne}<span className="h">{jourCourt(m.cree_le)} · {heure(m.cree_le)}</span></div>
            {m.statut === 'fait' && <div className="bulle claude">{m.resultat?.reponse}</div>}
            {EN_COURS.includes(m.statut) && <div className="bulle claude"><span className="travail">Claude réfléchit…</span></div>}
            {m.statut === 'erreur' && <div className="bulle claude" style={{ color: '#F0B3AF' }}>Pas de réponse : {m.erreur}</div>}
          </div>
        ))}
        <div ref={bas} />
      </div>

      <Erreur e={erreur} />
      <form className="saisie" onSubmit={(e) => { e.preventDefault(); envoyer() }}>
        <label htmlFor="msg" className="sr">Message pour Claude</label>
        <textarea id="msg" rows={1} value={texte} placeholder={attend ? 'Claude répond…' : 'Écris à Claude…'}
          onChange={(e) => { setTexte(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }}
          onKeyDown={clavier} />
        <button className="btn accent" type="submit" disabled={!texte.trim() || envoi} aria-label="Envoyer"><Envoyer /></button>
      </form>
    </div>
  )
}
