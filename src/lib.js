import { createClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clientDemo } from './demo.js'

// Clé publique (publishable) : faite pour être dans le code d'un site.
// Elle ne donne accès à rien sans connexion : chaque table n'est ouverte qu'aux comptes connectés.
// La clé service_role, elle, ne sort jamais de condor.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://dicdttcpcxnuzaeejyhc.supabase.co'
const CLE = import.meta.env.VITE_SUPABASE_CLE || 'sb_publishable_XURdUZAlx4Rs4Nurrdcu9A_DRvvqJYl'

// `npm run dev` puis ?demo : faux client et données d'exemple, pour vérifier l'affichage sans base.
// import.meta.env.DEV vaut false dans le site publié : le mode démo n'y existe pas.
export const supabase = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
  ? clientDemo()
  : createClient(URL, CLE)

// ------------------------------------------------------------------ libellés

export const STATUTS = {
  a_enrichir: 'À enrichir',
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  relance: 'Relancé',
  interesse: 'Intéressé',
  a_rappeler: 'À rappeler',
  echantillon: 'Échantillon envoyé',
  client: 'Client',
  refus: 'Refus',
  bloque: 'Bloquée',
}

export const DETECTES = {
  interesse: 'Intéressé',
  a_rappeler: 'À rappeler',
  refus: 'Refus',
  question: 'Question',
  desinscription: 'Désinscription',
  client_existant: 'Déjà client',
  autre: 'Autre',
}

export const TYPES_BOUTIQUE = {
  vape_shop: 'Vape shop',
  chaine: 'Chaîne',
  grossiste: 'Grossiste',
  distributeur: 'Distributeur',
  autre: 'Autre',
}

export const TYPES_BROUILLON = {
  premier: 'Premier contact',
  relance_1: 'Relance 1',
  relance_2: 'Relance 2',
  reponse: 'Réponse',
}

export const PAYS = {
  FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg', ES: 'Espagne', PT: 'Portugal',
  AT: 'Autriche', RO: 'Roumanie', HR: 'Croatie', IT: 'Italie', DE: 'Allemagne', NL: 'Pays-Bas', AUTRE: 'Autre',
}

export const CANAUX = { email: 'E-mail', appel: 'Appel', instagram: 'Instagram', note: 'Note', systeme: 'Claude' }

export const DEMANDES = {
  enrichir: 'Compléter la fiche',
  rediger: 'Rédiger un e-mail',
  reecrire: 'Réécrire un e-mail',
  resumer_reponse: 'Lire une réponse',
  note: 'Enregistrer une note',
  brief: 'Préparer le brief',
}

// Couleurs de pastille, d'après le cahier de design.
const PASTILLES = {
  interesse: 'p-accent',
  a_rappeler: 'p-jaune',
  contacte: 'p-turquoise', relance: 'p-turquoise', question: 'p-turquoise', echantillon: 'p-turquoise',
  a_contacter: 'p-gris', a_enrichir: 'p-gris', refus: 'p-gris', autre: 'p-gris',
  bloque: 'p-rouge', client: 'p-rouge', client_existant: 'p-rouge', desinscription: 'p-rouge',
}
export const pastille = (statut) => PASTILLES[statut] || 'p-gris'

// ------------------------------------------------------------------ dates

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const aujourdhui = () => {
  const d = new Date()
  const j = JOURS[d.getDay()]
  return `${j[0].toUpperCase()}${j.slice(1)} ${d.getDate()} ${MOIS[d.getMonth()]}`
}
export const heure = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : '')
export const jourCourt = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) : '')
export const dateLongue = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
export const jourISO = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

// ------------------------------------------------------------------ boutiques

export const metaBoutique = (b) => {
  if (!b) return ''
  const n = b.nb_boutiques > 1 ? `${b.nb_boutiques} boutiques` : null
  return [TYPES_BOUTIQUE[b.type], b.ville, b.pays && b.pays !== 'FR' ? PAYS[b.pays] : null, n].filter(Boolean).join(' · ')
}

