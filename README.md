# PumpHunter Wallet Bot

Telegram bot untuk wallet Solana, scanner token, dan copy-trade wallet.
Dokumentasi produk ada di [PRD.md](./PRD.md), aturan pengembangan di [AGENT.md](./AGENT.md).

Panduan pengguna tersedia dalam dua format:

- [docs/panduan-penggunaan.md](./docs/panduan-penggunaan.md) — sumber Markdown
- [docs/Panduan-Penggunaan-PumpHunter-Bot.pdf](./docs/Panduan-Penggunaan-PumpHunter-Bot.pdf) — siap dibagikan

Regenerate PDF setelah mengubah panduan:

```bash
python3 -m venv /tmp/pdfvenv
/tmp/pdfvenv/bin/pip install reportlab
/tmp/pdfvenv/bin/python docs/build-panduan-pdf.py
```

## Stack

- Node.js 22 + TypeScript (ESM)
- [grammY](https://grammy.dev) — framework bot Telegram
- Prisma + SQLite (`prisma/dev.db`)
- Zod — validasi environment

## Setup

```bash
npm install
cp .env.example .env        # lalu isi BOT_TOKEN & WALLET_ENCRYPTION_KEY
npm run db:migrate          # buat database + Prisma client
npm run dev                 # jalankan bot (polling)
```

Perintah lain:

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Jalankan bot + auto-reload |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Jalankan hasil build |
| `npm test` | Jalankan test (node:test via tsx) |
| `npm run db:migrate` | Migrasi database |
| `npm run db:generate` | Regenerate Prisma client |

## Struktur

```
prisma/
  schema.prisma          # model User, WatchedWallet, dan CopyPosition
src/
  index.ts               # entry point
  bot.ts                 # instance bot + registrasi handler
  config.ts              # validasi env (.env)
  db.ts                  # Prisma client singleton
  i18n.ts                # teks Bahasa Indonesia / English
  keyboards/             # reply & inline keyboard
  handlers/              # /start, /help, language, wallet, menu
  services/              # user & wallet (generate + enkripsi AES-256-GCM)
test/                    # unit test (i18n, base58, wallet)
```

## Fitur saat ini

- `/start` — welcome + disclaimer **+18** + menu reply keyboard
- `/help` — bantuan singkat + panduan PDF + tombol **Chat Admin**
- **Language** — pilih Indonesia / English (disimpan di DB)
- **Create Wallet** — generate wallet Solana, tampilkan alamat + private key,
  dan minta konfirmasi bila wallet sudah ada
- **Wallet Detail** — alamat, saldo SOL terkini (tombol Refresh Saldo), dan
  private key
- **Menu Utama** — inline keyboard Profile, Wallet Detail, Scanner Token,
  Scanning Wallet, Posisi Terbuka & Pengaturan
- **Pengaturan** — atur nominal beli (SOL), TP, SL, maks posisi, umur posisi,
  slippage, priority fee, serta filter Scanner Token (min market cap, min dev
  buy, window akumulasi, jeda alert) secara terpusat
- **Scanner Token** (PumpPortal) — deteksi token baru + filter dev buy & market cap
  per user, alert privat ke setiap chat yang menekan Start Scan (multi-user,
  tanpa broadcast).
- **Scanning Wallet** — pantau beberapa wallet, deteksi pembelian token via RPC,
  lalu auto-buy sesuai pengaturan user (simulasi atau live).

## Pengaturan (terpusat)

Buka `🏠 Menu Utama → ⚙️ Pengaturan`. Panel ini berisi:

- **💸 Atur Nominal** — nominal beli dalam SOL (contoh `0.01` atau `0,05`)
- **🎯 Atur TP** / **🛑 Atur SL** — persen PnL (contoh `50`, `12.5`, atau `0`
  untuk menonaktifkan)
- **📊 Atur Maks Posisi** — maksimal posisi terbuka per user (1-100)
- **⏳ Atur Umur Posisi** — auto-close posisi setelah X menit (`0` = nonaktif)
- **💧 Atur Slippage** — slippage eksekusi dalam persen (0-100)
- **⛽ Atur Priority Fee** — priority fee transaksi dalam SOL
- **📊 Atur Min MCap** — filter market cap minimum alert scanner (USD, `0` = mati)
- **💸 Atur Min Dev Buy** — ambang total pembelian dev (SOL, `0` = mati)
- **⏱ Atur Window** — lama window akumulasi dev sejak token launch (menit)
- **⏸ Atur Jeda** — jeda per chat setelah satu alert terkirim (menit, `0` = tanpa jeda)

Semua nilai di atas disimpan di database per user dengan default dari kode
(lengkapnya ada di `src/copyTrade/config.ts` dan `src/scanner/config.ts`), jadi
tidak perlu diatur lewat `.env`.

Nilai disimpan per user dan dipakai untuk semua posisi berikutnya, baik dari
copy-trade otomatis maupun buy manual di Scanner Token. Filter scanner juga
berlaku per user: dua user bisa memakai ambang market cap/dev buy yang berbeda.
Panel **Scanning Wallet** hanya menampilkan nilai tersebut (read-only) — tidak
ada input nominal/TP/SL di sana.


## Scanner (PumpPortal)

Buka `🏠 Menu Utama → 🔎 Scanner Token`; panel scanner dikirim sebagai **pesan
baru** sehingga pesan Menu Utama tetap utuh. Saat berjalan, scanner berlangganan
event `subscribeNewToken` (gratis). Bila `PUMPPORTAL_API_KEY` diisi, scanner juga
berlangganan trade token baru (`subscribeTokenTrade`, berbayar 0.01 SOL / 10.000
event) untuk mengakumulasi pembelian dev selama window akumulasi user.

Alur filter (nilai diambil dari `⚙️ Pengaturan` tiap user):

1. Token baru masuk → cek market cap (`marketCapSol × harga SOL`) ≥ min market cap user.
2. `initialBuy` dev ≥ min dev buy user → langsung alert.
3. Jika belum, akumulasi pembelian dev sampai window user habis (butuh API key).
4. Alert terkirim → **chat penerima** dijeda sesuai pengaturan user (user lain tetap jalan).
5. Tanpa API key, hanya `initialBuy` yang dicek (akumulasi tidak tersedia).

Scanner bersifat multi-user: setiap chat yang menekan **▶️ Start Scan** menjadi
pelanggan alert untuk chat itu sendiri. Tidak ada `ALERT_CHAT_IDS` dan tidak ada
broadcast — alert satu user tidak pernah dikirim ke user lain. Stop dari satu
chat hanya mengeluarkan chat tersebut; koneksi PumpPortal tetap hidup selama
masih ada pelanggan lain.

Alert memakai bahasa tersimpan user (`id`/`en`) dan **meng-edit satu pesan
notifikasi** yang sama, bukan mengirim pesan baru tiap token. Yang di-edit adalah
**pesan panel scanner** (bukan pesan Menu Utama). Tombol **⏹ Stop Scan**
menghentikan langganan chat tersebut sekaligus menghapus pesan notifikasinya.

Setiap alert juga punya tombol **💸 Buy** untuk beli **manual** (tidak pernah
otomatis): tekan Buy → kirim nominal dalam SOL (contoh `0.01`) → bot langsung
mengeksekusi buy untuk token tersebut. Nominal hanya berlaku untuk pembelian itu
dan tidak mengubah pengaturan scanning wallet. Posisi hasil buy muncul di
`🏠 Menu Utama → 📈 Posisi Terbuka` dan bisa ditutup manual dari sana.

Panel scanner punya tombol **▶️ Start Scan** / **⏹ Stop Scan**, plus **❌ Tutup**
saat scan belum berjalan untuk menghapus panel tanpa memulai scan. Statistik dan
filter di panel ikut diperbarui saat alert masuk. Untuk membuka panel lagi,
gunakan `🏠 Menu Utama → 🔎 Scanner Token`.

## Scanning Wallet (copy-trade)

Buka `🏠 Menu Utama → 🧲 Scanning Wallet`. Panel dikirim sebagai **pesan baru**.

Untuk melihat semua posisi yang sedang terbuka (lengkap dengan PnL terkini dan
tombol close per token), buka `🏠 Menu Utama → 📈 Posisi Terbuka`. Panel ini
**auto-refresh tiap 10 detik** dan punya tombol **⬅️ Kembali** ke menu utama.

Alur:

1. **➕ Add Wallet** → kirim alamat wallet Solana (base58) sebagai pesan teks.
   Bisa menambahkan beberapa wallet (maksimal 10 per user).
2. Atur nominal beli, TP, dan SL dari `🏠 Menu Utama → ⚙️ Pengaturan`
   (lihat bagian **Pengaturan** di atas).
3. **▶️ Start Scan Wallet** → bot mulai memantau semua wallet tersebut.
4. Saat wallet pantauan **membeli token**, bot otomatis membeli token yang sama
   dengan nominal yang sudah diatur.
5. Posisi dipantau untuk **TP/SL/max age**; saat terpenuhi bot menjual 100%.
6. Notifikasi trade berupa **satu board live** per chat: PnL diperbarui berkala
   dan setiap token punya tombol **❌ Tutup** untuk close manual.
7. **⏹ Stop Scan Wallet** menghentikan scan sekaligus menghapus panel Scanning
   Wallet dan board notifikasi trade. Menu utama tetap ada.
8. Kalau belum jadi memulai scan, tekan **❌ Tutup** untuk menghapus panel tanpa
   mengubah pengaturan atau wallet yang sudah ditambahkan.

TP/SL memakai nilai yang disimpan user lewat `⚙️ Pengaturan`. Bila user belum
pernah mengatur, bot memakai fallback default di kode (nominal `0.01` SOL, TP
`150%`, SL nonaktif). Setiap posisi menyimpan ambangnya saat dibuka, jadi
perubahan pengaturan hanya berlaku untuk posisi berikutnya.

Deteksi pembelian memakai polling RPC (`getSignaturesForAddress` +
`getParsedTransaction`): saldo token owner naik dan ada nilai keluar dari wallet,
baik SOL maupun quote token (USDC/USDT/WSOL). Wallet baru di-baseline ke
transaksi terbaru, jadi transaksi lama tidak ikut di-copy. Bila `HELIUS_API_KEY`
diisi, RPC otomatis memakai endpoint Helius (lebih stabil).

Mode eksekusi:

- `COPY_TRADE_DRY_RUN=true` → **simulasi**: posisi & notifikasi dibuat tanpa
  transaksi on-chain. Cocok untuk uji alur.
- `COPY_TRADE_DRY_RUN=false` → **live**: buy/sell via **PumpPortal Local
  Transaction API** (`/api/trade-local`), ditandatangani lokal dengan private key
  wallet user, lalu dikirim ke RPC. Butuh saldo SOL di wallet bot.

Aturan posisi:

- Satu posisi open per user + mint (pembelian berulang tidak menumpuk).
- Maksimal posisi open per user mengikuti `📊 Atur Maks Posisi` di `⚙️ Pengaturan`
  (default 5).
- TP/SL dihitung dari harga token (DexScreener) terhadap harga masuk.
- Bila user mengatur TP/SL ke `0` lewat `⚙️ Pengaturan`, fitur tersebut nonaktif.
- `⏳ Atur Umur Posisi` = `0` menonaktifkan auto-close berdasarkan umur.
- `💧 Atur Slippage` dan `⛽ Atur Priority Fee` dipakai saat buy/sell on-chain.

Notifikasi trade memakai bahasa user dan **meng-edit satu pesan** yang sama
(tidak spam). Panel Scanning Wallet tetap terpisah dan bisa dibuka lagi kapan
saja. Stop hanya menghentikan chat tersebut; selama masih ada user lain yang
running, watcher tetap hidup.

| Env | Fungsi |
| --- | --- |
| `ADMIN_ID` | ID angka atau `@username` admin untuk tombol **Chat Admin** di Bantuan (kosong = tombol disembunyikan) |
| `SCANNER_ENABLED` | Matikan total fitur scanner |
| `SCANNER_AUTOSTART` | Hubungkan scanner saat bot boot (alert tetap hanya ke chat yang Start) |
| `PUMPPORTAL_API_KEY` | Aktifkan stream trade (akumulasi dev buy) |
| `COPY_TRADE_ENABLED` | Matikan total fitur scanning wallet |
| `COPY_TRADE_DRY_RUN` | `true` = simulasi, `false` = transaksi on-chain |
| `COPY_TRADE_POOL` | Pool target: `auto`, `pump`, `pump-amm`, ... |
| `COPY_TRADE_RPC_POLL_MS` | Interval polling transaksi wallet (ms) |
| `COPY_TRADE_POLL_SECONDS` | Interval cek harga TP/SL (detik) |
| `COPY_TRADE_PROVIDER` | `auto`, `rpc`, `helius`, atau `pumpportal` |
| `HELIUS_API_KEY` | Opsional: RPC Helius untuk polling lebih stabil |

Pengaturan per user (nominal, TP/SL, maks posisi, umur posisi, slippage,
priority fee, dan filter scanner) **tidak lagi dibaca dari `.env`**. Semuanya
diatur lewat `⚙️ Pengaturan` dan disimpan di database.
