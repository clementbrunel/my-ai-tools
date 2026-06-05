#!/usr/bin/env python3
"""
Surveillance des disponibilités - Les Bleuets Méribel Mottaret
Période ciblée : 16/07 - 31/07

Sources :
  - meribel-mottaret-lesbleuets.fr  (site officiel)
  - maeva.com                        (API JSON)
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime, date

# ── Configuration ────────────────────────────────────────────────────────────
URL          = "https://meribel-mottaret-lesbleuets.fr/locations"
TARGET_START = date(2026, 7, 16)
TARGET_END   = date(2026, 7, 31)

MAEVA_BASE = "https://www.maeva.com/fr-fr/pages/fiche.php"
MAEVA_PARAMS_COMMON = {
    "filtres": "",
    "action": "updatePrixSeo",
    "residence_cle": "10793",
    "nbPax": "4",
    "theme": "france",
    "cmbTheme": "0",
    "formule": "0",
    "url_filtres": "",
    "ordreSeo": "prixAsc",
}
MAEVA_WEEKS = [
    {"dateDebut": "2026-07-16", "dateFin": "2026-07-22"},
    {"dateDebut": "2026-07-23", "dateFin": "2026-07-29"},
]
MAEVA_URL_TEMPLATE = (
    "https://www.maeva.com/fr-fr/residence-pierre-vacances-les-bleuets_10793.html"
    "?residence_cle=10793&nbPax=4&ordreSeo=prixAsc"
    "&adultePax=2&enfantPax=1&babiePax=1"
    "&date_debut={debut}&date_fin={fin}"
)

# Variables d'environnement (à définir dans GitHub Actions Secrets)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
NOTIFY_EMAIL   = os.getenv("NOTIFY_EMAIL", "hasto88@gmail.com")

CACHE_FILE = "last_results.json"
# ─────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


# ── Bleuets (site officiel) ───────────────────────────────────────────────────

def fetch_page() -> BeautifulSoup:
    resp = requests.get(URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def parse_date_fr(text: str) -> date | None:
    """Parse une date française dd/mm/yyyy ou variantes."""
    text = text.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%d.%m.%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def overlaps(start: date | None, end: date | None) -> bool:
    """Vérifie si [start, end] chevauche [TARGET_START, TARGET_END]."""
    if start is None or end is None:
        return False
    return start <= TARGET_END and end >= TARGET_START


def resolve_link(cell) -> str:
    link_el = cell.find("a", href=True)
    if not link_el:
        return URL
    href = link_el["href"]
    if href.startswith("http"):
        return href
    return "https://meribel-mottaret-lesbleuets.fr" + href


def extract_listings(soup: BeautifulSoup) -> list[dict]:
    """
    Parse le tableau .table__list du site Les Bleuets.
    Colonnes : Voir(0) | Réf(1) | Période(2) | Arrivée(3) | Départ(4) |
               Appartement(5) | Exposition(6) | Etage(7) | Bâtiment(8) | Prix(9)
    """
    listings = []

    table = soup.select_one("table.table__list, table.tablesorter")
    if not table:
        table = soup.find("table")
    if not table:
        return listings

    for row in table.select("tbody tr"):
        cells = row.find_all("td")
        if len(cells) < 10:
            continue

        ref       = cells[1].get_text(strip=True)
        arrival   = cells[3].get_text(strip=True)
        departure = cells[4].get_text(strip=True)
        appt      = cells[5].get_text(strip=True)
        batiment  = cells[8].get_text(strip=True)
        prix_raw  = cells[9].get_text(strip=True)

        start = parse_date_fr(arrival)
        end   = parse_date_fr(departure)
        if not start or not end:
            continue

        listings.append({
            "title": f"Réf. {ref} – {appt} – {batiment}",
            "start": start.isoformat(),
            "end":   end.isoformat(),
            "price": f"{prix_raw} €" if prix_raw else "–",
            "url":   resolve_link(cells[0]),
            "overlaps_target": overlaps(start, end),
        })

    return listings


# ── Maeva (API JSON) ──────────────────────────────────────────────────────────

def _parse_maeva_products(produits) -> list[dict] | None:
    """Normalise la structure produit Maeva en liste de dicts."""
    if isinstance(produits, list):
        return produits
    if isinstance(produits, dict):
        result = []
        for v in produits.values():
            if isinstance(v, list):
                result.extend(v)
            elif isinstance(v, dict):
                result.append(v)
        return result
    return None


def _maeva_product_to_dict(p: dict, date_debut: str, date_fin: str, booking_url: str) -> dict | None:
    """Convertit un produit Maeva brut en dict logement. Retourne None si indisponible."""
    dispo = p.get("libre")
    if dispo is not None and str(dispo) == "0":
        return None
    price = p.get("prix") or "–"
    return {
        "title": p.get("produit_libe") or p.get("nom") or "Logement",
        "start": p.get("debut", date_debut),
        "end":   p.get("fin",   date_fin),
        "price": f"{price} €" if price and price != "–" else "–",
        "dispo": str(dispo) if dispo is not None else "?",
        "url":   booking_url,
    }


def fetch_maeva_week(date_debut: str, date_fin: str) -> list[dict]:
    """Interroge l'API Maeva pour une semaine et retourne les logements dispo."""
    params = {**MAEVA_PARAMS_COMMON, "dateDebut": date_debut, "dateFin": date_fin}
    try:
        resp = requests.get(MAEVA_BASE, params=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  ⚠️  Maeva {date_debut}→{date_fin} : erreur {e}")
        return []

    produits = data.get("content", {}).get("produit", {})
    products = _parse_maeva_products(produits)
    if products is None:
        print(f"  ⚠️  Maeva : structure JSON inattendue pour {date_debut}→{date_fin}")
        return []

    booking_url = MAEVA_URL_TEMPLATE.format(debut=date_debut, fin=date_fin)
    results = []
    for p in products:
        entry = _maeva_product_to_dict(p, date_debut, date_fin, booking_url)
        if entry:
            results.append(entry)
    return results


def fetch_maeva_all() -> list[dict]:
    """Récupère les dispos Maeva pour les 2 semaines, en fusionnant les doublons par titre."""
    seen: dict[str, dict] = {}
    for week in MAEVA_WEEKS:
        listings = fetch_maeva_week(week["dateDebut"], week["dateFin"])
        print(f"  Maeva {week['dateDebut']}→{week['dateFin']} : {len(listings)} logement(s)")
        for l in listings:
            print(f"    🌐 {l['title']} | {l['start']} → {l['end']} | {l['price']} | {l.get('dispo','?')} unité(s)")
            title = l["title"]
            if title not in seen:
                seen[title] = dict(l)
            else:
                # Même logement disponible sur plusieurs semaines : on étend la plage de dates
                existing = seen[title]
                if l.get("start", "") < existing.get("start", ""):
                    existing["start"] = l["start"]
                if l.get("end", "") > existing.get("end", ""):
                    existing["end"] = l["end"]
    return list(seen.values())


# ── Email ─────────────────────────────────────────────────────────────────────

def send_email(subject: str, body_html: str, body_text: str):
    if not RESEND_API_KEY:
        print("⚠️  RESEND_API_KEY non configurée — email non envoyé.")
        return

    resp = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": "Mottaret Watch <onboarding@resend.dev>",
            "to": [NOTIFY_EMAIL],
            "subject": subject,
            "html": body_html,
            "text": body_text,
        },
    )
    if resp.status_code in (200, 201):
        print(f"✅ Email envoyé à {NOTIFY_EMAIL}")
    else:
        print(f"❌ Erreur Resend {resp.status_code}: {resp.text}")


