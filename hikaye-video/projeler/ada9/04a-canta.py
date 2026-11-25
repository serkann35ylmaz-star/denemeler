#!/usr/bin/env python3
"""04a: enkaza tutunan Kemal'e sırt çantası giydirir. Karakter yeniden çizilmez; çantanın iki yanı omuzların arkasında görünür, göğüste iki askı geçer.
Kullanım: python3 04a-canta.py <04a-orijinal.jpg> <cikti.jpg>"""
import sys, cv2, numpy as np
im = cv2.imread(sys.argv[1]); H, W = im.shape[:2]
S = 1 / 0.7; Y0 = 1100
def P(x, y): return (int(x * S), int(Y0 + y * S))
def pts(a): return np.array([P(*p) for p in a], np.int32)
# kişi maskesi (baş + gövde + kollar): çanta bunların ARKASINDA kalır
person = np.zeros((H, W), np.uint8)
cv2.fillPoly(person, [pts([(300, 300), (330, 262), (415, 240), (735, 255), (800, 290), (850, 380), (900, 470), (940, 520), (940, 700), (200, 700), (185, 520), (215, 400), (255, 340)])], 255)
cv2.circle(person, P(577, 173), int(166 * S), 255, -1)
person = cv2.dilate(person, np.ones((7, 7), np.uint8))
# --- çanta gövdesi (arkada) ---
bag = np.zeros((H, W, 4), np.float32)
def rrect(img, x0, y0, x1, y1, r, col):
    cv2.rectangle(img, (x0 + r, y0), (x1 - r, y1), col, -1, cv2.LINE_AA); cv2.rectangle(img, (x0, y0 + r), (x1, y1 - r), col, -1, cv2.LINE_AA)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)): cv2.circle(img, (cx, cy), r, col, -1, cv2.LINE_AA)
x0, y0 = P(272, 148); x1, y1 = P(885, 360); r = int(92 * S)
m_out = np.zeros((H, W), np.uint8); rrect(m_out, x0 - 9, y0 - 9, x1 + 9, y1 + 9, r + 9, 255)      # siyah kontur
m_in = np.zeros((H, W), np.uint8); rrect(m_in, x0, y0, x1, y1, r, 255)
vis_out = cv2.bitwise_and(m_out, cv2.bitwise_not(person)); vis_in = cv2.bitwise_and(m_in, cv2.bitwise_not(person))
col = np.zeros((H, W, 3), np.float32); col[:] = (30, 33, 38)
yy = np.arange(H, dtype=np.float32)[:, None]; xx = np.arange(W, dtype=np.float32)[None, :]
shade = 0.8 + 0.55 * np.clip(1 - (yy - y0) / max(1, y1 - y0), 0, 1) * np.clip(1.15 - np.abs((xx - (x0 + x1) / 2) / max(1, (x1 - x0) / 2)), 0, 1)
col *= shade[..., None]
# kumaş dokusu: ince dikey dikişler + nem parlaması
for k in range(x0 + 40, x1, 46): cv2.line(col, (k, y0 + 10), (k - 6, y1), (52, 56, 62), 2, cv2.LINE_AA)
rng = np.random.default_rng(7); noise = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 2.2) - .5; col += noise[..., None] * 26
a_out = cv2.GaussianBlur(vis_out.astype(np.float32), (0, 0), 1.0)[..., None] / 255; a_in = cv2.GaussianBlur(vis_in.astype(np.float32), (0, 0), 1.0)[..., None] / 255
out = im.astype(np.float32)
out = out * (1 - a_out) + np.array([8, 8, 10], np.float32) * a_out
out = out * (1 - a_in) + np.clip(col, 0, 255) * a_in
# --- askılar (önde, gömleğin üstünde) ---
def strap(path, w):
    m = np.zeros((H, W), np.uint8); p = pts(path)
    cv2.polylines(m, [p], False, 255, int(w * S) + 14, cv2.LINE_AA, 0)
    for q in p: cv2.circle(m, tuple(int(v) for v in q), (int(w * S) + 14) // 2, 255, -1, cv2.LINE_AA)
    mi = np.zeros((H, W), np.uint8); cv2.polylines(mi, [p], False, 255, int(w * S), cv2.LINE_AA, 0)
    for q in p: cv2.circle(mi, tuple(int(v) for v in q), int(w * S) // 2, 255, -1, cv2.LINE_AA)
    return m, mi
# suyun altına inmesin: su çizgisi ~ y=495 (ekran)
for path in ([(398, 262), (422, 330), (440, 410), (447, 492)], [(748, 272), (728, 340), (708, 420), (698, 492)]):
    mo, mi = strap(path, 44)
    clip = np.zeros((H, W), np.uint8); clip[:int(Y0 + 497 * S), :] = 255
    mo = cv2.bitwise_and(mo, clip); mi = cv2.bitwise_and(mi, clip)
    ao = cv2.GaussianBlur(mo.astype(np.float32), (0, 0), 1.0)[..., None] / 255; ai = cv2.GaussianBlur(mi.astype(np.float32), (0, 0), 1.0)[..., None] / 255
    sc = np.zeros((H, W, 3), np.float32); sc[:] = (34, 37, 42)
    sc += (cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 1.6)[..., None] - .5) * 24
    out = out * (1 - ao) + np.array([8, 8, 10], np.float32) * ao
    out = out * (1 - ai) + np.clip(sc, 0, 255) * ai
    # kenarda açık dikiş çizgisi
    edge = cv2.morphologyEx(mi, cv2.MORPH_GRADIENT, np.ones((5, 5), np.uint8)); ae = cv2.GaussianBlur(edge.astype(np.float32), (0, 0), 1.0)[..., None] / 255 * 0.38
    out = out * (1 - ae) + np.array([95, 100, 108], np.float32) * ae
    # ıslaklık parlaması
    hl = np.zeros((H, W), np.uint8); cv2.polylines(hl, [pts(path) + np.array([int(7 * S), 0])], False, 255, 4, cv2.LINE_AA)
    hl = cv2.bitwise_and(hl, mi); ah = cv2.GaussianBlur(hl.astype(np.float32), (0, 0), 1.2)[..., None] / 255 * 0.5
    out = out * (1 - ah) + np.array([170, 175, 182], np.float32) * ah
cv2.imwrite(sys.argv[2], np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam')
