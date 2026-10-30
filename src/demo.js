// Faux client Supabase, chargé uniquement par `npm run dev` avec ?demo dans l'adresse.
// Il sert à vérifier l'affichage sans compte ni base ; il n'est jamais inclus dans le site publié.
// Les boutiques sont celles de la maquette : des exemples.

function donnees() {
  const h = (heures) => new Date(Date.now() - heures * 3600e3).toISOString()
  const auj = () => new Date().toISOString().slice(0, 10)

  const B = [
    { id: 'b1', nom: 'Vapote & Cie', ville: 'Lyon 3e', pays: 'FR', type: 'vape_shop', nb_boutiques: 2, email: 'contact@vapote.fr', marques: ['Liquideo', 'Alfaliquid'], statut: 'a_contacter', score: 82, angle: 'la marge du 60 ml', source: 'Annuaire', enrichi_le: h(3), notes: 'Source email : https://vapote.fr/contact\nSource marques : https://www.instagram.com/vapote', site_web: 'https://vapote.fr', instagram: '@vapote', telephone: '04 78 00 00 00', contact_nom: 'Julie, gérante', adresse: '8 rue Paul Bert', code_postal: '69003' },
    { id: 'b2', nom: 'Le Nuage Bleu', ville: 'Bordeaux', pays: 'FR', type: 'vape_shop', nb_boutiques: 1, email: 'bonjour@nuagebleu.fr', marques: ['Fuu'], statut: 'a_contacter', score: 71, angle: 'pas de saveur dormante', source: 'Instagram', prochaine_action: 'Rappeler la gérante', prochaine_action_le: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) },
    { id: 'b3', nom: 'Smoke Free 59', ville: 'Lille', pays: 'FR', type: 'chaine', nb_boutiques: 5, email: 'contact@smokefree59.fr', marques: [], statut: 'relance', score: 68, angle: 'version Découverte 1 m²', source: 'Annuaire' },
    { id: 'b4', nom: 'Vap’Hôtel Rennes', ville: 'Rennes', pays: 'FR', type: 'vape_shop', nb_boutiques: 1, email: 'contact@vaphotel', marques: ['Le French Liquide', 'Fuu'], statut: 'interesse', score: 77, angle: 'mix bar en boutique', source: 'Site', enrichi_le: h(50), dernier_contact_le: h(120), prochaine_action: 'Envoyer le récap prix et proposer 5 échantillons', prochaine_action_le: auj(), infos: { siren: '943007922', siret: '94300792200017', tva: 'FR57943007922', forme_juridique: 'SAS', date_creation: '2025-04-03', naf: '46.69A', etat: 'active', dirigeants: [{ nom: 'Lucas Martin', qualite: 'Président de SAS' }], fiche_officielle: 'https://annuaire-entreprises.data.gouv.fr/entreprise/943007922', facebook: 'https://www.facebook.com/vaphotel', google_note: 4.7, google_avis: 128, google_maps: 'https://maps.google.com/?cid=1', horaires: 'Mar–sam 10h–19h', a_verifier: [{ champ: 'telephone', actuel: '02 99 00 00 00', propose: '02 99 11 22 33', source: 'https://maps.google.com/?cid=1' }], sources: [{ champ: 'facebook', url: 'https://www.facebook.com/vaphotel' }, { champ: 'google_note', url: 'https://maps.google.com/?cid=1' }] }, adresse: '12 rue de la Soif, 35000 Rennes, France', code_postal: '35000' },
    { id: 'b5', nom: 'La Fumée Douce', ville: 'Porto', pays: 'PT', type: 'vape_shop', nb_boutiques: 1, email: 'ola@fumeedouce.pt', marques: [], statut: 'a_rappeler', score: 49, source: 'Google Maps' },
    { id: 'b6', nom: 'Vape Story Lille', ville: 'Lille', pays: 'FR', type: 'vape_shop', nb_boutiques: 1, email: 'info@vapestory.fr', marques: [], statut: 'bloque', score: null, bloque_raison: 'client : client Odoo (Vape Story)', source: 'Ancien CRM' },
  ]
  const corps = (angle) => `Bonjour,\n\nJe suis Nathan, de Le Mixologue.\n\n${angle}\n\nAuriez-vous 10 minutes cette semaine pour en parler ?\n\nNathan Gillet\nLe Mixologue\n\nRépondez STOP pour ne plus recevoir nos messages.`
  const D = {
    boutiques: B,
    brouillons: [
      { id: 'd1', boutique_id: 'b1', type: 'premier', statut: 'a_valider', objet: 'Le 60 ml qui laisse de la marge', corps: corps('Vous vendez Liquideo et Alfaliquid : notre 60 ml laisse plus de marge.'), cree_le: h(2), maj_le: h(2) },
      { id: 'd2', boutique_id: 'b2', type: 'premier', statut: 'a_valider', objet: 'Plus de saveur qui dort en rayon', corps: corps('88 saveurs qui se mélangent : rien ne reste en stock.'), cree_le: h(2), maj_le: h(2) },
      { id: 'd3', boutique_id: 'b3', type: 'relance_1', statut: 'a_valider', objet: 'Re: Un bar à saveurs pour vos 5 boutiques', corps: corps('Je me permets de revenir vers vous.'), cree_le: h(1), maj_le: h(1) },
      { id: 'd4', boutique_id: 'b4', type: 'reponse', statut: 'a_valider', pieces_jointes: ['offre'], objet: 'Re: Le mix en boutique', corps: corps('Voici le récap prix. Je vous propose 5 échantillons fruités.'), cree_le: h(1), maj_le: h(1) },
      { id: 'd5', boutique_id: 'b6', type: 'premier', statut: 'erreur', erreur: 'boutique bloquée : cliente depuis 2021', objet: 'x', corps: 'x', cree_le: h(30), maj_le: h(20) },
    ],
    echanges: [
      { id: 'e1', boutique_id: 'b4', canal: 'email', sens: 'entrant', objet: 'Re: Le mix en boutique', resume: 'Intéressé, demande le récap prix et des échantillons de 5 saveurs fruitées.', statut_detecte: 'interesse', le: h(5), de_email: 'contact@vaphotel-rennes.fr' },
      { id: 'e2', boutique_id: 'b4', canal: 'email', sens: 'sortant', objet: 'Le mix en boutique', corps: corps('Un bar à saveurs.'), le: h(120) },
      { id: 'e3', boutique_id: 'b5', canal: 'email', sens: 'entrant', objet: 'Re: Bonjour', resume: 'Rappeler après le 15 novembre, inventaire en cours.', statut_detecte: 'a_rappeler', le: h(8) },
      { id: 'e4', boutique_id: null, canal: 'email', sens: 'entrant', objet: 'Question livraison', resume: null, statut_detecte: null, le: h(0.2), de_email: 'inconnu@exemple.fr' },
    ],
    briefs: [{ jour: auj(), cree_le: h(4), contenu: { genere_le: h(4), depuis: h(28), mode_test: true, fiches_completees: [B[0], B[1]], boutiques_bloquees: [B[5]], brouillons_a_valider: [{ boutiques: B[0] }, { boutiques: B[1] }], relances_pretes: [{ boutiques: B[2] }], reponses_recues: [{ boutiques: B[3] }, { boutiques: B[4] }], clients_existants: [], sans_reponse_apres_relances: [], erreurs: { demandes: [], envois: [] } } }],
    services_etat: [
      { service: 'veilleur', vu_le: h(0.01), info: { mode_test: true } },
      { service: 'facteur', vu_le: h(0.01), info: { mode_test: true, envois_aujourdhui: 3, en_attente_parce_que: null } },
    ],
    reglages: [
      { cle: 'envoi_pause', valeur: false }, { cle: 'documents', valeur: [
      { id: 'offre', nom: 'Offre Le Mixologue (packs et prix)', fichier: 'Offre_Mixologue.pdf', usage: 'Prix et packs', premier_contact: false },
      { id: 'cout_revient', nom: 'Calculateur de coût de revient', fichier: 'Cout_de_revient_Mixologue.xlsx', usage: 'Marge', premier_contact: false },
      { id: 'catalogue', nom: 'Catalogue (zip)', fichier: 'Catalogue_Mixologue_EN.pdf.zip', usage: 'Saveurs', premier_contact: true }] }, { cle: 'envoi_intervalle_secondes', valeur: 120 },
      { cle: 'envoi_max_par_jour', valeur: 40 }, { cle: 'envoi_heures', valeur: { debut: 9, fin: 18, jours: [1, 2, 3, 4, 5] } },
    ],
    file_claude: [
    { id: 'f1', type: 'enrichir', boutique_id: 'b4', statut: 'en_cours', cree_le: h(0.05) },
    { id: 'c1', type: 'chat', conversation_id: 'v1', statut: 'fait', consigne: 'Combien de boutiques à contacter ?', resultat: { reponse: 'Tu as 2 boutiques à contacter. Vapote & Cie a le meilleur score (82) : commence par elle.', fiches: ['b1', 'b2'], actions: [] }, cree_le: h(2) },
    { id: 'c3', type: 'chat', conversation_id: 'v1', statut: 'fait', consigne: 'Passe Smoke Free 59 en intéressé et bloque Vape Story Lille.', resultat: { reponse: 'C’est fait.', fiches: ['b3'], actions: [{ ok: true, texte: 'Smoke Free 59 : statut « interesse »' }, { ok: false, texte: 'Vape Story Lille est déjà bloquée' }] }, cree_le: h(1) },
    { id: 'c4', type: 'chat', conversation_id: 'v1', statut: 'fait', consigne: 'Où ai-je peu de clients ?', cree_le: h(0.5), resultat: { reponse: 'Ton réseau est dense dans le Nord et en Belgique. Les trous : la Bretagne et le Sud-Ouest.', fiches: [], actions: [], visuels: [
      { type: 'chiffres', titre: '', elements: [{ libelle: 'clients', valeur: 1334 }, { libelle: 'régions sous 20 clients', valeur: 3 }, { libelle: 'sans ville', valeur: 580, note: 'pas de ville dans Odoo' }] },
      { type: 'barres', titre: 'Clients par région', elements: [{ libelle: 'Hauts-de-France', valeur: 306 }, { libelle: 'Wallonie', valeur: 184 }, { libelle: 'Grand Est', valeur: 91 }, { libelle: 'Occitanie', valeur: 37 }, { libelle: 'Pays de la Loire', valeur: 20 }, { libelle: 'Centre-Val de Loire', valeur: 19 }] },
      { type: 'carte', titre: 'Zones à prospecter', elements: [{ libelle: 'Rennes', valeur: 2, lat: 48.11, lng: -1.68, note: '2 clients' }, { libelle: 'Bordeaux', valeur: 4, lat: 44.84, lng: -0.58 }, { libelle: 'Toulouse', valeur: 6, lat: 43.6, lng: 1.44 }, { libelle: 'Lille', valeur: 120, lat: 50.63, lng: 3.06 }] } ] } },
    { id: 'c2', type: 'chat', conversation_id: 'v1', statut: 'en_cours', consigne: 'Est-ce que Vape Story Lille est cliente ?', cree_le: h(0.01) },
    { id: 'r1', type: 'recherche', statut: 'fait', consigne: '{"zone":"Lille et métropole","type":"vape_shop","nombre":10,"criteres":"indépendants"}', cree_le: h(3), resultat: { remarque: 'Zone bien fournie, sources : Pages Jaunes et Google Maps.', ecartes: [{ nom: 'Vape Story', raison: 'client' }], candidats: [
      { nom: 'Le Nuage du Nord', ville: 'Roubaix', pays: 'FR', type: 'vape_shop', email: 'contact@nuagedunord.fr', site_web: 'https://nuagedunord.fr', telephone: '03 20 00 00 00', source_url: 'https://www.pagesjaunes.fr', pourquoi: 'Indépendant avec un grand rayon DIY.', marques: ['Fuu'] },
      { nom: 'Vap’Lille Centre', ville: 'Lille', pays: 'FR', type: 'vape_shop', instagram: '@vaplille', source_url: 'https://instagram.com', pourquoi: 'Instagram actif, met en avant les longfills.' } ] } },
    { id: 'r2', type: 'recherche', statut: 'en_cours', consigne: '{"zone":"Bruxelles","type":"vape_shop","nombre":5}', cree_le: h(0.02) },
  ],
  geocodage: [
    { cle: 'lyon 3e', lat: 45.75, lng: 4.85 }, { cle: 'lyon', lat: 45.76, lng: 4.84 }, { cle: 'bordeaux', lat: 44.84, lng: -0.58 },
    { cle: 'lille', lat: 50.63, lng: 3.06 }, { cle: 'rennes', lat: 48.11, lng: -1.68 }, { cle: 'porto', lat: 41.15, lng: -8.61 },
    { cle: 'lamballe armor', lat: 48.47, lng: -2.52 }, { cle: 'craponne', lat: 45.75, lng: 4.72 } ],
  conversations: [{ id: 'v1', titre: 'Combien de boutiques à contacter ?', maj_le: h(0.01) }, { id: 'v2', titre: 'Relances de la semaine', maj_le: h(26) }],
  blocages: [
    { id: 'k1', type: 'client', email: 'info@vapestory.fr', nom: 'Vape Story', ville: 'Lille', raison: 'client Odoo (Vape Story)' },
    { id: 'k2', type: 'client', email: 'contact@kervape.fr', nom: 'Ker Vape', ville: 'Lamballe-Armor', raison: 'client Odoo (Ker Vape)' },
    { id: 'k3', type: 'client', email: null, nom: 'Au Bon Vapoteur', ville: 'Craponne', raison: 'client Odoo (Au Bon Vapoteur, sans e-mail)' },
  ],
  }

  return { B, D }
}

