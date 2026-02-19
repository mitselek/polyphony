# Administraatori teejuht

_Ülevaade rollidest ja õigustest — kes mida teha saab_

---

## Sissejuhatus

Polyphony Vault on üles ehitatud rollidele. See tähendab, et igal kasutajal on kindlad õigused vastavalt sellele, milline on tema ülesanne kooris.

**Pane tähele:** Ühel inimesel võib olla **mitu rolli korraga**. Näiteks võib koorivanem olla korraga nii administraator kui ka noodikogu hoidja. Õigused liituvad – kui üks roll lubab midagi teha, siis on see lubatud, isegi kui teine roll seda konkreetselt ei maini.

---

## Rollide kirjeldused

### Omanik (Owner)

Keskkonna looja ja juhtkonna liige. **Ei tegele ise nootide ega proovide haldamisega** — vajaduse korral määrab endale sobivad rollid.

**Ülesanded:**

- Määrab teistele liikmetele rolle (sh teisi omanikke)
- Haldab rakenduse tehnilisi seadeid
- Vastutab kogu keskkonna toimimise eest
- Saab vajaduse korral ennast määrata administraatoriks, raamatukoguhoidjaks või dirigendiks

**Kellele sobib:** Koori president, juhatuse esimees või IT-tugi.

⚠️ **NB:** Igas kooris peab alati olema vähemalt üks aktiivne omaniku õigustega kasutaja.

---

### Administraator (Admin)

Korraldab liikmete nimekirja. **Ei tegele nootide lisamisega** — see on eraldatud roll.

**Ülesanded:**

- Lisab uued lauljad nimekirja ja saadab neile liitumiskutseid
- Määrab liikmetele rolle (v.a omaniku rolli — seda saab muuta ainult omanik)
- Eemaldab vajadusel liikmeid nimekirjast

**Kellele sobib:** Koori sekretär, juhatuse liige või koorivanem.

**Nipp:** Kui administraator peab tegelema ka nootidega, võib ta endale lihtsalt lisada ka raamatukoguhoidja roll.

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

Aitab pidada arvestust kohaloleku üle.

**Ülesanded:**

- Märgib liikmete kohalolekut proovides

**Kellele sobib:** Soprani, aldi, tenori või bassi vanem.

---

## Õiguste tabel

Kiire ülevaade, millised tegevused on erinevatele rollidele lubatud:

| Tegevus                             | Omanik | Admin | Raamatukoguhoidja | Dirigent | Häälerühma vanem | Tavaline laulja |
| :---------------------------------- | :----: | :---: | :---------------: | :------: | :--------------: | :-------------: |
| Nootide vaatamine ja allalaadimine  |   ✅   |  ✅   |        ✅         |    ✅    |        ✅        |       ✅        |
| **Nootide lisamine ja muutmine**    |   ❌   |  ❌   |        ✅         |    ❌    |        ❌        |       ❌        |
| **Liikmete kutsumine ja haldamine** |   ✅   |  ✅   |        ❌         |    ❌    |        ❌        |       ❌        |
| **Rollide muutmine**                |   ✅   |  ✅¹  |        ❌         |    ❌    |        ❌        |       ❌        |
| **Proovide lisamine kalendrisse**   |   ❌   |  ❌   |        ❌         |    ✅    |        ❌        |       ❌        |
| **Kohaloleku märkimine**            |   ❌   |  ❌   |        ❌         |    ✅    |        ✅        |       ❌        |
| **Seadete haldamine**               |   ✅   |  ✅   |        ❌         |    ❌    |        ❌        |       ❌        |
| Keskkonna kustutamine               |   ✅   |  ❌   |        ❌         |    ❌    |        ❌        |       ❌        |

**Selgitus:**

- ✅ = Lubatud
- ❌ = Ei ole lubatud
- ¹ Admin saab muuta kõiki rolle **v.a omaniku rolli** — seda saab muuta ainult omanik.
- **Tavaline laulja** = Iga sisse logitud liige, kellel pole ühtegi lisarolli.
- **Omanik** saab endale lisada rolle (Raamatukoguhoidja, Dirigent jne) kui vajab nende õigusi.
- **Individuaalse vastutuse usaldamine (Trust Individual Responsibility):** Kui see seade on sisse lülitatud, saavad ka tavalised lauljad ise oma RSVP ja kohalolekut märkida. Vaikimisi on see lubatud ainult omanikele, administraatoritele, dirigentidele ja häälerühma vanematele.

