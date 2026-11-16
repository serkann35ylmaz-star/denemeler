---
name: hikaye-video
description: Kullanıcının verdiği hikayeyi 2D sinematik, sesli ve altyazılı animasyon videosuna (MP4) çevirir. "Bu hikayeyi videoya çevir", "2D animasyon yap", "hikaye videosu", "karakterli video" gibi isteklerde kullan.
---

# Hikaye → 2D sinematik video

Sistem `hikaye-video/` klasöründe. Alan başvurusu: `hikaye-video/README.md` (önce oku).

## Akış

1. **Hikayeyi anla.** Eksikse tek soruda sor: süre (varsayılan 30-60 sn), format (16:9 / 9:16), ton.
2. **Uyarla.** Hikayeyi sahnelere böl: her sahne bir mekan, 10-25 sn. Anlatımı kısa `anlatici` satırlarına, konuşmaları `replik`lere dönüştür. Her karaktere görünüş (saç stili, renkler, boy) ve ses (Emel kadın, Ahmet erkek; perde ile yaş) ver.
3. **Sinematik dil kullan:** sahne açılışında geniş plan ve `kamera.son` ile yavaş yaklaşma; duygusal replikte `plan: "yakin"`; karşılıklı konuşmada plan değiştir; giriş/çıkışlar ekran dışından `yuru`; anlatım sırasında yürüyüş için `paralel: true`; açılışta `yazi` başlık kartı.
4. **Yeni projede** klasörü kopyala: `cp -r hikaye-video <proje-adi>` (node_modules, vo, out hariç), sonra `npm install`.
5. **Üret ve kontrol et:**
   ```bash
   python3 ses.py && node build.js && node render.js --onizle
   ```
   Önizleme karelerine bak (kadraj, altyazı, karakter konumu). Düzelt, sonra `node render.js`.
6. MP4'ü kullanıcıya gönder. Sahne listesi ve süreyi kısaca özetle.

## Görselli dikey mod

Kullanıcı referanstaki gibi yapay zekâ görselli dikey video isterse `ornekler/kurye.json` yapısını kullan (`format: 9:16`, `gorselStil`, karakterlerde `gorselTarif`, her çekimde `gorsel` + `gorselPrompt`, vurgu için `*kelime*`).
Görselleri Canva bağlantısıyla üret: `generate-image` (PORTRAIT_9_16). Sonuç yalnızca küçük önizleme döndürür; tam boy için `create-design` (format "Instagram Story (Portrait)", references=[media id], brief: yalnız görsel, tam sayfa, yazı yok) → `export-design` (jpg, 1080x1920) → URL'yi `curl` ile `gorseller/...` yoluna indir. Görselleri indirdikten sonra kontrol et (karakter tutarlılığı, istenmeyen yazı).

**Karakter tutarlılığı:** Önce her ana karakter için Canva'da bir referans kartı üret (önden ve 3/4 açıdan tam boy, düz koyu arka plan). Karakterin `gorselReferans` alanına bu kartın Canva media id'sini yaz. Sonra her çekimde `generate-image` çağrısına `imageReferences: [{type: MEDIA, id}]` ekle ve prompta "the exact character from the reference image (...)" yaz.
- Mevcut dizi ana karakteri (2026-11-16): Canva media `MAHbG9bFtyY`. Görünüşü: yuvarlak bembeyaz kafa, minik siyah nokta gözler, kalın kaşlar, lacivert bere, kiremit rengi bomber ceket, beyaz tişört, koyu kot, beyaz çizgi film elleri.

**Referans kurgu temposu (kullanıcının örnek videosu):** 1-2 saniyede bir kesme, yaklaşık saniyede 3 kelimelik hızlı anlatım, ilk 2 saniyede kanca cümlesi, sayılar için sayaç animasyonu, üstte kırmızı Anton başlık bandı, ortada 2-3 kelimelik vurgulu altyazı. Bir satır içinde birden çok görsel gerekiyorsa satırı bölüp her parçaya ayrı `gorsel` ver.

## Hareket

- Her bölümde görseller indikten sonra `python3 hazirla.py <hikaye>` çalıştır (derinlik + kukla katmanı). Her çekime uygun `oynat` seç.
- Bölüm başına 2-3 kilit çekimi `canlandir.py` ile gerçek klibe çevir (arka planda, tek tek; aynı anda iki tane çalıştırma, bellek yetmez). Hareket tarifini İngilizce ve tek, küçük bir eylem olarak yaz; kamera hareketi isteme.
- Kayma olmasın diye her zaman karakterin `gorselTarif` metnini `--tarif` ile ver. `--son-kare 0.6` varsayılan olarak açık; son kareyi de görsele bağlar. Varsayılan genişlik 384, kare sayısı 49 (15 GB belleğe sığan en büyük ayar).
- Ses (global python, torch 2.6 CPU + diffusers 0.29) ile video modeli (`~/.venvs/video`, diffusers 0.43) ayrı ortamlarda. Global ortama diffusers yükseltme kurma; Chatterbox bozulur.

## Notlar

- Mekan listesinde olmayan bir yer gerekirse en yakın mekanı kullan ya da `engine.js` içindeki `SETS` nesnesine yeni bir mekan ekle (mevcutları örnek al).
- Kullanıcı arka plan görseli verirse: `"mekan": { "resim": "arkaplan/dosya.jpg" }`.
- Ses motoru varsayılan olarak Chatterbox (yerel, ücretsiz, doğal). Kurulu değilse: `pip install chatterbox-tts faster-whisper`. Kurulmazsa ses.py kendiliğinden Edge'e geçer.
- Kullanıcı ses kaydı verirse karaktere `"ornekSes"` ekle. Çıktıdaki "uyum" yüzdesi düşükse (%80 altı) metni sadeleştir ya da `--edge` ile o satırı karşılaştır.
- Bu bulut ortamında vekil sertifikası `ses.py` içinde ayarlanır. Ağ yoksa `--sessiz`.
