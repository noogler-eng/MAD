# MAD Docs — React Native + Expo Handbook

Ye ek self-hosted HTML documentation site hai jo React Native + Expo ko basic se production-level tak
Hinglish mein cover karta hai. Design: Claude-style dark theme (terracotta orange accent), sidebar nav,
code blocks with copy button, "Senior Dev Note" callouts for security/architecture/crash wisdom.

**Status: ✅ ALL 21 CHAPTERS COMPLETE** (17 core course chapters + 4 extra gap-filling chapters, each with
an Advanced Deep-Dive section and a senior-level Interview Questions section).

**Location:** `/Users/sharadpoddar/Desktop/MAD/docs/`

**Course source:** Chapters 1-17 follow [codewithbeto.dev's React Native course](https://codewithbeto.dev)
curriculum (17 topics, Intro through Publishing/Native Modules/Bonus). Chapters 18-21 are extra chapters
added to fill gaps the course curriculum didn't cover, plus a hands-on capstone project.

> **For Claude (future sessions):** This file is the source of truth for what's in the handbook and how
> it's built. Read this before editing/extending any chapter — reuse `assets/style.css` / `assets/app.js`
> classes exactly, follow the same sidebar markup pattern (all 21 chapters wired in every file's sidebar,
> split into "Course" (1-17) and "Extra Topics" (18-21) nav-groups), keep the Hinglish tone (Latin script
> ONLY — never let Devanagari characters slip into prose, this has happened before and been caught/fixed
> multiple times, double-check new content), and keep adding `.callout.senior` production notes. Don't
> restart the design system — extend it.
>
> **HARD REQUIREMENT #1: every single line inside every code block MUST have an inline `//` (or
> language-appropriate) comment explaining what that exact line does.** Not just the tricky lines — every
> line, including simple ones like imports and closing braces. Sharad is learning line-by-line. For JSON
> files that don't support comments (`eas.json`, `app.json`), use the "teaching comment" pattern (annotate
> as if JS/JSON5 comments were allowed, with a caption noting real JSON doesn't support them).
>
> **HARD REQUIREMENT #2: every folder/file-structure tree block MUST also have an inline comment on every
> file/folder line explaining what that file/folder is for AND why it's structured that way** (the
> reasoning, not just the label).
>
> **ESTABLISHED PATTERN (from ch.1 onward, now standard for every chapter): every chapter ends with an
> "Advanced Deep-Dive — Beyond the Basics" (`id="advanced-deep-dive"`) section and a "🎯 Interview
> Questions — Senior React Native Developer" (`id="interview-questions"`) section, both linked in the
> `.toc`, right before `.prevnext`.** New chapters should follow this same shape unless there's a good
> reason not to (ch.21's capstone uses a lighter "test your understanding" variant since it's a practical
> build-along, not a concept chapter).

---

## File structure

```
docs/
├── readme.md                        (this file — progress tracker + design-system reference)
├── index.html                       (hub page, links to all 21 chapters)
├── assets/
│   ├── style.css                    (design system — dark + orange, all shared classes)
│   └── app.js                       (copy-button behaviour, active nav highlighting)
├── 01-introduction.html
├── 02-components-and-apis.html
├── 03-style-and-design.html
├── 04-expo-router.html
├── 05-animations-and-gestures.html
├── 06-expo-ui.html
├── 07-testing.html
├── 08-push-notifications.html
├── 09-backend-supabase.html
├── 10-eas-build.html
├── 11-eas-submit.html
├── 12-eas-update.html
├── 13-eas-workflows.html
├── 14-publishing.html
├── 15-payments.html
├── 16-native-modules.html
├── 17-bonus.html
├── 18-state-management.html
├── 19-debugging-and-crashes.html
├── 20-accessibility-i18n.html
└── 21-capstone-free-app.html
```

---

## ✅ Done — Chapters 1-17 (Core Course)

Each of these covers its core topic PLUS an Advanced Deep-Dive and Interview Questions section.

1. **Introduction** — RN+Expo fundamentals, dev env setup, New Architecture (JSI/Fabric/TurboModules/Hermes),
   Expo Go vs Dev Builds, scalable folder structure. Advanced: Hermes bytecode compilation, Prebuild/CNG
   internals, JS engine comparison, monorepo/Metro config.
