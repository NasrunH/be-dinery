
# Project Title

A brief description of what this project does and who it's for

# 🍽️ Dinery API

Dinery API adalah RESTful Backend API yang dirancang untuk mendukung aplikasi manajemen wishlist dan jurnal tempat makan bagi pasangan (couple).  
API ini memungkinkan pengguna menyimpan referensi tempat makan dari media sosial, mengelola wishlist bersama pasangan, mencatat riwayat kunjungan, serta memberikan ulasan.

---

## 🚀 Fitur Utama

- Authentication & Authorization (JWT)
- Manajemen Akun Pengguna
- Manajemen Couple (Pasangan)
- Wishlist Tempat Makan
- Random Place (Gacha)
- Radius Search (Nearby Places)
- Journal / Visit History & Review
- Sistem Tag (Global & Custom Tag)
- Notifikasi In-App
- Upload Media
- Admin Dashboard (Super Admin)

---

## 🛠️ Tech Stack

- Runtime: Node.js
- Framework: Express.js
- Database: PostgreSQL
- Authentication: JSON Web Token (JWT)
- Storage: Image Upload
- Architecture: RESTful API

---

## 📂 Struktur Proyek (Ringkas)

src/
├── controllers/
├── routes/
├── services/
├── middlewares/
├── models/
├── utils/
├── app.js
└── server.js

yaml
Copy code

---

## 🔐 Authentication

Semua endpoint (kecuali login & register) membutuhkan header berikut:

Authorization: Bearer <TOKEN>

yaml
Copy code

Token diperoleh dari endpoint login.

---

## 🌐 Base URL

http://localhost:5000/api

markdown
Copy code

---

## 📌 Endpoint Utama

### Authentication
- POST `/auth/register`
- POST `/auth/login`
- GET `/auth/me`
- PUT `/auth/profile`

### Couple Management
- GET `/couples/my-status`
- POST `/couples/create`
- POST `/couples/join`
- PUT `/couples`

### Wishlist / Places
- POST `/places/preview`
- POST `/places`
- GET `/places`
- GET `/places/nearby`
- GET `/places/gacha`
- PUT `/places/:id`
- DELETE `/places/:id`

### Journal / Visits
- POST `/visits`
- GET `/visits/history`

### Notifications
- GET `/notifications`
- PUT `/notifications/:id/read`

### Master Data
- GET `/master/categories`
- GET `/master/tags`
- POST `/master/tags`

### Storage
- POST `/storage/upload`

### Admin (Super Admin Only)
- GET `/admin/stats`
- GET `/admin/users`
- GET `/admin/users/:id`
- DELETE `/admin/users/:id`
- POST `/admin/categories`
- POST `/admin/tags`

---

## 📄 API Documentation

Dokumentasi API lengkap tersedia dalam file HTML:

api-docs.html

yaml
Copy code

Buka file tersebut melalui browser untuk melihat detail request dan response setiap endpoint.

---

## ⚙️ Environment Variables

Buat file `.env` dengan konfigurasi berikut:

PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/dinery
JWT_SECRET=your_jwt_secret

yaml
Copy code

---

## ▶️ Menjalankan Project

Install dependency:

npm install

yaml
Copy code

Menjalankan mode development:

npm run dev

yaml
Copy code

Menjalankan mode production:

npm start

yaml
Copy code

---

## 👤 Author

Nasrun Hidayatullah  
Backend Developer & System Analyst  
GitHub: https://github.com/NasrunH

---

## 📌 Status Project

🚧 In Development

---

## 📜 License

MIT License