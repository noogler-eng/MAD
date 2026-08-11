# Frontend DevOps and Deployment — Senior Frontend Ke Liye

Ye chapter frontend engineering ka wo hissa hai jo "code likhna" aur "users tak pahunchna" ke beech ka poora gap fill karta hai — CI/CD pipelines, preview deployments, environment configs, feature flags, edge deployment, aur rollback strategies. Agar tumne MAD ka RN/Expo handbook padha hai (`../docs/12-eas-update.html` aur `../docs/13-eas-workflows.html`), tumhe kaafi concepts familiar lagenge — staged rollouts, environment-based config, CI/CD pipeline stages, ye sab **conceptually same** hain mobile aur web dono mein. Lekin mechanism bilkul alag hai, kyunki web ke paas app-store-review process hi nahi hai — aur yehi difference is chapter ka core theme hai. Hum dekhenge ki web deployment "easy" kyun hai, aur exactly isi ease ki wajah se apni khud ki safety-net practices (preview deploys, feature flags, staged rollouts) kyun invent karni padti hain — mobile ke store-review-based safety net ka replacement.

## Table of Contents

1. [Why Web Deployment Is Fundamentally Easier Than Mobile — And Why That's a Double-Edged Sword](#why-web-deployment-is-fundamentally-easier-than-mobile--and-why-thats-a-double-edged-sword)
2. [CI/CD Pipeline Stages for a Frontend App](#cicd-pipeline-stages-for-a-frontend-app)
3. [Preview Deployments — The Web-Specific Superpower](#preview-deployments--the-web-specific-superpower)
4. [Environment Variables and Config Across Environments](#environment-variables-and-config-across-environments)
5. [Feature Flags — Web's Rollout Mechanism (Parallel to EAS Update's Rollout Percentages)](#feature-flags--webs-rollout-mechanism-parallel-to-eas-updates-rollout-percentages)
6. [Edge Deployment — Running Code Physically Close to Users](#edge-deployment--running-code-physically-close-to-users)
7. [Rollback Strategies](#rollback-strategies)
8. [Real-World Gotchas](#real-world-gotchas)
9. [Key Takeaways](#key-takeaways)
10. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## Why Web Deployment Is Fundamentally Easier Than Mobile — And Why That's a Double-Edged Sword

RN handbook ka Chapter 12 (`12-eas-update.html`) yaad karo — wahan poora chapter isi pe tha ki OTA updates possible kaise hain, aur unki kitni limitations hain (native code kabhi OTA se update nahi ho sakta, runtime version fingerprint match karna padta hai, channels alag rakhne padte hain). Web deployment mein wo saari complexity **exist hi nahi karti**.

Ek web app deploy karne ka matlab hai: naye HTML/CSS/JS files ko ek server/CDN pe daal do. Jab user apna browser refresh karega (ya naya tab kholega), use naye files mil jaayenge. Isse compare karo mobile ke saath:

| Aspect | Mobile (React Native) | Web |
|---|---|---|
| Native code change | `eas build` + naya store submission + **review process (1-7 din)** | Concept exist hi nahi karta — sab kuch "JS-level" hai |
| JS/logic-only change | OTA update possible, lekin **runtime version match** aur **channel binding** ki constraints | Bas naye files serve karo, koi constraint nahi |
| User ko update kaise milta hai | User ko app **explicitly reopen/foreground** karna padta hai, ya OTA check trigger hona chahiye | User ka agla **page load/refresh** — automatic, user ko kuch karna nahi padta |
| Review/approval gate | Apple/Google review — app-store-level control jo obviously-broken builds ko (kabhi-kabhi) catch karta hai | Koi external review nahi — jo tumne push kiya, wahi turant live hai |
| Rollback speed | OTA rollback fast hai lekin phir bhi device ko next-launch pe check karna padta hai | Edge-level traffic re-routing — **instant**, koi client-side "check" involved nahi |

Is table ka sabse important row hai last wala — review/approval gate. Mobile mein Apple/Google ka review process ek **weak lekin non-zero safety net** hai — obviously crash karne wale builds kabhi-kabhi review mein reject ho jaate hain, aur submission-se-live tak ka gap accidental disasters ko catch karne ka thoda buffer deta hai. Web mein **ye safety net completely absent hai**. Jo bhi tum `git push` karte ho (ya CI pipeline complete hone pe), wo seconds-to-minutes mein production users tak pahunch sakta hai — bina kisi third-party gatekeeper ke.

### Double-edged sword — ease ka dark side

Ye ease genuinely powerful hai — hotfixes minutes mein ship ho sakte hain, iteration speed dramatically fast hai, koi "app store approval ka wait karo" wala friction nahi hai. Lekin exactly isi wajah se, **ek broken change bhi minutes mein saare users tak pahunch sakta hai**, bina kisi external check ke. Teams jo isse casually treat karti hain ("web deploy toh easy hai, thoda risk le lete hain") end up shipping production incidents kaafi frequently — kyunki jo safety net mobile mein Apple/Google provide karte hain, web mein wo safety net **tumhe khud banana padta hai**.

Yehi wo exact gap hai jo is chapter ke baaki sections fill karte hain:

- **Preview deployments** (section 3) — code merge hone se pehle actually dekh lo ki change kaam karta hai, real running URL pe.
- **Feature flags** (section 5) — code ko 100% users ko ship karo, lekin feature ko disabled rakho jab tak confident na ho.
- **Rollback strategies** (section 7) — agar kuch galat ho jaaye, turant purani working state pe wapas jao.

Ye teeno practices conceptually parallel hain RN handbook ke EAS Update rollout-percentage feature (`12-eas-update.html`, "Rollout Percentage Strategies" section) ke saath — dono ka goal same hai: **"ship karo, lekin gradually aur reversibly, na ki 'all-or-nothing, bina safety net ke'"**. Farak sirf mechanism ka hai — mobile OTA rollout percentage server-side pointer + device-side "next check" pe depend karta hai, web feature flags real-time, per-request evaluation pe.

> **Senior mental model**: Web deployment ki "ease" ek engineering advantage hai, lekin wo tumhe correctness ki responsibility se exempt nahi karti — bas us responsibility ko discharge karne ka tool badal deta hai (app-store-review ki jagah, tumhare apne CI/CD gates, feature flags, aur monitoring).

---

## CI/CD Pipeline Stages for a Frontend App

Ek typical frontend CI/CD pipeline ek fixed sequence follow karta hai — har stage pehle wale se **cheaper/faster fail-fast checks** pe based hoti hai, taaki expensive stages (build, deploy) tak sirf wahi code pahunche jo basic checks pass kar chuka ho.

```text
1. Install dependencies       <- sabse pehla, sab kuch isi pe depend karta hai
2. Lint / Typecheck           <- fastest checks, syntax/style/type errors yahin catch hote hain
3. Run tests (unit + integration) <- logic correctness verify karo
4. Build                      <- production bundle banao (Next.js build, Vite build, etc.)
5. Deploy to preview/staging  <- ek isolated environment mein deploy karo, review ke liye
6. Promote to production      <- manual approval ya automatic (tag-based), actual users tak
```

Har stage pehle wale se zyada "costly" hota jaata hai (lint 10 seconds leta hai, full build 2-5 minutes le sakta hai) — isliye order matter karta hai. Agar lint hi fail ho raha hai, build chalane ka koi fayda nahi — CI resources waste honge aur feedback loop slow ho jaayega.

### Full annotated GitHub Actions example — Next.js app

```yaml
name: CI/CD Pipeline # workflow ka naam, GitHub UI mein yahi dikhega

on: # trigger conditions define kar rahe hain
  push: # git push event pe trigger
    branches: [main] # sirf main branch pe push hone par production-bound pipeline chalegi
  pull_request: # PR open/update hone pe bhi trigger karo
    branches: [main] # sirf un PRs ke liye jo main mein merge honi hain

jobs: # jobs ki list, ye pipeline ke andar actual kaam karne wali units hain
  install: # pehla job — dependencies install karna, baaki sab isi pe depend karega
    runs-on: ubuntu-latest # GitHub-hosted Ubuntu runner pe chalega
    steps: # is job ke andar steps ki sequence
      - name: Checkout code # repo ka code checkout karne wala step
        uses: actions/checkout@v4 # official GitHub action, repo ko runner pe clone karta hai
      - name: Setup Node # Node.js runtime setup karne wala step
        uses: actions/setup-node@v4 # official setup-node action
        with: # is action ke inputs
          node-version: 20 # Node version pin kiya — reproducibility ke liye, "latest" use nahi karte
          cache: "npm" # npm dependency cache enable kiya, repeated installs fast honge
      - name: Install dependencies # actual install step
        run: npm ci # "ci" (clean install) use kiya, lockfile ko strictly respect karta hai — "install" nahi, jo lockfile drift allow karta hai

  lint_and_typecheck: # dusra job — code quality/type-safety checks, install job complete hone ke baad
    needs: install # dependency — install job pehle success hona chahiye
    runs-on: ubuntu-latest # runner
    steps: # steps list
      - name: Checkout code # code chahiye is job ko bhi, har job apna alag runner instance leta hai
        uses: actions/checkout@v4 # checkout action
      - name: Setup Node # Node setup, har job independent hai isliye repeat karna padta hai
        uses: actions/setup-node@v4 # setup-node action
        with: # inputs
          node-version: 20 # same version, consistency ke liye
          cache: "npm" # cache enable
      - name: Install dependencies # dependencies phir se install (har job apna fresh environment hai)
        run: npm ci # clean install
      - name: Run ESLint # lint check — code style aur common bug patterns
        run: npm run lint # package.json ka "lint" script chalaya
      - name: Run TypeScript typecheck # type errors ko compile-time pe hi catch karna
        run: npm run typecheck # "tsc --noEmit" jaisa script, sirf type-check karta hai, output nahi banata

  test: # teesra job — actual test suite chalana
    needs: install # install job pe depend karta hai
    runs-on: ubuntu-latest # runner
    steps: # steps
      - name: Checkout code # checkout
        uses: actions/checkout@v4 # action
      - name: Setup Node # Node setup
        uses: actions/setup-node@v4 # action
        with: # inputs
          node-version: 20 # version
          cache: "npm" # cache
      - name: Install dependencies # install
        run: npm ci # clean install
      - name: Run unit + integration tests # actual test run
        run: npm test -- --coverage # coverage report bhi generate kiya, taaki test-quality trackable ho

  build: # chautha job — production build banana, sirf tab chalega jab lint/typecheck aur tests dono pass ho
    needs: [lint_and_typecheck, test] # dono upstream jobs ke success pe depend karta hai — koi bhi fail hua, build skip
    runs-on: ubuntu-latest # runner
    steps: # steps
      - name: Checkout code # checkout
        uses: actions/checkout@v4 # action
      - name: Setup Node # Node setup
        uses: actions/setup-node@v4 # action
        with: # inputs
          node-version: 20 # version
          cache: "npm" # cache
      - name: Install dependencies # install
        run: npm ci # clean install
      - name: Build Next.js app # actual production build
        run: npm run build # Next.js ka "next build" — optimized, minified production output banata hai
        env: # build-time environment variables, is step ke liye scoped
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }} # client bundle mein bake hone wala public API URL — GitHub secret se aa raha hai (section 4 mein detail hai)

  deploy_preview: # paanchvaan job — PR ke liye preview deploy (sirf pull_request events pe chalega)
    if: github.event_name == 'pull_request' # condition — sirf tab chalo jab trigger ek PR hai, direct push pe nahi
    needs: build # build job success hone tak wait
    runs-on: ubuntu-latest # runner
    steps: # steps
      - name: Checkout code # checkout
        uses: actions/checkout@v4 # action
      - name: Deploy to Vercel Preview # Vercel CLI se preview deploy trigger karna
        run: npx vercel deploy --token=${{ secrets.VERCEL_TOKEN }} # non-production deploy, Vercel apna khud ka unique preview URL return karega (section 3 mein detail)

  deploy_production: # chhata job — production deploy, sirf main branch pe push hone par
    if: github.ref == 'refs/heads/main' # condition — sirf main branch ka push event, PR preview nahi
    needs: build # build success pe depend
    runs-on: ubuntu-latest # runner
    steps: # steps
      - name: Checkout code # checkout
        uses: actions/checkout@v4 # action
      - name: Deploy to Vercel Production # production flag ke saath deploy
        run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }} # "--prod" flag production alias update karta hai, real users tak
```

**Senior note**: Notice karo — `deploy_preview` aur `deploy_production` dono `build` job pe depend karte hain, lekin ek dusre pe nahi. Ye `.eas/workflows` mein dekhe gaye `needs` pattern (RN handbook, `13-eas-workflows.html`) ke bilkul similar hai — explicit dependency graph, jahan har job apna exact upstream dependency declare karta hai, taaki unrelated failures ek dusre ko block na karein.

---

## Preview Deployments — The Web-Specific Superpower

Ye capability hai jiska mobile CI/CD (EAS Workflows/Build) ke paas **koi real equivalent nahi hai**. RN handbook mein `build_preview` job hota hai (`13-eas-workflows.html`), lekin uska output ek `.ipa`/`.apk` file hai jo device pe **manually install** karna padta hai (QR code scan karo, ya TestFlight/internal-distribution link kholo). Ye kaam karta hai, lekin friction hai — reviewer ko ek physical/simulator device chahiye, install karna padta hai, phir navigate karke feature dhoondhna padta hai.

Vercel/Netlify jaise web platforms is friction ko poori tarah eliminate kar dete hain: **har single pull request automatically deploy hota hai apne khud ke unique, live, shareable URL pe** — kuch is tarah:

```text
https://my-app-git-fix-checkout-bug-myteam.vercel.app
```

Ye URL PR khulte hi (ya usme naya commit push hote hi) automatically generate/update hota hai, aur ye **poori tarah functional, real running deployment hai** — sirf ek screenshot ya diff nahi. Koi bhi is URL ko click karke actual UI mein click-through kar sakta hai, exactly jaisa production mein dikhega.

### Kyun ye review quality ko meaningfully improve karta hai

Ek code review mein jab tumhe sirf diff dikhta hai:

```text
- <button className="btn-primary">Submit</button>
+ <button className="btn-primary-v2">Submit</button>
```

Reviewer ko **imagine** karna padta hai ki `btn-primary-v2` class actually kaisi dikhti hai — spacing, color, hover state, mobile responsiveness, sab kuch mentally simulate karna padta hai code se. Ye especially visual/UX changes ke liye unreliable hai — CSS ka real rendering result diff se predict karna almost impossible hai jab tak tum expert-level CSS-in-head na ho.

Preview deployment isse solve karta hai: reviewer seedha URL kholta hai, actual button dekhta hai, click karta hai, hover karta hai, mobile viewport pe resize karta hai — **verify karta hai, imagine nahi karta**. Ye especially valuable hai in scenarios mein:

- **Design/stakeholder review** — ek designer ya PM jo code padh nahi sakta, wo bhi preview URL click karke feedback de sakta hai, bina developer ko chahiye "isko run karke dikhao mujhe" bolna.
- **Cross-browser/device testing** — reviewer apne khud ke device/browser se preview URL khol sakta hai, real environment mein test kar sakta hai.
- **QA sign-off before merge** — QA team ko poora local setup karne ki zaroorat nahi, seedha preview URL pe test cases run kar sakte hain.

```yaml
# .github/workflows पर koi extra config zaroori nahi Vercel/Netlify GitHub integration ke saath —
# ye automatically har PR pe comment kar deta hai preview URL ke saath. Manual CLI wala equivalent:
name: PR Preview Comment # workflow ka naam
on: # trigger
  pull_request: # PR events pe
    types: [opened, synchronize] # jab PR khule, ya naya commit push ho (synchronize)
jobs: # jobs
  preview: # preview job
    runs-on: ubuntu-latest # runner
    steps: # steps
      - name: Checkout # code checkout
        uses: actions/checkout@v4 # action
      - name: Deploy Preview # actual preview deploy step
        id: deploy # id diya taaki iska output baad mein reference kar sakein
        run: echo "url=$(npx vercel deploy --token=${{ secrets.VERCEL_TOKEN }})" >> "$GITHUB_OUTPUT" # deploy karke returned URL ko GitHub Actions output variable mein store kiya
      - name: Comment PR with preview link # PR pe automatically comment karna
        uses: actions/github-script@v7 # GitHub API ko script se call karne wala official action
        with: # inputs
          script: | # inline JS script jo GitHub API call karega
            github.rest.issues.createComment({ // PR (jo GitHub ke liye ek "issue" hi hai) pe comment banane wala API call
              issue_number: context.issue.number, // current PR ka number
              owner: context.repo.owner, // repo owner
              repo: context.repo.repo, // repo naam
              body: `Preview deployed: ${{ steps.deploy.outputs.url }}` // comment body mein preview URL insert kiya
            }) // API call ka end
```

**Senior note**: RN handbook ke Maestro E2E job (`13-eas-workflows.html`, section 4) ka goal tha "har build ek automated gate se guzre, human discipline pe depend na ho." Preview deployments similarly automated hain — koi bhola karo, koi manually "please deploy a test build" na maange, PR khulte hi preview khud-ba-khud generate ho jaata hai. Difference sirf ye hai ki Maestro machine-verified gate hai (pass/fail), preview deployment ek **human-verified** gate hai (reviewer khud dekh ke confirm karta hai) — dono complementary safety layers hain.

---

## Environment Variables and Config Across Environments

Har real app ko multiple environments mein chalna padta hai — local dev, staging (ya "preview"), aur production — aur har environment ka apna config hota hai (alag API URLs, alag feature flag defaults, alag analytics keys). Vercel/Netlify dono per-environment variable management provide karte hain — Vercel dashboard mein tum ek variable ko specifically "Production", "Preview", ya "Development" scope ke liye set kar sakte ho.

```bash
# Vercel CLI se environment-specific variable set karna
vercel env add DATABASE_URL production # ye variable sirf production deployments mein available hoga
vercel env add DATABASE_URL preview    # alag value, sirf PR preview deployments ke liye (usually staging DB)
vercel env add DATABASE_URL development # local `vercel dev` ke liye, developer ke apne machine pe
```

### `NEXT_PUBLIC_` — wahi exact lesson jo RN handbook `EXPO_PUBLIC_` ke saath sikhata hai

Agar tumne RN handbook ka backend/Supabase chapter padha hai, tumhe `EXPO_PUBLIC_` prefix ka concept yaad hoga — koi bhi env var jo `EXPO_PUBLIC_` se prefixed hai, wo **build time pe client JS bundle mein bake ho jaata hai**, aur device pe installed app ke bundle ke andar plainly readable hota hai (koi bhi decompile/inspect karke dekh sakta hai). Next.js mein **exact same mechanism**, sirf naam different hai: `NEXT_PUBLIC_` prefix.

```typescript
// .env.local — server-side ke liye, kabhi bhi client bundle mein nahi jaata
DATABASE_URL=postgres://user:pass@host:5432/db // sirf Node.js server-side code (API routes, server components) mein accessible, browser JS mein nahi aata

// NEXT_PUBLIC_ prefix wala variable — YE CLIENT BUNDLE MEIN JAATA HAI
NEXT_PUBLIC_API_URL=https://api.example.com // build time pe literally is string ki value client JS mein hardcode ho jaati hai
```

```typescript
// component.tsx
export function ApiStatus() {
  // ye access seedha client-side JS mein resolve ho jaata hai build time pe —
  // browser devtools mein bundle inspect karke koi bhi is exact string ko dekh sakta hai
  const apiUrl = process.env.NEXT_PUBLIC_API_URL; // "https://api.example.com" — publicly visible value

  return <div>API: {apiUrl}</div>; // render kiya, koi secret nahi hai isme (isliye public hona theek hai)
}
```

**Universal frontend lesson — RN-specific nahi hai**: ye rule sirf React Native ya Next.js tak limited nahi hai — **koi bhi frontend framework** (Vite ka `VITE_*`, Create React App ka `REACT_APP_*`, Next.js ka `NEXT_PUBLIC_*`, Expo ka `EXPO_PUBLIC_*`) same underlying principle follow karta hai: jo bhi env var **client-side JS mein expose** hota hai (build-time substitution ke through), wo **shipped bundle mein publicly readable** hai, chahe wo web ho ya mobile. Iska matlab hai:

- **Kabhi bhi secrets (API keys jo server-side auth chahiye, database credentials, private tokens) ko `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_` prefix ke saath mat rakho** — chahe tumhe "convenient" lage. Ye prefix literally "publicly expose karo" ka instruction hai build tool ko.
- Sirf wahi values in prefixes ke saath rakho jo **genuinely public hain** — public API endpoints, analytics tracking IDs, feature-flag-service public keys (jo already client-side evaluation ke liye designed hain).
- Agar kisi secret ko client-side logic mein "use" karna hai (jaise ek third-party API call jo authenticated honi chahiye), wo call **server-side** (API route/server component/backend proxy) se honi chahiye, client se seedha nahi.

```bash
# .env.production — WRONG pattern, dikhne mein convenient lekin security bug hai
NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_xxxxx # GALAT — ye secret key hai, "NEXT_PUBLIC_" ka matlab hai ye client bundle mein publicly readable hoga

# .env.production — CORRECT pattern
STRIPE_SECRET_KEY=sk_live_xxxxx # prefix nahi hai, isliye ye sirf server-side Node.js runtime mein accessible hai, client bundle mein kabhi nahi jaata
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx # ye Stripe ki publishable key hai — designed hi client-side use ke liye hui hai, isliye public hona sahi hai
```

**Senior note**: "Works in preview, broken in production" bugs ka sabse common source yahi hai — ek env var preview environment mein set hai lekin production mein forgot kar diya, ya values slightly mismatch hain (jaise preview mein staging API URL, production mein production URL, aur koi typo ho gaya). Section 8 mein isko concrete gotcha ke roop mein dekhenge.

---

## Feature Flags — Web's Rollout Mechanism (Parallel to EAS Update's Rollout Percentages)

RN handbook ka `12-eas-update.html` chapter, section "Rollout Percentage Strategies" mein ye pattern dikhaya tha: ek OTA update ko turant 100% users ko na bhejo — pehle 10% ko bhejo, monitor karo, phir gradually 50%, 100% tak ramp-up karo, aur agar problem dikhe toh 0% pe wapas le aao. Ye poora mechanism **server-side pointer + device-side per-request eligibility check** pe based hai.

Web mein iska equivalent — conceptually identical goal, completely different mechanism — **feature flags** hain.

### Core idea

Feature flags ka fundamental insight ye hai: **"deploy" aur "release" do alag concepts hain**. Tum apna naya feature-containing code **100% users ko deploy** kar sakte ho (sab users ka browser wahi JS bundle download karega), lekin feature khud **disabled** rakh sakte ho ek runtime check ke peeche — matlab code technically har jagah hai, lekin visually/functionally "off" hai jab tak flag enable na ho.

```typescript
// feature-flags.ts — simplest possible pattern, self-hosted/basic approach
type FeatureFlags = {
  newCheckoutFlow: boolean; // naya checkout redesign, abhi rollout ho raha hai
  darkModeV2: boolean; // dark mode ka naya implementation
};

// runtime pe flags fetch karne wala function — ek remote config service se, ya simple JSON endpoint se
async function fetchFeatureFlags(userId: string): Promise<FeatureFlags> {
  // ek lightweight API call jo current user ke liye applicable flags return karta hai
  const res = await fetch(`/api/feature-flags?userId=${userId}`); // user-specific evaluation ke liye userId pass kiya
  return res.json(); // parsed flags object return kiya
}

// component ke andar usage
function CheckoutPage({ flags }: { flags: FeatureFlags }) {
  // simple conditional rendering — flag on hai toh naya component, warna purana
  if (flags.newCheckoutFlow) {
    return <NewCheckoutFlow />; // naya, in-progress rollout wala UI
  }
  return <LegacyCheckoutFlow />; // stable, already-proven UI — default fallback
}
```

```typescript
// server-side evaluation logic — percentage-based rollout, EAS Update ke --rollout-percentage jaisa concept
function isUserInRollout(userId: string, rolloutPercentage: number): boolean {
  // userId ka ek consistent hash generate kiya — same user hamesha same bucket mein aayega (flip-flop nahi hoga)
  const hash = simpleHash(userId); // deterministic hash function, koi bhi stable hashing algorithm chalega
  // hash ko 0-100 range mein normalize karke rolloutPercentage se compare kiya
  return (hash % 100) < rolloutPercentage; // agar hash ka mod-100 value rollout percentage se kam hai, user "in" bucket mein hai
}

function simpleHash(str: string): number {
  let hash = 0; // accumulator, 0 se start
  for (let i = 0; i < str.length; i++) { // string ke har character pe loop
    hash = (hash << 5) - hash + str.charCodeAt(i); // ek simple bit-shifting hash formula, deterministic output deta hai
    hash |= 0; // 32-bit integer mein force kiya, overflow control ke liye
  }
  return Math.abs(hash); // negative avoid karne ke liye absolute value return ki
}
```

### Instant rollback — web ka sabse bada advantage yahan

Agar `newCheckoutFlow` mein koi critical bug nikal jaaye, fix karna sirf ek flag flip karna hai — **koi naya deploy nahi**, koi build pipeline nahi, koi wait nahi:

```bash
# ek simple self-hosted flag-service ke against, curl se flag ko turant disable karna
curl -X PATCH https://flags.internal.example.com/api/flags/newCheckoutFlow \
  -H "Authorization: Bearer $FLAG_SERVICE_TOKEN" \
  -d '{"enabled": false, "rolloutPercentage": 0}'
# ye request seconds mein propagate hoti hai — agla API call jo flag check karega, updated value dekhega
```

Ye redeploy se bhi **fast** hai — even web ka atomic redeploy (section 7 mein dekhenge) mein bhi ek naya deployment record activate karna padta hai; flag flip sirf ek database row update hai, jo turant propagate ho jaata hai. Ye web-specific rollback speed ka ek extra layer hai, deployment rollback se bhi upar.

### Tools at scale

Chhote projects ke liye upar wala self-hosted pattern (database table + simple API) sufficient hai. Scale badhne pe (multiple teams, complex targeting rules — jaise "sirf enterprise-tier users ko", "sirf specific country ke users ko"), dedicated tools use karte hain:

- **LaunchDarkly** — industry-standard, sophisticated targeting rules, real-time flag updates via SDK, detailed analytics on flag usage.
- **Simpler self-hosted approaches** — Unleash (open-source), ya even ek simple database table + admin dashboard jo internal teams manage karte hain, chhoti teams ke liye kaafi hota hai.

**Senior note — direct parallel banate hain**: EAS Update ka `--rollout-percentage 10` → `50` → `100` flow, aur feature flag ka `rolloutPercentage` field, **same underlying pattern hai**: gradual, monitored, reversible exposure increase. Difference sirf ye hai ki EAS Update ka rollout ek **naye JS bundle ki availability** ko control karta hai (device ko naya bundle milta hi nahi jab tak rollout uska bucket cover na kare), jabki feature flag ka rollout ek **already-shipped code ke behavior** ko control karta hai (code sab jagah hai, sirf ek if-check decide karta hai wo chalega ya nahi). Web mein flag flip **instant** hai kyunki koi client-side "next launch check" involved nahi hai — server-side evaluation har request pe fresh hoti hai.

---

## Edge Deployment — Running Code Physically Close to Users

`06-cdn.md` mein humne Edge Functions ka core concept already dekha hai (section 3, "Static Assets vs Dynamic Content at the Edge") — ki CDN ab sirf static-file-caching tool nahi hai, balki edge locations pe **actual compute** bhi run kar sakta hai. Is chapter mein hum usi concept ko specifically **deployment decision** ke angle se dekhte hain.

Jab tum Vercel Edge Functions ya Cloudflare Workers deploy karte ho, tumhara small piece of server logic **ek centralized region mein nahi, balki globally-distributed edge locations mein** deploy hota hai — same PoPs jahan static assets cache hoti hain.

```typescript
// middleware.ts — Next.js Edge Middleware example, deployment ke context mein
export const config = { // Edge runtime pe deploy karne ka config
  matcher: "/dashboard/:path*", // sirf /dashboard/* routes ke liye ye middleware chalega
};

export function middleware(request: Request) { // ye function edge locations pe globally deploy hota hai, ek centralized region mein nahi
  const token = request.headers.get("Authorization"); // incoming request se auth token nikaala

  if (!token) { // agar token missing hai
    // redirect response yahin edge pe generate ho gaya — origin server ko involve kiye bina
    return Response.redirect(new URL("/login", request.url)); // user ko login page pe redirect kiya, latency minimal kyunki edge pe hua
  }

  // agar token present hai, request ko origin/backend tak forward kar diya normal flow mein
  return undefined; // undefined return karne ka matlab hai "request ko normally continue hone do"
}
```

Deployment-relevant consideration ye hai: is middleware ka har instance **user ke physically closest edge location** pe run hota hai — Mumbai user ke liye Mumbai edge pe, Frankfurt user ke liye Frankfurt edge pe — na ki tumhare backend ke single region (jaise us-east-1) mein. Latency-sensitive decisions (auth checks, A/B routing decisions, geolocation-based redirects) yahan resolve hone se, request ko unnecessary origin round-trip nahi karna padta.

**Deployment implication**: jab tum edge functions use karne ka decide karte ho, tum effectively apna deployment target "one region" se "every PoP globally" mein badal dete ho — ye deployment strategy ka hi ek extension hai, sirf application code ke architecture ka nahi. Isliye deployment planning karte waqt socho: "kaunsi logic itni latency-sensitive hai ki usse edge pe rakhna worth hai, aur kaunsi logic origin/backend pe hi reh sakti hai (jaise heavy database queries, jo edge runtime ke limited environment mein anyway possible nahi hoti)?"

---

## Rollback Strategies

Ye section web deployment ka sabse practically-important advantage cover karta hai, aur RN handbook ke OTA rollback se ek direct, explicit contrast banata hai.

RN handbook (`12-eas-update.html`, section "Reverting a Bad Update") mein humne dekha tha: OTA rollback bhi fast hai — "rollback" ka matlab literally naya bundle build karna nahi hai, sirf channel ke pointer ko purani, known-good update pe wapas point karna hai. Lekin **is speed ki ek limitation hai**: device ko ye naya (rolled-back) manifest tabhi milega jab wo **next launch/foreground** pe check karega. Matlab rollback server-side turant ho jaata hai, lekin actual effect user ke device pe unke agle app-open tak delayed rehta hai.

### Web mein rollback — atomic aur truly instant

Modern deployment platforms (Vercel, Netlify) ek fundamentally different model follow karte hain: **har previous deployment permanently available rehta hai**, apne khud ke immutable URL ke saath, aur "production" sirf ek **pointer/alias** hai jo kisi bhi deployment ko point kar sakta hai.

```bash
# deployment history dekhna — Vercel CLI se
vercel ls my-app # is project ke saare recent deployments list karta hai, har ek ka apna unique URL/ID hai

# output kuch aisa dikhega (conceptually):
# my-app-abc123.vercel.app   (current production — v45, naya deploy jisme bug hai)
# my-app-xyz789.vercel.app   (v44, previous deployment — known-good, working state)
# my-app-def456.vercel.app   (v43, aur purana)

# production alias ko purani (known-good) deployment pe re-point karna
vercel alias set my-app-xyz789.vercel.app my-app.com # production domain ab v44 deployment ko point karta hai, v45 ko nahi
```

Ye operation **atomic** hai — CDN/edge-level routing table mein ek entry update hoti hai ("production domain ab is deployment ID ko point karta hai"), aur **agli hi request** (jo koi bhi user, kisi bhi region se bheje) naye pointer ke through purani, working deployment se serve hoti hai. Koi client-side "check for update" involved nahi hai, koi "next launch" wait nahi hai — traffic re-routing edge-level pe instant hai.

```text
# Rollback comparison — mobile OTA vs web

Mobile OTA rollback:
  1. Server-side: channel pointer update (instant)
  2. Device: next launch/foreground par manifest check
  3. Device: naya (rolled-back) manifest detect, download
  4. Device: agli launch se effective
  → Total user-facing rollback time: minutes to days (depends on user's app-open frequency)

Web deployment rollback:
  1. Edge-level: production alias/pointer update (instant, atomic)
  2. Next incoming request (any user, any region): automatically routed to reverted deployment
  → Total user-facing rollback time: seconds
```

Ye contrast interview mein aana chahiye: web ka rollback **client behavior pe depend nahi karta** — ye purely server/edge-side routing decision hai. Mobile OTA rollback bhi fast hai (comparatively naye native build se), lekin phir bhi ek client-side "polling" step involved hai jo delay introduce karta hai.

### Senior practice — deploy karne se pehle hi socho rollback ka

Har deployment ko is lens se dekho: "agar isme bug nikla, main kitni jaldi aur kitni cleanly wapas ja sakta hoon?" Immutable deployments (jahan har deploy apna khud ka permanent, addressable artifact hai) ye guarantee dete hain ki rollback hamesha available hai — tumhe koi "undo commit + rebuild" process nahi karna padta, sirf pointer switch karna hai.

---

## Real-World Gotchas

- **"Fast, easy deploy" ko "correctness ki zaroorat nahi" samajhna** — ye sabse common team-culture mistake hai jo frequent production incidents ka root cause hoti hai. Web deployment ka mechanism fast hai, lekin usse ye follow nahi hota ki tumhara code correctness ke liye same rigor nahi chahiye jo mobile mein hoti hai. Teams jo "chalo push karte hain, easy toh hai revert karna" mentality follow karti hain, end up shipping untested edge cases production mein — sirf isliye ki deployment friction kam thi, testing discipline bhi kam kar diya. Deployment ki ease **testing ki necessity ko replace nahi karti**, sirf iteration speed badhati hai.
- **Environment variable typos/misconfiguration — "works in preview, broken in prod" ka sabse common source** — jab preview environment mein ek variable set hai (jaise staging API URL) lekin production environment mein wo variable **missing hi hai**, ya value mein typo hai, code preview mein perfectly kaam karta hai (developer confident feel karta hai "test kar liya, sab theek hai"), lekin production mein silently fail hota hai (undefined value, ya galat endpoint hit hota hai). Mitigation: environment variable schema validation add karo (jaise Zod se `process.env` parse karna app startup pe), taaki missing/malformed env vars **build/deploy time pe hi fail** ho jaayein, runtime pe silent bug ban ke nahi.
- **Feature flags jo rollout complete hone ke baad bhi enabled reh jaate hain — "flag debt"** — jab ek feature flag ka rollout 100% complete ho jaata hai aur feature ab stable/permanent hai, teams often bhool jaati hain flag ko **remove karna** — flag check condition code mein permanently reh jaati hai, chahe uska "off" branch kabhi exercise hi na ho. Time ke saath ye accumulate hoti hai — dozens of stale, always-true flag checks jo codebase ko harder-to-reason-about banate hain (kaunsa flag actually still meaningful hai, kaunsa dead weight hai, ye track karna mushkil ho jaata hai), aur new engineers confuse hote hain ye dekh ke ki `if (flags.oldFeatureFromLastYear)` abhi bhi code mein hai. Senior practice: har feature flag ke saath ek "cleanup ticket" bhi create karo jab flag banayi jaaye, taaki rollout complete hone ke baad flag aur uska dead branch explicitly remove ho — flag lifecycle ko "temporary tool" treat karo, permanent architecture nahi.
- **Preview deployment ko production jaisa treat na karna, phir "preview mein toh chala tha" bolna** — preview deployments aksar alag (chhoti/staging-tier) database, alag rate limits, ya alag third-party API keys use karte hain. Agar tumne preview mein ek feature "test" kiya lekin actual production-scale data/traffic conditions kabhi simulate nahi kiye, preview success ka matlab production success guarantee nahi hai — preview ek **UI/logic verification tool** hai, ek **load/scale testing tool** nahi.
- **`vercel alias`/production rollback karne ke baad naya code deploy karte waqt purani state ko bhool jaana** — agar tumne rollback kiya (production ko v44 pe wapas point kiya), aur phir kisi ne bina realize kiye normal `git push` kiya jo naya build trigger karta hai, wo naya build ho sakta hai wahi buggy v45 code se hi ban raha ho (agar underlying branch fix nahi hua tha, sirf pointer switch hua tha) — matlab agla automatic deploy silently wapas buggy version ko production pe le aa sakta hai. Rollback ke baad **root cause ko actual code fix karke branch mein commit karna zaroori hai**, sirf pointer switch karna temporary band-aid hai, permanent fix nahi.

---

## Key Takeaways

- Web deployment mobile se fundamentally easier hai kyunki koi app-store-review gate nahi hai, aur users ko explicitly update install nahi karna padta — bas naya page load naya version deta hai. Ye ease double-edged hai: bina safety practices ke, broken changes bhi seconds mein saare users tak pahunch sakte hain.
- CI/CD pipeline ka standard order — install → lint/typecheck → test → build → deploy preview/staging → promote production — fail-fast principle follow karta hai, cheapest checks pehle.
- Preview deployments (Vercel/Netlify) mobile CI/CD se ek unique advantage hain — har PR ko ek live, clickable URL milta hai, jisse review "imagine karo diff se" se "actually verify karo running app mein" ban jaata hai.
- `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_` — sab same universal rule follow karte hain: koi bhi client-exposed env var, framework kuch bhi ho, shipped bundle mein publicly readable hoti hai. Secrets in prefixes ke saath kabhi mat rakho.
- Feature flags web ka equivalent hain EAS Update ke rollout-percentage feature ka — code ko 100% deploy karo, feature ko gradually enable karo, aur bug milte hi instant flag-flip se disable karo — deployment se bhi fast rollback.
- Edge Functions (Vercel Edge, Cloudflare Workers) deployment ko "one region" se "globally distributed" bana dete hain — latency-sensitive logic (auth, A/B routing) ke liye relevant deployment consideration hai.
- Web rollback (production alias ko purani immutable deployment pe re-point karna) atomic aur truly instant hai — mobile OTA rollback fast hai lekin phir bhi client-side "next launch check" pe depend karta hai.
- Deployment ki ease testing discipline ko replace nahi karti — env var misconfig aur flag debt do sabse common real-world sources hain "preview mein chala, prod mein tuta" jaisi incidents ka.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. Web deployment mobile app deployment se fundamentally kaise different hai, aur is difference ka practical impact kya hai?**

Web deployment mein naye files ek server/CDN pe daal do, aur user ka agla page load automatically naya version dikhata hai — koi external review process (jaise Apple/Google App Store review) involved nahi hai, aur user ko explicitly kuch "install"/"update" karne ki zaroorat nahi. Mobile app deployment mein native binary change ke liye naya build, naya store submission, aur review process (1-7 din) chahiye hota hai, aur OTA (JS-only) updates ke liye bhi user ko app reopen karna padta hai naya bundle check karne ke liye. Practical impact: web mein iteration speed dramatically fast hai, lekin correspondingly **koi external safety net nahi hai** — jo bhi deploy hua, turant sabhi users tak pahunch sakta hai bina kisi gatekeeper check ke. Isliye web teams ko apni khud ki safety practices (preview deploys, staged rollout via flags, monitoring) invest karni padti hain, jo mobile mein partially app-store-review se milti hain.

**Q2. Preview deployments (Vercel/Netlify) code review process ko kaise improve karte hain? Concrete example do.**

Traditional code review mein reviewer sirf diff dekhta hai aur mentally simulate karta hai ki visual/UX changes actually kaise dikhenge — jaise ek CSS class change (`btn-primary` → `btn-primary-v2`) ka real rendering result diff se accurately predict karna mushkil hai. Preview deployment har PR ko ek unique, live URL deta hai jahan actual running app dekha ja sakta hai — reviewer button ko actually click kar sakta hai, hover state dekh sakta hai, mobile viewport pe resize karke responsive behavior verify kar sakta hai. Ye especially valuable hai non-technical stakeholders (designers, PMs) ke liye jo code padh nahi sakte lekin URL click karke visually verify kar sakte hain — review "imagine from diff" se "verify from running app" mein shift ho jaata hai.

**Q3. `NEXT_PUBLIC_` prefix wale environment variables ke baare mein sabse common security mistake kya hai, aur RN developers ke liye ye concept familiar kyun hona chahiye?**

Sabse common mistake hai secrets (API keys jo server-side auth chahiye, database credentials) ko `NEXT_PUBLIC_` prefix ke saath rakh dena — kyunki prefix "convenient" lagta hai client-side access ke liye, developer bhool jaate hain ki ye prefix literally build tool ko instruction hai "is value ko client JS bundle mein bake kar do, publicly readable banao". RN developers ke liye ye concept familiar hona chahiye kyunki Expo mein bhi exact same mechanism hai `EXPO_PUBLIC_` prefix ke saath — dono cases mein underlying rule universal hai: koi bhi client-side-exposed env var, framework kuch bhi ho, shipped bundle mein readable hai. Fix hamesha same hai: secrets ko unprefixed rakho (sirf server-side accessible), aur genuinely-public values (public API URLs, publishable keys) ko hi prefix do.

**Q4. Feature flags aur EAS Update ke rollout-percentage feature mein conceptual similarity aur mechanistic difference explain karo.**

Conceptual similarity: dono ka goal same hai — ek change ko turant 100% users ko expose karne ke bajaye, gradually, monitored, aur easily-reversible tareeke se rollout karna. Mechanistic difference: EAS Update ka rollout percentage control karta hai ki **kaunsa naya JS bundle device ko milega hi ya nahi** — jo devices rollout se bahar hain, unhe naya update download hone ka chance hi nahi milta, wo apna purana bundle chalate rehte hain, aur check sirf app launch/foreground pe hoti hai. Feature flags mein code **sabhi users ko already deployed hota hai** — rollout percentage sirf ek runtime if-check ko control karta hai (flag on/off), aur ye evaluation har request pe real-time hoti hai, koi "device ka next check" involved nahi. Isi wajah se feature flag rollback (flag flip) EAS Update rollback se bhi fast hai — koi client-side polling delay nahi hai.

**Q5. Web deployment rollback ko "atomic aur instant" kyun bola jaata hai, aur ye mobile OTA rollback se kaise different hai speed ke terms mein?**

Modern platforms (Vercel/Netlify) har deployment ko ek permanent, immutable artifact ke roop mein store karte hain apne khud ke URL ke saath — production ek pointer/alias hai jo kisi bhi deployment ko point kar sakta hai. Rollback matlab sirf ye pointer ek purani, known-good deployment pe re-point karna — ye edge-level routing table ka ek single update hai, aur **agli hi incoming request** (koi bhi user, kahin se bhi) automatically naya pointer follow karti hai. Ye truly instant hai kyunki koi client-side involvement nahi hai. Mobile OTA rollback bhi fast hai (server-side channel pointer switch, naya bundle build nahi karna padta), lekin actual effect device pe tab tak nahi hota jab tak device khud **next launch/foreground pe manifest check** na kare — matlab rollback ka user-facing effect device ke usage pattern pe depend karta hai (active users fast, dormant users slow), jabki web mein har request independently, immediately naye pointer se resolve hoti hai.

**Q6. Ek team bolti hai "humein feature flags ki zaroorat nahi, hum sirf directly deploy karte hain aur agar bug aaye toh revert kar dete hain." Isme kya risk hai jo wo miss kar rahe hain?**

Deployment revert (rollback) aur feature flag dono reversibility provide karte hain, lekin different granularity aur speed pe. Deployment revert **poori deployment** ko revert karta hai — agar ek deploy mein 5 unrelated changes bundled hain aur sirf ek mein bug hai, revert karne se baaki 4 working changes bhi wapas chale jaate hain. Feature flag **specific feature** ko isolate karke disable kar sakta hai, baaki deployment (aur baaki features) unaffected rehte hain. Isse zyada critical: feature flags "dark launch" allow karte hain — code ko production mein deploy karke real infrastructure pe verify karo (bina users ko dikhaye), phir gradually enable karo, jabki pure deploy-and-revert approach mein tumhe pehle hi 100% users ko expose karna padta hai kisi bhi verification se pehle. Flags ka absence matlab bigger blast radius har change ke liye, aur coarser-grained rollback control.

**Q7. Environment variables ka "works in preview, broken in production" bug class kaise hota hai, aur senior-level prevention strategy kya hai?**

Ye bug tab hota hai jab preview/staging environment mein ek env var correctly set hai (jaise ek staging API URL ya test-mode third-party key), lekin production environment mein wo variable **missing hai, ya value typo/mismatch ke saath set hai**. Developer preview mein test karta hai, sab kaam karta hai dikh raha hai, confidence ban jaata hai — lekin production mein deploy hote hi silently fail hota hai (undefined value use ho raha hai, ya galat endpoint hit ho raha hai) kyunki us specific environment ka config kabhi verify nahi hua tha runtime tak. Senior-level prevention: application startup pe hi env var **schema validation** run karo (jaise Zod ya similar library se `process.env` ko parse/validate karna) — agar koi required variable missing ya malformed hai, app **build/deploy time pe hi crash/fail** ho, silent runtime bug ban ke users tak na pahunche. Isse "missing env var" ek loud, immediate CI failure ban jaata hai, na ki ek confusing production incident.

**Q8. "Flag debt" kya hai, aur ye codebase health ko kaise affect karta hai?**

Flag debt tab accumulate hota hai jab feature flags jinka rollout already 100% complete ho chuka hai (feature ab stable/permanent hai), unhe code se remove nahi kiya jaata — flag check condition (`if (flags.xyz)`) permanently code mein reh jaati hai, chahe uska "false" branch kabhi practically exercise hi na ho. Time ke saath ye dozens of stale flags accumulate karta hai, jo codebase ko harder-to-reason-about banata hai — new engineers confuse hote hain ye samajhne mein ki kaunsa flag "abhi bhi meaningful, actively rolling out" hai vs "years purana, hamesha-true, effectively dead code jo bhool gaye remove karna". Prevention: har flag creation ke saath ek explicit "cleanup" ticket/reminder bhi create karo, taaki rollout complete hone ke baad flag aur uska dead branch ko systematically remove karne ka process ho — flag ko permanent architecture treat karne ke bajaye ek temporary, time-bound tool treat karo.

**Q9. Debugging scenario: production users complain kar rahe hain ki ek naya feature "kabhi dikhta hai, kabhi nahi dikhta" — same user ke liye bhi inconsistent behavior report ho raha hai. Kya check karoge?**

Pehla suspect hoga feature flag evaluation ki consistency — check karo ki flag evaluation **per-request** ho rahi hai ya **per-session/cached** — agar user ka rollout-bucket assignment consistent hashing (jaise userId-based hash) pe based nahi hai, aur har request pe fresh random evaluation ho rahi hai, same user ko different requests pe different results milenge (flip-flopping). Dusra suspect: agar app CDN/edge caching use kar rahi hai aur flag-dependent content galti se cache ho raha hai bina proper `Vary` header/cache-key differentiation ke (jaisa `06-cdn.md` mein discuss kiya tha per-user content ke context mein) — ek user ka cached (flag-on) response doosre user (flag-off) ko mil sakta hai, ya same user ko alag-alag edge locations se alag cached versions mil sakte hain jab tak propagation complete na ho. Fix: ensure karo flag assignment deterministic/hash-based hai (same input = same output, hamesha), aur agar caching involved hai, flag-dependent responses ko cache-key mein flag-state include karke differentiate karo.
