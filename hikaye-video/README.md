# Hikaye Video: 2D sinematik animasyon sistemi

Bir hikayeyi sesli, altyazılı, kamera hareketli 2D animasyon videosuna (MP4) çevirir.
Her şey kodla çizilir. Görsel üretme servisi ya da ücretli bir API gerekmez.

```
hikaye.json  ──ses.py──▶  vo/ (karakter sesleri)  ──build.js──▶  out/zaman.js + out/ses.wav  ──render.js──▶  out/<başlık>.mp4
```

## Nasıl çalışır?

1. Sen hikayeyi düz metin olarak yazarsın.
2. Claude hikayeyi `hikaye.json` sahne dosyasına çevirir: karakterler, mekanlar, replikler, kamera.
3. Üç komutla video çıkar:

```bash
cd hikaye-video
npm install                 # bir kez (yazı tipi)
pip install edge-tts numpy chatterbox-tts faster-whisper  # bir kez (seslendirme)
python3 ses.py              # her replik için ses üretir (yerel yapay zekâ sesi, ücretsiz)
node build.js               # zaman çizelgesi + ses karışımı
node render.js --onizle     # her sahneden bir kare: out/onizleme/
node render.js              # tam video: out/<başlık>.mp4
```

## Ses motorları (ikisi de ücretsiz, kredi yok)

| motor | nasıl | süre |
|---|---|---|
| `chatterbox` (varsayılan) | Açık kaynak yapay zekâ ses modeli (Resemble AI, MIT lisansı). Bu makinede çalışır, internete yalnızca ilk indirmede ihtiyaç duyar. Tonlaması doğaldır ve replikteki `duygu` alanına göre coşkulu ya da sakin okur. Her satırı Whisper ile dinleyip kontrol eder, yanlış okursa yeniden üretir. | 1 sn ses ≈ 7-10 sn işlem (CPU) |
| `edge` | Microsoft Edge sesleri. Çok hızlı ama daha mekanik | anında |

Motoru `hikaye.json` içinde `"sesMotoru": "edge"` ile ya da `python3 ses.py --edge` ile seçersin.

**Karakter sesleri (chatterbox):** Model her karakterin sesini kısa bir örnek kayıttan kopyalar. Varsayılan olarak `sesler/` klasöründeki gerçek insan kayıtları kullanılır (Google FLEURS, CC BY 4.0; ayrıntı ve kredi metni `sesler/KAYNAK.md` içinde). Anlatıcı tok bir erkek sesiyle okur. Karakterlerde Emel sesi seçiliyse ince ses, değilse ikinci erkek sesi kullanılır. `"sesTipi": "kadin"` ile bu seçim zorlanabilir. Ölçümde bu sesler, Edge örneğinden kopyalanan sese göre yaklaşık 1,7 kat daha geniş tonlama verdi.
- En doğal sonuç için karaktere kendi kaydını ver: `"ornekSes": "sesler/ela.wav"`. Kayıt 5-15 saniye, tek kişi, gürültüsüz olmalı. Telefonla kaydedilmiş bir ses de olur. Yalnızca sana ait ya da izni alınmış sesleri kullan.
- Kayıt verilmezse karakterin `ses`/`perde`/`hiz` ayarlarıyla Edge'den kısa bir örnek üretilir ve ses rengi oradan kopyalanır. Tonlama yine yapay zekâ modelinden gelir.
- `"canlilik": 1.3` ile karakter daha coşkulu, `0.8` ile daha sakin konuşur.

### Ses stüdyosu (kendi sesin)

```bash
python3 ses_studyo.py kaydim.m4a benim-sesim        # sesler/benim-sesim.wav + out/ses-testi-benim-sesim.wav
```

Kayıt temizlenir (gürültü azaltma yapılmaz; boğuklaştırıyor), en uygun 10-15 saniye seçilir, gürültü ve süre kontrol edilir, ardından bu sesle bir deneme cümlesi üretilir. Kullanmak için karaktere ya da `anlatici` bölümüne `"ornekSes": "sesler/benim-sesim.wav"` ekle.

