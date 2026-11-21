#!/usr/bin/env python3
"""Génère les aides à la génération d'images pour un petit support imprimé.

Sorties (dans --out) :
  gabarit-composition.png  zones de couleur floues, SANS texte : image de contrôle / img2img faible force
  gabarit-annote.png       même gabarit annoté (zone titre, sujet, marge) : pour vérifier, pas pour le générateur
  palette.png              nuancier de la palette
  composition.txt          phrase de composition à coller dans le prompt
  palette.json             couleurs de la palette (reprises dans contenu.js par new_project.py)

Exemples :
  python make_assets.py --out ../projets/ma-carte/assets
  python make_assets.py --format a6 --palette pastel-lin --titre "Merci" --out out/
  python make_assets.py --format 100x150 --palette "#112233,#AABBCC,#FFEEDD" --out out/

Dépendance : Pillow (pip install pillow).
"""
import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FORMATS = {  # largeur x hauteur en mm (portrait)
    "a5": (148, 210), "a6": (105, 148), "carre": (150, 150), "a4": (210, 297), "10x15": (100, 150),
}
FONT_CANDIDATES = {
    "sans": ["DejaVuSans.ttf", "arial.ttf", "Arial.ttf", "Helvetica.ttc", "LiberationSans-Regular.ttf"],
    "bold": ["DejaVuSans-Bold.ttf", "arialbd.ttf", "Arial Bold.ttf", "LiberationSans-Bold.ttf"],
    "serif": ["DejaVuSerif.ttf", "georgia.ttf", "Georgia.ttf", "times.ttf", "LiberationSerif-Regular.ttf"],
}
FONT_DIRS = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation",
             "C:/Windows/Fonts", "/Library/Fonts", "/System/Library/Fonts", "/System/Library/Fonts/Supplemental"]


def font(kind, size):
    for name in FONT_CANDIDATES[kind]:
        for d in [""] + FONT_DIRS:
            try:
                return ImageFont.truetype(os.path.join(d, name) if d else name, size)
            except OSError:
                continue
    return ImageFont.load_default(size=size)  # Pillow >= 10.1


def load_palette(spec):
    with open(os.path.join(HERE, "palettes.json"), encoding="utf-8") as f:
        presets = json.load(f)
    presets.pop("_ordre", None)
    if spec in presets:
        return [(c["nom"], c["hex"]) for c in presets[spec]]
    if "#" in spec:
        return [(f"Couleur {i + 1}", h.strip()) for i, h in enumerate(spec.split(",")) if h.strip()]
    sys.exit(f"Palette inconnue : {spec}. Choix : {', '.join(presets)} ou une liste '#hex,#hex'.")


