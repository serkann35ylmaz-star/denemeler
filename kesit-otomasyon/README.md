# Kesit otomasyonu: yayınlardan Türkçe altyazılı Shorts/TikTok

Twitch ve Kick yayıncılarının viral kesitlerini bulur (tüm oyunlar ve IRL; istenirse tek oyuna, ör. GTA 6, süzülür), ve her birini 9:16, kelime kelime vurgulu Türkçe altyazılı, yayıncı kredili bir videoya çevirir. Yanında başlık, açıklama ve hashtag önerileri üretir. Hepsi ücretsiz ve açık kaynak araçlarla, bu makinede çalışır.

```bash
python3 kesit.py hepsi 5        # tara + en iyi 5 yeni kesiti üret
python3 kesit.py analiz         # sadece tara ve raporla  -> out/rapor.md
python3 kesit.py uret 3         # sıradaki 3 kesiti üret -> out/videolar/<tarih>/
python3 kesit.py url https://kick.com/xqc/clips/clip_... xQc        # belirli bir kesit
python3 kesit.py url https://www.twitch.tv/videos/123 xQc --bas 1:02:10 --son 1:02:55   # uzun yayından bölüm
python3 kesit.py hepsi --oyun "grand theft auto vi\b|gta ?6"     # yalnız GTA 6 kesitleri
```

## Nasıl çalışır

1. **Tarama:** `ayarlar.json`'daki her yayıncının son kesitleri (`aralik`: 24hr / 7d / 30d) izlenmeye göre alınır. Kesitler, yayıncının izleyicilerinin "bu an kaçmaz" dediği anlar olduğu için en güvenilir viral sinyaldir.
2. **Süzgeç:** Oyun kategorisi `oyun` kalıbıyla eşleşmeli, süre `minSure`-`maxSure` arasında olmalı, izlenme `minIzlenme` üstünde olmalı.
3. **Viral puan:** `izlenme / (saat cinsinden yaş + 2)^0.6`. Hem çok izlenen hem taze kesitler öne çıkar. `out/rapor.md` yayıncıları toplam kesit izlenmesine göre sıralar.
4. **Üretim:** İndir → Whisper ile yazıya dök → İngilizce ise Türkçe'ye çevir (Helsinki-NLP opus-mt-tc-big-en-tr, CC BY 4.0; diğer diller önce İngilizce'ye) → `sozluk` ile yayın argosunu düzelt → küfürleri yıldızla (`sansur`) → 9:16 kurgu + altyazı + kredi → başlık/açıklama dosyası.
5. **Tekrar yok:** İşlenen kesitler `islenenler.json`'a yazılır (depoda tutulur; makine sıfırlansa da aynı kesit ikinci kez üretilmez).
6. **Günlük özet:** `out/videolar/<gün>/OZET.md` o günün her videosunun başlık, açıklama ve etiketlerini sırayla listeler.
7. **Çeşitlilik:** Bir çalışmada aynı yayıncıdan en fazla `yayinciBasinaMax` (3) kesit alınır.

## Otomatik keşif (isteğe bağlı, Twitch resmi API)

`TWITCH_CLIENT_ID` ve `TWITCH_CLIENT_SECRET` ortam değişkenleri tanımlıysa, her çalışmada Twitch'te o an en çok izlenen Türkçe ve İngilizce yayıncılar (`kesifDilleri`, `kesifSayisi`) listeye kendiliğinden eklenir. Anahtarlar dev.twitch.tv/console'da ücretsiz bir uygulama oluşturarak alınır; hesap şifresi gerekmez. Tanımlı değilse yalnızca `yayincilar` listesi kullanılır.

## Ayarlar (`ayarlar.json`)

| alan | anlamı |
|---|---|
| `oyun` | Kategori süzgeci (regex). Boş = tüm oyunlar ve IRL |
| `aralik` | Kesit arama aralığı. `7d` önerilir: 24 saatlik liste izlenmeye göre sıralanmıyor |
| `yayincilar` | `platform` (twitch/kick), `kanal`, `ad`, `izin` (izin aldıysan true), isteğe bağlı `facecam` |
| `duzen` | `blur`: bulanık arka plan + ortada yakınlaştırılmış oyun (varsayılan). Yayıncıda `facecam` varsa üstte yüz kamerası, altta oyun |
| `facecam` | Yüz kamerasının kaynak görüntüdeki yeri, oran olarak `[x, y, genişlik, yükseklik]`, ör. `[0, 0.62, 0.25, 0.38]` (sol alt köşe) |
| `yakinlik` | `blur` düzeninde oyun görüntüsünün yakınlaştırması (varsayılan 1.3) |
| `sozluk` | Çeviriden sonra kelime düzeltmeleri ("sohbet" → "chat" gibi) |
| `sansur` | Altyazıda küfürleri yıldızla (true). Başlık önerisinde küfürlü cümle hiç seçilmez |

## Sınırlar

- **YouTube** bu bulut sunucusundan indirmeye izin vermiyor ("bot değilim" doğrulaması istiyor). Twitch ve Kick çalışıyor. YouTube için tarayıcıdan dışa aktarılmış bir `cookies.txt` gerekir.
- **Kategori yayının kategorisidir:** "GTA" kategorisindeki bir kesitte yayıncı o an sohbet ediyor olabilir. Raporu ve videoyu paylaşmadan önce gözden geçir.
- **Çeviri makine çevirisidir:** Kısa ve anlaşılır, ama espri ve argo kaçabilir. `sozluk`'e kendi düzeltmelerini ekleyebilirsin.

## Telif ve izin

Kesitler yayıncıların ve oyun yapımcısının içeriğidir. İzinsiz yeniden yükleme telif bildirimi, kanal ihtarı ve para kazanmanın kapatılmasıyla sonuçlanabilir.
- Mümkünse yayıncıdan izin al ya da kesitlemeye açıkça izin veren / kesitçi programı olan yayıncıları seç. İzin aldığında `izin: true` yap; raporda görünür.
- Her videoda yayıncı kredisi ve açıklamada kaynak bağlantısı bulunur. Kaldırma.
- Türkçe altyazı ve kurgu dönüştürücü katkıdır, ama tek başına izin yerine geçmez.
