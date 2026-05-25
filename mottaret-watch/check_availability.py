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
    """Récupère les dispos Maeva pour les 2 semaines."""
    all_results = []
    for week in MAEVA_WEEKS:
        listings = fetch_maeva_week(week["dateDebut"], week["dateFin"])
        print(f"  Maeva {week['dateDebut']}→{week['dateFin']} : {len(listings)} logement(s)")
        for l in listings:
            print(f"    🌐 {l['title']} | {l['start']} → {l['end']} | {l['price']} | {l.get('dispo','?')} unité(s)")
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


def build_email(
    bleuets_available: list[dict],
    bleuets_all: list[dict],
    maeva_listings: list[dict],
) -> tuple[str, str]:
    now    = datetime.now().strftime("%d/%m/%Y à %H:%M")
    period = f"{TARGET_START:%d/%m/%Y} – {TARGET_END:%d/%m/%Y}"

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
        *text_section(f"=== Site officiel : {len(bleuets_available)} logement(s) ===", bleuets_available),
        *text_section(f"=== Maeva : {len(maeva_listings)} logement(s) ===", maeva_listings, show_dispo=True),
    ]

    return html, "\n".join(lines)


# ── Cache ─────────────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(data: dict):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def detect_changes(
    previous: dict,
    bleuets_available: list[dict],
    maeva_listings: list[dict],
) -> tuple[list[dict], list[dict]]:
    """Retourne (new_bleuets, changed_maeva) par rapport au cache précédent."""
    prev_bleuets_refs = {l["title"] for l in previous.get("bleuets", [])}
    new_bleuets = [l for l in bleuets_available if l["title"] not in prev_bleuets_refs]

    prev_maeva_dispo = {l["title"]: l.get("dispo") for l in previous.get("maeva", [])}
    changed_maeva = [
        l for l in maeva_listings
        if l["title"] not in prev_maeva_dispo
        or prev_maeva_dispo[l["title"]] != l.get("dispo")
    ]
    return new_bleuets, changed_maeva


def notify_if_needed(
    previous: dict,
    bleuets_available: list[dict],
    bleuets_all: list[dict],
    maeva_listings: list[dict],
    new_bleuets: list[dict],
    changed_maeva: list[dict],
):
    has_anything = bleuets_available or maeva_listings
    has_changes  = new_bleuets or changed_maeva
    is_first_run = not previous

    if not has_anything:
        print("  Aucune disponibilité trouvée.")
        return
    if not (is_first_run or has_changes):
        print("  (Aucun changement depuis la dernière vérification — pas de nouvel email)")
        return

    total = len(bleuets_available) + len(maeva_listings)
    reasons = []
    if new_bleuets:
        reasons.append(f"{len(new_bleuets)} nouveau(x) sur site officiel")
    if changed_maeva:
        reasons.append(f"{len(changed_maeva)} changement(s) Maeva")
    reason_str = " · ".join(reasons) if reasons else f"{total} logement(s) dispo"
    subject = f"🏔️ Méribel Mottaret – {reason_str}"

    print(f"  → Envoi email : {reason_str}")
    html, text = build_email(bleuets_available, bleuets_all, maeva_listings)
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
    new_bleuets, changed_maeva = detect_changes(previous, bleuets_available, maeva_listings)
    save_cache({"bleuets": bleuets_available, "maeva": maeva_listings})
    notify_if_needed(previous, bleuets_available, bleuets_all, maeva_listings, new_bleuets, changed_maeva)


if __name__ == "__main__":
    main()