// L'enrichissement écrit parfois l'adresse entière (« 29 Cr Victor Hugo, 84300 Cavaillon, France ») :
// on n'y rajoute la ville que si elle n'y est pas déjà.
export const adresseComplete = (b) => {
  const a = (b?.adresse || '').replace(/,\s*(France|Belgique|Suisse|Espagne|Portugal)\s*$/i, '').trim()
  const cpVille = [b?.code_postal, b?.ville].filter(Boolean).join(' ')
  if (!a) return cpVille
  if (b?.ville && a.toLowerCase().includes(b.ville.toLowerCase())) return a
  return [a, cpVille].filter(Boolean).join(', ')
}

export const emailValide = (e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e || '')

// Score 0–100 → 1 à 5 pastilles allumées (0 si pas encore de score).
export const pastillesScore = (score) => (score == null ? 0 : Math.max(1, Math.min(5, Math.ceil(score / 20))))

// L'enrichissement ajoute des lignes « Source <champ> : <url> » au champ notes.
export const sourcesDe = (notes) => {
  const vues = new Map()
  for (const l of (notes || '').split('\n')) {
    const m = l.match(/^Source (\S+) : (https?:\/\/\S+)/)
    if (!m) continue
    let hote = m[2]
    try { hote = new window.URL(m[2]).hostname.replace(/^www\./, '') } catch { /* garde l'adresse brute */ }
    if (!vues.has(m[2])) vues.set(m[2], { url: m[2], hote, champs: [m[1]] })
    else vues.get(m[2]).champs.push(m[1])
  }
  return [...vues.values()]
}
export const notesSansSources = (notes) => (notes || '').split('\n').filter((l) => !/^Source \S+ : /.test(l)).join('\n').trim()

// ------------------------------------------------------------------ e-mails

// La ligne de désinscription est ajoutée par le veilleur ; le facteur refuse un e-mail sans elle.
export const contientStop = (corps) => /\bSTOP\b/.test(corps || '')

// ------------------------------------------------------------------ demandes à Claude

export async function demander(type, champs) {
  const { data, error } = await supabase.from('file_claude').insert({ type, ...champs }).select().single()
  if (error) throw error
  return data
}

// ------------------------------------------------------------------ accès aux données

// Charge une requête, la recharge quand on revient sur l'onglet et, si demandé, à intervalle.
export function useCharge(fabrique, deps, { toutes = 0 } = {}) {
  const [etat, setEtat] = useState({ data: null, error: null, chargement: true })
  const ref = useRef(fabrique)
  ref.current = fabrique
  const recharger = useCallback(async () => {
    try {
      const data = await ref.current()
      setEtat({ data, error: null, chargement: false })
    } catch (error) {
      setEtat((e) => ({ ...e, error, chargement: false }))
    }
  }, [])
  useEffect(() => {
    setEtat((e) => ({ ...e, chargement: true }))
    recharger()
    const auFocus = () => document.visibilityState === 'visible' && recharger()
    document.addEventListener('visibilitychange', auFocus)
    const t = toutes ? setInterval(() => document.visibilityState === 'visible' && recharger(), toutes) : null
    return () => { document.removeEventListener('visibilitychange', auFocus); if (t) clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { ...etat, recharger }
}

export async function q(promesse) {
  const { data, error } = await promesse
  if (error) throw error
  return data
}

export const messageErreur = (e) => {
  const m = e?.message || String(e)
  if (/brouillons_garde_fou|bloqu/i.test(m)) return 'Refusé par la base : cette boutique est bloquée, cliente ou en refus.'
  if (/JWT|session/i.test(m)) return 'Ta session a expiré. Reconnecte-toi.'
  if (/fetch|network/i.test(m)) return 'Connexion impossible. Vérifie internet et réessaie.'
  return m
}
