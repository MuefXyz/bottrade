# Panduan Penggunaan PumpHunter Wallet Bot

Panduan lengkap untuk pengguna bot Telegram PumpHunter: wallet Solana, Scanner Token, Scanning Wallet (copy-trade), pengaturan, dan posisi terbuka.

Versi dokumen: November 2026

## 1. Ringkasan fitur

- Wallet Solana dibuat langsung dari bot dan disimpan dalam bentuk terenkripsi.
- Scanner Token mendeteksi token baru sesuai filter milik masing-masing user.
- Scanning Wallet memantau wallet lain dan bisa auto-buy saat wallet target membeli token.
- Posisi terbuka menampilkan PnL dan bisa ditutup manual.
- Semua pengaturan trading disimpan per user di database dan diatur dari menu Pengaturan.

## 2. Persiapan awal

1. Buka bot di Telegram, lalu kirim perintah `/start`.
2. Pilih bahasa lewat tombol Bahasa (Indonesia / English).
3. Tekan Buat Wallet untuk membuat wallet Solana baru.
4. Simpan private key di tempat aman. Private key hanya ditampilkan oleh bot dan tidak bisa dipulihkan jika hilang.
5. Isi wallet dengan SOL sebelum melakukan transaksi live.
6. Buka Menu Utama lalu Pengaturan untuk menentukan nominal beli, TP, SL, dan filter scanner.

Penting: bot memakai wallet yang dibuat di dalam bot. Jangan pernah mengirim private key ke siapa pun, termasuk pihak yang mengaku sebagai admin.

## 3. Menu utama

Menu Utama berisi tombol berikut:

- Profile: menampilkan data user dan bahasa aktif.
- Wallet Detail: alamat wallet, saldo SOL terkini, tombol Refresh Saldo, dan private key.
- Scanner Token: panel pemantau token baru.
- Scanning Wallet: panel pemantau wallet dan copy-trade.
- Posisi Terbuka: daftar posisi yang masih berjalan.
- Pengaturan: semua nilai trading dan filter scanner.

### 3.1 Saldo wallet

Buka Wallet Detail untuk melihat saldo SOL wallet bot. Tekan Refresh Saldo untuk mengambil saldo terbaru dari jaringan Solana. Saldo diambil saat panel dibuka, jadi tidak ada pemantauan atau notifikasi otomatis.

## 4. Pengaturan

Semua nilai di bawah disimpan per user. Perubahan langsung dipakai untuk posisi berikutnya, termasuk saat scanner sedang berjalan.

### 4.1 Nilai trading

| Pengaturan | Default | Keterangan |
| --- | --- | --- |
| Nominal beli | 0.01 SOL | Nominal untuk copy-trade otomatis dan buy manual. Harus lebih dari 0. |
| Take Profit (TP) | 150% | Posisi ditutup otomatis saat PnL mencapai nilai ini. 0 berarti nonaktif. |
| Stop Loss (SL) | 0% | Posisi ditutup otomatis saat rugi mencapai nilai ini. 0 berarti nonaktif. |

### 4.2 Eksekusi dan risiko

| Pengaturan | Default | Keterangan |
| --- | --- | --- |
| Maks posisi | 5 | Maksimal posisi terbuka per user, bilangan bulat 1 sampai 100. |
| Umur posisi | 0 menit | Auto-close setelah umur tertentu. 0 berarti nonaktif. |
| Slippage | 15% | Toleransi slippage saat buy/sell on-chain, 0 sampai 100 persen. |
| Priority fee | 0.0001 SOL | Biaya prioritas transaksi, 0 sampai 1 SOL. |

### 4.3 Filter Scanner Token

| Pengaturan | Default | Keterangan |
| --- | --- | --- |
| Min market cap | 10.000 USD | Alert hanya untuk token dengan market cap minimal nilai ini. 0 berarti nonaktif. |
| Min dev buy | 2 SOL | Total pembelian dev yang diperlukan. 0 berarti nonaktif. |
| Window akumulasi | 60 menit | Lama waktu pengamatan akumulasi dev sejak token launch. 0 berarti hanya cek pembelian awal. |
| Jeda setelah alert | 15 menit | Jeda per user setelah satu alert terkirim. 0 berarti tanpa jeda. |

Catatan: filter market cap, dev buy, window, dan jeda berlaku per user. Dua user bisa memakai ambang yang berbeda pada saat yang sama.

## 5. Scanner Token

### 5.1 Memulai dan menghentikan

1. Buka Menu Utama lalu Scanner Token.
2. Tekan Start Scan. Panel menampilkan status, jumlah token yang dipantau, dan filter aktif.
3. Tekan Stop Scan untuk berhenti. Panel dan pesan alert akan dihapus.
4. Tombol Tutup menghapus panel tanpa memulai scan.

Scanner hanya mengirim alert ke chat yang menekan Start Scan. Tidak ada broadcast ke user lain.

### 5.2 Alert token baru

Alert berisi informasi token, dev buy, market cap, dan tombol berikut:

- Buy: membuka prompt untuk memasukkan nominal SOL. Pembelian ini manual dan tidak mengubah nominal default di Pengaturan.
- Stop Scan: menghentikan scanner.

Setelah alert terkirim, user tersebut memasuki masa jeda sesuai pengaturan Jeda setelah alert. User lain tetap menerima alert.

### 5.3 Mode gratis dan mode API key

- Tanpa PUMPPORTAL_API_KEY, scanner hanya memeriksa pembelian dev awal pada saat token terdeteksi.
- Dengan PUMPPORTAL_API_KEY, scanner juga mengikuti trade token baru untuk menghitung akumulasi dev selama window akumulasi.
- Stream trade memakai biaya dari PumpPortal (sekitar 0.01 SOL per 10.000 event).