def _listing_rows(listings: list[dict], show_dispo: bool = False) -> str:
    TD = "padding:8px;border:1px solid #ddd;"
    rows = ""
    for item in listings:
        dispo_cell = f"<td style='{TD}'>{item.get('dispo','')}</td>" if show_dispo else ""
        link = f"<a href='{item['url']}'>Voir</a>" if item.get("url") else "–"
        rows += (
            f"<tr>"
            f"<td style='{TD}'>{item['title']}</td>"
            f"<td style='{TD}'>{item.get('start','?')} → {item.get('end','?')}</td>"
            f"<td style='{TD}'>{item['price']}</td>"
            f"{dispo_cell}"
            f"<td style='{TD}'>{link}</td>"
            f"</tr>"
        )
    return rows


def _table_html(rows: str, extra_header: str = "") -> str:
    return f"""
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
        <thead>
          <tr style="background:#2c7be5;color:#fff">
            <th style="padding:8px">Logement</th>
            <th style="padding:8px">Période</th>
            <th style="padding:8px">Prix</th>
            {extra_header}
            <th style="padding:8px">Lien</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>"""


def _changes_section_html(new_bleuets: list[dict], maeva_changes: list[dict]) -> str:
    """Génère la section HTML 'Ce qui a changé' (vide si rien à signaler)."""
    new_maeva    = [c for c in maeva_changes if c["is_new"]]
    price_chg    = [c for c in maeva_changes if not c["is_new"] and c["price_changed"]]
    dispo_chg    = [c for c in maeva_changes if not c["is_new"] and c["dispo_changed"]]

    if not (new_bleuets or new_maeva or price_chg or dispo_chg):
        return ""

    LI = "margin:6px 0"
    items_html = ""

    for l in new_bleuets:
        items_html += (
            f"<li style='{LI}'>🆕 <strong>Nouveau – site officiel :</strong> "
            f"{l['title']} | {l.get('start','?')} → {l.get('end','?')} | {l['price']}</li>"
        )
    for c in new_maeva:
        l = c["listing"]
        items_html += (
            f"<li style='{LI}'>🆕 <strong>Nouveau – Maeva :</strong> "
            f"{l['title']} | {l.get('start','?')} → {l.get('end','?')} "
            f"| {l['price']} | {l.get('dispo','?')} unité(s)</li>"
        )
    for c in price_chg:
        l = c["listing"]
        items_html += (
            f"<li style='{LI}'>💰 <strong>Prix modifié – Maeva :</strong> "
            f"{l['title']} – "
            f"<span style='color:#c00;text-decoration:line-through'>{c['prev_price']}</span> "
            f"→ <span style='color:#090;font-weight:bold'>{l['price']}</span></li>"
        )
    for c in dispo_chg:
        l = c["listing"]
        items_html += (
            f"<li style='{LI}'>📦 <strong>Stock modifié – Maeva :</strong> "
            f"{l['title']} – "
            f"{c['prev_dispo']} unité(s) → <strong>{l.get('dispo','?')} unité(s)</strong></li>"
        )

    return f"""
      <div style="background:#fff8e1;border-left:4px solid #f9a825;padding:12px 16px;margin-bottom:20px;border-radius:4px">
        <h3 style="margin:0 0 8px;color:#c17900">🔔 Ce qui a changé</h3>
        <ul style="margin:0;padding-left:20px">{items_html}</ul>
      </div>"""


