# MAD Docs — React Native + Expo Handbook

A self-hosted HTML documentation site that teaches React Native + Expo from basics to
production-level, entirely in Hinglish, at a senior-developer depth.

**Status:** ✅ All 21 chapters complete — 17 core course chapters + 4 extra gap-filling chapters,
each with an **Advanced Deep-Dive** section and a senior-level **Interview Questions** section.

**Location:** `/Users/sharadpoddar/Desktop/MAD/docs/`

---

## Table of Contents

- [Overview](#overview)
- [Viewing the Handbook](#viewing-the-handbook)
- [Chapters](#chapters)
  - [Core Course (1–17)](#core-course-1-17)
  - [Extra Topics (18–21)](#extra-topics-18-21)
- [Project Structure](#project-structure)
- [Where Cross-Cutting Topics Live](#where-cross-cutting-topics-live)
- [Design System Reference](#design-system-reference)
- [Notes for Contributors / Claude](#notes-for-contributors--claude)

---

## Overview

| | |
|---|---|
| **Theme** | Dark, Claude-style UI — terracotta orange accent |
| **Language** | Hinglish prose (Latin script), English code + technical headings |
| **Chapters** | 21 (17 core + 4 extra), ~23,000 lines of HTML |
| **Course source** | Chapters 1–17 follow [codewithbeto.dev's React Native course](https://codewithbeto.dev) |
| **Extra chapters** | 18–21 fill gaps the course curriculum didn't cover, plus a hands-on capstone project |

Every chapter includes:
- A table of contents box with anchor links to every section
- Fully commented code blocks (every line explained — see [Design System Reference](#design-system-reference))
- `.callout` boxes for senior-level notes, warnings, security-critical info, and quick tips
- An **Advanced Deep-Dive** section
- A senior-level **Interview Questions** section
- Prev/Next navigation to the adjacent chapter

---

## Viewing the Handbook

This is a static site — no build step required.

```bash
cd /Users/sharadpoddar/Desktop/MAD/docs
python3 -m http.server 8000
```

Then open **http://localhost:8000/index.html** in a browser.

---

## Chapters

### Core Course (1–17)

| # | Chapter | Covers | Advanced Deep-Dive |
|---|---|---|---|
| 1 | [Introduction](01-introduction.html) | RN+Expo fundamentals, dev env setup, New Architecture (JSI/Fabric/TurboModules/Hermes), Expo Go vs Dev Builds, scalable folder structure | Hermes bytecode compilation, Prebuild/CNG internals, JS engine comparison, monorepo/Metro config |
| 2 | [Components & APIs](02-components-and-apis.html) | Core components, FlatList/FlashList virtualization, custom/compound components, memoization | Fabric shadow tree/reconciliation, Context re-render pitfalls, `useSyncExternalStore`, DevTools Profiler |
| 3 | [Style & Design](03-style-and-design.html) | StyleSheet internals, Flexbox, design tokens, dark mode | Yoga layout engine internals, array style resolution, responsive design systems |
| 4 | [Expo Router](04-expo-router.html) | File-based routing, dynamic routes, auth flow, RBAC, deep linking *(flagship security chapter)* | AASA/assetlinks.json verification, navigation state persistence, auth-guard race conditions |
| 5 | [Animations & Gestures](05-animations-and-gestures.html) | Reanimated 3, Gesture Handler v2, swipe-to-delete, 60fps rules | Worklet Babel-plugin internals, Fabric layout animations, shared element transitions |
| 6 | [Expo UI](06-expo-ui.html) | SwiftUI/Compose bridging, universal components, platform-fork architecture | Fabric shadow-tree mounting, state-sync cost analysis, bundle-size trade-offs |
| 7 | [Testing](07-testing.html) | Testing pyramid, Jest, RNTL, Maestro E2E, CI integration | Provider-stack test utilities, testing Reanimated/gestures, visual regression testing |
| 8 | [Push Notifications](08-push-notifications.html) | Expo Notifications vs OneSignal, FCM/APNs, permission flows | Silent/data-only push architecture, notification categories, badge count sync |
| 9 | [Backend + Supabase](09-backend-supabase.html) | API routes, RLS, client/server key patterns *(security-heavy chapter)* | Realtime subscriptions, offline-first sync, optimistic updates, idempotency |
| 10 | [EAS Build](10-eas-build.html) | Build profiles, credentials, version automation | Build caching internals, monorepo builds, dependency-conflict troubleshooting |
| 11 | [EAS Submit](11-eas-submit.html) | App Store/Play Store submission automation, signing | App Store Connect API scope, staged rollout automation |
| 12 | [EAS Update](12-eas-update.html) | OTA updates, runtime versions, channels, rollback | Manifest resolution/asset diffing, rollout percentage strategy, code signing |
| 13 | [EAS Workflows](13-eas-workflows.html) | CI/CD YAML pipelines, Maestro-in-CI | Matrix builds, workflow composition for monorepos |
| 14 | [Publishing](14-publishing.html) | Manual Xcode flow, full App Store/Play Store checklists | Phased release strategies, metadata automation, localization at scale |
| 15 | [Payments](15-payments.html) | IAP vs Stripe policy split, RevenueCat, PCI security *(high-stakes chapter)* | Server-side entitlement caching, subscription state machines, proration |
| 16 | [Native Modules](16-native-modules.html) | Expo Modules API, Swift+Kotlin+TS native module & view from scratch | Threading model, memory management, crash symbolication |
| 17 | [Bonus](17-bonus.html) | Apple Widgets, Expo SDK upgrade strategy, Meta Ads/Facebook SDK | App Clips, Live Activities, App Bundles, CodePush vs EAS Update — plus capstone-style questions tying the whole handbook together |

### Extra Topics (18–21)

| # | Chapter | Covers | Advanced Deep-Dive |
|---|---|---|---|
| 18 | [State Management](18-state-management.html) | Context vs Zustand vs Redux Toolkit vs Jotai, decision framework, MMKV/AsyncStorage persistence, selector patterns | XState, RTK Query vs TanStack Query, derived state |
| 19 | [Debugging & Crashes](19-debugging-and-crashes.html) | Dev tools (Flipper/DevTools/Reactotron), Sentry setup, crash symbolication, JS errors vs native crashes vs ANRs | Sentry breadcrumbs, release health tracking, custom error boundaries |
| 20 | [Accessibility & i18n](20-accessibility-i18n.html) | a11y props, screen reader testing, font scaling, i18next, RTL layout, pluralization | `AccessibilityInfo` API, accessible gesture components, CI a11y testing |
| 21 | [Capstone: Free Full App](21-capstone-free-app.html) | End-to-end build of a "Streaks" habit tracker using **only free tiers**: Expo + Supabase (RLS) + Razorpay/Stripe Test Mode + EAS free tier. Full steps: project setup → Supabase/RLS → auth → habit logic → payment order + signature verification → per-stage debugging → free build/share → free-vs-paid-at-scale breakdown | *(uses a lighter "test your understanding" section instead — it's a practical build-along)* |

> 18–19 were explicitly flagged as gaps in earlier drafts of this handbook (state management and
> debugging/crash analysis weren't part of the original 17-topic course) — both are now filled.
> 20 (accessibility/i18n) was never part of the course either. No further known gaps remain; see
> [Notes for Contributors](#notes-for-contributors--claude) for how to add more.

---

## Project Structure

```
docs/
├── readme.md                        # this file
├── index.html                       # hub page — links to all 21 chapters
├── assets/
│   ├── style.css                    # design system — dark + orange, all shared classes
│   └── app.js                       # copy-button behaviour, active nav highlighting
├── 01-introduction.html
├── 02-components-and-apis.html
├── ...
└── 21-capstone-free-app.html
```

---

## Where Cross-Cutting Topics Live

Some topics span multiple chapters rather than having one home. Quick index:

| Topic | Chapters |
|---|---|
| Security (tokens, SSL pinning, deep links, RLS, PCI) | 4, 9, 15, 21 |
| API key handling (`EXPO_PUBLIC_`, EAS Secrets, test vs live keys) | 1, 9, 21 |
| Firebase (FCM) | 8 |
| State management | 18 |
| Debugging & crash analysis | 19 |
| Accessibility & i18n | 20 |
| Automations / CI-CD | 10, 13 |
| Expo SDK upgrades | 17 |
| Full production-app walkthrough | 21 (ties together ch.4, 9, 10, 15, 19) |

---

## Design System Reference

| | |
|---|---|
| Background | `--bg: #1a1918` |
| Elevated surface | `--bg-elevated: #21201e` |
| Accent | `--accent: #d97757` (terracotta orange) |

- **Sidebar:** two `nav-group`s — "Course" (1–17, plus Home) and "Extra Topics" (18–21). Kept in
  sync across every HTML file manually whenever a chapter is added.
- **Per-chapter layout:** `.toc` box at top → numbered content sections → Advanced Deep-Dive →
  Interview Questions → `.prevnext` navigation.
- **Code blocks:** `.code-block` with `.code-title` + `.copy-btn`, syntax highlighted via `.tok-*`
  spans.
- **Callouts:** `.callout.senior` 🧠 (architecture/production wisdom), `.callout.warn` ⚠️
  (gotchas), `.callout.danger` 🔒 (security/crash critical), `.callout.info`, `.callout.hinglish-tip`.
- **Progress indicator:** `"Chapter N of 21"` on chapter pages, `"21 / 21 topics ready"` on
  `index.html`.
- **Language:** Hinglish prose in **Latin script only** — no Devanagari. Verify with:
  ```bash
  python3 -c "
  import re, glob
  for f in glob.glob('*.html'):
      if re.findall(r'[ऀ-ॿ]+', open(f, encoding='utf-8').read()):
          print(f)
  "
  ```

---

## Notes for Contributors / Claude

Read this before editing or extending any chapter.

**Hard requirements** (apply to every code block, in every chapter):

1. **Every line of code must be commented.** Not just the tricky lines — imports, closing braces,
   everything. The reader is learning line-by-line. For JSON files that don't support comments
   (`eas.json`, `app.json`), use a "teaching comment" pattern — annotate as if comments were
   allowed, with a caption noting real JSON doesn't support them.
2. **Every folder/file-structure tree must explain *why*, not just *what*.** Each line needs a
   comment describing the file/folder's purpose and the reasoning behind its placement.

**Established pattern** for every chapter: end with an "Advanced Deep-Dive — Beyond the Basics"
(`id="advanced-deep-dive"`) section and a "🎯 Interview Questions — Senior React Native Developer"
(`id="interview-questions"`) section, both linked from the `.toc`, immediately before `.prevnext`.

**When adding a new chapter:**
- Reuse `assets/style.css` / `assets/app.js` classes exactly — don't invent new ones.
- Copy the sidebar markup from an existing file and update it across **all** HTML files (this is a
  manual step, not automatic).
- Keep the Hinglish tone — Latin script only, run the Devanagari check above after generating content.
- Number it 22+ under the "Extra Topics" nav-group unless it belongs in the original 17-chapter course.

Ideas for future chapters if new gaps surface: a dedicated GraphQL/tRPC chapter, a deeper
monorepo/Turborepo chapter, or a Web+Native code-sharing chapter for teams targeting
`react-native-web`.