### 5.4 Tips filter

- Filter terlalu ketat membuat alert jarang muncul. Mulai dari min market cap 2.500 sampai 10.000 USD.
- Window akumulasi 0 cocok jika hanya ingin menangkap dev buy awal.
- Jeda 1 sampai 5 menit berguna saat pasar sedang ramai agar tidak kebanjiran alert.

## 6. Scanning Wallet (copy-trade)

### 6.1 Menambah wallet target

1. Buka Menu Utama lalu Scanning Wallet.
2. Tekan Add Wallet.
3. Kirim alamat wallet Solana (format base58) sebagai pesan teks.
4. Maksimal 10 wallet per user. Wallet bisa dihapus lewat tombol Hapus.

### 6.2 Menjalankan pemantauan

1. Tekan Start Scan Wallet.
2. Bot memantau transaksi wallet target melalui RPC atau Helius.
3. Saat wallet target membeli token, bot melakukan buy otomatis memakai nominal, TP, SL, slippage, dan priority fee milik user.
4. Tekan Stop Scan Wallet untuk berhenti.

Satu posisi terbuka per user dan mint. Pembelian berulang pada token yang sama tidak menambah posisi baru.

### 6.3 Mode simulasi dan live

Mode diatur lewat variabel COPY_TRADE_DRY_RUN di file .env:

- true: simulasi. Posisi dan notifikasi dibuat tanpa transaksi on-chain.
- false: live. Buy dan sell dikirim on-chain dan memakai saldo SOL di wallet bot.

Selalu coba mode simulasi sebelum mengaktifkan mode live.

### 6.4 Batas posisi

Jumlah posisi terbuka dibatasi oleh pengaturan Maks posisi. Jika batas tercapai, buy otomatis berikutnya ditolak dan bot mengirim notifikasi.

## 7. Posisi terbuka

1. Buka Menu Utama lalu Posisi Terbuka.
2. Panel menampilkan token, nominal masuk, harga masuk, harga sekarang, dan PnL.
3. Setiap posisi memiliki tombol tutup untuk menjual secara manual.
4. Posisi juga bisa tertutup otomatis karena TP, SL, atau Umur posisi.

## 8. Alur penggunaan singkat

1. Start bot, pilih bahasa, dan buat wallet.
2. Isi Pengaturan: nominal, TP, SL, dan filter scanner.
3. Pilih salah satu alur:
   - Scanner Token: Start Scan, lalu pantau alert dan gunakan tombol Buy untuk membeli manual.
   - Scanning Wallet: tambahkan wallet target, lalu Start Scan Wallet untuk copy-trade otomatis.
4. Pantau Posisi Terbuka dan tutup manual bila perlu.

## 9. Keamanan dan risiko

- Trading crypto berisiko tinggi dan bisa menyebabkan kerugian total.
- Bot ini bukan nasihat keuangan. Semua keputusan trading adalah tanggung jawab pengguna.
- Jangan pernah membagikan private key atau file .env kepada siapa pun.
- Gunakan WALLET_ENCRYPTION_KEY yang kuat dan simpan cadangannya.
- Simulasi (dry run) sangat disarankan sebelum transaksi live.
- Bot tidak bertanggung jawab atas kerugian akibat penggunaan atau penyalahgunaan.

## 10. Pemecahan masalah

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| Bot tidak membalas | Proses bot berhenti atau koneksi Telegram bermasalah | Pastikan bot berjalan, lalu coba kirim /start lagi. |
| Wallet bot belum dibuat | Belum ada wallet | Buka Wallet Detail lalu tekan Buat Wallet. |
| Scanner tidak mengirim alert | Belum Start Scan, filter terlalu ketat, atau sedang jeda | Tekan Start Scan, longgarkan filter, atau tunggu masa jeda selesai. |
| Akumulasi dev buy tidak jalan | PUMPPORTAL_API_KEY kosong | Isi API key untuk mengaktifkan stream trade. |
| Copy-trade tidak membeli | Belum Start Scan Wallet, wallet target kosong, atau batas posisi tercapai | Tambahkan wallet, tekan Start Scan Wallet, dan cek Maks posisi. |
| Scanner berhenti setelah restart bot | Langganan scanner disimpan di memori | Tekan Start Scan atau Start Scan Wallet lagi. |
| Transaksi live gagal | Saldo SOL kurang atau RPC sibuk | Isi saldo wallet dan coba lagi. |
| Saldo di Wallet Detail tidak muncul | RPC sedang lambat atau tidak merespons | Tunggu lalu tekan Refresh Saldo. |

## 11. Catatan teknis

Pengaturan per user tidak lagi dibaca dari .env. Nilai default ada di kode dan bisa diubah lewat menu Pengaturan:

- src/copyTrade/config.ts untuk nominal, TP, SL, maks posisi, umur posisi, slippage, dan priority fee.
- src/scanner/config.ts untuk filter scanner.

.env hanya dipakai untuk rahasia, infrastruktur, dan saklar global seperti BOT_TOKEN, WALLET_ENCRYPTION_KEY, DATABASE_URL, SOLANA_RPC_URL, PUMPPORTAL_API_KEY, HELIUS_API_KEY, SCANNER_ENABLED, SCANNER_AUTOSTART, COPY_TRADE_ENABLED, dan COPY_TRADE_DRY_RUN.

## 12. Bantuan

Kirim /help kapan saja untuk menampilkan ringkasan menu dan fitur. Bot juga mengirim file PDF panduan ini, plus tombol Chat Admin untuk langsung membuka chat dengan admin. Untuk kendala teknis, sertakan tangkapan layar pesan error dan waktu kejadian agar lebih mudah ditelusuri.
