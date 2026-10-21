# Laporan Proyek: StoraWeb (Platform Manajemen Penyimpanan Berbasis Web)

**Tanggal:** 22 Oktober 2026  
**Status:** Selesai (MVP & GA Foundation)  

---

## 1. Ringkasan Eksekutif
**StoraWeb** adalah platform manajemen penyimpanan dan sistem operasi NAS berbasis web modern yang terinspirasi dari TrueNAS. Platform ini dirancang dengan antarmuka yang bersih, intuitif, mendukung **Bahasa Indonesia** secara penuh sejak hari pertama, serta dilengkapi dengan wizard terpandu untuk memudahkan pengguna pemula maupun profesional IT dalam mengelola server penyimpanan, pool ZFS, dataset, berbagi file (SMB/NFS), snapshot, dan pemantauan sistem secara real-time.

---

## 2. Arsitektur & Teknologi

| Komponen | Teknologi | Keterangan |
| --- | --- | --- |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, SQLite | Menyediakan REST API lengkap dan WebSocket untuk event/job real-time |
| **Storage Engine** | OpenZFS (Linux) | Mesin filesystem utama dengan dukungan pool, vdev (mirror, raidz), dataset, dan snapshot |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide Icons | Single Page Application (SPA) responsif dengan dukungan mode gelap/terang |
| **Background Tasks** | APScheduler | Penjadwalan otomatis untuk scrub, snapshot, dan tes S.M.A.R.T. |

---

## 3. Fitur Utama yang Telah Diimplementasikan

1. **Autentikasi & Kontrol Akses (RBAC):**
   - Login JWT dengan enkripsi sandi aman (`bcrypt`).
   - Manajemen peran (Admin, Operator, Readonly, Share Admin).
   - Kebijakan keamanan sandi dan fitur penguncian akun (*account lockout*).

2. **Manajemen Disk & Pool ZFS (P0):**
   - Pemindaian disk otomatis (`lsblk`).
   - Wizard pembuatan pool dengan dukungan konfigurasi Stripe, Mirror, RAID-Z1, RAID-Z2, dan RAID-Z3.
   - Operasi lanjutan: Scrub pool, perluasan vdev, penggantian disk (resilver), ekspor/impor pool.
   - Konfirmasi destruktif berlapis (wajib mengetik nama pool/dataset untuk menghapus).

3. **Dataset & Snapshot:**
   - Pembuatan dataset dan zvol dengan preset (Umum, SMB, Aplikasi, Media).
   - Pengaturan kompresi (`LZ4`, `ZSTD`), dedup, kuota, dan reservasi ruang.
   - Snapshot manual/terjadwal serta pemulihan cepat (*rollback*).

4. **Layanan Berbagi File (Sharing):**
   - Berbagi file via protokol SMB (dukungan *guest access*, *recycle bin*, *time machine*) dan NFSv3/v4.
   - Penjelajah sesi aktif dan *one-click copy* jalur jaringan (UNC Path).

5. **Pemantauan & Peringatan (Monitoring & Alerts):**
   - Dashboard sistem *real-time* (CPU, Memori, I/O Jaringan, Pool Status).
   - Pemantauan kesehatan disk S.M.A.R.T. dan pengujian berkala.
   - Sistem peringatan berjenjang (Info, Warning, Critical) dengan kanal notifikasi.

6. **Internasionalisasi (i18n):**
   - Dukungan dwibahasa penuh: **Bahasa Indonesia** dan **English**.

---

## 4. Panduan Menjalankan Aplikasi

### A. Menjalankan Backend (FastAPI)
```bash
cd backend
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

### B. Menjalankan Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
Akses antarmuka web di browser melalui: **http://localhost:3000**

### C. Kredensial Administrator Bawaan
- **Username:** `admin`
- **Password:** `StoraAdmin123!`

---

## 5. Pengujian dan Verifikasi
Seluruh modul backend utama telah lulus pengujian otomatis menggunakan `pytest`:
- Pengujian Otentikasi & RBAC (`test_auth.py`)
- Pengujian Manajemen Disk, Pool ZFS, Dataset, & Snapshot (`test_storage.py`)
- Pengujian Berbagi File SMB/NFS (`test_shares.py`)
- Pengujian Dashboard & Sistem Peringatan (`test_alerts_dashboard.py`)
