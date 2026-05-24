#!/usr/bin/env python3
"""
Surveillance des disponibilités - Les Bleuets Méribel Mottaret
Période ciblée : 16/07 - 31/07
"""

import requests
from bs4 import BeautifulSoup
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
import os
import re
from datetime import datetime, date

# ── Configuration ────────────────────────────────────────────────────────────
URL = "https://meribel-mottaret-lesbleuets.fr/locations"
TARGET_START = date(2026, 7, 16)
TARGET_END   = date(2026, 7, 31)

# Variables d'environnement (à définir dans GitHub Actions Secrets)
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT") or "587")
SMTP_USER     = os.getenv("SMTP_USER", "")          # votre email expéditeur
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")      # mot de passe app Gmail
NOTIFY_EMAIL  = os.getenv("NOTIFY_EMAIL", "hasto88@gmail.com")

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


def extract_listings(soup: BeautifulSoup) -> list[dict]:
    """
    Extrait les logements disponibles depuis la page.
    Adapte les sélecteurs CSS si le site change de structure.
    """
    listings = []

    # ── Tentative 1 : cartes / articles classiques ────────────────────────
    cards = soup.select(
        "article, .location, .logement, .appartement, "
        ".listing, .card, [class*='location'], [class*='logement']"
    )

    for card in cards:
        text = card.get_text(separator=" ", strip=True)

        # Cherche toutes les dates dans le texte de la carte
        dates_found = re.findall(
            r"\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\b", text
        )
        parsed_dates = [parse_date_fr(d) for d in dates_found]
        parsed_dates = [d for d in parsed_dates if d is not None]

        # Détermine start/end si au moins 2 dates trouvées
        start = min(parsed_dates) if parsed_dates else None
        end   = max(parsed_dates) if len(parsed_dates) >= 2 else None

        # Titre / nom du logement
        title_el = card.select_one("h1, h2, h3, h4, .title, .name, .titre")
        title = title_el.get_text(strip=True) if title_el else text[:80]

        # URL du logement
        link_el = card.select_one("a[href]")
        link = link_el["href"] if link_el else ""
        if link and not link.startswith("http"):
            link = "https://meribel-mottaret-lesbleuets.fr" + link

        # Prix
        price_match = re.search(r"(\d[\d\s]*[€$]|\d+\s*euros?)", text, re.I)
        price = price_match.group(0).strip() if price_match else "–"

        listings.append({
            "title": title,
            "start": start.isoformat() if start else None,
            "end":   end.isoformat()   if end   else None,
            "price": price,
            "url":   link,
            "overlaps_target": overlaps(start, end),
            "raw_dates": dates_found,
        })

    # ── Tentative 2 : si aucune carte trouvée, analyse globale du texte ──
    if not listings:
        full_text = soup.get_text(separator="\n", strip=True)
        # Cherche des blocs "disponible du … au …"
        pattern = re.compile(
            r"disponible[^\n]*?du\s+(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})"
            r"\s+au\s+(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
            re.I,
        )
        for m in pattern.finditer(full_text):
            start = parse_date_fr(m.group(1))
            end   = parse_date_fr(m.group(2))
            listings.append({
                "title": m.group(0)[:80],
                "start": start.isoformat() if start else None,
                "end":   end.isoformat()   if end   else None,
                "price": "–",
                "url":   URL,
                "overlaps_target": overlaps(start, end),
                "raw_dates": [m.group(1), m.group(2)],
            })

    return listings


def send_email(subject: str, body_html: str, body_text: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        print("⚠️  SMTP non configuré — email non envoyé.")
        print("   Définissez SMTP_USER et SMTP_PASSWORD dans les secrets GitHub.")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = SMTP_USER
    msg["To"]      = NOTIFY_EMAIL

    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
    print(f"✅ Email envoyé à {NOTIFY_EMAIL}")


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
