# Audit design — pachetul `design_final_startica/` · 30.09.2026

Scanate: 36 `.dc.html`, 19 `.md`, 31 `screens/*.md`.

## A. Contrast: text alb pe `--orange` (#ef8a1d), 2,4:1 (încalcă regula din 30.09)
În aplicație trebuie să fie `--orange-strong` (#b85a00):
1. **Checkbox bifat** (fundal portocaliu + ✓ alb): Achitări, Copii, De rezolvat, Planuri și curs, Situația (listă SMS), DS Tabel și filtre.
2. **Sidebar**, varianta închisă: itemul activ.
3. **Prima pornire**: cercul pasului curent.
4. **Butoane care devin active**: Planuri „Salvează” (dirty), De rezolvat (butonul pe rând, „Asociază”).
5. **Pastila „azi” în calendar**: Personal, Prezența (ziua 24).
6. **DS Componente, Button primary**: hover `#e27f12` și apăsat `#d57510` sunt din scara veche. Lipsesc hover/apăsat pentru `--orange-strong`, și nici TOKENS.md nu le are.

Insignele „5a”, „10b”… de pe pânză (79) sunt doar în design, deci nu contează.

## B. Text portocaliu #ef8a1d pe alb, 12px (2,4:1) → `--orange-ink`
Componente formular „Bazin” · DS Componente 2 „Tipărire” · DS Încărcare „Copil” · DS Tabel ▼ · DS Tipare „Pasul 3 din 5” · Responsive „Dashboard”, „Rapoarte” · Situația „Confirmă mesajul/mesajele” ×3 · SMS „Mesaj nou” ×2.

## C. Culori fără token
- **Dubluri greșite:** `#dff3e8` / `#2d6b4a` (DS Fundamente 2) sunt de fapt `--mint-soft` / `--mint-ink`. `#d8cfbf` / `#d8d3c9` (Prezența) sunt de fapt `--border-hover`.
- **Fără decizie:** `#f9f5ee` (5 fișiere DS), `#f6c98f` (Dashboard, Responsive), `#f6c49a`, `#fffafb`, `#fff7f9`, `#e0b4c2`, `#9c2245`, `#8a1e3d`, `#eeeeee` (Personal, tipărire).
- **Documentate, dar fără token:** `#f3faf6` (placa Prezent), chenarul și avatarul de grupă (`-border`, `-avatar`) pentru toate cele 8 tonuri.
- SMS expeditor: culorile de iOS sunt normale, e machetă de telefon.

## D. Font sub 10px (în afara tipăririi)
Prezența: 8px la tag, 9px la vârstă, zi, notițe · Grupe și Bazin: inițiale 9px · Personal: CO/CM 9px · Copii: 9px. Tipărirea și bonul pot rămâne așa.

## E. Link rupt
Formulare → `Grupe.dc.html#3a`. Artboardul nu există, id-urile din Grupe sunt 4a/4c.

## F. Documentație neactualizată
- `screens/28` §6 descrie încă UI-ul pentru Documente (grid 3, încarcă).
- `README.md`: „portocaliu #ef8a1d (acțiune)”, fără `--orange-strong`; „Starea la 29.09”.
- `TOKENS.md`: „26 fișiere” (acum sunt 36), fără hover/apăsat pentru orange-strong, fără `-border`/`-avatar`.
- `PROMPT-CLAUDE-CODE`, `-2`, `-3`, `-4` și `AUDIT-DS-30-09.md` (v1) sunt în pachet lângă v5/v2 și pot încurca Claude Code.

## G. Copii vechi în rădăcina proiectului
34 din 36 fișiere din rădăcină sunt **mai vechi** (butoane încă pe #ef8a1d). Stări goale și SMS expeditor există doar în `design_final_startica/`. Se urcă **doar** folderul.

## H. Glife ca iconițe (R3)
✓ ☰ ▼ ⚙ ☐ 🔒 🎂 apar în 30 de fișiere. În design țin locul `Icon`. Fără o notă explicită, Claude Code le poate copia ca text.

## I. Stări goale pe ecrane ≠ catalog (Stari goale 35b–35e)
| Ecran | Pe ecran | Ar trebui |
|---|---|---|
| Dashboard | „Nicio acțiune necesară” | `dashboard.attention.done`: „Nimic de rezolvat azi.” |
| Formulare (asociere) | „Nicio achitare fără copil asociat. Lista se completează…” | `asociere.done`: „Toate achitările sunt asociate” |
| Vizite | „Nicio altă vizită programată luna aceasta.” | `vizite.month.rest`: „Nicio altă vizită luna aceasta.” |
| Copii (zile de naștere) | „Nicio zi de naștere pentru filtrul ales.” | no-results: „Niciun rezultat pentru filtrele alese” |
| Grupe | „Nimeni nu se potrivește.” | no-results: „Niciun rezultat pentru „{căutare}”” |
| Personal | „Nimeni nu se potrivește căutării.” | no-results, idem |
| DS Tabel și filtre | „Nimic pentru „bal”” | no-results, idem |
| Prezența | „Nicio grupă aleasă.” | **lipsește cheia** din catalog |
| DS Date și grafice | „Încă nu sunt date” (grafic gol) | **lipsește cheia** / variantă pentru grafic |
| DS Fundamente 2, DS Tabel | „Nicio achitare încă” | Achitări e `period`: „Nicio achitare în {luna}” |

## Rezolvat (30.09, după audit)
- **A:** Tot textul alb e pe `#b85a00`. Asta include checkbox-urile (Achitări, Copii, De rezolvat, Planuri, Situația, Personal, Prezența, DS Tabel), Sidebar-ul activ, pasul curent din Prima pornire, butoanele „Salvează”, „Asociază” și „Tipărește”, pastila „azi” și stările de încărcare ale butonului primar. Butonul primar are hover `#a34f00` și apăsat `#8a4300` (în TOKENS.md).
- **B:** 16 texte portocalii trec pe `#a34f00`, inclusiv ziua curentă din calendarul Copii.
- **E:** Linkul spre Grupe duce acum la `#4a`.
- **F:** screens/28 marchează Documente ca istoric. README și TOKENS sunt actualizate. Prompturile 1–4 și AUDIT v1 sunt mutate în `arhiva/`.
- **I:** Textele din Formulare, Vizite, Copii, Grupe, Personal, DS Tabel și DS Fundamente 2 sunt aliniate la catalog. Cheia nouă e `chart.nodata` (35d).
  - „Nicio acțiune necesară” din Dashboard rămâne. E subtitlul unui rând cu valoarea 0, nu o stare goală.
  - „Nicio grupă aleasă.” din Prezența rămâne. E indiciu de câmp (35e).
- **Rămân pentru mai târziu:** C, D, G, H. Bordurile și punctele portocalii rămân pe `#ef8a1d`, fiindcă nu poartă text.

## Prioritate
A, B, E și F blochează migrarea. C, D, G, H se pot face după.
