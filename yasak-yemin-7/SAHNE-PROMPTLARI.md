# Yasak Yemin – 7. Bölüm · Sahne üretim promptları

Bu promptlar, bakiye ya da plan açıldığında dudak senkronlu, gerçek hareketli video üretmek için hazırlandı. Uygun araçlar: Higgsfield (Kling 3.0 / Seedance 2.5), Chatplace Virale (`heygen_avatar_iv`), Kling ya da Veo.

**Ortak kurallar:**
- Dikey 9:16, 1080×1920, sahne başına 10 sn (30 sn'lik kurgu için 5 sn).
- Müzik yok. Yalnızca diyalog ve hafif ortam sesi.
- Her sahnede `ref/s1.png` … `ref/s6.png` dosyalarını **başlangıç karesi / yüz referansı** olarak ver; karakterlerin yüzleri bu karelerle aynı kalmalı.
- Ortak stil cümlesini her prompta ekle: *"Cinematic Turkish TV drama, warm tungsten interior light, shallow depth of field, 35mm look, natural skin texture, realistic acting, subtle micro-expressions, no music, Turkish dialogue with accurate lip sync."*

**Karakterler (referanstaki görünüş):**
- **Asya:** Koyu kahve dalgalı uzun saç; krem dantel bluz.
- **Ateş:** Koyu dalgalı saç, kirli sakal, siyah gömlek.
- **Nihat:** Gri saç ve sakal, lacivert çizgili takım elbise, bordo kravat.
- **Derin:** Sarı dalgalı saç, siyah askılı elbise, altın halka küpe.

---

## Sahne 1 – Asya'nın isyanı (0–10 sn) · referans `ref/s1.png`
Grand mansion living room, evening. Asya stands facing Ateş (Ateş seen from behind, out of focus in the right foreground). Her eyes are glassy with tears but she does not cry; jaw tense, voice trembling with restrained anger. Slow push-in from medium close-up to close-up on Asya's face. Ateş stays still and cold.
**Asya (Türkçe, dudak senkronlu):** "Bana hâlâ bir yabancı gibi davranmana artık dayanamıyorum, Ateş!"

## Sahne 2 – Ateş'in cevabı (10–20 sn) · referans `ref/s2.png`
Same living room, reverse shot. Close-up on Ateş, Asya's hair blurred in the left foreground. He speaks low and hard, then looks away at the end of the line. Asya is silent for two seconds; hold on Ateş as his eyes avoid hers.
**Ateş:** "Sen bu evde sadece babamın karısısın. Benden başka bir şey bekleme!"

## Sahne 3 – Nihat'ın müdahalesi (20–30 sn) · referans `ref/s3.png`
Nihat enters the living room from the doorway, crystal chandelier behind him. Authoritative, slow walk, then stops and looks at both. Medium shot, slight low angle. Cut-ins: Asya turns to him in surprise; Ateş clenches his jaw, hiding his anger.
**Nihat:** "İkiniz de artık şunu bilin! Bu evde kuralları ben koyarım."

## Sahne 4 – Asya'nın şüphesi (30–40 sn) · referans `ref/s4.png`
Asya alone in an ornate bedroom, bedside lamp glowing. She sits on the bed, hand over her mouth, holding back tears. She whispers the line, then opens the nightstand drawer and takes out the marriage contract. Insert close-up: as she flips the pages she notices an extra page she had never seen before. Her eyes widen.
**Asya (fısıltıyla):** "Bu evlilik gerçekten sadece bir anlaşma mıydı?"

## Sahne 5 – Ateş'in itirafı (40–50 sn) · referans `ref/s5.png`
Night, mansion terrace, city lights bokeh behind. Ateş alone, leaning on the railing, lost in thought. Very slow push-in. He looks up toward the single lit window of Asya's room.
**Ateş (kendi kendine, alçak sesle):** "Neden onu bu kadar önemsiyorum? Bu his neyin nesi?"

## Sahne 6 – Derin'in dönüşü (50–60 sn) · referans `ref/s6.png`
Night, mansion corridor, warm wall sconces. Asya (back to camera, right foreground) runs into Derin. Derin smiles coldly, calm and confident. After the line, cut to Asya's shocked face and push in fast. Just as she opens her mouth to answer, hard cut to black.
**Derin:** "Sakın unutma Asya… Ateş'in geçmişinde ben varım. Ve bu hikâye henüz bitmedi!"
**Ekran yazısı (siyah üzerine):** "DEVAM EDECEK…"

---

## Montaj talimatı
1. Sahneleri 1→6 sırasıyla, sahne değiştirmeden birleştir. Sahne içinde kesme yok; aralarda 0,2 sn siyaha geçiş.
2. Renk: tüm sahnelere aynı sıcak ton (hafif turuncu-kahve) ve aynı vinyet uygulanır. Gece sahneleri (5–6) biraz daha soğuk ama aynı kontrastta olmalı.
3. Ses: yalnızca diyalog; −16 LUFS'e normalize edilir. Müzik yok.
4. Çıkış: MP4 (H.264, yuv420p), 1080×1920, 30 fps.

Bu klasördeki `out/yasak-yemin-7.mp4`, bu planın 30 saniyelik bir taslağıdır: hareketli kareler ve dublaj içerir, dudak senkronu yoktur. Yukarıdaki promptlarla üretilen gerçek video klipler aynı kurguya yerleştirilebilir.
