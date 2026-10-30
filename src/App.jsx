import { useEffect, useState } from 'react'
import { supabase } from './lib.js'
import Connexion from './pages/Connexion.jsx'
import Matinee from './pages/Matinee.jsx'
import Prospects from './pages/Prospects.jsx'
import Fiche from './pages/Fiche.jsx'
import Envois from './pages/Envois.jsx'
import Reponses from './pages/Reponses.jsx'
import Calendrier from './pages/Calendrier.jsx'
import Clients from './pages/Clients.jsx'
import Claude from './pages/Claude.jsx'

// Navigation par ancre (#/prospects…) : le site reste un simple dossier de fichiers statiques.
function useRoute() {
  const lire = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(lire)
  useEffect(() => {
    const changer = () => { setRoute(lire()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', changer)
    return () => window.removeEventListener('hashchange', changer)
  }, [])
  return route
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const route = useRoute()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Connexion />

  const [, page, id] = route.split('/')
  if (page === 'prospects') return <Prospects />
  if (page === 'boutique' && id) return <Fiche key={id} id={id} />
  if (page === 'envois') return <Envois key={id || 'tous'} choisi={id} />
  if (page === 'reponses') return <Reponses />
  if (page === 'calendrier') return <Calendrier />
  if (page === 'clients') return <Clients />
  if (page === 'claude') return <Claude conversation={id} />
  return <Matinee />
}
