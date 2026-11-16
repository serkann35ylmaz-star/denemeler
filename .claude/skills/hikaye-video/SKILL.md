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

## Notlar

- Mekan listesinde olmayan bir yer gerekirse en yakın mekanı kullan ya da `engine.js` içindeki `SETS` nesnesine yeni bir mekan ekle (mevcutları örnek al).
- Kullanıcı arka plan görseli verirse: `"mekan": { "resim": "arkaplan/dosya.jpg" }`.
- Ses motoru varsayılan olarak Chatterbox (yerel, ücretsiz, doğal). Kurulu değilse: `pip install chatterbox-tts faster-whisper`. Kurulmazsa ses.py kendiliğinden Edge'e geçer.
- Kullanıcı ses kaydı verirse karaktere `"ornekSes"` ekle. Çıktıdaki "uyum" yüzdesi düşükse (%80 altı) metni sadeleştir ya da `--edge` ile o satırı karşılaştır.
- Bu bulut ortamında vekil sertifikası `ses.py` içinde ayarlanır. Ağ yoksa `--sessiz`.