def _changes_section_text(new_bleuets: list[dict], maeva_changes: list[dict]) -> list[str]:
    """Génère les lignes texte brut de la section 'Ce qui a changé'."""
    new_maeva = [c for c in maeva_changes if c["is_new"]]
    price_chg = [c for c in maeva_changes if not c["is_new"] and c["price_changed"]]
    dispo_chg = [c for c in maeva_changes if not c["is_new"] and c["dispo_changed"]]

    if not (new_bleuets or new_maeva or price_chg or dispo_chg):
        return []

    lines = ["=== CE QUI A CHANGÉ ==="]
    for l in new_bleuets:
        lines.append(f"[NOUVEAU – site officiel] {l['title']} | {l.get('start','?')} → {l.get('end','?')} | {l['price']}")
    for c in new_maeva:
        l = c["listing"]
        lines.append(f"[NOUVEAU – Maeva] {l['title']} | {l.get('start','?')} → {l.get('end','?')} | {l['price']} | {l.get('dispo','?')} unité(s)")
    for c in price_chg:
        l = c["listing"]
        lines.append(f"[PRIX MODIFIÉ – Maeva] {l['title']} : {c['prev_price']} → {l['price']}")
    for c in dispo_chg:
        l = c["listing"]
        lines.append(f"[STOCK MODIFIÉ – Maeva] {l['title']} : {c['prev_dispo']} unité(s) → {l.get('dispo','?')} unité(s)")
    lines.append("")
    return lines