def parse_format(spec):
    if spec.lower() in FORMATS:
        return FORMATS[spec.lower()]
    try:
        w, h = (float(x) for x in spec.lower().split("x"))
        return w, h
    except ValueError:
        sys.exit(f"Format invalide : {spec} (ex. a5, a6, carre, 100x150)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--format", default="a5", help="a5 | a6 | a4 | carre | 10x15 | LxH en mm (défaut a5)")
    ap.add_argument("--paysage", action="store_true", help="orientation paysage")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--zone-titre", type=float, default=22, help="hauteur réservée au titre, en %% (0 = aucune)")
    ap.add_argument("--marge", type=float, default=5, help="marge de sécurité en mm")
    ap.add_argument("--palette", default="pastel-lin", help="nom dans palettes.json ou '#hex,#hex,...'")
    ap.add_argument("--titre", default="Titre", help="texte d'exemple sur le gabarit annoté")
    ap.add_argument("--sous-titre", default="", help="2e ligne d'exemple sur le gabarit annoté")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    wmm, hmm = parse_format(a.format)
    if a.paysage:
        wmm, hmm = max(wmm, hmm), min(wmm, hmm)
    px_mm = a.dpi / 25.4
    W, H = round(wmm * px_mm), round(hmm * px_mm)
    pal = load_palette(a.palette)
    hexes = [h for _, h in pal]
    bg = hexes[0]
    os.makedirs(a.out, exist_ok=True)

    title_h = int(H * a.zone_titre / 100)
    margin = int(a.marge * px_mm)

    # 1. Gabarit de composition (aucun texte)
    g = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(g)
    # (x relatif, y relatif dans la zone sous le titre, rayon relatif au petit côté)
    blobs = [(0.30, 0.52, 0.22), (0.68, 0.58, 0.20), (0.50, 0.32, 0.12), (0.50, 0.78, 0.16)]
    accents = hexes[1:-1] or hexes
    s = min(W, H)
    for i, (cx, cy, r) in enumerate(blobs):
        y = title_h + (H - title_h) * cy
        d.ellipse((cx * W - r * s, y - r * s, cx * W + r * s, y + r * s), fill=accents[i % len(accents)])
    g = g.filter(ImageFilter.GaussianBlur(max(W, H) / 60))
    g.save(os.path.join(a.out, "gabarit-composition.png"))

    # 2. Gabarit annoté
    ann = g.convert("RGBA")
    ov = Image.new("RGBA", ann.size, (0, 0, 0, 0))
    o = ImageDraw.Draw(ov)
    accent = hexes[3] if len(hexes) > 3 else hexes[-1]
    ink = hexes[-1]
    if title_h:
        o.rectangle((0, 0, W, title_h), fill=(255, 255, 255, 150))
        o.line((0, title_h, W, title_h), fill=accent, width=max(3, W // 300))
    o.rectangle((margin, margin, W - margin, H - margin), outline=ink, width=max(2, W // 450))
    ann = Image.alpha_composite(ann, ov)
    d = ImageDraw.Draw(ann)
    u = W / 1748  # échelle par rapport à un A5 portrait
    lab = font("sans", int(40 * u))
    if title_h:
        y = title_h * 0.42 if a.sous_titre else title_h * 0.5
        d.text((W / 2, y), a.titre, font=font("serif", int(120 * u)), fill=accent, anchor="mm")
        if a.sous_titre:
            d.text((W / 2, title_h * 0.75), a.sous_titre, font=font("serif", int(85 * u)), fill=ink, anchor="mm")
        d.text((W / 2, title_h + 45 * u), f"ZONE TITRE ({a.zone_titre:g} %) : fond clair et calme",
               font=lab, fill=ink, anchor="mm")
    d.text((W / 2, title_h + (H - title_h) * 0.55), "SUJET PRINCIPAL", font=font("bold", int(64 * u)),
           fill=ink, anchor="mm")
    d.text((W / 2, H - margin - 40 * u), f"marge de sécurité {a.marge:g} mm", font=lab, fill=ink, anchor="mm")
    ann.convert("RGB").save(os.path.join(a.out, "gabarit-annote.png"))

    # 3. Palette
    sw = 300
    p = Image.new("RGB", (sw * len(pal), 420), "#FFFFFF")
    d = ImageDraw.Draw(p)
    for i, (name, h) in enumerate(pal):
        d.rectangle((i * sw + 20, 20, (i + 1) * sw - 20, 300), fill=h, outline="#CCCCCC")
        d.text((i * sw + sw / 2, 340), name, font=font("bold", 28), fill="#333333", anchor="mm")
        d.text((i * sw + sw / 2, 385), h.upper(), font=font("sans", 26), fill="#666666", anchor="mm")
    p.save(os.path.join(a.out, "palette.png"))

    # 4. Phrase de composition + couleurs pour le prompt
    orient = "Landscape" if W > H else ("Square" if W == H else "Portrait")
    comp = f"{orient} composition, {W}x{H} px."
    if title_h:
        comp += (f" The top {a.zone_titre:g}% of the image is calm, empty, light background "
                 "(a title will be printed there). Main subject in the lower part, centered,")
    else:
        comp += " Main subject centered,"
    comp += f" nothing important within {a.marge:g} mm ({100 * a.marge / wmm:.0f}%) of the edges."
    colors = "Color palette: " + ", ".join(f"{n.lower()} {h.upper()}" for n, h in pal) + "."
    with open(os.path.join(a.out, "composition.txt"), "w", encoding="utf-8") as f:
        f.write(comp + "\n" + colors + "\n")
    with open(os.path.join(a.out, "palette.json"), "w", encoding="utf-8") as f:
        json.dump([{"nom": n, "hex": h} for n, h in pal], f, ensure_ascii=False, indent=2)

    print(f"{W}x{H} px ({wmm:g}x{hmm:g} mm @ {a.dpi} dpi) -> {a.out}")
    print(comp)
    print(colors)


if __name__ == "__main__":
    main()
