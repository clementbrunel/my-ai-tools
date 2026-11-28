#!/usr/bin/env python3
"""Crée un projet de carte dans perso/projets/<nom>/ (dossier ignoré par git).

  python new_project.py fete-des-meres
  python new_project.py naissance-lea --palette bebe
  python new_project.py merci-voisins --palette hiver --titre "Merci !"

Contenu créé :
  perso/projets/<nom>/carte.html        copie du gabarit (templates/carte-pliee-a5.html)
  perso/projets/<nom>/contenu.js        textes à remplir (copie de exemple/contenu.js)
  perso/projets/<nom>/prompts.md        modèle de prompt, avec composition + couleurs déjà remplies
  perso/projets/<nom>/assets/           gabarits de composition, gabarit annoté, palette
  perso/projets/<nom>/references/       photos de référence à déposer
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def paper_from(cream, part=0.4):
    """Fond « papier » des panneaux clairs : blanc teinté par la couleur de fond.
    Un blanc pur (#FFFFFF) tranche trop à côté des panneaux crème."""
    c = cream.strip().lstrip("#")
    if len(c) == 3:  # #abc → #aabbcc (accepté par --palette '#hex,...')
        c = "".join(ch * 2 for ch in c)
    try:
        rgb = [int(c[i:i + 2], 16) for i in (0, 2, 4)] if len(c) == 6 else None
    except ValueError:
        rgb = None
    if rgb is None:  # couleur illisible : blanc, comme avant
        return "#FFFFFF"
    return "#" + "".join(f"{round(255 - (255 - v) * part):02X}" for v in rgb)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("nom", help="nom du dossier projet (ex. anniversaire-2027)")
    ap.add_argument("--palette", default="pastel-lin", help="nom dans image-kit/palettes.json ou '#hex,#hex,...'")
    ap.add_argument("--titre", default="Titre", help="titre d'exemple sur le gabarit annoté")
    ap.add_argument("--sous-titre", default="", help="2e ligne d'exemple sur le gabarit annoté")
    ap.add_argument("--force", action="store_true", help="régénère carte.html, assets/ et prompts.md d'un projet existant (contenu.js et references/ conservés)")
    a = ap.parse_args()

    if not re.fullmatch(r"[\w.-]+", a.nom):
        sys.exit("Nom invalide : lettres, chiffres, '-', '_' ou '.' uniquement.")
    dst = os.path.normpath(os.path.join(HERE, "..", "projets", a.nom))
    if os.path.exists(os.path.join(dst, "contenu.js")) and not a.force:
        sys.exit(f"{dst} existe déjà (--force régénère carte.html, assets/ et prompts.md ; contenu.js et references/ sont conservés).")

    os.makedirs(os.path.join(dst, "references"), exist_ok=True)
    shutil.copy(os.path.join(HERE, "templates", "carte-pliee-a5.html"), os.path.join(dst, "carte.html"))
    new_content = not os.path.exists(os.path.join(dst, "contenu.js"))
    if new_content:  # jamais écrasé : il contient les textes du projet
        shutil.copy(os.path.join(HERE, "exemple", "contenu.js"), os.path.join(dst, "contenu.js"))

    subprocess.run([sys.executable, os.path.join(HERE, "image-kit", "make_assets.py"),
                    "--format", "a5", "--palette", a.palette, "--titre", a.titre,
                    "--sous-titre", a.sous_titre, "--out", os.path.join(dst, "assets")], check=True)

    # Reporte la palette dans contenu.js (1re = fond, 2e/3e = accents doux, 4e = accent, dernière = encre)
    with open(os.path.join(dst, "assets", "palette.json"), encoding="utf-8") as f:
        hx = [c["hex"] for c in json.load(f)]
    if new_content and len(hx) >= 5:
        cj = os.path.join(dst, "contenu.js")
        with open(cj, encoding="utf-8") as f:
            js = f.read()
        couleurs = (f'couleurs: {{\n    cream: "{hx[0]}", paper: "{paper_from(hx[0])}", ink: "{hx[-1]}", inkSoft: "{hx[-1]}CC",\n'
                    f'    accent: "{hx[3]}", accent2: "{hx[1]}", accent3: "{hx[2]}",\n  }}')
        js = re.sub(r"couleurs: \{.*?\n  \}", lambda _: couleurs, js, count=1, flags=re.S)
        with open(cj, "w", encoding="utf-8") as f:
            f.write(js)

    with open(os.path.join(dst, "assets", "composition.txt"), encoding="utf-8") as f:
        comp, colors = (f.read().strip().split("\n") + [""])[:2]
    with open(os.path.join(HERE, "image-kit", "prompt-template.md"), encoding="utf-8") as f:
        tpl = f.read()
    filled = (f"# Prompts — {a.nom}\n\n## Prompt de couverture (à compléter : blocs 1, 2 et 5)\n\n```\n"
              f"<SUJET>.\n<RÉFÉRENCE éventuelle>.\n{comp}\n{colors}\n<STYLE>.\n"
              "No text, no letters, no words, no logo, no watermark, no signature, no border.\n```\n\n---\n\n" + tpl)
    with open(os.path.join(dst, "prompts.md"), "w", encoding="utf-8") as f:
        f.write(filled)

    print(f"\nProjet prêt : {dst}")
    print("  1. Remplir contenu.js (textes, couleurs)")
    print("  2. Déposer les photos de référence dans references/")
    print("  3. Compléter prompts.md et générer recto.png (+ vignette.png, fond-interieur.png)")
    print("  4. Ouvrir carte.html, Ctrl+P (A4 paysage, sans marges, recto-verso bord court)")


if __name__ == "__main__":
    main()