def build_email(
    bleuets_available: list[dict],
    bleuets_all: list[dict],
    maeva_listings: list[dict],
    new_bleuets: list[dict] | None = None,
    maeva_changes: list[dict] | None = None,
) -> tuple[str, str]:
    """
    Construit l'email HTML + texte brut.

    new_bleuets / maeva_changes : passés uniquement lors de runs non-initiaux
    pour afficher la section 'Ce qui a changé'. Laisser à None sur première exécution.
    """
    now    = datetime.now().strftime("%d/%m/%Y à %H:%M")
    period = f"{TARGET_START:%d/%m/%Y} – {TARGET_END:%d/%m/%Y}"

    # ── Section changements ───────────────────────────────────────────────────
    nb = new_bleuets or []
    mc = maeva_changes or []
    changes_html = _changes_section_html(nb, mc)
    changes_text = _changes_section_text(nb, mc)

    # ── HTML ──────────────────────────────────────────────────────────────────
    bleuets_section = ""
    if bleuets_available:
        bleuets_section = f"""
      <h3 style="color:#444">🏠 Site officiel Les Bleuets ({len(bleuets_available)} dispo)</h3>
      {_table_html(_listing_rows(bleuets_available))}"""
    else:
        bleuets_section = "<p>❌ Aucune disponibilité sur le site officiel Les Bleuets.</p>"

    maeva_section = ""
    if maeva_listings:
        maeva_section = f"""
      <h3 style="color:#444">🌐 Maeva ({len(maeva_listings)} logement(s))</h3>
      {_table_html(_listing_rows(maeva_listings, show_dispo=True),
                   extra_header="<th style='padding:8px'>Unités</th>")}"""
    else:
        maeva_section = "<p>❌ Aucune disponibilité trouvée sur Maeva.</p>"

    html = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:700px;margin:auto">
      <h2 style="color:#2c7be5">🏔️ Méribel Mottaret – Les Bleuets</h2>
      <p>Vérification du <strong>{now}</strong><br>
         Période recherchée : <strong>{period}</strong></p>
      {changes_html}
      {bleuets_section}
      {maeva_section}
      <p style="margin-top:20px;font-size:12px;color:#888">
        Sources : <a href="{URL}">{URL}</a> · <a href="https://www.maeva.com">maeva.com</a><br>
        Total logements détectés (site officiel) : {len(bleuets_all)}
      </p>
    </body></html>"""

    # ── Texte brut ────────────────────────────────────────────────────────────
    def text_section(title: str, items: list[dict], show_dispo: bool = False) -> list[str]:
        out = [title]
        for item in items:
            dispo = f" | {item.get('dispo','?')} unité(s)" if show_dispo else ""
            out += [
                f"- {item['title']}",
                f"  {item.get('start','?')} → {item.get('end','?')} | {item['price']}{dispo}",
                f"  {item.get('url','')}",
                "",
            ]
        return out

    lines = [
        f"Méribel Mottaret – Les Bleuets | {now}",
        f"Période : {period}",
        "",
        *changes_text,
        *text_section(f"=== Site officiel : {len(bleuets_available)} logement(s) ===", bleuets_available),
        *text_section(f"=== Maeva : {len(maeva_listings)} logement(s) ===", maeva_listings, show_dispo=True),
    ]

    return html, "\n".join(lines)


# ── Cache ─────────────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("  ⚠️  Cache corrompu — ignoré.")
    return {}


def save_cache(data: dict):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def detect_changes(
    previous: dict,
    bleuets_available: list[dict],
    maeva_listings: list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Retourne (new_bleuets, maeva_changes) par rapport au cache précédent.

    maeva_changes : liste de dicts décrivant chaque changement Maeva :
      - listing      : dict du logement actuel
      - prev_price   : ancien prix (str) ou None si nouveau
      - prev_dispo   : ancien stock (str) ou None si nouveau
      - price_changed: bool
      - dispo_changed: bool
      - is_new       : bool (True = logement absent du cache précédent)
    """
    prev_bleuets_refs = {l["title"] for l in previous.get("bleuets", [])}
    new_bleuets = [l for l in bleuets_available if l["title"] not in prev_bleuets_refs]

    prev_maeva = {(l["title"], l.get("start")): l for l in previous.get("maeva", [])}
    maeva_changes: list[dict] = []
    for l in maeva_listings:
        key = (l["title"], l.get("start"))
        if key not in prev_maeva:
            maeva_changes.append({
                "listing":       l,
                "prev_price":    None,
                "prev_dispo":    None,
                "price_changed": False,
                "dispo_changed": False,
                "is_new":        True,
            })
        else:
            prev          = prev_maeva[key]
            price_changed = prev.get("price") != l.get("price")
            dispo_changed = prev.get("dispo")  != l.get("dispo")
            if price_changed or dispo_changed:
                maeva_changes.append({
                    "listing":       l,
                    "prev_price":    prev.get("price"),
                    "prev_dispo":    prev.get("dispo"),
                    "price_changed": price_changed,
                    "dispo_changed": dispo_changed,
                    "is_new":        False,
                })

    return new_bleuets, maeva_changes


