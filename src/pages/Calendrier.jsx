import { useMemo, useState } from 'react'
import { DETECTES, TYPES_BROUILLON, heure, jourISO, q, supabase, useCharge } from '../lib.js'
import { Entete, Erreur, Fleche, Retour, Titre } from '../ui.jsx'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// Trois sortes d'événements, chacune sa couleur de pastille (celles du cahier de design).
const GENRES = {
  action: { nom: 'À faire', classe: 'p-jaune' },
  envoi: { nom: 'E-mails', classe: 'p-turquoise' },
  reponse: { nom: 'Réponses', classe: 'p-accent' },
}

async function charger(debut, fin) {
  const de = debut.toISOString()
  const a = fin.toISOString()
  const [actions, envoyes, valides, reponses] = await Promise.all([
    q(supabase.from('boutiques').select('id,nom,ville,prochaine_action,prochaine_action_le')
      .gte('prochaine_action_le', jourISO(debut)).lt('prochaine_action_le', jourISO(fin))),
    q(supabase.from('brouillons').select('id,type,envoye_le,boutiques(id,nom,ville)').eq('statut', 'envoye').gte('envoye_le', de).lt('envoye_le', a)),
    q(supabase.from('brouillons').select('id,type,valide_le,boutiques(id,nom,ville)').in('statut', ['valide', 'en_envoi'])),
    q(supabase.from('echanges').select('id,resume,statut_detecte,le,boutiques(id,nom,ville)').eq('sens', 'entrant').gte('le', de).lt('le', a)),
  ])
  const ev = [
    ...actions.map((b) => ({ genre: 'action', jour: b.prochaine_action_le, nom: b.nom, texte: b.prochaine_action, lien: `#/boutique/${b.id}` })),
    ...envoyes.map((d) => ({ genre: 'envoi', jour: jourISO(new Date(d.envoye_le)), h: heure(d.envoye_le), nom: d.boutiques?.nom, texte: `${TYPES_BROUILLON[d.type]} envoyé`, lien: `#/boutique/${d.boutiques?.id}` })),
    // Les e-mails validés partent aujourd'hui ou au prochain créneau : on les montre aujourd'hui.
    ...valides.map((d) => ({ genre: 'envoi', jour: jourISO(), nom: d.boutiques?.nom, texte: `${TYPES_BROUILLON[d.type]} en file d’envoi`, lien: '#/envois' })),
    ...reponses.map((r) => ({ genre: 'reponse', jour: jourISO(new Date(r.le)), h: heure(r.le), nom: r.boutiques?.nom || 'Expéditeur inconnu', texte: r.resume || (r.statut_detecte ? DETECTES[r.statut_detecte] : 'Réponse reçue'), lien: r.boutiques?.id ? `#/boutique/${r.boutiques.id}` : '#/reponses' })),
  ]
  const retard = await q(supabase.from('boutiques').select('id,nom,ville,prochaine_action,prochaine_action_le')
    .lt('prochaine_action_le', jourISO()).not('statut', 'in', '(bloque,client,refus)').order('prochaine_action_le').limit(50))
  return { ev, retard }
}

