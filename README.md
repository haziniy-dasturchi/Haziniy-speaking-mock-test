# Haziniy Speaking Mock — CEFR Multilevel Speaking Test Web App

Haziniy O'quv Markazi (Farg'ona, O'zbekiston) uchun maxsus ishlab chiqilgan to'liq funksional **CEFR Multilevel Speaking Mock Test** tizimi.

Ushbu platforma orqali o'qituvchilar real kompyuter-asosidagi CEFR Multilevel Speaking imtihoni (NCL Mock Test uslubi) ko'rinishidagi testlarni yaratishi, audio va rasmlarni kiritishi, taymerlarni sozlashi va sinf xonasidagi katta ekran / proyektorlarda o'tkazishi mumkin.

---

## 🌟 Asosiy xususiyatlar

- **100% Bepul xizmatlar (Free-Tier):** Neon Serverless Postgres, Cloudinary Media Storage va Cloudflare Workers.
- **Proyektor uchun 16:9 Exam Player:**
  - Katta o'lchamli shriftlar (1920x1080 va 1366x768 ga moslashtirilgan).
  - Yuqori markazda yashil progress indikatori (`1.  2.  3.`) va tugallangan qismlar uchun belgi.
  - Silliq aylanuvchi katta doiraviy taymer (Preparation & Speak now).
  - Haqiqiy Web Audio API ovozli signallari: tayyorgarlikdan so'ng 1000 Hz signal (beep) va vaqt tugash signali.
  - Audio yuklanmagan savollar uchun avtomatik brauzer SpeechSynthesis (TTS) ovozli o'qish imkoniyati.
  - Javob berish bosqichida jonli vizual soundwave (ovoz to'lqini) animatsiyasi.
  - Imtihon o'rtasida to'xtab qolmasligi uchun barcha media fayllarni oldindan to'liq xotiraga yuklash (Preloading).
  - O'qituvchi boshqaruv paneli (Pause/Resume, Keyingi, Oldingi, Qayta boshlash, To'liq ekran) va klaviatura yorliqlari.
- **Rasmiy 4 ta imtihon bo'limi:**
  - **Part 1.1:** 3 ta qisqa shaxsiy savol (5s prep, 30s answer).
  - **Part 1.2:** 2 ta yonma-yon rasm va savollar (5s prep, 30s answer).
  - **Part 2:** 1 ta asosiy rasm va bir vaqtning o'zida ko'rsatiladigan 3 ta savol (60s prep, 120s answer).
  - **Part 3:** Mavzu bayonoti (Topic) + FOR (3 ta dalil) va AGAINST (3 ta dalil) jadvallari (60s prep, 120s answer).
- **Xavfsiz va tezkor arxitektura:**
  - Web Crypto PBKDF2-SHA256 parol xeshlash (Cloudflare Workers bepul rejasidagi CPU limitlariga to'liq mos).
  - Imzolangan HTTP-only sessiya kukisi (`jose` JWT).
  - Cloudinary-ga to'g'ridan-to'g'ri brauzerdan imzolangan yuklash (Signed Upload — API maxfiy kaliti serverdan chiqmaydi).
  - Savol, bo'lim yoki mock o'chirilganda Cloudinary-dagi barcha audio va rasm fayllarini avtomatik tozalash.

---

## 🛠 Texnologiyalar to'plami

- **Frontend & Backend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Database:** Neon Serverless PostgreSQL + Drizzle ORM (`@neondatabase/serverless` HTTP driver)
- **Deployment:** Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)
- **Fayl saqlash:** Cloudinary (Signed Direct Uploads)
- **Autentifikatsiya:** Custom credentials auth (Web Crypto PBKDF2 + jose JWT)

---

## 📋 Tizim talablari

