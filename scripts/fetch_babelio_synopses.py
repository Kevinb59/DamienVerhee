"""Usage ponctuel : récupère les résumés Babelio (latin-1)."""
import re
import sys
import urllib.request

BOOKS = [
    (
        "L'homme qui regardait pousser les tomates",
        "https://www.babelio.com/livres/Verhee-Lhomme-qui-regardait-pousser-les-tomates/1262171",
    ),
    (
        "Pour une éternité",
        "https://www.babelio.com/livres/Verhee-Pour-une-eternite/1393877",
    ),
    (
        "Le silence de l'océan",
        "https://www.babelio.com/livres/Verhee-Le-silence-de-locean/1604411",
    ),
    (
        "Les 90 jours du lynx",
        "https://www.babelio.com/livres/Verhee-Les-90-jours-du-lynx/1312657",
    ),
    (
        "Laisser faner les roses",
        "https://www.babelio.com/livres/Verhee-Laisser-faner-les-roses/1501356",
    ),
    (
        "Bienvenue à Treblinka !",
        "https://www.babelio.com/livres/Verhee-Bienvenue-a-Treblinka-/1819706",
    ),
    (
        "Le chant du Marais",
        "https://www.babelio.com/livres/Verhee-Le-chant-du-Marais/1278159",
    ),
    (
        "Le sang du Marais",
        "https://www.babelio.com/livres/Verhee-Le-sang-du-Marais/1286430",
    ),
    (
        "L'évaille des mots",
        "https://www.babelio.com/livres/Verhee-Levaille-des-mots/1321153",
    ),
]


def extract_resume(html: str) -> str:
    m = re.search(
        r'class="livre_resume"[^>]*>(.*?)</div>\s*</div>\s*<div class="livre_resume_bottom"',
        html,
        re.S,
    )
    if not m:
        m = re.search(r'class="livre_resume"[^>]*>(.*?)</div>', html, re.S)
    if not m:
        return ""
    text = re.sub(r"<[^>]+>", " ", m.group(1))
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r">\s*Voir plus\s*$", "", text).strip()
    return text


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    opener = urllib.request.build_opener()
    opener.addheaders = [("User-Agent", "Mozilla/5.0 (compatible; DamienVerheeSite/1.0)")]

    for title, url in BOOKS:
        raw = opener.open(url, timeout=25).read().decode("latin-1", errors="replace")
        r = extract_resume(raw)
        print("---", title)
        print(r)
        print()


if __name__ == "__main__":
    main()
