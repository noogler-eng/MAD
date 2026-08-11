# MAD

Mobile App Development — learning + build workspace. Ek jagah 5 related sub-projects hain: ek RN app,
uska backend, ek self-hosted RN/Expo handbook, ek standalone Python learning project, aur ek general
frontend/web engineering knowledge base.

## Table of Contents

- [Sub-Projects](#sub-projects)
- [Learning Journey So Far](#learning-journey-so-far)
- [Quick Start](#quick-start)

---

## Sub-Projects

| Folder | Kya Hai | Detail README |
|---|---|---|
| [`docs/`](docs/readme.md) | 21-chapter React Native + Expo Hinglish handbook (self-hosted HTML site) — basics se production-level tak, senior-dev depth, har chapter mein Advanced Deep-Dive + Interview Questions | [docs/readme.md](docs/readme.md) |
| [`my-app/`](my-app/readme.md) | Expo Router based React Native app — real hands-on project jahan handbook ke concepts practically implement kiye. Push Notifications aur Razorpay Payments features working hain. | [my-app/readme.md](my-app/readme.md) |
| [`fastapi/`](fastapi/README.md) | `my-app` ka backend (Python/FastAPI) — push token registration + trigger, Razorpay order creation + signature verification | [fastapi/README.md](fastapi/README.md) |
| [`file-parsing/`](file-parsing/readme.md) | Standalone Python learning project — CSV/Excel/PDF read aur write, format-specific libraries ke saath | [file-parsing/readme.md](file-parsing/readme.md) |
| [`frontend/`](frontend/readme.md) | General frontend/web engineering knowledge base (12 chapters) — API calling, GraphQL, TanStack Query, Next.js, rendering strategies, CDN, caching, performance, bundling, testing, accessibility, security | [frontend/readme.md](frontend/readme.md) |

---

## Learning Journey So Far

Chronological order mein jo practically seekha/banaya gaya:

1. **RN + Expo Handbook** (`docs/`) — 21 chapters likhe gaye, fundamentals se leke EAS pipeline,
   payments, native modules, state management, debugging, accessibility, aur ek free-tier capstone
   project tak.
2. **Push Notifications** (`my-app/` + `fastapi/`) — Expo Notifications + Firebase Cloud Messaging
   end-to-end setup, real debugging journey ke saath (FCM V1 credentials, Google Cloud IAM permissions,
   client-server field mismatches). Full detail: [my-app/readme.md](my-app/readme.md#feature-push-notifications).
3. **Payments** (`my-app/` + `fastapi/`) — Razorpay Test Mode integration, order-create → checkout →
   signature-verify flow, aur samjha ki kyun payment verification hamesha backend mein honi chahiye,
   client mein nahi. Full detail: [my-app/readme.md](my-app/readme.md#feature-payments-razorpay).
4. **File Parsing** (`file-parsing/`) — CSV, Excel, PDF ko Python se read/write karna, format-specific
   libraries ke internals samajhna (quoting rules, cell/formula model, PDF ka inverted coordinate
   system). Full detail: [file-parsing/readme.md](file-parsing/readme.md).
5. **Frontend Knowledge Base** (`frontend/`) — mobile (RN) se hatke general web engineering — API
   calling patterns, GraphQL internals, TanStack Query, Next.js (Server/Client Components), rendering
   strategies (CSR/SSR/SSG/ISR), CDN, full caching hierarchy, performance (Core Web Vitals), bundling,
   testing, web accessibility, aur security (XSS/CSRF/CORS). Full detail:
   [frontend/readme.md](frontend/readme.md).

**Recurring pattern jo har feature mein dikha:** client sirf "request/intent" bhejta hai, **sensitive
decisions (payment verify, notification trigger) backend mein hoti hain** — ye ek core architectural
principle hai jo push notifications aur payments dono mein repeat hua, aur `frontend/12-security.md`
(client-side validation kabhi security boundary nahi hoti) mein isi principle ko web ke context mein
formally cover kiya gaya.

---

## Quick Start

```bash
# Handbook dekhna
cd docs && python3 -m http.server 8000   # http://localhost:8000/index.html

# Backend chalana
cd fastapi && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# RN app chalana (Development Build zaroori hai — Expo Go se push/payments kaam nahi karenge)
cd my-app && npx expo start --dev-client

# File parsing scripts try karna
cd file-parsing && source venv/bin/activate && python3 write_csv.py && python3 read_csv.py
```

Har sub-project ka apna detailed README hai (upar table mein linked) — setup steps, concepts, aur
real debugging journeys (jo issues actually face hue, unke fixes) sab wahan documented hain.