- **Node.js**: v20.x yoki v22+ (v24 ham qo'llab-quvvatlanadi)
- **npm** yoki **pnpm**

---

## 🚀 O'rnatish va mahalliy ishga tushirish (Local Setup)

### 1. Loyihani yuklab olish va paketlarni o'rnatish

```bash
git clone <repo-url>
cd "Speaking mock test"
npm install
```

### 2. Muhit o'zgaruvchilarini sozlash

Loyiha ildizida `.env.example` faylidan nusxa olib, `.env` faylini yarating:

```bash
cp .env.example .env
```

`.env` faylidagi o'zgaruvchilarni to'ldiring:

```env
# Neon Postgres ma'lumotlar bazasi havolasi
DATABASE_URL=postgresql://neondb_owner:parol@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require

# JWT sessiyani imzolash uchun kalit (kamida 32 ta belgi)
SESSION_SECRET=haziniy_super_secret_jwt_session_key_32_chars_min_secure

# Cloudinary hisob ma'lumotlari
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Boshlang'ich tizim ma'muri (Admin) hisobi
ADMIN_LOGIN=admin
ADMIN_PASSWORD=HaziniyAdmin2026!
```

---

## ☁️ Bepul xizmatlarni ulash bo'yicha qo'llanma

### 1. Neon Serverless Postgres (Ma'lumotlar bazasi)
1. [neon.tech](https://neon.tech) saytiga kiring va bepul ro'yxatdan o'ting.
2. Yangi loyiha (Project) yarating (masalan: `haziniy-mock-db`).
3. Dashboard-da berilgan **Connection string** (Postgres URL) ni nusxalab oling.
4. `.env` faylidagi `DATABASE_URL` parametriga qo'ying (`?sslmode=require` bilan).

### 2. Cloudinary (Rasm va audio saqlash)
1. [cloudinary.com](https://cloudinary.com) saytidan bepul hisob oching.
2. Dashboard-dan quyidagi 3 ta parametrni oling:
   - **Cloud Name** -> `CLOUDINARY_CLOUD_NAME`
   - **API Key** -> `CLOUDINARY_API_KEY`
   - **API Secret** -> `CLOUDINARY_API_SECRET`
3. Ushbu qiymatlarni `.env` fayliga yozing.

### 3. Cloudflare (Domen va bepul joylashtirish)
1. [cloudflare.com](https://cloudflare.com) saytidan bepul hisob oching.
2. Kompyuteringizda Wrangler orqali Cloudflare hisobingizga kiring:
   ```bash
   npx wrangler login
   ```

---

## 🗄 Ma'lumotlar bazasini tayyorlash va Admin yaratish

Jadvallarni yaratish va dastlabki Admin hisobini faollashtirish uchun:

```bash
npm run db:seed
```

Ushbu buyruq:
1. `users`, `mocks`, `parts` va `questions` jadvallarini avtomatik barpo etadi.
2. `.env` dagi `ADMIN_LOGIN` va `ADMIN_PASSWORD` bo'yicha boshqaruvchi (Admin) hisobini yaratadi.

---

## 💻 Mahalliy rejimda ishga tushirish

```bash
npm run dev
```

Brauzerda oching: [http://localhost:3000](http://localhost:3000)

1. `/login` sahifasiga yo'naltirilasiz.
2. Admin login va parolini kiriting (standart: `admin` / `HaziniyAdmin2026!`).

---

## 👥 O'qituvchilarni qo'shish va boshqarish

1. Admin sifatida tizimga kiring.
2. Yuqori menyudan **"O'qituvchilar"** bo'limiga o'ting (`/admin/teachers`).
3. **"Yangi o'qituvchi qo'shish"** tugmasini bosing:
   - O'qituvchining F.I.SH.
   - Login (masalan: `rustam_teacher`)
   - Parol (kamida 6 ta belgi)
4. Yaratilgan hisob ma'lumotlarini o'qituvchiga taqdim eting.
5. O'qituvchi o'z logini bilan kirganda faqat o'ziga tegishli mock testlarni ko'radi, tahrirlaydi va ishga tushiradi.

---

## 🎯 Mock Test yaratish va Presentation Mode

1. **"Yangi mock yaratish"** tugmasini bosing (Sarlavha va darajani belgilang, masalan: `CEFR Mock #1`, `B1–C1`).
2. Har bir qism uchun savollarni kiriting:
   - **Part 1.1:** 3 ta shaxsiy savol matni va audiosi.
   - **Part 1.2:** 2 ta rasmni yuklang va taqqoslash savolini yozing.
   - **Part 2:** 1 ta asosiy rasm va 3 ta savol matni.
   - **Part 3:** Mavzu bayonoti, 3 ta "Points FOR" va 3 ta "Points AGAINST" bandlari.
3. Test to'liq tayyor bo'lgach, **"Tayyor deb belgilash"** tugmasini bosing (tizim barcha rasmlar va savollar to'liqligini avtomatik tekshiradi).
4. **"Ishga tushirish"** yoki **"Ko'rish (Preview)"** tugmasini bosib proyektorda darsni boshlang!

### Proyektor / Katta ekran boshqaruvi:
- `Space` — Pauza / Davom ettirish
- `→` (O'ng strelka) — Keyingi savol / Keyingi bosqich
- `←` (Chap strelka) — Oldingi savol / Oldingi bosqich
- `F` — To'liq ekran rejimi (Fullscreen)
- `Esc` — Imtihondan chiqish

---

## 🌐 Cloudflare Workers-ga joylashtirish (Deploy)

Loyiha Cloudflare OpenNext adapteri orqali Cloudflare Workers bepul rejasiga to'liq moslangan:

```bash
# 1. Cloudflare uchun loyihani qurish
npm run cf-build

# 2. To'g'ridan-to'g'ri Cloudflare-ga yuklash (Deploy)
npm run cf-deploy
```

Yoki Wrangler orqali sinab ko'rish:
```bash
npm run cf-preview
```

> **Eslatma:** Cloudflare Dashboard-da o'z loyihangizning **Settings -> Variables and Secrets** bo'limiga `.env` dagi barcha o'zgaruvchilarni (`DATABASE_URL`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) qo'shishni unutmang.
# Haziniy-speaking-mock-test
