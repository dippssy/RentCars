# Redesign Plan: Fitur Tambahan LUXDRIVE

Berikut adalah rencana implementasi untuk menambahkan fitur visual yang direquest:

## 1. Navbar Liquid Glass Effect Saat Di-scroll
Saat ini, background navbar ketika di-scroll (`.navbar.scrolled`) memiliki opacity 90% sehingga terlihat hampir solid. 
- **Solusi**: Saya akan menurunkan opacity background menjadi lebih transparan (sekitar `0.4` - `0.6`) di Light Mode dan Dark Mode, serta mempertahankan/meningkatkan efek `backdrop-filter: blur(24px)` agar efek liquid glass-nya sangat terasa ketika melewati gambar/elemen di bawahnya.
- **File target**: `css/style.css` (Update nilai variabel `--nav-scrolled`)

## 2. Card Silver Glow Effect Saat Di-hover
Saat ini, `.glass-card` memiliki shadow bayangan hitam (`rgba(0,0,0,0.2)`) saat di-hover.
- **Solusi**: Saya akan menambahkan komposisi `box-shadow` baru pada bagian `:hover` di mana bagian bawah card akan memiliki pancaran/glow menggunakan variabel warna `--accent` (silver). Efek transform (naik ke atas) akan dipertahankan.
- **File target**: `css/style.css` (Update `.glass-card:hover`)

## 3. Testimonial Sticky Scroll Animation
Bagian "More Reviews" pada halaman Testimonial saat ini menggunakan layout `grid` (berjajar ke samping/bawah). Animasi "sticky scroll" biasanya merujuk pada efek di mana card saling bertumpuk (stacking) seiring user men-scroll halaman ke bawah.
- **Solusi**: Saya akan merubah layout grid pada bagian "More Reviews" menjadi tumpukan kolom (stack) di desktop. Masing-masing card akan diberi `position: sticky` dengan nilai `top` yang dinamis. Ketika user men-scroll ke bawah, card pertama akan tertahan di atas, lalu ditumpuk oleh card kedua, dan seterusnya.
- **File target**: `testimoni.html` (Mengubah layout grid) dan `css/style.css` (Menambahkan class khusus untuk animasi sticky stack).

> [!NOTE]
> Jika Anda memiliki preferensi lain tentang bagaimana "sticky scroll" pada testimoni ini berjalan (misalnya men-scroll ke samping/horizontal saat user men-scroll ke bawah), mohon sampaikan sebelum saya mulai. Jika tidak, saya akan menggunakan efek card bertumpuk (vertical sticky card stack) yang elegan.

## Open Questions / User Review Required
Apakah plan untuk efek tumpukan card (vertical stacking cards) pada bagian Testimoni di atas sudah sesuai dengan yang Anda maksud dengan "animasi sticky scroll"? 

Silakan approve plan ini (atau berikan revisi) dan saya akan segera mengeksekusinya!