export default function Calendrier() {
  const [mois, setMois] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [choisi, setChoisi] = useState(jourISO())
  const [genres, setGenres] = useState(new Set(Object.keys(GENRES)))

  // Grille du lundi précédant le 1er au dimanche suivant la fin du mois.
  const cases = useMemo(() => {
    const debut = new Date(mois)
    debut.setDate(1 - ((debut.getDay() + 6) % 7))
    const fin = new Date(mois.getFullYear(), mois.getMonth() + 1, 0)
    fin.setDate(fin.getDate() + (6 - ((fin.getDay() + 6) % 7)) + 1) // lendemain du dimanche de la dernière semaine
    const l = []
    for (const d = new Date(debut); d < fin; d.setDate(d.getDate() + 1)) l.push(new Date(d))
    return l
  }, [mois])
  const { data, error } = useCharge(() => { const fin = new Date(cases[cases.length - 1]); fin.setDate(fin.getDate() + 1); return charger(cases[0], fin) }, [mois], { toutes: 60000 })

  const ev = (data?.ev || []).filter((e) => genres.has(e.genre))
  const parJour = useMemo(() => {
    const m = {}
    for (const e of ev) (m[e.jour] ||= []).push(e)
    return m
  }, [ev])
  const auj = jourISO()
  const duJour = (parJour[choisi] || []).sort((a, b) => (a.h || '').localeCompare(b.h || ''))
  const changerMois = (n) => setMois(new Date(mois.getFullYear(), mois.getMonth() + n, 1))
  const basculer = (g) => { const s = new Set(genres); s.has(g) ? s.delete(g) : s.add(g); setGenres(s) }
  const total = (g) => (data?.ev || []).filter((e) => e.genre === g && e.jour.slice(0, 7) === jourISO(mois).slice(0, 7)).length

  return (
    <div className="page">
      <Entete actif="calendrier" />
      <section className="titre-bloc">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="lbl" style={{ fontSize: 14 }}>{MOIS[mois.getMonth()]} {mois.getFullYear()}</span>
          <Titre texte="CALENDRIER" lettre="A" />
        </div>
        <div className="chiffres">
          <div className="chiffre"><b>{total('action')}</b><span>à faire</span></div>
          <div className="chiffre"><b>{total('envoi')}</b><span>e-mails</span></div>
          <div className="chiffre"><b>{total('reponse')}</b><span>réponses</span></div>
        </div>
      </section>
      <Erreur e={error} />

      <div className="rangee" style={{ justifyContent: 'space-between' }}>
        <div className="rangee">
          <button className="icone" onClick={() => changerMois(-1)} aria-label="Mois précédent"><Retour /></button>
          <button className="pilule" onClick={() => { const d = new Date(); setMois(new Date(d.getFullYear(), d.getMonth(), 1)); setChoisi(jourISO()) }}>Aujourd’hui</button>
          <button className="icone" onClick={() => changerMois(1)} aria-label="Mois suivant" style={{ transform: 'scaleX(-1)' }}><Retour /></button>
        </div>
        <div className="rangee" role="group" aria-label="Afficher">
          {Object.entries(GENRES).map(([g, v]) => (
            <button key={g} className="pilule" aria-pressed={genres.has(g)} onClick={() => basculer(g)}>
              <span className={`point ${v.classe}`} style={{ width: 10, height: 10 }} aria-hidden="true" />{v.nom}
            </button>
          ))}
        </div>
      </div>

      <div className="colonnes" style={{ gap: 28 }}>
        <section className="principal" style={{ gap: 0 }} aria-label="Mois">
          <div className="calendrier">
            {JOURS.map((j) => <div key={j} className="cal-tete">{j}</div>)}
            {cases.map((d) => {
              const iso = jourISO(d)
              const liste = parJour[iso] || []
              const horsMois = d.getMonth() !== mois.getMonth()
              return (
                <button key={iso} className={`cal-jour${horsMois ? ' hors' : ''}${iso === auj ? ' auj' : ''}${iso === choisi ? ' choisi' : ''}`}
                  onClick={() => setChoisi(iso)} aria-label={`${d.getDate()} ${MOIS[d.getMonth()]}, ${liste.length} événement${liste.length > 1 ? 's' : ''}`}>
                  <span className="num">{d.getDate()}</span>
                  <span className="cal-ev">
                    {liste.slice(0, 3).map((e, i) => <span key={i} className={`cal-pil ${GENRES[e.genre].classe}`}>{e.nom}</span>)}
                    {liste.length > 3 && <span className="lbl">+{liste.length - 3}</span>}
                  </span>
                  {!!liste.length && <span className="cal-points" aria-hidden="true">{[...new Set(liste.map((e) => e.genre))].map((g) => <span key={g} className={`point ${GENRES[g].classe}`} />)}</span>}
                </button>
              )
            })}
          </div>
        </section>

        <aside className="panneau cote" aria-label="Détail du jour">
          <h2>{new Date(`${choisi}T12:00:00`).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          {!duJour.length && <div className="bloc"><span className="petit">Rien ce jour-là.</span></div>}
          {duJour.map((e, i) => (
            <a key={i} className="bloc" href={e.lien} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="rangee" style={{ justifyContent: 'space-between' }}>
                <strong>{e.nom}</strong>
                <span className={`statut ${GENRES[e.genre].classe}`} style={{ height: 26, fontSize: 12 }}>{GENRES[e.genre].nom}{e.h ? ` · ${e.h}` : ''}</span>
              </span>
              <span style={{ fontSize: 14, color: '#3D3D38', lineHeight: 1.45 }}>{e.texte}</span>
            </a>
          ))}
          {!!data?.retard.length && (
            <>
              <h2 style={{ fontSize: 20, marginTop: 8 }}>En retard</h2>
              {data.retard.map((b) => (
                <a key={b.id} className="bloc" href={`#/boutique/${b.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="rangee" style={{ justifyContent: 'space-between' }}><strong>{b.nom}</strong><span className="petit">prévu le {new Date(`${b.prochaine_action_le}T12:00:00`).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' })}</span></span>
                  <span style={{ fontSize: 14, color: '#3D3D38' }}>{b.prochaine_action}</span>
                </a>
              ))}
            </>
          )}
          <a className="btn noir" href="#/prospects"><Fleche />Voir les prospects</a>
        </aside>
      </div>
    </div>
  )
}
