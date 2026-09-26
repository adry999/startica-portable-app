# 09 — Copii → fișa copilului

**Referință:** `Copii.dc.html#1e`. **Depinde de:** `00-comun.md` A, C.

## 1. Fișiere
Se modifică: `children/ChildrenPage.tsx` (ramura cu `childId`) sau, recomandat, un fișier nou `children/ChildProfilePage.tsx` + `.module.css`, randat când `childId` e setat. `useChildProfile.ts` rămâne.

## 2. Antet
Titlul din antet rămâne „Copii” (`VIEW_TITLES`). În conținut, primul rând e breadcrumb-ul „Copii / Nume Prenume”, 13px `--muted`, cu „Copii” link spre `/copii`.

## 3. Arbore
```tsx
<div className={s.content}>                          {/* padding:26px 40px 44px; gap:20 */}
  <Breadcrumb />
  <header className={s.hero}>                         {/* fundal tonul grupei (groupTone); radius 24; padding 24px 28px; cerc decorativ */}
    <Avatar size={84} />                              {/* alb, inițiale Baloo, ink-ul tonului */}
    <div><h2>Nume Prenume</h2>                         {/* Baloo 36/800 */}
      <p>Născut 12.05.2022 · 4 ani 4 luni · Contract #3 · <Badge>Activ</Badge> <Badge tone={groupTone}>Mars</Badge></p></div>
    <button className="secondary">Editează fișa</button>
    <button className="primary">+ Plată</button>      {/* deschide PaymentFormDrawer precompletat */}
  </header>
  <div className={s.grid}>                            {/* grid 1fr 1.35fr; gap 18 */}
    <div className={s.left}>
      <Card>Date personale</Card>
      <Card>Părinți: nume · telefon; „+ adaugă telefon” dacă lipsește</Card>
      <Card>Grupă și educator: pătrat cu inițiala grupei + „Schimbă”</Card>
      <Card>Note: cea mai recentă pe --yellow-soft, restul pe --neutral-softer; „+ Notă”</Card>
      <Card>Plătitori reținuți: aliasuri din payer_aliases, cu × pentru ștergere</Card>
    </div>
    <div className={s.right}>
      <div className={s.mini}>Sold (mint) · Taxă lunară (yellow) · Contract (alb)</div>  {/* grid 3 col */}
      <Card>Istoric plăți: lună · dată · metodă · sumă · badge; ⋯ → Tipărește chitanța</Card>
      <Card>Documente: grid 3, icon PDF colorat, „+ Încarcă”</Card>
    </div>
  </div>
</div>
```

## 4. Criterii de acceptare
- [ ] Fișa e pagină (`/copii/:id`), nu dialog
- [ ] Culoarea headerului vine din grupa copilului (`groupTone`)
- [ ] „+ Plată” deschide formularul de achitare cu copilul precompletat
- [ ] Plătitorii reținuți se pot șterge din fișă
