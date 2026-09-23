# 🗺️ FasalSetu - Page & Component Architecture Guide

Welcome! If you are looking for a specific page or wondering how files are organized, this guide provides a direct directory map.

---

## Why does Next.js have files named `page.tsx`?
In Next.js 14 (App Router), every folder in `src/app/` represents a URL route, and Next.js **mandates** that the route entrypoint file must be named `page.tsx`.

To make development intuitive and avoid confusing identical `page.tsx` editor tabs, **every single page is cleanly implemented with its real, professional name inside `src/views/`**.

---

## 📍 Direct Page Directory Map

| Page | URL | Next.js Route Entry | 🎯 Where to Edit (Clear Name) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **🏠 Home Page** | `/` | `src/app/page.tsx` | [`src/views/HomePage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/HomePage.tsx) | Landing page, hero, 4 ways to see field, steps, crops |
| **📊 Dashboard** | `/dashboard` | `src/app/dashboard/page.tsx` | [`src/views/DashboardPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/DashboardPage.tsx) | Farmer dashboard, metrics, active alerts, quick actions |
| **🤖 KrishiBot AI** | `/ai-chat` | `src/app/ai-chat/page.tsx` | [`src/views/AiChatPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/AiChatPage.tsx) | Multi-lingual AI farming assistant with starter questions |
| **🛰️ Satellite** | `/satellite` | `src/app/satellite/page.tsx` | [`src/views/SatellitePage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/SatellitePage.tsx) | Mapbox live satellite imagery, NDVI history, stress alerts |
| **⛅ Weather** | `/weather` | `src/app/weather/page.tsx` | [`src/views/WeatherPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/WeatherPage.tsx) | 10-day forecast, storm alerts, smart irrigation advice |
| **✨ Features** | `/features` | `src/app/features/page.tsx` | [`src/views/FeaturesPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/FeaturesPage.tsx) | Catalog of all 14 farming tools |
| **❓ Help Center** | `/help` | `src/app/help/page.tsx` | [`src/views/HelpPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/HelpPage.tsx) | FAQs, guides, and WhatsApp agronomist support |
| **🔑 Login** | `/login` | `src/app/login/page.tsx` | [`src/views/LoginPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/LoginPage.tsx) | Farmer phone/password & WhatsApp OTP login |
| **📝 Register** | `/register` | `src/app/register/page.tsx` | [`src/views/RegisterPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/RegisterPage.tsx) | Farmer onboarding, language & crop selection |
| **🌾 My Farms** | `/farms` | `src/app/farms/page.tsx` | [`src/views/FarmsPage.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/views/FarmsPage.tsx) | List of registered farms with health scores |

---

## 🧩 Shared Components Directory (`src/components/`)

- [`Navbar.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/components/Navbar.tsx): Main top navigation bar with FasalSetu logo (links to `/`), language switcher (English, বাংলা, हिंदी), and quick links.
- [`AppLayout.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/components/AppLayout.tsx): Dashboard/app layout featuring responsive sidebar, mobile topbar, and FasalSetu logo (links to `/`).
- [`Footer.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/components/Footer.tsx): Footer with crop marquee, brand statement, and links.
- [`SourceBadge.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/components/SourceBadge.tsx): Provenance indicators for live vs. mock vs. satellite data.
- [`map/MapView.tsx`](file:///c:/1_personal_files/0_code/farming/frontend/src/components/map/MapView.tsx): Mapbox GL integration with polygon boundary drawing tools.