def notify_if_needed(
    previous: dict,
    bleuets_available: list[dict],
    bleuets_all: list[dict],
    maeva_listings: list[dict],
    new_bleuets: list[dict],
    maeva_changes: list[dict],
):
    has_anything = bleuets_available or maeva_listings
    has_changes  = new_bleuets or maeva_changes
    is_first_run = not previous

    if not has_anything:
        print("  Aucune disponibilité trouvée.")
        return
    if not (is_first_run or has_changes):
        print("  (Aucun changement depuis la dernière vérification — pas de nouvel email)")
        return

    # ── Construction du sujet ────────────────────────────────────────────────
    new_maeva   = [c for c in maeva_changes if c["is_new"]]
    price_chg   = [c for c in maeva_changes if not c["is_new"] and c["price_changed"]]
    dispo_chg   = [c for c in maeva_changes if not c["is_new"] and c["dispo_changed"]]

    reasons = []
    if new_bleuets:
        reasons.append(f"{len(new_bleuets)} nouveau(x) site officiel")
    if new_maeva:
        reasons.append(f"{len(new_maeva)} nouveau(x) Maeva")
    if price_chg:
        reasons.append(f"{len(price_chg)} changement(s) de prix Maeva")
    if dispo_chg:
        reasons.append(f"{len(dispo_chg)} changement(s) de stock Maeva")

    total      = len(bleuets_available) + len(maeva_listings)
    reason_str = " · ".join(reasons) if reasons else f"{total} logement(s) dispo"
    subject    = f"🏔️ Méribel Mottaret – {reason_str}"

    # ── Envoi ────────────────────────────────────────────────────────────────
    print(f"  → Envoi email : {reason_str}")
    # Sur la première exécution on n'a pas de 'avant' à comparer : pas de section changements
    html, text = build_email(
        bleuets_available, bleuets_all, maeva_listings,
        new_bleuets=new_bleuets if not is_first_run else None,
        maeva_changes=maeva_changes if not is_first_run else None,
    )
    send_email(subject, html, text)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Vérification Les Bleuets + Maeva")

    # ── Site officiel ─────────────────────────────────────────────────────────
    try:
        soup = fetch_page()
    except Exception as e:
        print(f"❌ Erreur site officiel : {e}")
        soup = None

    bleuets_all       = extract_listings(soup) if soup else []
    bleuets_available = [l for l in bleuets_all if l["overlaps_target"]]

    print(f"  Site officiel — détectés : {len(bleuets_all)}, dispo 16-31/07 : {len(bleuets_available)}")
    for l in bleuets_available:
        print(f"    ✅ {l['title']} | {l['start']} → {l['end']} | {l['price']}")

    # ── Maeva ─────────────────────────────────────────────────────────────────
    maeva_listings = fetch_maeva_all()

    # ── Cache & envoi ────────────────────────────────────────────────────────
    previous = load_cache()
    new_bleuets, maeva_changes = detect_changes(previous, bleuets_available, maeva_listings)
    save_cache({"bleuets": bleuets_available, "maeva": maeva_listings})
    notify_if_needed(previous, bleuets_available, bleuets_all, maeva_listings, new_bleuets, maeva_changes)


if __name__ == "__main__":
    main()
