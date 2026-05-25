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

    products = data if isinstance(data, list) else data.get("produits", data.get("products", []))
    if not isinstance(products, list):
        print(f"  ⚠️  Maeva : structure JSON inattendue pour {date_debut}→{date_fin}")
        return []

    booking_url = MAEVA_URL_TEMPLATE.format(debut=date_debut, fin=date_fin)
    results = []
    for p in products:
        name  = p.get("nom") or p.get("name") or p.get("libelle") or "Logement"
        price = p.get("prix") or p.get("price") or p.get("prixBase") or "–"
        dispo = p.get("nbDispo") or p.get("disponibilites") or p.get("stock")

        # Ignore si explicitement indisponible (0 unités)
        if dispo is not None and str(dispo) == "0":
            continue

        price_str = f"{price} €" if price and price != "–" else "–"
        results.append({
            "title": name,
            "start": date_debut,
            "end":   date_fin,
            "price": price_str,
            "dispo": str(dispo) if dispo is not None else "?",
            "url":   booking_url,
        })

    return results


def fetch_maeva_all() -> list[dict]:
    """Récupère les dispos Maeva pour les 2 semaines."""
    all_results = []
    for week in MAEVA_WEEKS:
        listings = fetch_maeva_week(week["dateDebut"], week["dateFin"])
        print(f"  Maeva {week['dateDebut']}→{week['dateFin']} : {len(listings)} logement(s)")
        all_results.extend(listings)
    return all_results


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
    rows = ""
    for l in listings:
        dispo_cell = f"<td style='padding:8px;border:1px solid #ddd;'>{l.get('dispo','')}</td>" if show_dispo else ""
        rows += f"""
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">{l['title']}</td>
          <td style="padding:8px;border:1px solid #ddd;">{l.get('start','?')} → {l.get('end','?')}</td>
          <td style="padding:8px;border:1px solid #ddd;">{l['price']}</td>
          {dispo_cell}
          <td style="padding:8px;border:1px solid #ddd;">
            {"<a href='" + l['url'] + "'>Voir</a>" if l.get('url') else '–'}
          </td>
        </tr>"""
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


def build_email(
    bleuets_available: list[dict],
    bleuets_all: list[dict],
    maeva_listings: list[dict],
) -> tuple[str, str]:
    now    = datetime.now().strftime("%d/%m/%Y à %H:%M")
    period = "16/07/2026 – 31/07/2026"

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
      {bleuets_section}
      {maeva_section}
      <p style="margin-top:20px;font-size:12px;color:#888">
        Sources : <a href="{URL}">{URL}</a> · <a href="https://www.maeva.com">maeva.com</a><br>
        Total logements détectés (site officiel) : {len(bleuets_all)}
      </p>
    </body></html>"""

    # ── Texte brut ────────────────────────────────────────────────────────────
    lines = [
        f"Méribel Mottaret – Les Bleuets | {now}",
        f"Période : {period}",
        "",
        f"=== Site officiel : {len(bleuets_available)} logement(s) ===",
    ]
    for l in bleuets_available:
        lines += [f"- {l['title']}", f"  {l['start']} → {l['end']} | {l['price']}", f"  {l['url']}", ""]

    lines += [f"=== Maeva : {len(maeva_listings)} logement(s) ==="]
    for l in maeva_listings:
        lines += [f"- {l['title']}", f"  {l['start']} → {l['end']} | {l['price']} | {l.get('dispo','?')} unité(s)", f"  {l['url']}", ""]

    return html, "\n".join(lines)


# ── Cache ─────────────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(data: dict):
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


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
    for l in maeva_listings:
        print(f"    🌐 {l['title']} | {l['start']} → {l['end']} | {l['price']} | {l.get('dispo','?')} unité(s)")

    # ── Cache & envoi ─────────────────────────────────────────────────────────
    previous      = load_cache()
    prev_bleuets  = {l["title"] for l in previous.get("bleuets", [])}
    new_bleuets   = [l for l in bleuets_available if l["title"] not in prev_bleuets]

    save_cache({"bleuets": bleuets_available, "maeva": maeva_listings})

    has_anything   = bleuets_available or maeva_listings
    is_first_run   = not previous
    has_new        = new_bleuets

    if has_anything and (is_first_run or has_new):
        total = len(bleuets_available) + len(maeva_listings)
        subject = (
            "🆕 Nouveaux logements à Méribel Mottaret (16-31 juillet) !"
            if has_new else
            f"🏔️ {total} logement(s) dispo à Méribel Mottaret (16-31 juillet)"
        )
        html, text = build_email(bleuets_available, bleuets_all, maeva_listings)
        send_email(subject, html, text)
    elif has_anything:
        print("  (Mêmes logements qu'à la dernière vérification — pas de nouvel email)")
    else:
        print("  Aucune disponibilité trouvée.")


if __name__ == "__main__":
    main()