---

## Kuidas…

### …lisada uut lauljat?

Liikme lisamine toimub kahes sammus:

1. **Admin** (või omanik) valib menüüst **"Members"** ja klikib **"Add Roster Member"**.
2. Sisestab laulja nime ja määrab sobiva häälerühma (nt "Sopran" või "Bass"). Salvesta.
3. Ava äsja lisatud liikme profiil ja klikib **"Send Invitation"**.
   > Liige saab unikaalse kutselingi, millega ta saab registreeruda ja pääseda ligi nootidele. E-posti aadressi pole kutsumisel kohe vaja teada — liige lisatakse esmalt nimekirja, kutse saadetakse hiljem.

### …lisada uut nooti?

1. **Raamatukoguhoidja** avab **"Works"**.
2. Valib **"Add Work"** (lisa teos).
3. Laeb üles PDF-faili ja täidab vajalikud andmed (pealkiri, autor).

### …korraldada proovi?

1. **Dirigent** avab **"Events"**.
2. Loob uue sündmuse, märkides kuupäeva ja kellaaja.
3. Pärast proovi avab sama sündmuse ja märgib, kes olid kohal.

### …hallata seadeid?

**Omanik** või **administraator** pääseb ligi seadete lehele (**"Settings"**). Sealt saab:

- Muuta vaikimisi sündmuse kestust
- Määrata koori vaikimisi keele ja ajavööndi
- Lülitada sisse/välja **Individuaalse vastutuse usaldamine** — kui see on sees, saavad liikmed ise oma RSVP ja kohalolekut hallata.

---

## Uued nimekirja liikmed (roster-only)

Lauljad saab lisada nimekirja **enne** kutse saatmist. Sellist liiget nimetatakse _nimekirja liikmeks_ (roster-only):

- Ta on nähtav osalusstatistikas ja sündmuste nimekirjas
- Ta **ei saa sisse logida** enne, kui talle on kutse saadetud ja ta on registreerumise lõpetanud
- Kutse saatmise hetkel saab talle eelnevalt rolle määrata — need aktiveeruvad kohe pärast registreerumist

See kaheastmeline mudel võimaldab koori nimekirja korras hoida ka enne, kui kõik lauljad on registreerumise lõpetanud.

---

## Esimesed sammud uuele haldajale

Kui oled äsja saanud administraatori või omaniku õigused, soovitame alustada nii:

1. **Vaata üle oma rollid.**
   Mine lehele "Members" ja otsi nimekirjast üles enda nimi. Veendu, et sul on olemas kõik vajalikud rollid oma töö tegemiseks.

2. **Lisa kooriliikmed nimekirja.**
   Kasuta "Add Roster Member" nuppu, et lisada lauljad häälerühmade kaupa. Seejärel saada neile kutsed "Send Invitation" kaudu.

3. **Määra abilised.**
   Leia nimekirjast üles inimesed, kes aitavad noote või proove hallata, ja lisa neile vastavad rollid (nt _Admin_ või _Librarian_). Selleks kliki liikme nime juures olevale rolli nupule.

4. **Korrasta häälerühmad.**
   Veendu, et igal lauljal on märgitud õige häälerühm (nt Sopran 1, Tenor 2). See on oluline, kui hakkate hiljem proovides kohalolekut märkima.

---

## Korduma kippuvad küsimused

**Miks ma ei saa noote üles laadida?**
Tõenäoliselt puudub sul **Raamatukoguhoidja (Librarian)** roll. Palu administraatoril või omanikul see endale lisada.

**Miks ma ei näe "Add Roster Member" nuppu?**
Sul puudub **Administraatori (Admin)** roll. Ainult adminid ja omanikud saavad liikmeid lisada.

**Kas ma saan liikmelt rolli ära võtta?**
Jah. Liikumisel "Members" lehel ja vajutades aktiivsele rollile (nt sinine "Admin" nupp), muutub see mitteaktiivseks ja õigus kaob koheselt.

---

_Juhend uuendatud: 19.02.2026_
