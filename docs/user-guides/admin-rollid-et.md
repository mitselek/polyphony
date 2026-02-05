# Polyphony Vault: Administraatori teejuht

_Ülevaade rollidest ja õigustest — kes mida teha saab_

---

## Sissejuhatus

Polyphony Vault on üles ehitatud rollidele. See tähendab, et igal kasutajal on kindlad õigused vastavalt sellele, milline on tema ülesanne kooris.

**Pane tähele:** Ühel inimesel võib olla **mitu rolli korraga**. Näiteks võib koorivanem olla korraga nii administraator kui ka noodikogu hoidja. Õigused liituvad – kui üks roll lubab midagi teha, siis on see lubatud, isegi kui teine roll seda konkreetselt ei maini.

---

## Rollide kirjeldused

### Omanik (Owner)

Keskkonna looja ja peavastutaja. Omab **kõiki õigusi**.

**Ülesanded:**

- Määrab teistele liikmetele rolle (sh teisi omanikke)
- Haldab rakenduse tehnilisi seadeid
- Vastutab kogu keskkonna toimimise eest

**Kellele sobib:** Koori president, juhatuse esimees või IT-tugi.

⚠️ **NB:** Igas kooris peab alati olema vähemalt üks aktiivne omaniku õigustega kasutaja.

---

### Administraator (Admin)

Korraldab liikmete nimekirja. **Ei tegele nootide lisamisega** — see on eraldatud roll.

**Ülesanded:**

- Saadab uutele lauljatele liitumiskutseid
- Määrab liikmetele rolle (v.a omaniku rolli)
- Eemaldab vajadusel liikmeid nimekirjast

**Kellele sobib:** Koori sekretär, juhatuse liige või koorivanem.

**Nipp:** Kui administraator peab tegelema ka nootidega, tuleb talle lihtsalt lisada ka raamatukoguhoidja roll.

---

### Raamatukoguhoidja (Librarian)

Hoolitseb noodikogu korrashoiu eest.

**Ülesanded:**

- Laeb üles uusi teoseid ja noote (PDF)
- Lisab teostele infot (helilooja, seadja, litsents)
- Kustutab vananenud või vigaseid faile

**Kellele sobib:** Noodikogu hoidja, arhivaar või dirigendi abi.

---

### Dirigent (Conductor)

Korraldab proovigraafikut ja jälgib osavõttu.

**Ülesanded:**

- Loob kalendrisse proove ja kontserte ("Events")
- Muudab sündmuste aegu ja infot
- Märgib puudujaid ja kohalkäijaid

**Kellele sobib:** Peadirigent, koormeister või abidirigent.

---

### Häälerühma vanem (Section Leader)

Aitab pidada arvestust oma häälerühma üle.

**Ülesanded:**

- Märgib oma häälerühma liikmete kohalolekut proovides

**Kellele sobib:** Soprani, aldi, tenori või bassi vanem.

---

## Õiguste tabel

Kiire ülevaade, millised tegevused on erinevatele rollidele lubatud:

| Tegevus                             | Omanik | Admin | Raamatukoguhoidja | Dirigent | Häälerühma vanem | Tavaline laulja |
| :---------------------------------- | :----: | :---: | :---------------: | :------: | :--------------: | :-------------: |
| Nootide vaatamine ja allalaadimine  |   ✅   |  ✅   |        ✅         |    ✅    |        ✅        |       ✅        |
| **Nootide lisamine ja muutmine**    |   ✅   |  ❌   |        ✅         |    ❌    |        ❌        |       ❌        |
| **Liikmete kutsumine ja haldamine** |   ✅   |  ✅   |        ❌         |    ❌    |        ❌        |       ❌        |
| **Rollide muutmine**                |   ✅   |  ✅   |        ❌         |    ❌    |        ❌        |       ❌        |
| **Proovide lisamine kalendrisse**   |   ✅   |  ❌   |        ❌         |    ✅    |        ❌        |       ❌        |
| **Kohaloleku märkimine**            |   ✅   |  ❌   |        ❌         |    ✅    |        ✅        |       ❌        |
| Keskkonna kustutamine               |   ✅   |  ❌   |        ❌         |    ❌    |        ❌        |       ❌        |

**Selgitus:**

- ✅ = Lubatud
- ❌ = Ei ole lubatud
- **Tavaline laulja** = Iga sisse logitud liige, kellel pole ühtegi lisarolli.

---

## Kuidas…

### …lisada uut lauljat?

1. **Admin** (või omanik) valib menüüst **"Members"** ja klikib **"Invite Member"**.
2. Kirjutab lahtrisse laulja nime.
3. Määrab sobiva häälerühma (nt "Sopran" või "Bass").
4. Saadab kutse teele.
   > Uus liige saab unikaalse kutselingi, millega ta pääseb ligi nootidele. E-posti aadressi pole kutsumisel kohe vaja teada.

### …lisada uut nooti?

1. **Raamatukoguhoidja** (või omanik) avab **"Library"**.
2. Valib **"Add Work"** (lisa teos).
3. Laeb üles PDF-faili ja täidab vajalikud andmed (pealkiri, autor).

### …korraldada proovi?

1. **Dirigent** (või omanik) avab **"Events"**.
2. Loob uue sündmuse, märkides kuupäeva ja kellaaja.
3. Pärast proovi avab sama sündmuse ja märgib, kes olid kohal.

---

## Esimesed sammud uuele haldajale

Kui oled äsja saanud administraatori või omaniku õigused, soovitame alustada nii:

1. **Vaata üle oma rollid.**
   Mine lehele "Members" ja otsi nimekirjast üles enda nimi. Veendu, et sul on olemas kõik vajalikud rollid oma töö tegemiseks.

2. **Kutsu kooriliikmed.**
   Kasuta "Invite Member" nuppu, et saata kutsed häälerühmade kaupa.

3. **Määra abilised.**
   Leia nimekirjast üles inimesed, kes aitavad noote või proove hallata, ja lisa neile vastavad rollid (nt _Admin_ või _Librarian_). Selleks kliki liikme nime juures olevale rolli nupule.

4. **Korrasta häälerühmad.**
   Veendu, et igal lauljal on märgitud õige häälerühm (nt Sopran 1, Tenor 2). See on oluline, kui hakkate hiljem proovides kohalolekut märkima.

---

## Korduma kippuvad küsimused

**Miks ma ei saa noote üles laadida?**
Tõenäoliselt puudub sul **Raamatukoguhoidja (Librarian)** roll. Palu administraatoril või omanikul see endale lisada.

**Miks ma ei näe "Invite Member" nuppu?**
Sul puudub **Administraatori (Admin)** roll. Ainult adminid ja omanikud saavad uusi inimesi kutsuda.

**Kas ma saan liikmelt rolli ära võtta?**
Jah. Liikumisel "Members" lehel ja vajutades aktiivsele rollile (nt sinine "Admin" nupp), muutub see mitteaktiivseks ja õigus kaob koheselt.

---

_Juhend uuendatud: 05.02.2026_
