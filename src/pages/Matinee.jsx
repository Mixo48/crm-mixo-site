import { useState } from 'react'
import { DETECTES, TYPES_BROUILLON, aujourdhui, demander, heure, jourISO, metaBoutique, q, supabase, useCharge } from '../lib.js'
import { Entete, Erreur, Fleche, Score, Soleil, Statut, Titre } from '../ui.jsx'

const FILTRES = {
  Tous: () => true,
  Chaud: (d) => (d.boutiques?.score ?? -1) >= 80,
  'Intérêt fort': (d) => { const s = d.boutiques?.score ?? -1; return s >= 60 && s < 80 },
  'Intérêt moyen': (d) => { const s = d.boutiques?.score ?? -1; return s >= 40 && s < 60 },
  Relances: (d) => d.type.startsWith('relance'),
}

const BOUTIQUE = 'boutiques(id,nom,ville,pays,type,nb_boutiques,angle,source,score,marques,statut)'

async function charger() {
  const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const [brief, brouillons, bloquees] = await Promise.all([
    q(supabase.from('briefs').select('jour,contenu,cree_le').eq('jour', jourISO()).maybeSingle()),
    q(supabase.from('brouillons').select(`id,type,objet,cree_le,${BOUTIQUE}`).eq('statut', 'a_valider').order('cree_le')),
    q(supabase.from('boutiques').select('id', { count: 'exact', head: true }).eq('statut', 'bloque').gt('maj_le', hier)),
  ])
  const depuis = brief?.contenu?.depuis || hier
  const reponses = await q(supabase.from('echanges')
    .select('id,resume,statut_detecte,de_email,le,boutiques(id,nom,ville)')
    .eq('sens', 'entrant').gt('le', depuis).order('le', { ascending: false }).limit(20))
  return { brief, brouillons, reponses, bloquees }
}

const resumeCarte = (d) => {
  const b = d.boutiques || {}
  if (d.type !== 'premier') return `${TYPES_BROUILLON[d.type]} · ${d.objet}`
  const marques = b.marques?.length ? `Vend déjà ${b.marques.slice(0, 3).join(', ')}. ` : ''
  return `${marques}${b.angle ? `Angle : ${b.angle}.` : d.objet}`
}

function CarteBrouillon({ d, vedette }) {
  const b = d.boutiques || {}
  return (
    <article className={`carte${vedette ? ' vedette' : ''}`}>
      <a className="icone encoche" href={`#/boutique/${b.id}`} aria-label={`Ouvrir la fiche ${b.nom}`}><Fleche /></a>
      <div className="tete">
        <h3>{b.nom}</h3>
        <span className="meta">{metaBoutique(b)}</span>
      </div>
      <p>{resumeCarte(d)}</p>
      <div className="pied">
        <div><span className="lbl">Source</span><span className="puce">{b.source || 'Manuel'}</span></div>
        <div><Score score={b.score} /></div>
      </div>
      <a className={`btn ${vedette ? 'noir' : 'gris'}`} href={`#/envois/${d.id}`}>Relire et envoyer</a>
    </article>
  )
}

