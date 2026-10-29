import { useState } from 'react'
import { supabase } from '../lib.js'

export default function Connexion() {
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')
  const [attente, setAttente] = useState(false)

  const entrer = async (e) => {
    e.preventDefault()
    setErreur('')
    setAttente(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp })
    setAttente(false)
    if (error) setErreur(/invalid/i.test(error.message) ? 'E-mail ou mot de passe incorrect.' : error.message)
  }

  return (
    <main className="connexion">
      <form onSubmit={entrer}>
        <div className="logo"><img src="/mixo-logo-blanc.png" alt="Le Mixologue" /><span>CRM</span></div>
        <h1 className="titre-page" style={{ fontSize: 40 }}>B<span className="a">O</span>NJOUR</h1>
        <div className="champ">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="mdp">Mot de passe</label>
          <input id="mdp" type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </div>
        {erreur && <div className="avis erreur" role="alert">{erreur}</div>}
        <button className="btn accent" type="submit" disabled={attente}>{attente ? 'Connexion…' : 'Entrer'}</button>
      </form>
    </main>
  )
}
