#!/usr/bin/env python3
"""
Surveillance des disponibilités - Les Bleuets Méribel Mottaret
Période ciblée : 16/07 - 31/07
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime, date

# ── Configuration ────────────────────────────────────────────────────────────
URL = "https://meribel-mottaret-lesbleuets.fr/locations"
TARGET_START = date(2026, 7, 16)
TARGET_END   = date(2026, 7, 31)

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


def fetch_page() -> BeautifulSoup:
    resp = requests.get(URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def parse_date_fr(text: str) -> date | None:
    """Tente de parser une date française dd/mm/yyyy ou dd/mm/yy."""
    text = text.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%d.%m.%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def overlaps(start: date | None, end: date | None) -> bool:
    """Vérifie si la période [start, end] chevauche la cible [TARGET_START, TARGET_END]."""
    if start is None or end is None:
        return False
    return start <= TARGET_END and end >= TARGET_START


def resolve_link(cell) -> str:
    """Retourne l'URL absolue depuis la première cellule d'une ligne."""
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
        # Fallback : premier tableau trouvé
        table = soup.find("table")
    if not table:
        return listings

    for row in table.select("tbody tr"):
        cells = row.find_all("td")
        if len(cells) < 10:
            continue

        ref        = cells[1].get_text(strip=True)
        arrival    = cells[3].get_text(strip=True)
        departure  = cells[4].get_text(strip=True)
        appt       = cells[5].get_text(strip=True)
        batiment   = cells[8].get_text(strip=True)
        prix_raw   = cells[9].get_text(strip=True)

        start = parse_date_fr(arrival)
        end   = parse_date_fr(departure)
        if not start or not end:
            continue

        price = f"{prix_raw} €" if prix_raw else "–"
        title = f"Réf. {ref} – {appt} – {batiment}"

        link = resolve_link(cells[0])

        listings.append({
            "title": title,
            "start": start.isoformat(),
            "end":   end.isoformat(),
            "price": price,
            "url":   link or URL,
            "overlaps_target": overlaps(start, end),
            "raw_dates": [arrival, departure],
        })

    return listings


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
    if resp.status_code == 200 or resp.status_code == 201:
        print(f"✅ Email envoyé à {NOTIFY_EMAIL}")
    else:
        print(f"❌ Erreur Resend {resp.status_code}: {resp.text}")


def load_cache() -> list:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return []


def save_cache(data: list):
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def build_email(available: list[dict], all_listings: list[dict]) -> tuple[str, str]:
    now = datetime.now().strftime("%d/%m/%Y à %H:%M")
    period = f"16/07/2026 – 31/07/2026"

    # ── HTML ──────────────────────────────────────────────────────────────
    rows = ""
    for l in available:
        rows += f"""
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">{l['title']}</td>
          <td style="padding:8px;border:1px solid #ddd;">{l.get('start','?')} → {l.get('end','?')}</td>
          <td style="padding:8px;border:1px solid #ddd;">{l['price']}</td>
          <td style="padding:8px;border:1px solid #ddd;">
            {"<a href='" + l['url'] + "'>Voir</a>" if l['url'] else '–'}
          </td>
        </tr>"""

    html = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:700px;margin:auto">
      <h2 style="color:#2c7be5">🏔️ Méribel Mottaret – Les Bleuets</h2>
      <p>Vérification du <strong>{now}</strong><br>
         Période recherchée : <strong>{period}</strong></p>
      <p><strong>{len(available)}</strong> logement(s) disponible(s) sur la période.</p>
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr style="background:#2c7be5;color:#fff">
            <th style="padding:8px">Logement</th>
            <th style="padding:8px">Disponibilité</th>
            <th style="padding:8px">Prix</th>
            <th style="padding:8px">Lien</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#888">
        Source : <a href="{URL}">{URL}</a><br>
        Total logements détectés sur la page : {len(all_listings)}
      </p>
    </body></html>"""

    # ── Texte brut ────────────────────────────────────────────────────────
    lines = [
        f"Méribel Mottaret – Les Bleuets | {now}",
        f"Période : {period}",
        f"{len(available)} logement(s) disponible(s) :\n",
    ]
    for l in available:
        lines.append(f"- {l['title']}")
        lines.append(f"  Dispo : {l.get('start','?')} → {l.get('end','?')}")
        lines.append(f"  Prix  : {l['price']}")
        if l['url']:
            lines.append(f"  URL   : {l['url']}")
        lines.append("")

    return html, "\n".join(lines)


def main():
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Vérification de {URL}")

    try:
        soup = fetch_page()
    except Exception as e:
        print(f"❌ Erreur lors de la récupération de la page : {e}")
        return

    all_listings = extract_listings(soup)
    available    = [l for l in all_listings if l["overlaps_target"]]

    print(f"  Logements détectés : {len(all_listings)}")
    print(f"  Disponibles 16/07-31/07 : {len(available)}")

    for l in available:
        print(f"    ✅ {l['title']} | {l['start']} → {l['end']} | {l['price']}")

    # ── Comparaison avec le cache pour détecter les nouveautés ─────────────
    previous = load_cache()
    prev_titles = {l["title"] for l in previous}
    new_listings = [l for l in available if l["title"] not in prev_titles]

    save_cache(available)

    # Envoie un email si :
    #   • des logements sont disponibles ET
    #   • soit c'est la première vérification, soit il y a de nouvelles annonces
    if available and (not previous or new_listings):
        subject = (
            f"🏔️ {len(available)} logement(s) dispo à Méribel Mottaret (16-31 juillet)"
        )
        if new_listings:
            subject = f"🆕 Nouveau(x) logement(s) à Méribel Mottaret (16-31 juillet) !"

        html, text = build_email(available, all_listings)
        send_email(subject, html, text)
    elif available:
        print("  (Mêmes logements qu'à la dernière vérification — pas de nouvel email)")
    else:
        print("  Aucune disponibilité sur la période cible.")


if __name__ == "__main__":
    main()