İnternet yoksa `python3 ses.py --sessiz` süreleri tahmin eder, böylece sessiz önizleme yapılabilir.
`index.html` dosyasını tarayıcıda açarsan video gerçek zamanlı oynar (boşluk: oynat/durdur).

## Neler var?

- **Karakterler:** Kodla çizilen, eklemli 2D kuklalar. Yürüme döngüsü, nefes alma, göz kırpma, konuşurken sese göre açılan ağız (dudak senkronu), duygular, el kol hareketleri.
- **Sinematik görünüm:** Derinlikli paralaks katmanlar, bulanık ön plan (alan derinliği), 2.39:1 sinema bantları, renk tonu, vinyet, film greni, el kamerası titreşimi.
- **Kamera:** Yavaş yaklaşma ve kaydırma, yakın ve orta çekim, kesme geçişleri, sarsıntı.
- **Efektler:** Ateş böceği, yağmur, kar, toz, kıvılcım, ışık huzmesi.
- **Ses:** Her karaktere ayrı Türkçe ses. Anlatıcı, isteğe bağlı fon müziği.
- **Format:** 16:9 (YouTube) veya 9:16 (Reels/TikTok/Shorts).

## Görselli dikey mod (Reels / TikTok / Shorts)

Kuklalar yerine yapay zekâyla çizilmiş görseller kullanılır. Her çekim tam ekran gösterilir ve yavaşça yaklaşır ya da kayar. Altyazı ekranın ortasında 2-3 kelimelik parçalar halinde, sesle senkron akar. Üstte kırmızı bir başlık bandı durur. Örnek: `ornekler/kurye.json`.

- `"format": "9:16"` dikey format; altyazı stili kendiliğinden `vurgulu` olur.
- `"baslikBant": "SON TESLİMAT"` üst banttaki başlık. Sahne bazında `"bant"` ile değiştirilir, `null` ile gizlenir.
- Sahnede `"gorsel": "gorseller/x/01.jpg"` ilk çekimdir. Herhangi bir olaya `"gorsel"` eklenirse o satır başladığında yeni çekime geçilir.
- `"hareket"`: `yaklas`, `uzaklas`, `sola`, `saga`, `yukari`, `asagi`. Verilmezse otomatik seçilir.
- Metinde `*kelime*` yazılan yer altyazıda turuncu vurgulanır. Yıldızlar seslendirmede okunmaz.
- `"gorselStil"` bütün görsellerin sonuna eklenen ortak stil paragrafıdır. Karakterdeki `"gorselTarif"` ise prompt içinde `[KARAKTER-ADI]` yazılan yere konan sabit tariftir. Bu iki alan karakterlerin ve stilin bütün çekimlerde aynı kalmasını sağlar.
- Karaktere `"gorselReferans": "<Canva media id>"` eklenirse görseller o karakter kartı referans verilerek üretilir. Böylece karakter her sahnede aynı kalır.
- `node build.js` her çekimin tam promptunu `out/gorsel-promptlari.md` dosyasına yazar. Henüz üretilmemiş görseller videoda "GÖRSEL BEKLENİYOR" kartı olarak görünür, böylece önizleme yine de yapılabilir.

### Görselleri hareketlendirme (hepsi açık kaynak, ücretsiz, bu makinede)

Üç katman var. Hepsi ücretsiz; her biri bir öncekinin üstüne eklenir:

1. **2.5D kamera** (her çekimde, anında): `python3 hazirla.py ornekler/x.json` her görselin derinlik haritasını çıkarır (Depth Anything V2). Kamera hareket ettikçe öndeki nesneler arkadakilerden daha çok kayar.
2. **Kukla katmanı** (her çekimde, görsel başına ~10 sn): Aynı komut özneyi arka plandan keser (rembg / IS-Net) ve arkasında kalan boşluğu doldurur (LaMa). Böylece karakter ayrı bir katman olarak oynatılabilir. Çekimde `"oynat"` ile seçilir: `nefes` (varsayılan), `surus` (kameraya doğru sürüş), `git` (uzaklaşma), `ilerle`, `yuru`, `titre`, `salin`, `yukari`, `yok`. Özne görselin %60'ından büyükse katman yapılmaz.
3. **Gerçek yapay zekâ animasyonu** (yalnızca önemli çekimlerde, işlemcide çekim başına 10-30 dk): `~/.venvs/video/bin/python canlandir.py gorseller/x/01.jpg "ne hareket etsin (İngilizce)" 49 448` LTX-Video 2B (Lightricks, açık ağırlık) ile görselden 2 saniyelik bir klip üretir ve `01.mp4` olarak kaydeder. `node build.js` bu klibi bulur; video o çekimde görsel yerine klibi oynatır. Karakter ve mekân kaymasın diye: `--tarif "<karakterin gorselTarif metni>"` ekle, eylemi tek ve küçük tut, kamera hareketi isteme. Son kare de varsayılan olarak görsele bağlıdır (`--son-kare 0.6`). Klip çekimden kısaysa ileri-geri oynatılır, donmaz.