2. **Components & APIs** — Core components, FlatList/FlashList virtualization, custom/compound components,
   memoization. Advanced: Fabric shadow tree/reconciliation, Context re-render pitfalls, `useSyncExternalStore`,
   DevTools Profiler workflow.
3. **Style & Design** — StyleSheet internals, Flexbox, design tokens, dark mode. Advanced: Yoga layout engine
   internals, array style resolution, UI-thread vs layout-thread animatable properties, responsive design systems.
4. **Expo Router** — File-based routing, dynamic routes, auth flow, RBAC, deep linking (flagship security
   chapter). Advanced: AASA/assetlinks.json verification internals, navigation state persistence, auth-guard
   race conditions, permission-based RBAC at scale.
5. **Animations & Gestures** — Reanimated 3, Gesture Handler v2, swipe-to-delete, 60fps rules. Advanced:
   worklet Babel-plugin serialization internals, Fabric layout animations, shared element transitions,
   gesture composition APIs.
6. **Expo UI** — SwiftUI/Compose bridging, universal components, platform-fork architecture. Advanced:
   Fabric shadow-tree mounting of native views, state-sync cost analysis, bundle-size trade-offs.
7. **Testing** — Testing pyramid, Jest, RNTL, Maestro E2E, CI integration. Advanced: provider-stack test
   utilities, testing Reanimated/gestures, visual regression testing, CI performance profiling.
8. **Push Notifications** — Expo Notifications vs OneSignal, FCM/APNs, permission flows. Advanced:
   silent/data-only push architecture, notification categories/actions, badge count sync.
9. **Backend + Supabase** — API routes, RLS, client/server key patterns (security-heavy chapter). Advanced:
   Realtime subscriptions, offline-first sync/conflict resolution, optimistic updates with rollback,
   idempotency for mobile APIs.
10. **EAS Build** — Build profiles, credentials, version automation. Advanced: build caching internals,
    monorepo builds, custom build hooks, dependency-conflict troubleshooting.
11. **EAS Submit** — App Store/Play Store submission automation, signing. Advanced: App Store Connect API
    scope/key rotation, staged rollout automation, submit idempotency.
12. **EAS Update** — OTA updates, runtime versions, channels, rollback. Advanced: manifest resolution/asset
    diffing, rollout percentage strategy, update code signing.
13. **EAS Workflows** — CI/CD YAML pipelines, Maestro-in-CI. Advanced: matrix builds, workflow composition
    for monorepos, secrets scoping.
14. **Publishing** — Manual Xcode flow, full App Store/Play Store checklists. Advanced: phased release
    strategies, App Store Connect API metadata automation, localization at scale.
15. **Payments** — IAP vs Stripe policy split, RevenueCat, PCI security (high-stakes chapter). Advanced:
    server-side entitlement caching, subscription state machines, proration handling.
16. **Native Modules** — Expo Modules API, Swift+Kotlin+TS native module & view from scratch. Advanced:
    threading model, memory management (ARC/GC), sync vs async performance, crash symbolication.
17. **Bonus** — Apple Widgets, Expo SDK upgrade strategy, Meta Ads/Facebook SDK. Advanced: App Clips/Instant
    Apps, Live Activities, Android App Bundles, CodePush vs EAS Update. Includes capstone-style questions
    tying the whole handbook together.

## ✅ Done — Chapters 18-21 (Extra Topics)

18. **State Management** (`18-state-management.html`) — Context vs Zustand vs Redux Toolkit vs Jotai, senior
    decision framework, MMKV/AsyncStorage persistence, selector patterns to prevent re-renders. Advanced:
    XState for complex flows, RTK Query vs TanStack Query (client vs server state distinction), derived state.
19. **Debugging & Crashes** (`19-debugging-and-crashes.html`) — dev tools (Flipper/DevTools/Reactotron),
    Sentry setup, crash symbolication (dSYM/ProGuard mapping) deep-dive, JS errors vs native crashes vs ANRs,
    "works locally, crashes in prod" debugging checklist, performance profiling. Advanced: Sentry breadcrumbs,
    release health/crash-free rate tracking, custom error boundaries. This was explicitly flagged as an open
    gap in earlier versions of this readme — now filled.
