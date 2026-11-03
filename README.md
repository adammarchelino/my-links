# My Links

Katalog bookmark pribadi dengan desain minimalis hitam-putih-abu-abu.

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Fitur saat ini

- Katalog 91 bookmark hasil impor Chrome
- Folder utama dengan accordion dan subfolder
- Pencarian berdasarkan nama, URL, deskripsi, dan kategori
- Filter bookmark favorit
- Tambah, edit, dan hapus bookmark
- Validasi dan normalisasi URL otomatis ke alamat absolut
- Klik seluruh card untuk membuka website
- Pengaturan urutan card dengan drag-and-drop
- Tombol naik/turun untuk pengaturan posisi di mobile
- Urutan custom tersimpan di localStorage
- Penyimpanan bookmark dan perubahan lokal tersimpan di localStorage
- Toggle mode terang/gelap
- Layout responsif desktop dan mobile

## Catatan arsitektur

Saat ini aplikasi berjalan sebagai prototipe lokal tanpa autentikasi atau database online. Data awal berada di `lib/data.js`, sedangkan perubahan pengguna tersimpan di browser melalui localStorage. Integrasi Supabase dan login Google belum diaktifkan.

## Setup berikutnya

Untuk mengaktifkan data permanen, login Google, impor Chrome, dan backup JSON, tambahkan Supabase setelah akun Supabase dan Google Cloud siap. Environment variable yang diperlukan nantinya:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
