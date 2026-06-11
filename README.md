# Google Maps API Key Tester

Project kecil static untuk mengetes apakah API key Google Maps JavaScript API bisa dipakai dari browser.

## Fitur

- Input API key manual.
- Tombol **Tes**.
- Hasil hijau jika Maps JavaScript API berhasil diload.
- Hasil merah jika gagal, dengan keterangan arti error.
- API key tidak disimpan ke server, localStorage, sessionStorage, cookie, atau file apa pun.

## Cara jalan lokal

Karena ini project static, cukup buka `index.html` atau jalankan server static kecil:

```bash
python -m http.server 3000
```

Lalu buka:

```txt
http://localhost:3000
```

## Deploy ke Vercel

Repo ini bisa langsung di-import ke Vercel sebagai static site. Tidak perlu environment variable karena API key diisi manual di UI saat testing.

## Catatan penting

Tester ini mengecek **Maps JavaScript API**. Kalau hasil gagal karena `RefererNotAllowedMapError`, tambahkan domain Vercel kamu ke HTTP referrer API key di Google Cloud Console, misalnya:

```txt
https://nama-project.vercel.app/*
```

Untuk production, tetap batasi API key dengan HTTP referrer agar tidak bebas dipakai sembarang website.