// Le brief de 7 h 30 est un instantané calculé par le veilleur, sans IA.
function lignesBrief(c) {
  if (!c) return []
  const noms = (l) => l.slice(0, 4).map((x) => x.nom || x.boutiques?.nom).filter(Boolean).join(', ') + (l.length > 4 ? '…' : '')
  const n = (l) => l?.length || 0
  const erreurs = n(c.erreurs?.demandes) + n(c.erreurs?.envois)
  return [
    n(c.fiches_completees) && { titre: `${n(c.fiches_completees)} fiche${n(c.fiches_completees) > 1 ? 's' : ''} complétée${n(c.fiches_completees) > 1 ? 's' : ''}`, texte: noms(c.fiches_completees) },
    n(c.boutiques_bloquees) && { titre: `${n(c.boutiques_bloquees)} boutique${n(c.boutiques_bloquees) > 1 ? 's' : ''} bloquée${n(c.boutiques_bloquees) > 1 ? 's' : ''}`, texte: 'Déjà clientes ou désinscrites : aucun e-mail ne partira vers elles.' },
    n(c.brouillons_a_valider) && { titre: `${n(c.brouillons_a_valider)} brouillon${n(c.brouillons_a_valider) > 1 ? 's' : ''} à relire`, texte: noms(c.brouillons_a_valider), accent: true },
    n(c.reponses_recues) && { titre: `${n(c.reponses_recues)} réponse${n(c.reponses_recues) > 1 ? 's' : ''} résumée${n(c.reponses_recues) > 1 ? 's' : ''}`, texte: noms(c.reponses_recues) },
    n(c.relances_pretes) && { titre: `${n(c.relances_pretes)} relance${n(c.relances_pretes) > 1 ? 's' : ''} prête${n(c.relances_pretes) > 1 ? 's' : ''}`, texte: noms(c.relances_pretes) },
    n(c.sans_reponse_apres_relances) && { titre: `${n(c.sans_reponse_apres_relances)} sans réponse après 2 relances`, texte: `${noms(c.sans_reponse_apres_relances)}. À appeler ou à laisser.` },
    erreurs && { titre: `${erreurs} erreur${erreurs > 1 ? 's' : ''}`, texte: [...(c.erreurs.demandes || []), ...(c.erreurs.envois || [])].slice(0, 3).map((e) => `${e.boutiques?.nom || '?'} : ${e.erreur}`).join(' · ') },
  ].filter(Boolean)
}

function Brief({ brief, nb }) {
  const [demande, setDemande] = useState(null)
  const [erreur, setErreur] = useState(null)
  const lignes = lignesBrief(brief?.contenu)
  const h = heure(brief?.contenu?.genere_le || brief?.cree_le)
  const preparer = async () => {
    setErreur(null)
    try { setDemande(await demander('brief', {})) } catch (e) { setErreur(e) }
  }
  return (
    <aside id="brief" aria-label="Brief de Claude" className="panneau cote">
      <div className="rangee" style={{ gap: 14 }}>
        <span className="icone" aria-hidden="true" style={{ background: '#141414', color: 'var(--accent)', border: 0 }}><Soleil /></span>
        <h2 style={{ flex: 1 }}>Brief de Claude</h2>
      </div>
      {!brief && (
        <div className="bloc">
          <strong>Pas encore de brief aujourd’hui</strong>
          <span className="petit">Il se prépare tout seul à 7 h 30 les jours ouvrés.</span>
          {demande ? <span className="travail">Demandé, il arrive dans une minute</span>
            : <button className="btn noir" style={{ alignSelf: 'flex-start' }} onClick={preparer}>Le préparer maintenant</button>}
        </div>
      )}
      {brief && !lignes.length && <div className="bloc"><strong>Rien de neuf</strong><span className="petit">Aucune fiche, réponse ni relance depuis le dernier brief.</span></div>}
      {!!lignes.length && (
        <ol className="brief-liste">
          {lignes.map((l) => (
            <li key={l.titre}>
              <span className="h">{h}</span>
              <div className={`b${l.accent ? ' accent' : ''}`}><strong>{l.titre}</strong>{l.texte && <span>{l.texte}</span>}</div>
            </li>
          ))}
        </ol>
      )}
      {brief?.contenu?.mode_test && <span className="petit">Mode test : les e-mails partent vers ta propre adresse.</span>}
      <Erreur e={erreur} />
      {nb > 0 && <a href="#/envois" className="btn noir">Valider les {nb} brouillon{nb > 1 ? 's' : ''}</a>}
    </aside>
  )
}

