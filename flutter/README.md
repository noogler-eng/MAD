# Flutter — Full Roadmap (Zero to Production)

Yeh roadmap Flutter/Dart ko end-to-end, root-level depth ke saath cover karta hai — language basics se leke production app shipping tak. Har checkpoint ke baad ek chhota project/exercise hai taaki concept muscle memory ban jaaye.

Status: not started — checkpoints yahan sirf topic list hai, docs baad me likhenge (jaisa MAD ke baaki handbooks me hua).

---

## Checkpoint 0 — Setup & Mental Model
- [ ] Flutter SDK install, `flutter doctor`, Android Studio / Xcode toolchain setup
- [ ] VS Code / Android Studio plugin setup, hot reload vs hot restart
- [ ] Flutter architecture: Dart VM, Skia/Impeller rendering engine, widget tree → element tree → render tree
- [ ] Why "everything is a widget" — declarative UI mental model (vs imperative Android/iOS)
- [ ] `flutter create`, project structure walkthrough (lib/, pubspec.yaml, android/, ios/)

## Checkpoint 1 — Dart Language Fundamentals
- [ ] Variables, `var`/`final`/`const`, null safety (`?`, `!`, `late`)
- [ ] Functions, arrow syntax, named/positional/optional params
- [ ] Classes, constructors (default, named, factory), `this`, inheritance, mixins, abstract classes, interfaces
- [ ] Collections: List, Set, Map + spread/collection-if/collection-for
- [ ] Generics
- [ ] Futures, async/await, Streams, `async*`/`yield`
- [ ] Exception handling (try/catch/on, custom exceptions)
- [ ] Extension methods, typedefs, enums (incl. enhanced enums)

## Checkpoint 2 — Widgets 101
- [ ] StatelessWidget vs StatefulWidget, widget lifecycle (`initState`, `dispose`, `build`)
- [ ] Core layout widgets: Container, Row, Column, Stack, Expanded, Flexible, Padding, Align, Center
- [ ] Text, Image, Icon, Button family (ElevatedButton, TextButton, IconButton)
- [ ] ListView, GridView, SingleChildScrollView, CustomScrollView + Slivers
- [ ] Constraints model — "constraints go down, sizes go up, parent sets position"
- [ ] Keys (ValueKey, ObjectKey, GlobalKey) — kab aur kyun zaruri hain

## Checkpoint 3 — Navigation & Routing
- [ ] Navigator 1.0 (push/pop, named routes)
- [ ] Navigator 2.0 / declarative routing basics
- [ ] `go_router` package — nested routes, deep linking, redirects, route guards
- [ ] Passing data between screens, returning results

## Checkpoint 4 — State Management
- [ ] `setState` ki limitations samajhna
- [ ] InheritedWidget / InheritedModel (state management ka foundation)
- [ ] Provider package
- [ ] Riverpod (recommended modern default) — providers, AsyncNotifier, ref.watch/read
- [ ] Bloc/Cubit pattern — events, states, streams
- [ ] GetX (overview + trade-offs)
- [ ] Kab kaunsa use karna hai — decision framework

## Checkpoint 5 — Forms, Input & Validation
- [ ] TextField/TextFormField, controllers, focus nodes
- [ ] Form widget, GlobalKey<FormState>, validators
- [ ] Gesture detection: GestureDetector, InkWell, drag/swipe
- [ ] Keyboard handling, input formatters

## Checkpoint 6 — Networking & Data
- [ ] `http` package basics — GET/POST/PUT/DELETE
- [ ] `dio` package — interceptors, error handling, retries
- [ ] JSON serialization — manual, `json_serializable`, `freezed`
- [ ] Repository pattern for data layer
- [ ] Error/loading/success UI states (AsyncValue pattern)

## Checkpoint 7 — Local Storage & Persistence
- [ ] SharedPreferences — key-value storage
- [ ] SQLite via `sqflite`
- [ ] Hive / Isar (NoSQL local DB) — kab use karna hai
- [ ] Secure storage (`flutter_secure_storage`) for tokens/secrets
- [ ] File system access (`path_provider`)

## Checkpoint 8 — Architecture & Project Structure
- [ ] Clean Architecture in Flutter — layers (presentation/domain/data)
- [ ] Feature-first vs layer-first folder structure
- [ ] Dependency Injection — `get_it`, `injectable`, or Riverpod's own DI
- [ ] Separation of concerns — UI vs business logic vs data source

## Checkpoint 9 — Animations
- [ ] Implicit animations (AnimatedContainer, AnimatedOpacity, etc.)
- [ ] Explicit animations — AnimationController, Tween, CurvedAnimation
- [ ] Hero animations (screen-to-screen transitions)
- [ ] Custom painters (`CustomPaint`, `CustomPainter`) for advanced graphics
- [ ] Rive/Lottie integration for designer-made animations

## Checkpoint 10 — Platform Integration
- [ ] Platform channels (MethodChannel) — Dart ↔ native (Kotlin/Swift) communication
- [ ] Permissions handling (`permission_handler`)
- [ ] Camera, location, sensors access
- [ ] Push notifications (Firebase Cloud Messaging)
- [ ] Deep links / app links