20. **Accessibility & i18n** (`20-accessibility-i18n.html`) — a11y props, screen reader testing (VoiceOver/
    TalkBack), font scaling, color contrast, i18next setup, RTL layout support, pluralization/locale
    formatting. Advanced: `AccessibilityInfo` API, accessible custom-gesture components, CI a11y testing.
21. **Capstone: Free Full App** (`21-capstone-free-app.html`) — the biggest, most hands-on chapter. Builds a
    real "Streaks" habit-tracker app end-to-end using ONLY free tiers: Expo + Supabase (free tier, RLS) +
    Razorpay Test Mode (with a Stripe Test Mode callout for non-India readers) for a premium unlock feature +
    EAS free tier for builds. Full step-by-step: project setup → Supabase tables/RLS → auth flow → habit
    tracking logic → Razorpay order creation (server-side, test keys) → client checkout → server-side
    signature verification before unlocking premium → a dedicated debugging-steps section per stage
    (RLS issues, auth redirect loops, payment-verification failures, Expo Go vs Dev Build gotchas, network
    inspection) → building/sharing a free preview build → an honest "what's free forever vs what costs money
    at scale" table → closing notes on what it'd take to actually ship this to production using the rest of
    the handbook (ch.11 Submit, ch.14 Publishing, ch.15 live payment keys, ch.19 Sentry).

---

## Cross-cutting topics — where they live

- **Security**: token storage/SSL pinning/deep-link validation (ch.4), RLS/API key split (ch.9), payment
  security/PCI (ch.15), receipt/signature verification (ch.15, ch.21)
- **API keys handling**: `EXPO_PUBLIC_` exposure (ch.1), EAS Secrets + backend-proxy pattern (ch.9), test vs
  live key separation (ch.21)
- **Firebase**: FCM for push (ch.8)
- **State management**: full dedicated chapter (ch.18) — this was a real gap in the original 17-chapter course
- **Debugging & crash analysis**: full dedicated chapter (ch.19) — previously flagged as open, now filled
- **Accessibility & i18n**: full dedicated chapter (ch.20) — not part of the original course at all
- **Automations**: EAS Workflows (ch.13), version-code automation (ch.10)
- **New SDKs**: Expo SDK upgrade strategy (ch.17)
- **Real production app walkthrough**: the capstone (ch.21) — ties together Router (ch.4), Supabase (ch.9),
  EAS Build (ch.10), Payments (ch.15), and Debugging (ch.19) into one coherent build

No further known gaps remain in the handbook as of this writing. If new gaps surface later (e.g. a
dedicated GraphQL/tRPC chapter, a deeper monorepo/Turborepo chapter, or a Web+Native code-sharing chapter
for teams also targeting `react-native-web`), add them as chapters 22+ following the same "Extra Topics"
sidebar group pattern.

---

## Design system reference (for continuity)

- Colors: `--bg:#1a1918`, `--bg-elevated:#21201e`, `--accent:#d97757` (terracotta orange), full palette in
  `assets/style.css`
- Sidebar: two `nav-group`s — "Course" (chapters 1-17, plus Home) and "Extra Topics" (chapters 18-21). Every
  chapter's sidebar must be kept in sync across ALL html files whenever a new chapter is added — this is a
  manual step (find/replace across all files), not automatic.
- Every chapter: `.toc` box at top (links to every h2 including Advanced Deep-Dive + Interview Questions),
  `.code-block` with `.code-title` + `.copy-btn`, syntax via `.tok-*` spans
- Callout types: `.callout.senior` (🧠 architecture/production wisdom), `.callout.warn` (⚠️ gotchas),
  `.callout.danger` (🔒 security/crash critical), `.callout.info`, `.callout.hinglish-tip`
- Every chapter ends with `.prevnext` linking to previous/next chapter (chain verified 01→21→index)
- Progress-pill format: `"Chapter N of 21"` on chapter pages, `"21 / 21 topics ready"` on index.html
- Language: Hinglish prose (Latin script ONLY, no Devanagari — verify with a regex scan
  `[ऀ-ॿ]+` across files after any bulk generation, this has caught real slip-ups before), English code +
  technical headings, written like a senior Indian dev explaining to a colleague — not textbook-formal
- **Every code block: every line commented** (hard requirement #1), **every folder tree: every line
  reasoned** (hard requirement #2), **every chapter: Advanced Deep-Dive + Interview Questions sections**
  (established pattern) — all apply to any future edits or new chapters
