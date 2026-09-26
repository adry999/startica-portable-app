# 10 — De notificat

**Referință:** `De notificat.dc.html#2b`. **Depinde de:** `00-comun.md` A. Face parte din Contabilitate și **nu are legătură cu Vizite**.

## 1. Fișiere
Se modifică: `notify/NotifyPage.tsx`, `.module.css`, `.test.tsx`. `useNotify.ts` rămâne.

## 2. Antet
`De notificat  CONTABILITATE` · pastila „Telegram conectat” (mint, punct `--success-dot`) · `[Trimite toate · N]` (primar).

## 3. Arbore
```tsx
<div className={s.content}>                          {/* grid 1fr 1fr; gap 18; padding 28px 40px 40px */}
  <section className={s.queue}>                       {/* card alb radius 22 */}
    <SegmentedControl options={[De trimis · N, Trimise, Eșuate]} />
    {items.map(i => <QueueRow active={i.id===activeId} />)}  {/* activ: inset 4px 0 0 var(--orange), fundal --cream */}
  </section>
  <section className={s.preview}>
    <div className={s.templates}>{/* chip-uri șabloane */}</div>
    <div className={s.bubble}>{/* fundal --mint-soft, radius 18; câmpurile auto (nume, sumă, lună) îngroșate */}</div>
    <footer>Nu trimite (text) · Editează textul (secundar) · Trimite (primar)</footer>
  </section>
</div>
```

## 4. Criterii de acceptare
- [ ] Ecranul e separat de Vizite (rută `/de-notificat`, sidebar „De notificat” activ)
- [ ] Rândul activ are bara stângă orange de 4px
- [ ] Contorul din sidebar se golește după trimitere