## Checkpoint 11 — Firebase & Backend Integration
- [ ] Firebase setup (Auth, Firestore, Storage, Cloud Functions)
- [ ] Firebase Auth — email/password, Google/Apple sign-in
- [ ] Firestore realtime listeners vs one-time reads
- [ ] REST/GraphQL backend integration patterns
- [ ] WebSocket / real-time data (chat-type apps)

## Checkpoint 12 — Testing
- [ ] Unit tests (`test` package) — business logic, repositories
- [ ] Widget tests (`flutter_test`) — pump, find, matchers
- [ ] Integration tests (`integration_test` package) — full app flows
- [ ] Golden tests (UI regression via screenshot comparison)
- [ ] Mocking (`mocktail`/`mockito`)

## Checkpoint 13 — Performance & Debugging
- [ ] DevTools — widget inspector, timeline, memory profiler
- [ ] Avoiding unnecessary rebuilds (const constructors, `Selector`, `Consumer`)
- [ ] `ListView.builder` vs `ListView` for large lists
- [ ] Image caching/optimization
- [ ] Build size analysis (`flutter build --analyze-size`)

## Checkpoint 14 — Responsive & Adaptive UI
- [ ] MediaQuery, LayoutBuilder, OrientationBuilder
- [ ] Adaptive design — phone vs tablet vs desktop/web layouts
- [ ] Flutter for Web and Desktop — differences, limitations

## Checkpoint 15 — App Theming & Design System
- [ ] ThemeData, Material 3 (`useMaterial3`), custom themes
- [ ] Dark mode support
- [ ] Custom fonts, reusable design tokens/components
- [ ] Cupertino widgets for iOS-native look

## Checkpoint 16 — CI/CD & Release
- [ ] App signing (Android keystore, iOS certificates/provisioning)
- [ ] Build flavors (dev/staging/prod)
- [ ] Fastlane / GitHub Actions / Codemagic for CI/CD
- [ ] Play Store & App Store submission process
- [ ] Versioning, crash reporting (Firebase Crashlytics/Sentry)

## Checkpoint 17 — Capstone Projects
- [ ] Project 1: Todo/notes app — CRUD + local storage (Checkpoints 0-7)
- [ ] Project 2: Social/chat app — Firebase Auth + Firestore realtime + push notifications (Checkpoints 8-11)
- [ ] Project 3: Production-grade app — full clean architecture, tests, CI/CD, store submission (all checkpoints)

## Checkpoint 18 — Payments & Monetization
- [ ] In-app purchases — `in_app_purchase` package (consumables, subscriptions, restore purchases)
- [ ] Payment gateway integration — Razorpay / Stripe / Google Pay / Apple Pay (checkout flow, webhooks on backend)
- [ ] Subscription management — trial periods, receipt validation (client + server-side)
- [ ] Ads integration (if relevant) — Google AdMob basics

## Checkpoint 19 — Internationalization & Accessibility
- [ ] `intl` package, `flutter_localizations`, ARB files — multi-language support
- [ ] RTL layout support (Directionality, `EdgeInsetsDirectional`)
- [ ] Accessibility — Semantics widget, screen reader support (TalkBack/VoiceOver), tap target sizing, contrast

## Checkpoint 20 — App Security
- [ ] Certificate/SSL pinning for network calls — `http`/`dio` with pinned certs, why MITM proxies (Charles/Burp) get blocked, cert rotation strategy
- [ ] Code obfuscation (`flutter build --obfuscate --split-debug-info`)
- [ ] Biometric authentication (`local_auth`) — fingerprint/Face ID
- [ ] Root/jailbreak detection — `flutter_jailbreak_detection`/`safe_device` packages, what signals they check (su binaries, Cydia, debuggable flags, emulator detection) and their limits (client-side checks are bypassable, not a substitute for server-side verification)
- [ ] Google Play Integrity API — app/device/account integrity verdicts, replacing deprecated SafetyNet, server-side verdict verification flow
- [ ] Apple App Attest / DeviceCheck — iOS equivalent of Play Integrity for attesting genuine app + device
- [ ] Secure API key handling (not hardcoding secrets, `.env` + build-time config)

## Checkpoint 21 — Background Work & Native Interop
- [ ] Isolates — `compute()` for heavy CPU work off the main thread
- [ ] Background execution — `workmanager` (Android), background fetch (iOS)
- [ ] `dart:ffi` for calling native C libraries (overview, when it's actually needed)

## Checkpoint 22 — Analytics, Maps & Extras
- [ ] Analytics — Firebase Analytics / Mixpanel, event tracking strategy
- [ ] Maps — Google Maps / Mapbox integration, current location, markers
- [ ] QR/barcode scanning (`mobile_scanner`)
- [ ] In-app update prompts (Play Store In-App Update API)

## Checkpoint 23 — Publishing a Package
- [ ] Structuring a reusable Flutter/Dart package
- [ ] `pubspec.yaml` for packages vs apps, platform-specific plugin code
- [ ] Publishing to pub.dev, versioning (semver), CHANGELOG discipline

---

## Reference Stack (recommended defaults)
- State management: **Riverpod**
- Routing: **go_router**
- Networking: **dio**
- Models: **freezed** + **json_serializable**
- DI: Riverpod-native or **get_it**
- Backend: **Firebase** (fastest path) or custom REST/GraphQL
- Testing: **flutter_test** + **mocktail**
