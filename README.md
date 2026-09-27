# قعدة مصلحة | Qaadet Maslaha

A small, bilingual legal site for GitHub Pages.
No build step, dependencies, scripts, trackers, or external fonts.
Arabic pages use RTL; English pages use LTR.
The theme follows the device’s color preference.

## Files

- `index.html` / `index-en.html`: game introduction and links.
- `privacy.html` / `privacy-en.html`: privacy practices.
- `terms.html` / `terms-en.html`: terms of use.
- `support.html` / `support-en.html`: support contacts.
- `account-deletion.html` / `account-deletion-en.html`: deletion instructions.
- `styles.css`: the single shared stylesheet.
- `.nojekyll`: disables Jekyll processing.
- `CONTENT-SOURCES.md`: claim evidence and source discrepancies.
- `README.md`: owner instructions.

## Before publishing

The support email appears on both support and both deletion pages.
The placeholder is visible and deliberately has no mailto link.
Use the same real address across both languages.
Review the content against the version you plan to release.
Check hosting configuration separately from application code.
This review cannot establish hosting-provider logs or backup behavior.

## Publish on GitHub Pages

The local repository is initialized on `main`.
No remote repository was created, and nothing was pushed.

1. Create a new public GitHub repository named `maslaha-legal`.
2. Leave its README, license, and gitignore initialization options unchecked.
3. Open PowerShell in this folder.
4. Replace `OWNER` below with your GitHub account name.
5. Run these commands yourself:

```powershell
Set-Location -LiteralPath 'G:\Work Space\maslaha-legal'
git add .
git commit -m "Add bilingual legal site"
git remote add origin https://github.com/OWNER/maslaha-legal.git
git push -u origin main
```

6. Open the repository’s **Settings → Pages**.
7. Under **Source**, choose **Deploy from a branch**.
8. Choose **main** and **/(root)**, then **Save**.
9. Wait for deployment, then open **Visit site**.
10. Check every page and language link on your phone.

Expected address: `https://OWNER.github.io/maslaha-legal/`.
All internal links are relative, supporting this project path.
Future updates require another commit and push to `main`.

Instructions follow [GitHub’s publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Preview locally

Open `index.html` directly in your browser.
Alternatively, run this command from this folder:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8080/`.
Press Ctrl+C to stop the preview.

## Content maintenance

Update both languages together when game behavior changes.
Keep sentences at 12 words or fewer.
Use Western digits and plain Egyptian Arabic.
Keep `CONTENT-SOURCES.md` aligned with every data-practice change.
Do not replace the current copy with outdated source paragraphs.
