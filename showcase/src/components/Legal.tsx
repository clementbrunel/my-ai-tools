import { publisher } from '../legal'
import { profile, type Lang } from '../apps'

const txt = {
  fr: {
    back: '← Retour à l’accueil', h1: 'Mentions légales & confidentialité',
    ed: 'Éditeur', host: 'Hébergement', hostT: 'Ce site est hébergé par GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis — ', status: 'Statut', contact: 'Contact',
    projects: 'Projets présentés',
    projectsT: 'Prono-core et ai-env-manager sont des projets personnels, menés bénévolement et sans but lucratif. BienvenueBébé est édité par une société dont je ne suis pas actionnaire : j’y contribue bénévolement en tant que développeur. Ses propres mentions légales et sa politique de confidentialité sont disponibles sur ',
    ip: 'Propriété intellectuelle',
    ipT: 'Les contenus de ce site (textes, mise en page) sont protégés. Les marques, logos et contenus des applications présentées appartiennent à leurs éditeurs respectifs.',
    data: 'Données personnelles',
    dataT: 'Ce site est une simple vitrine : il ne comporte ni compte, ni formulaire, ni traceur, ni cookie publicitaire. Seul le choix de langue est mémorisé dans votre navigateur (stockage local), sans être transmis. Chaque application présentée (prono-core, BienvenueBébé…) traite ses propres données selon sa propre politique de confidentialité, accessible depuis l’application.',
    law: 'Loi applicable', lawT: 'Droit français. Réclamation possible auprès de la CNIL : ',
  },
  en: {
    back: '← Back to home', h1: 'Legal notice & privacy',
    ed: 'Publisher', host: 'Hosting', hostT: 'This site is hosted by GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA — ', status: 'Status', contact: 'Contact',
    projects: 'Featured projects',
    projectsT: 'Prono-core and ai-env-manager are personal projects, carried out on a volunteer basis and not for profit. BienvenueBébé is published by a company in which I am not a shareholder: I contribute to it as a volunteer developer. Its own legal notice and privacy policy are available on ',
    ip: 'Intellectual property',
    ipT: 'The content of this site (text, layout) is protected. Trademarks, logos and content of the presented applications belong to their respective owners.',
    data: 'Personal data',
    dataT: 'This site is a simple showcase: no account, no form, no tracker, no advertising cookie. Only your language choice is remembered in your browser (local storage) and never sent anywhere. Each presented application (prono-core, BienvenueBébé…) handles its own data under its own privacy policy, available in the app.',
    law: 'Applicable law', lawT: 'French law. Complaints can be made to the CNIL: ',
  },
}

export default function Legal({ lang }: { lang: Lang }) {
  const t = txt[lang]
  return (
    <div className="legal">
      <a href="#/" className="back">{t.back}</a>
      <h1>{t.h1}</h1>
      <section><h2>{t.ed}</h2>
        <p><b>{publisher.name}</b></p>
        <p>{t.status} : {publisher.status[lang]}</p>
        <p>{t.contact} : <a href={profile.linkedin}>LinkedIn</a> · <a href={profile.github}>GitHub</a></p>
      </section>
      <section><h2>{t.host}</h2><p>{t.hostT}<a href="https://pages.github.com/" target="_blank" rel="noopener noreferrer">pages.github.com</a></p></section>
      <section><h2>{t.projects}</h2><p>{t.projectsT}<a href="https://bienvenuebebe.com" target="_blank" rel="noopener noreferrer">bienvenuebebe.com</a>.</p></section>
      <section><h2>{t.ip}</h2><p>{t.ipT}</p></section>
      <section><h2>{t.data}</h2><p>{t.dataT}</p></section>
      <section><h2>{t.law}</h2><p>{t.lawT}<a href="https://www.cnil.fr/">cnil.fr</a></p></section>
    </div>
  )
}
