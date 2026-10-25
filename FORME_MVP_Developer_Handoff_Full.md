# FORME

## MVP PRODUCT & DEVELOPER HANDOFF | VERSION 1.0 | 24 OCTOBER 2026

Mobile-first web app • Product requirements • UX and visual direction • Architecture • Data model • Delivery and testing

## 1. Executive Brief

FORME is a personal wardrobe and styling experience. Users digitise clothing they actually own, receive daily and weekly outfit suggestions, explore combinations, and gradually teach the product their preferences.

Pilot objective: A new user can create an account, photograph 20 garments, confirm extracted details, receive a week of wardrobe-only outfits, modify one outfit, and return later to see saved changes.

Product principle: Real inventory before artificial intelligence.

## 2. Scope Decisions

### P0 Must Ship
- Mobile responsive web app with account/session
- 5 tabs and onboarding
- Photo upload and editable garment metadata
- Persistent wardrobe
- Rule-based outfit suggestions
- 7-day planner and manual edits

### P1
- Background removal
- Video import
- Improved recognition
- Learning from feedback
- Weather/calendar integrations
- PWA support

### Out of Scope
- Native mobile apps
- 3D body scan / try-on
- Marketplace/payments
- Custom fashion AI model

## 3. Brand & Design Contract
- Palette: #241D17, #D5C5B0, #F4EDE3
- Editorial serif headlines + restrained sans-serif UI
- Full-screen fashion photography
- Five-tab bottom navigation
- Accessible controls >=44px

## 4. Navigation
Routes:
- /welcome
- /today
- /studio
- /wardrobe
- /week
- /you
- /login

## 5. Screen Specifications
### Today
Editorial hero, saved outfit, regenerate, save, studio.

### Studio
2D outfit composition with Tops, Bottoms, Outerwear, Footwear, Accessories.

### Wardrobe
Upload -> Review -> Save.

### My Week
Seven-day planner with lock/regenerate/edit.

### You
Lifestyle, Style, Colours, Fit/Size, Occasions, Climate, Goals.

## 6. End-to-End Workflows
- New user onboarding
- Add garment
- Generate outfit
- Edit outfit
- Remove garment
- Return visit

## 7. Technical Architecture
Frontend: React + TypeScript + Vite/Next.js
Backend: Supabase Auth, Postgres, Storage, RLS

## 8. Data Model
Tables:
- profiles
- preferences
- garments
- outfits
- outfit_items
- feedback
- upload_jobs

## 9. API Contracts
- POST /garments/upload-url
- POST /garments
- GET /garments
- PATCH /garments/:id
- POST /outfits/generate
- PATCH /outfits/:id
- GET /outfits
- GET/PATCH /preferences

## 10. Styling Algorithm
Inventory-only outfit generation with ranking, exclusions and feedback.

## 11. Photo Recognition
Manual metadata with optional vision API support.

## 12. Nonfunctional Requirements
Performance, accessibility, reliability, privacy, browser coverage and analytics.

## 13. Delivery Milestones
M0 through M5 covering alignment, shell, wardrobe, outfit engine, profile, QA.

## 14. Acceptance Tests
AT-01 through AT-15.

## 15. QA & Pilot
5–10 pilot users, task-based validation.

## 16. Development Workflow
Repository, component library, staging, migrations, testing and demos.

## 17. Decisions Before Coding
Accounts, styling presentation, recognition provider, studio approach, monetisation and image rights.

## 18. First Sprint
Project setup, onboarding, navigation, wardrobe, studio, week planner and profile screens.

FORME • Confidential working product specification • v1.0
