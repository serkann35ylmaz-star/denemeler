# Bu depoda çalışırken

Bu depo; Claude Code ajanları (`.claude/agents/`) ve becerileri (`.claude/skills/`) için ortak bir araç kutusudur. Her yeni projede bunları kullan:

- **Ajanlar (agency-agents + agent-skills):** İş bir uzmanlık alanına giriyorsa (frontend, backend, güvenlik, pazarlama, tasarım, test…) `.claude/agents/` içindeki uygun ajanı seç ve görevi ona ver.
- **Geliştirme süreci (addyosmani/agent-skills):** Yeni bir işe başlarken `using-agent-skills` ile uygun beceriyi seç: belirsiz isteklerde `interview-me` / `spec-driven-development`, kodlarken `incremental-implementation` + `test-driven-development`, birleştirmeden önce `code-review-and-quality`.
- **ponytail:** Kod yazarken en küçük, yeterli değişikliği tercih et.
- **graphify:** Büyük ya da yabancı bir kod tabanını anlamak için `/graphify .` (CLI gerekli: `uv tool install graphifyy`).
- **claudex-loop / claudex-route:** Planı Codex ile çapraz incelemek için (Codex CLI kurulu ve oturum açık olmalı).
- **unslop:** Yazılan metinleri yapay zekâ kalıplarından temizlemek için.
- **stil:** Görselden animasyonlu video stili çıkarmak için.

## Token tasarrufu (drona23/claude-token-efficient)
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Token araçları (oturum başında kurulu değildir)
- `rtk` (komut çıktısını sıkıştırır): `cargo install --git https://github.com/rtk-ai/rtk`
- `headroom` (bağlam sıkıştırma proxy'si): `uv tool install --python 3.13 "headroom-ai[all]"`
- `jcodemunch-mcp` (sembol düzeyinde kod okuma MCP'si, yalnız ticari olmayan kullanım): `uv tool install jcodemunch-mcp`
- `cto` (claude-token-optimizer): `npm install -g claude-token-optimizer`, sonra `cto measure`
- `claude-mem` (oturumlar arası hafıza; sağlayıcı: Anthropic planı, telemetri açık): `npx claude-mem install --provider claude`