export default function Matinee() {
  const [filtre, setFiltre] = useState('Tous')
  const { data, error } = useCharge(charger, [], { toutes: 60000 })

  const brouillons = data?.brouillons || []
  const premiers = brouillons.filter((d) => !d.type.startsWith('relance'))
  const relances = brouillons.length - premiers.length
  const reponses = data?.reponses || []
  const visibles = brouillons.filter(FILTRES[filtre])
    .sort((a, b) => (b.boutiques?.score ?? -1) - (a.boutiques?.score ?? -1))
  const h = heure(data?.brief?.contenu?.genere_le)

  return (
    <div className="page">
      <Entete actif="matinee">
        {data?.brief && (
          <div className="barre-brief">
            <strong>Brief de Claude</strong>
            <div className="pil">Prêt à {h} · {brouillons.length} brouillon{brouillons.length > 1 ? 's' : ''} · {reponses.length} réponse{reponses.length > 1 ? 's' : ''} · {relances} relance{relances > 1 ? 's' : ''}</div>
            <a className="icone" href="#brief" aria-label="Ouvrir le brief" onClick={(e) => { e.preventDefault(); document.getElementById('brief')?.scrollIntoView({ behavior: 'smooth' }) }}><Fleche /></a>
          </div>
        )}
      </Entete>

      <section className="titre-bloc">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="lbl" style={{ fontSize: 14 }}>{aujourdhui()}</span>
          <Titre texte="TA MATINÉE" lettre="É" />
        </div>
        <div className="chiffres">
          <div className="chiffre"><b>{premiers.length}</b><span>à valider</span></div>
          <div className="chiffre"><b>{reponses.length}</b><span>réponses</span></div>
          <div className="chiffre"><b>{relances}</b><span>relances</span></div>
          <div className="chiffre optionnel"><b>{data?.bloquees ?? 0}</b><span>bloqués, déjà clients</span></div>
        </div>
      </section>

      <Erreur e={error} />

      {brouillons.length > 0 && (
        <div className="resume-mobile seulement-mobile">
          {h && <span className="petit">Préparé par Claude à {h}</span>}
          <h2>{brouillons.length} brouillon{brouillons.length > 1 ? 's' : ''} prêt{brouillons.length > 1 ? 's' : ''} à partir</h2>
          {!!data?.bloquees && <p>{data.bloquees} boutique{data.bloquees > 1 ? 's' : ''} bloquée{data.bloquees > 1 ? 's' : ''} depuis hier : aucun e-mail ne partira vers elles.</p>}
          <a className="btn noir" href="#/envois" style={{ height: 48 }}>Relire et envoyer</a>
        </div>
      )}

      <div className="colonnes">
        <main className="principal">
          <section className="section sans-mobile">
            <div className="section-tete">
              <h2 className="s">À valider</h2>
              <span className="souligne">{brouillons.length} brouillon{brouillons.length > 1 ? 's' : ''}</span>
              <div className="rangee" role="group" aria-label="Filtrer par intérêt">
                {Object.keys(FILTRES).map((f) => (
                  <button key={f} className="pilule" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>{f}</button>
                ))}
              </div>
            </div>
            {data && !visibles.length && (
              <div className="vide">
                {brouillons.length ? 'Aucun brouillon dans ce filtre.' : 'Aucun brouillon à relire. Ajoute des boutiques dans Prospects, puis demande à Claude de leur écrire.'}
              </div>
            )}
            <div className="grille">
              {visibles.map((d, i) => <CarteBrouillon key={d.id} d={d} vedette={i === 0 && filtre === 'Tous'} />)}
            </div>
          </section>

          <section className="section">
            <div className="section-tete">
              <h2 className="s">Réponses</h2>
              <span className="souligne">{reponses.filter((r) => r.resume).length} lues par Claude</span>
            </div>
            {data && !reponses.length && <div className="vide">Pas de nouvelle réponse depuis hier.</div>}
            <div className="lignes">
              {reponses.map((r) => (
                <a key={r.id} className="ligne" href={r.boutiques?.id ? `#/boutique/${r.boutiques.id}` : '#/reponses'}>
                  <span className="nom">{r.boutiques?.nom || r.de_email || 'Expéditeur inconnu'}</span>
                  <span className="texte">{r.resume || 'Claude la lit…'}</span>
                  {r.statut_detecte ? <Statut code={r.statut_detecte} libelle={DETECTES[r.statut_detecte]} /> : <span className="travail lbl">en lecture</span>}
                </a>
              ))}
            </div>
          </section>
        </main>
        <Brief brief={data?.brief} nb={brouillons.length} />
      </div>
    </div>
  )
}