// Jointure « boutiques(...) » : on rattache la boutique entière.
const joindre = (B, t, l) => (['brouillons', 'echanges'].includes(t) ? { ...l, boutiques: B.find((b) => b.id === l.boutique_id) || null } : l)

function requete({ B, D }, table) {
  const filtres = []
  let mode = 'liste'
  let head = false
  let tri = null
  let changement = null
  let limite = null
  const r = {
    select(_c, o) { head = !!o?.head; return r },
    eq(k, v) { filtres.push((l) => l[k] === v); return r },
    neq(k, v) { filtres.push((l) => l[k] !== v); return r },
    in(k, v) { filtres.push((l) => v.includes(l[k])); return r },
    gt(k, v) { filtres.push((l) => l[k] > v); return r },
    ilike(k, v) { const re = new RegExp('^' + String(v).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i'); filtres.push((l) => re.test(l[k] || '')); return r },
    delete() { changement = { delete: true }; return r },
    gte(k, v) { filtres.push((l) => l[k] != null && l[k] >= v); return r },
    lt(k, v) { filtres.push((l) => l[k] != null && l[k] < v); return r },
    not(k, _op, v) { const l2 = v.replace(/[()]/g, '').split(','); filtres.push((l) => !l2.includes(l[k])); return r },
    or() { filtres.push((l) => l.statut === 'client' || (l.statut === 'bloque' && /^client/.test(l.bloque_raison || ''))); return r },
    order(k, o) { tri = tri || [k, o?.ascending !== false]; return r },
    limit(n) { limite = n; return r },
    range(a, b) { limite = b - a + 1; return r },
    maybeSingle() { mode = 'un'; return r },
    single() { mode = 'un'; return r },
    insert(v) { changement = { insert: { id: `n${Date.now()}`, statut: 'en_attente', cree_le: new Date().toISOString(), ...v } }; return r },
    update(v) { changement = { update: v }; return r },
    then(ok, ko) {
      const lignes = D[table] || []
      if (changement?.insert) { lignes.push(changement.insert); return Promise.resolve({ data: changement.insert, error: null }).then(ok, ko) }
      let res = lignes.filter((l) => filtres.every((f) => f(l)))
      if (changement?.update) res.forEach((l) => Object.assign(l, changement.update))
      if (changement?.delete) res.forEach((l) => lignes.splice(lignes.indexOf(l), 1))
      res = res.map((l) => joindre(B, table, l))
      if (tri) res = [...res].sort((a, b) => ((a[tri[0]] ?? '') > (b[tri[0]] ?? '') ? 1 : -1) * (tri[1] ? 1 : -1))
      if (limite) res = res.slice(0, limite)
      const sortie = head ? { data: null, count: res.length, error: null } : { data: mode === 'un' ? res[0] ?? null : res, error: null }
      return Promise.resolve(sortie).then(ok, ko)
    },
  }
  return r
}

export function clientDemo() {
  const base = donnees()
  const session = { user: { email: 'demo@exemple.fr' } }
  return {
    from: (table) => requete(base, table),
    rpc: async (nom, args) => ({ data: nom === 'est_webmail' ? ['gmail.com', 'orange.fr'].includes(args.d) : null, error: null }),
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
      signInWithPassword: async () => ({ error: null }),
    },
  }
}