**Görseller nereden gelir?** Claude bunları Canva bağlantısıyla (Canva'nın yapay zekâ görsel üretimi) üretip `gorseller/` klasörüne 1080×1920 olarak indirir. İstersen promptları başka bir araçta kullanıp görselleri aynı dosya adlarıyla klasöre koyabilirsin.

## hikaye.json başvuru kılavuzu

### Üst düzey

| alan | açıklama |
|---|---|
| `baslik` | Video adı, çıktı dosyasının adı da buradan gelir |
| `format` | `"16:9"` (varsayılan) veya `"9:16"` |
| `fps` | Saniyedeki kare sayısı, varsayılan 30 |
| `anlatici` | `{ "ses", "hiz", "perde" }` |
| `karakterler` | Karakter tanımları (aşağıda) |
| `sahneler` | Sahne listesi (aşağıda) |
| `muzik`, `muzikSeviyesi` | İsteğe bağlı fon müziği dosyası (ör. `muzik/fon.mp3`) ve ses seviyesi (0.18) |
| `altyazi`, `sinemaBantlari` | `true`/`false` |
| `repliklerArasi` | Replikler arasındaki boşluk (sn), varsayılan 0.35 |

### Karakter

```json
"ela": {
  "ad": "Ela", "ses": "tr-TR-EmelNeural", "hiz": "-4%", "perde": "+0Hz",
  "ten": "#f3c9a6", "sac": "#5a2e1b", "sacStil": "at-kuyrugu",
  "kiyafet": "#c4473a", "pantolon": "#2d3550", "boy": 0.95
}
```

- **Sesler:** `tr-TR-EmelNeural` (kadın), `tr-TR-AhmetNeural` (erkek). Yaşlı ses için `perde` değerini düşür (`-14Hz`), çocuk sesi için yükselt (`+25Hz`). `hiz` ile konuşma hızı ayarlanır.
- **Saç stilleri** (`sacStil`): `kisa`, `uzun`, `topuz`, `at-kuyrugu`, `kivircik`, `kel`
- **Ek seçenekler:** `sakal` (renk), `gozluk` (true), `etek` (true, rengi `pantolon`), `pelerin` (renk), `goz` (renk), `ayakkabi` (renk), `renk` (altyazıdaki isim rengi), `boy` (0.7 çocuk, 1.0 yetişkin)

### Sahne

```json
{
  "id": "karsilasma", "mekan": "orman-gece", "gecis": "karart", "efekt": "ates-bocegi",
  "kamera": { "x": 0, "zoom": 1.1, "son": { "x": 200, "zoom": 1.3 } },
  "oyuncular": [ { "kim": "ela", "x": -220, "yon": 1, "duygu": "notr" } ],
  "olaylar": [ ... ]
}
```

- **Mekanlar:** `orman-gece`, `orman-gunduz`, `sehir-gece`, `oda`, `gunbatimi`, `deniz`. Kendi görselini kullanmak için: `"mekan": { "resim": "arkaplan/saray.jpg" }`
- **Geçiş** (`gecis`): `karart`, `beyaz`, `kesme`
- **Efekt** (`efekt`): `ates-bocegi`, `yagmur`, `kar`, `toz`, `kivilcim`, efektsiz için `null`
- **Konum:** `x` sahne ortasına göre piksel cinsindendir. Ekran yaklaşık −900 ile +900 arasını gösterir. `yon` 1 ise sağa, −1 ise sola bakar. `z` ile önde/arkada durma sırası verilir (büyük olan önde).
- **Kamera:** `x`, `y`, `zoom` (1 = geniş plan). `son` verilirse sahne boyunca oraya doğru yavaşça kayar. `sarsinti` piksel cinsinden titreme miktarıdır.
- `ton: ["#ff8040", 0.2]` sahnenin renk tonunu değiştirir.

### Olaylar (sırayla oynar)

Her olay bir öncekinin bittiği anda başlar. `"paralel": true` eklenen olay bir sonrakini bekletmez (ör. biri yürürken anlatıcı konuşur).

| tip | alanlar | ne yapar |
|---|---|---|
| `replik` | `kim`, `metin`, `duygu`, `jest`, `plan` | Karakter konuşur. Süre sesten gelir, ağız sese göre oynar |
| `anlatici` | `metin` | Anlatıcı konuşur, altyazı italik görünür |
| `yuru` | `kim`, `x`, `sure` (veya `hiz`), `sonYon` | Karakter verilen x konumuna yürür. Sahneye girip çıkmak için ekran dışındaki bir x kullan |
| `duygu` | `kim`, `duygu` | Yüz ifadesini değiştirir |
| `jest` | `kim`, `jest`, `sure` | Konuşmadan el kol hareketi |
| `bak` | `kim`, `yon` veya `hedef` | Bir yöne ya da bir karaktere döner |
| `kamera` | `x`, `y`, `zoom`, `sure`, `kesme`, `hedef`, `sarsinti` | Kamera hareketi. `hedef: "ela"` karakteri kadraja alır, `kesme: true` anında geçer |
| `yazi` | `metin`, `alt`, `sure`, `arkaplan: "siyah"`, `konum: "ust"` | Başlık ya da ara yazı |
| `bekle` | `sure` | Duraklama |
| `goster` / `gizle` | `kim` | Karakteri görünür ya da görünmez yapar |

- **Duygular:** `notr`, `mutlu`, `uzgun`, `kizgin`, `saskin`, `korkmus`, `dusunceli`
- **Jestler:** `el-salla`, `isaret`, `kollar-acik`, `dusun`, `yumruk`, `omuz-silk`, `dur`, `yuz-kapat`. Konuşurken jest verilmezse karakter kendiliğinden hafifçe el kol oynatır (`"otomatikJest": false` bunu kapatır).
- **Plan** (`plan`, replik süresince kamera): `yakin`, `cokyakin`, `orta`
- Dinleyen karakterler kendiliğinden konuşana döner (`"otomatikBakis": false` bunu kapatır).

## İpuçları

- Bir sahne 10 ile 25 saniye arasında iyi durur. Uzun diyalogları `plan` değişimleriyle (geniş, yakın, orta) böl.
- Her sahne değiştiğinde önce `node render.js --onizle` çalıştır, kareleri kontrol et, sonra tam videoyu al.
- Sesler önbelleğe alınır. Metni değiştirmediğin replikler yeniden üretilmez.
- 40 saniyelik 1080p video bu ortamda yaklaşık 1 dakikada çizilir. Chatterbox seslendirmesi buna birkaç dakika ekler, ama bir kez üretilen satır önbellekte kalır.

## Dosyalar

| dosya | görevi |
|---|---|
| `hikaye.json` | Hikaye: tek düzenlemen gereken dosya |
| `ses.py` | Seslendirme (Chatterbox veya Edge), Whisper kontrolü, kırpma, dudak senkronu verisi |
| `build.js` | Zamanlama ve ses karışımı |
| `engine.js` | Çizim motoru: mekanlar, kukla, kamera, efektler, altyazı |
| `render.js` | Önizleme kareleri ve MP4 çıktısı (Playwright + ffmpeg) |

## Krediler

- Ses: Chatterbox Multilingual (Resemble AI, MIT lisansı), Microsoft Edge Neural TTS (`edge-tts`), kontrol için faster-whisper (MIT)
- Yazı tipi: Nunito, SIL Open Font License 1.1 (@fontsource/nunito)
