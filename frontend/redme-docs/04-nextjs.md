# Next.js — App Router, Server Components, aur Modern Rendering Model

Next.js ko sirf "React ka framework wrapper" samajhna galat hai — App Router ke aane ke baad Next.js ne
poore rendering model ko re-architect kiya hai around React Server Components (RSC). Ye chapter tumhe wo
mental model degi jo ek senior engineer ke paas honi chahiye: kya server pe chalta hai, kya client pe,
kab kaunsa data-fetching pattern use karna hai, aur wo gotchas jo SPA background wale developers ko
sabse zyada confuse karte hain. Hum App Router ko primary focus rakhenge (yehi modern default hai);
Pages Router sirf historical context ke liye touch karenge.

## Is chapter mein

1. [App Router vs Pages Router — Why Next.js Changed Its Whole Model](#1-app-router-vs-pages-router--why-nextjs-changed-its-whole-model)
2. [Server Components vs Client Components — The Biggest Mental Model Shift](#2-server-components-vs-client-components--the-biggest-mental-model-shift)
3. [File-Based Routing, Layouts, and Nested Layouts](#3-file-based-routing-layouts-and-nested-layouts)
4. [Data Fetching in Server Components](#4-data-fetching-in-server-components)
5. [Route Handlers (API Routes in App Router)](#5-route-handlers-api-routes-in-app-router)
6. [Middleware](#6-middleware)
7. [Metadata API for SEO](#7-metadata-api-for-seo)
8. [Real-World Gotchas](#8-real-world-gotchas)
9. [Key Takeaways](#key-takeaways)
10. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## 1. App Router vs Pages Router — Why Next.js Changed Its Whole Model

Thoda history samjho pehle, kyunki iske bina "why App Router exists" click nahi karega.

**Pages Router (Next.js ka original model, `pages/` directory):**
- Convention simple thi — `pages/about.tsx` = `/about` route. File = page, bas.
- Default behavior **client-rendered** tha — component browser mein hi mount/render hota tha, exactly
  jaise plain React SPA mein hota hai (hydration ke through).
- Server-side data chahiye toh explicitly opt-in karna padta tha — `getServerSideProps` (har request pe
  server pe run hota, SSR) ya `getStaticProps` (build time pe run hota, SSG). Ye functions page component
  se **alag** export hote the, aur data ko props ke through page tak pahunchate the.
- Problem ye thi ki har page ek monolithic unit thi — agar page ke andar ek chhota interactive widget tha
  (jaise ek like button), poora page ka JS bundle client ko bhejna padta tha, chahe 90% content static
  ho.

**App Router (`app/` directory, Next.js 13+ se default, 14/15 mein production-mature):**
- File-system based routing wahi rehta hai, lekin ye sirf ek surface-level similarity hai. Real change
  ye hai ki App Router **React Server Components (RSC) ke ground-up around banaya gaya hai**.
- Convention badal gayi: `page.tsx` (route ka content), `layout.tsx` (shared shell), `loading.tsx`,
  `error.tsx` — har ek ka apna special purpose hai (detail section 3 mein).
- Sabse fundamental shift: **ab har component by default server pe render hota hai**, aur sirf wahi
  JavaScript client ko jaata hai jiski interactivity ke liye zaroorat ho. Ye ek granular, per-component
  decision ban gaya hai, na ki per-page.

Isliye ye genuinely ek **paradigm shift** hai, folder rename nahi:

| Aspect | Pages Router | App Router |
|---|---|---|
| Default rendering | Client-side (hydrated SPA) | Server Components (zero JS by default) |
| Data fetching | `getServerSideProps`/`getStaticProps` (separate functions) | `async`/`await` directly inside component |
| Granularity of "server vs client" | Whole page | Per-component (`"use client"` opt-in) |
| Layouts | Manual (`_app.tsx` wraps everything, re-renders on nav) | Nested `layout.tsx`, persists across navigation |
| Streaming/Suspense | Limited | First-class (`loading.tsx`, `<Suspense>`) |
| Mental model | "React app that Next.js serves" | "Server-first app that selectively ships JS" |

Practical implication: Pages Router mein tum React ki SPA mental model carry karte the (`useEffect` for
fetching, everything client-rendered), Next.js sirf routing + SSR convenience add karta tha. App Router
mein tumhe **naya mental model** seekhna padta hai — "server components by default, client components
sirf jab zaroorat ho" — jo next section mein deep dive karenge.

---

## 2. Server Components vs Client Components — The Biggest Mental Model Shift

Ye is poori chapter ka core concept hai. Agar ye samajh gaye, baaki sab easy hai.

### Default: Server Component

`app/` directory ke andar **har file by default ek Server Component hai** — koi special syntax nahi
chahiye. Server Component:

- Server pe render hota hai (build time pe, ya request time pe — depends on caching strategy).
- Render hone ke baad, sirf resulting **HTML + ek serialized description** (React ka internal "RSC
  payload", JSON jaisa format) client ko bhejta hai.
- **Zero JavaScript** us component ke liye browser ko bhejta hai — matlab uska component code, uske
  imports, uski logic — kuch bhi client-side bundle mein nahi jaata. Sirf output (HTML) jaata hai.
- Server pe hi database calls, file-system access, secrets (API keys) directly use kar sakta hai — kyunki
  ye code kabhi browser mein pahuchta hi nahi, security concern nahi hai.

### Kab Client Component chahiye

Client Component tab banate ho jab component ko **browser mein actually run** hona zaroori ho:

- `useState`, `useEffect`, `useContext` jaise React hooks use kar rahe ho.
- Event handlers hain (`onClick`, `onChange`, etc.) — browser mein hi ye events fire honge.
- Browser-only APIs use kar rahe ho (`window`, `localStorage`, `navigator.geolocation`).
- Third-party libraries jo browser APIs pe depend karti hain (jaise kuch charting libraries).

File ke **sabse top** pe `"use client"` directive daal ke ye declare karte ho. Ye ek build-time boundary
marker hai — Next.js/React compiler ko batata hai "is file se aage jo bhi import chain hai, sab client
bundle mein jaana chahiye."

### Why this matters for performance

Ye sirf academic distinction nahi hai — ye seedha **page load performance** pe impact karta hai:

- Kam JavaScript client ko bhejna = smaller bundle size = faster download, especially slow
  networks (3G/4G in tier-2/3 cities, jahan Sharad jaisa India-based dev often target audience rakhta
  hai) pe bahut noticeable hai.
- Kam JS = kam **parse + execute time** on the device — slow/budget Android phones pe JS parsing/execution
  CPU-bound bottleneck hota hai, sirf network nahi.
- Server Components ka data-fetching bhi server pe hota hai, matlab **waterfall of client-server
  round-trips avoid hota hai** jo traditional "fetch in `useEffect`" pattern mein hota tha (component
  mount → effect run → fetch start → response → re-render).

Yani agar tum purani SPA habit se aa rahe ho (sab kuch `"use client"` laga dena "kyunki mujhe pata nahi
chahiye ya nahi"), tum is entire performance benefit ko throw away kar rahe ho. Correct default mindset:
**Server Component rakho jab tak koi specific reason na ho Client Component banane ka.**

### Full example — Server Component fetching data + nested Client Component for interactivity

```tsx
// app/products/[id]/page.tsx
// Ye ek Server Component hai — koi "use client" nahi likha, isliye default server pe render hoga.

import { LikeButton } from "./LikeButton";
// LikeButton ek Client Component hai (interactivity ke liye), niche define karenge.
// Isko import karna Server Component ke andar bilkul valid hai — Server Component
// Client Component ko render kar sakta hai (dusri taraf ulta nahi ho sakta, direct import se).

type Product = { id: string; title: string; price: number; likes: number };
// Product shape ka type — API response ko type-safe rakhne ke liye.

async function getProduct(id: string): Promise<Product> {
  // ye function server pe chalta hai — browser tak kabhi nahi pahunchta.
  const res = await fetch(`https://api.myshop.com/products/${id}`, {
    // Next.js ka extended fetch — cache option pass kar sakte hain (section 4 mein detail).
    cache: "no-store",
    // no-store isliye kyunki product price/stock jaisa data fresh hona chahiye har request pe.
  });
  // await yahan directly chalta hai kyunki component khud async function hai — no useEffect needed.

  if (!res.ok) {
    // agar API ne error status diya (404, 500), explicitly throw karo.
    throw new Error(`Failed to fetch product ${id}`);
    // Next.js is throw ko automatically nearest error.tsx boundary tak propagate karega.
  }

  return res.json();
  // response body ko JSON parse karke Product shape mein return kar rahe hain.
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  // page component khud async hai — App Router ye allow karta hai sirf Server Components ke liye.
  // params Next.js automatically inject karta hai dynamic route segment [id] se.

  const product = await getProduct(params.id);
  // seedha await — HTML client ko bheja hi nahi jaata jab tak ye data resolve na ho jaaye.
  // matlab client ko koi loading spinner dikhne se pehle hi complete HTML mil jaata hai (no waterfall).

  return (
    // JSX return — ye server pe hi HTML mein convert ho jaayega.
    <div>
      <h1>{product.title}</h1>
      {/* product title render — plain server-rendered text, isko JS ki zaroorat nahi client pe */}
      <p>Price: ₹{product.price}</p>
      {/* price bhi static server-rendered content hai */}
      <LikeButton productId={product.id} initialLikes={product.likes} />
      {/* yahan Client Component ko mount kar rahe hain — sirf ye hissa interactive hoga,
          baaki poora page ka HTML already server pe ban chuka hai bina extra JS ke. */}
    </div>
  );
}
```

```tsx
// app/products/[id]/LikeButton.tsx
"use client";
// yahan "use client" mandatory hai kyunki hum useState aur onClick use kar rahe hain —
// dono hi browser mein run hote hain, server pe inka koi matlab nahi.

import { useState } from "react";
// useState React hook — sirf Client Components ke andar allowed (Server Component mein error dega).

export function LikeButton({
  productId,
  initialLikes,
}: {
  productId: string;
  // parent Server Component se prop ke through data pass hua — ye serialize ho ke aata hai.
  initialLikes: number;
  // initial value server se aayi, client pe isko local state mein seed kar rahe hain.
}) {
  const [likes, setLikes] = useState(initialLikes);
  // local mutable state — sirf browser mein exist karta hai, re-render trigger karta hai.
  const [isLiked, setIsLiked] = useState(false);
  // track karta hai ki current session mein user ne like kiya ya nahi (double-click rokne ke liye).

  const handleLike = async () => {
    // event handler — sirf Client Component mein possible, browser event loop pe chalta hai.
    if (isLiked) return;
    // agar already like kiya hai, dobara mat karo — simple guard.

    setLikes((prev) => prev + 1);
    // optimistic update — UI turant update karo, backend confirm hone ka wait mat karo.
    setIsLiked(true);
    // mark kar diya ki like ho gaya, button dobara disable jaisa behave karega.

    await fetch(`/api/products/${productId}/like`, { method: "POST" });
    // ye ek Route Handler ko call kar raha hai (section 5 mein cover karenge) kyunki
    // Client Component seedha database ko touch nahi kar sakta — usko HTTP endpoint chahiye.
  };

  return (
    <button onClick={handleLike} disabled={isLiked}>
      {/* onClick handler sirf client pe attach hota hai — is button ka JS bundle mein jaana zaroori hai */}
      ❤️ {likes}
      {/* current like count display — state change hone pe re-render hoga */}
    </button>
  );
}
```

Notice karo — sirf `LikeButton.tsx` ka JS browser ko jaata hai. `ProductPage` ka koi bhi JS client bundle
mein nahi hai, sirf uska rendered HTML output hai.

---

## 3. File-Based Routing, Layouts, and Nested Layouts

App Router ke special filenames, har ek ka apna specific role hai:

| File | Purpose |
|---|---|
| `page.tsx` | Route ka actual content — is file ke bina folder ek route nahi banta |
| `layout.tsx` | Shared UI shell jo child routes ko wrap karta hai — navigation ke beech **persist** karta hai, re-render/remount nahi hota |
| `loading.tsx` | Automatic `<Suspense>` boundary — jab tak `page.tsx` ka data resolve ho raha ho, ye instantly dikhta hai |
| `error.tsx` | Automatic error boundary — agar segment ke andar kahin bhi error throw ho, ye catch karta hai |
| `(folder)` | Route group — URL mein segment nahi banta, sirf organizational/layout-grouping purpose |
| `[id]` | Dynamic route segment — URL ka wo part ek param ban jaata hai |

### Layout persistence — kyun important hai

`layout.tsx` ka sabse critical property: jab user ek route se dusre route pe navigate karta hai **same
segment ke andar**, layout **re-render nahi hota** — sirf uska `children` (jo `page.tsx` hai) swap hota
hai. Isse layout ke andar ka state (jaise scroll position, ek open modal, form draft) preserve rehta hai
navigation ke through — traditional multi-page-app mein ye impossible tha (poora page reload hota tha).

### Folder tree example

```
app/                              // root routing folder — Next.js is directory ko scan karke route tree banata hai
├── layout.tsx                    // ROOT layout — <html>, <body> tags yahan hote hain, poore app ko wrap karta hai
├── page.tsx                      // route: "/" — home page ka content
├── loading.tsx                   // root-level fallback — koi bhi nested route load ho rahi ho, isse fallback milega agar apna loading.tsx na ho
├── error.tsx                     // root-level error boundary — catch-all safety net poore app ke liye
├── (marketing)/                  // ROUTE GROUP — URL mein "(marketing)" nahi aayega, sirf marketing pages ko group karne ke liye
│   ├── layout.tsx                // marketing-specific layout (jaise different header/footer for public pages)
│   ├── about/
│   │   └── page.tsx               // route: "/about" — group ka naam URL mein NAHI aata
│   └── pricing/
│       └── page.tsx               // route: "/pricing" — same group, same layout milega
├── dashboard/                    // real folder (bracket nahi), isliye URL mein "dashboard" segment aayega
│   ├── layout.tsx                 // dashboard ka apna layout — sidebar/nav yahan define hota hai, navigation ke beech persist karega
│   ├── loading.tsx                 // dashboard-specific loading UI — agar page.tsx ka data slow ho toh ye dikhega, layout ka sidebar phir bhi turant dikhega
│   ├── page.tsx                    // route: "/dashboard" — dashboard ka default/overview view
│   ├── settings/
│   │   └── page.tsx                 // route: "/dashboard/settings" — dashboard layout ke andar hi render hoga (sidebar persist rahega)
│   └── orders/
│       ├── page.tsx                  // route: "/dashboard/orders" — list view
│       └── [orderId]/
│           ├── page.tsx               // route: "/dashboard/orders/123" — [orderId] dynamic segment se "123" param ban jaata hai
│           └── error.tsx              // is specific segment ke liye error boundary — order-not-found jaisa error yahan hi catch hoga, poora dashboard crash nahi hoga
└── api/                           // Route Handlers ke liye reserved folder — page.tsx nahi, route.ts hota hai (section 5 mein detail)
    └── products/
        └── [id]/
            └── like/
                └── route.ts        // endpoint: POST /api/products/123/like — Client Component isko fetch karta hai
```

Key observation: `dashboard/loading.tsx` sirf `dashboard/page.tsx` (aur uske children) ke data-fetch ke
liye trigger hota hai — `dashboard/layout.tsx` ka sidebar isse affected nahi hota, wo already render ho
chuka hota hai. Yehi granular streaming ka fayda hai.

---

## 4. Data Fetching in Server Components

Ye pattern purane React/SPA world se sabse zyada different feel hota hai:

```tsx
// app/dashboard/page.tsx
// koi "use client" nahi — ye Server Component hai, isliye async component banana valid hai.

async function getOrderStats() {
  // helper function — server pe chalega, seedha backend/DB call kar sakta hai.
  const res = await fetch("https://internal-api.myshop.com/stats/orders", {
    // Next.js ne native fetch() ko EXTEND kiya hai custom caching options ke saath —
    // ye unusual hai kyunki normally caching HTTP layer ya separate library ka kaam hota hai,
    // yahan Next.js ne ise fetch() API ke andar hi bake kar diya hai.
    next: { revalidate: 60 },
    // revalidate: 60 matlab is response ko 60 seconds tak cache mein rakho (time-based revalidation,
    // "stale-while-revalidate" jaisa) — 60 sec baad next request pe fresh data fetch hoga background mein.
  });

  if (!res.ok) {
    // response fail hua toh explicit error throw — nearest error.tsx isse handle karega.
    throw new Error("Failed to load order stats");
  }

  return res.json();
  // parsed JSON return kar rahe hain, caller ise directly consume karega.
}

export default async function DashboardPage() {
  // page component async hai — Server Component hone ki wajah se ye allowed hai.
  const stats = await getOrderStats();
  // no useEffect, no useState, no loading spinner logic manually likhna — bas await.
  // HTML client ko tabhi jaayega jab ye data ready ho (ya loading.tsx dikhega beech mein automatically).

  return (
    <div>
      <h2>Total Orders: {stats.total}</h2>
      {/* server pe already computed value, direct render */}
      <h2>Revenue: ₹{stats.revenue}</h2>
      {/* same yahan bhi — koi client-side computation nahi chahiye is display ke liye */}
    </div>
  );
}
```

### `fetch()` caching modes — teen important variants

```ts
// Variant 1 — default caching (SSG-like behavior)
fetch("https://api.example.com/data");
// koi cache option nahi diya — Next.js DEFAULT behavior use karega: cache: 'force-cache'.
// matlab response ko INDEFINITELY cache karega (build time jaisa static data), jab tak
// explicitly revalidate na ho. Ye static content ke liye best hai (jaise blog posts, docs).

// Variant 2 — always fresh (SSR-like behavior)
fetch("https://api.example.com/data", { cache: "no-store" });
// no-store matlab HAR request pe fresh fetch hoga, kabhi cache nahi hoga.
// use karo jab data genuinely dynamic ho — user-specific data, real-time prices, live stock counts.

// Variant 3 — time-based revalidation (ISR-like behavior)
fetch("https://api.example.com/data", { next: { revalidate: 3600 } });
// revalidate: 3600 matlab data ko 1 hour tak cache mein serve karo, uske baad next
// request background mein fresh fetch trigger karega (stale-while-revalidate pattern).
// ye "mostly static but occasionally changes" data ke liye ideal hai — jaise product catalog.
```

Ye extended `fetch()` behavior ka matlab hai ki **caching strategy ab data-fetching call ke saath
co-located hai** — tumhe separate config file ya wrapper library nahi chahiye har API call ke liye
alag caching decide karne ke liye. Ye unusual hai (normal JS mein `fetch` cache option ka ye meaning
nahi hota — ye Next.js ka polyfill/patch hai), lekin ek baar samajh lo toh bahut powerful pattern hai.

---

## 5. Route Handlers (API Routes in App Router)

Server Component seedha data fetch/database call kar sakta hai — usko API route ki zaroorat hi nahi
padti. Toh Route Handlers kab chahiye?

**Route Handler zaroori hai jab ek Client Component ko server-side kaam karana ho** — kyunki Client
Component browser mein run hota hai, wo directly database ya secret-key-wala backend call nahi kar
sakta (security + bundling dono reasons se). Usko ek HTTP endpoint chahiye jise `fetch()` se call kare.

```ts
// app/api/products/[id]/like/route.ts
// route.ts (page.tsx nahi) — ye batata hai Next.js ko ki ye ek API endpoint hai, page nahi.

import { NextRequest, NextResponse } from "next/server";
// Next.js ke request/response helper types — standard Request/Response ke superset hain.

export async function POST(
  request: NextRequest,
  // incoming request object — headers, body, cookies sab yahan se access hote hain.
  { params }: { params: { id: string } }
  // dynamic segment [id] yahan automatically inject hota hai, jaise page.tsx mein hota hai.
) {
  const productId = params.id;
  // URL se product id nikal li — jaise "/api/products/123/like" se "123".

  // yahan hum seedha database call kar sakte hain kyunki ye code SIRF server pe chalta hai —
  // Route Handler bhi server-only environment hai, browser mein kabhi nahi jaata.
  const updated = await db.product.update({
    where: { id: productId },
    // kaunsa row update karna hai — id se match kar rahe hain.
    data: { likes: { increment: 1 } },
    // likes column ko atomically 1 se increment kar rahe hain (race-condition safe).
  });

  return NextResponse.json({ likes: updated.likes });
  // JSON response wapas bhej rahe hain — Client Component ka fetch() ye consume karega.
}
```

```
Client Component (LikeButton) --fetch()--> Route Handler (route.ts) --db call--> Database
     (browser)                              (server)                    (server)
```

Comparison table jo yaad rakhna zaroori hai:

| Scenario | Pattern |
|---|---|
| Server Component ko data chahiye | Directly `await fetch()` ya `await db.query()` — no API route needed |
| Client Component ko data chahiye (initial load) | Parent Server Component se props ke through pass karo (best), ya Route Handler + client-side fetch |
| Client Component ko mutation trigger karni hai (button click pe POST) | Route Handler zaroori hai — client seedha DB ko touch nahi kar sakta |
| External service (webhook receiver, third-party integration) | Route Handler — ye traditional REST endpoint jaisa hi kaam karta hai |

Ye genuinely traditional SPA+API architecture se different pattern hai — SPA mein **har** data fetch
API route se hoke guzarta tha (kyunki poora frontend client-side tha). App Router mein Server Components
directly backend tak pahunch jaate hain, API layer sirf tab banta hai jab client-side interactivity ko
server logic chahiye.

---

## 6. Middleware

`middleware.ts` (project root ya `src/` mein) ek function hai jo **request complete hone se pehle**
chalta hai — Edge runtime pe, bahut low latency ke saath. Common use cases: auth gating, redirects,
header manipulation, A/B test bucket assignment, geolocation-based routing.

```ts
// middleware.ts (project root)
import { NextResponse } from "next/server";
// response helper — redirect/rewrite/next sab yahan se milte hain.
import type { NextRequest } from "next/server";
// request type — TypeScript ke liye.

export function middleware(request: NextRequest) {
  // ye function HAR matching request pe chalta hai, page render se bhi pehle.

  const token = request.cookies.get("session_token")?.value;
  // cookie se session token nikal rahe hain — middleware ke paas cookies read karne ki access hoti hai.

  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard");
  // check kar rahe hain ki current request kisi protected path ke liye hai ya nahi.

  if (isProtectedRoute && !token) {
    // agar protected route hai aur token nahi hai (user logged in nahi hai)...
    const loginUrl = new URL("/login", request.url);
    // absolute login URL banaya current request ke base URL se.
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    // original destination ko query param mein save kar rahe hain — login ke baad wapas wahin bhej sakein.
    return NextResponse.redirect(loginUrl);
    // request ko yahin se redirect kar do — page.tsx tak pahunchega hi nahi.
  }

  return NextResponse.next();
  // sab theek hai, request ko aage badhne do — actual route handler/page render hoga.
}

export const config = {
  // config object batata hai kaunse paths pe middleware chale — sabpe chalana wasteful hai.
  matcher: ["/dashboard/:path*"],
  // sirf /dashboard aur uske sab sub-paths pe ye middleware trigger hoga.
};
```

Middleware Edge runtime pe chalta hai — matlab Node.js ka full API surface available nahi hota (jaise
kuch native modules), lekin latency bahut kam hoti hai kyunki ye CDN edge locations pe distribute hota
hai, origin server tak jaane se pehle hi decision le leta hai.

---

## 7. Metadata API for SEO

Traditional client-rendered SPA mein SEO problematic hota hai kyunki search engine crawler ko initial
HTML mein sirf ek empty `<div id="root">` milta hai — meta tags JS execute hone ke baad inject hote hain,
aur kai crawlers JS execute hi nahi karte (ya properly nahi karte). App Router mein Server Components ki
wajah se **HTML already meta tags ke saath complete hota hai** jab crawler use dekhta hai — isliye
Metadata API itna important hai.

```tsx
// app/products/[id]/page.tsx
import type { Metadata } from "next";
// Metadata type — static export ke liye shape define karta hai.

// Option A — static metadata (jab content build-time pe pata ho)
export const metadata: Metadata = {
  title: "My Shop — Products",
  // <title> tag ban jaayega — server pe hi render hoga, JS ke bina bhi crawler ko milega.
  description: "Browse our product catalog",
  // <meta name="description"> ban jaayega.
};

// Option B — dynamic metadata (jab data fetch karke banani ho, jaise per-product title)
export async function generateMetadata({
  params,
}: {
  params: { id: string };
  // dynamic route ka id yahan bhi milta hai, page component jaisa hi pattern.
}): Promise<Metadata> {
  const product = await getProduct(params.id);
  // yahi function jo page component bhi use kar raha tha — data fetch server pe hi ho raha hai.

  return {
    title: `${product.title} — My Shop`,
    // product-specific title — SEO ke liye critical, har product page ka unique title hona chahiye.
    description: `Buy ${product.title} for ₹${product.price}`,
    // product-specific description.
    openGraph: {
      // Open Graph tags — social media (WhatsApp, Twitter, Facebook) pe link share karne pe preview banate hain.
      title: product.title,
      images: [product.imageUrl],
      // link share karte waqt ye image thumbnail ke roop mein dikhegi.
    },
  };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  // actual page component — metadata function alag se chalta hai, isse independent.
  const product = await getProduct(params.id);
  return <div>{product.title}</div>;
}
```

`generateMetadata` **page render se pehle/parallel me** resolve hota hai, aur Next.js dono ke data-fetch
calls ko automatically **de-duplicate** kar deta hai agar same URL/params ho (React's `fetch` cache ke
through) — matlab `getProduct` do baar network call nahi karega, ek hi resolve hote hi dono jagah reuse
ho jaata hai.

---

## 8. Real-World Gotchas

- **Habit se sab kuch Client Component bana dena.** Pure-SPA background se aane wale developers ka
  sabse common mistake — file ke top pe `"use client"` daal dena "safe side" ke liye, bina soche ki
  zaroorat thi ya nahi. Isse tum Server Components ka poora zero-JS benefit throw away kar dete ho.
  Rule of thumb: `"use client"` sirf tab lagao jab hooks/event-handlers/browser-APIs use ho rahe hon.

- **Sequential awaits ka "waterfall" problem.** Agar ek Server Component do independent data sources se
  fetch kar raha hai aur tum unhe sequentially `await` karte ho:
  ```tsx
  const user = await getUser(id);      // pehle ye complete hoga
  const orders = await getOrders(id);  // FIR ye start hoga — dono independent hain, par serial chal rahe hain
  ```
  Ye unnecessarily slow hai kyunki `orders` fetch `user` fetch complete hone ka wait kar raha hai bina
  kisi dependency ke. Correct pattern `Promise.all` se parallel fetch karna hai:
  ```tsx
  const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
  // dono ek saath start hote hain — total time = slower wale ka time, na ki dono ka sum
  ```

- **Hydration mismatch errors.** Agar Server Component render karte waqt `Date.now()`,
  `Math.random()`, ya kisi bhi non-deterministic value ka use directly render output mein karte ho, toh
  server pe generate hua HTML aur client pe React ka expected output **match nahi karega** — React
  console mein hydration mismatch warning/error dega, aur kabhi-kabhi visible UI flicker/glitch bhi
  hoga. Fix: aisi values ko `useEffect` ke andar (Client Component mein) set karo taaki wo sirf
  client-side hi compute ho, ya server se hi consistently pass karo.

- **`layout.tsx` navigation pe re-run nahi hota — state-reset expectations galat ho sakti hain.**
  Agar tumne `layout.tsx` ke andar koi state rakha hai (jaise `useState` kisi Client Component wale
  layout mein) ye expect karke ki har navigation pe reset ho jaayega — wo galat assumption hai. Layout
  same segment ke andar navigation pe **persist** karta hai, remount nahi hota. Agar reset chahiye hi
  chahiye, tumhe `key` prop trick ya explicit reset logic (route change detect karke) use karna padega.

---

## Key Takeaways

- App Router folder rename nahi hai — ye React Server Components ke around ek fundamentally naya
  rendering model hai, jahan har component by default server pe render hota hai aur zero JS ship karta
  hai jab tak explicitly interactive na ho.
- `"use client"` ek opt-in boundary hai, opt-out nahi — default hamesha Server Component rakho, sirf
  hooks/events/browser-APIs ki zaroorat pe Client Component banao.
- Server Components ke andar seedha `await fetch()`/`await db.query()` chal jaata hai — no
  `useEffect`/`useState` dance, kyunki ye server pe HTML banne se pehle hi resolve ho jaata hai.
- Next.js ka extended `fetch()` caching (`force-cache` default, `no-store`, `next: { revalidate }`)
  caching strategy ko data-fetch call ke saath co-locate karta hai — samajhna zaroori hai kyunki subtle
  bugs (stale data, unexpected fresh fetches) yahin se aate hain.
- Route Handlers sirf tab zaroori hain jab Client Component ko server-side kaam (mutation, secret-key
  wala backend call) karana ho — Server Components ko API layer ki zaroorat hi nahi.
- `layout.tsx` navigation ke beech persist karta hai (remount nahi hota), `loading.tsx`/`error.tsx`
  automatic Suspense/error boundaries dete hain per-segment granularity pe.
- Metadata API (static `metadata` export ya `generateMetadata()`) SEO ke liye critical hai kyunki HTML
  already meta tags ke saath complete hota hai crawler tak pahunchne se pehle — client-side injection
  ki zaroorat nahi.
- Common mistakes: habit se sab kuch Client Component banana, sequential awaits ka waterfall,
  non-deterministic values se hydration mismatch, aur layout persistence ko underestimate karna.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. App Router aur Pages Router mein sabse fundamental difference kya hai — sirf folder naming ya
kuch deeper?**

Deeper hai. Pages Router mein default rendering client-side thi (SPA jaisa hydration), aur server-side
data ke liye explicit functions (`getServerSideProps`/`getStaticProps`) opt-in karni padti thi — ye
per-page granularity pe kaam karta tha. App Router React Server Components ke around bana hai, jahan
default rendering server-side hai aur JS shipping per-component decide hoti hai (`"use client"` se). Ye
sirf routing convention ka change nahi, balki rendering aur bundling ka fundamentally different model hai.

**Q2. Server Component aur Client Component mein kya difference hai, aur "use client" directive
exactly kya karta hai?**

Server Component (default, `app/` ke andar koi bhi file bina directive ke) server pe render hota hai,
sirf HTML + RSC payload client ko bhejta hai, uska JS code kabhi browser mein nahi jaata. Client
Component (`"use client"` top pe) browser mein actually mount/run hota hai — hooks, event handlers,
browser APIs use kar sakta hai. `"use client"` ek build-time boundary marker hai jo bundler ko batata hai
ki us file se aage ka import chain client bundle mein include karna hai. Important: ye directive us file
aur uske saare non-"use client" imports ko client bundle mein daal deta hai — isliye boundary ko as low
as possible (leaf components pe) rakhna best practice hai.

**Q3. Agar tumhe ek page banani ho jisme mostly static content ho lekin ek chhota interactive
counter/button ho, toh kaise structure karoge?**

Page ko Server Component rakhunga (default), aur sirf counter/button ko ek separate file mein Client
Component banaunga (`"use client"` + `useState`), phir usko parent Server Component se import/render
karunga. Isse poore page ka static content zero extra JS ke saath serve hoga, aur sirf us chhote
interactive widget ka JS bundle client ko jaayega — bandwidth aur parse-time dono minimize hote hain.

**Q4. Server Component se Client Component ko render kar sakte ho, lekin Client Component se Server
Component ko directly import karke render nahi kar sakte — why?**

Kyunki Client Component browser mein run hota hai, aur Server Component ka code (jisme server-only
logic, secrets, direct DB calls ho sakte hain) browser tak kabhi bhejna nahi chahiye — na security
reasons se, na bundle-size reasons se. Agar directly import allowed hota, toh Server Component ka poora
code accidentally client bundle mein leak ho jaata. Workaround: Server Component ko `children` prop ke
through Client Component mein pass karo ("passing Server Components as children/props" pattern) — ye
composition allow karta hai bina import boundary violate kiye.

**Q5. Next.js ka extended `fetch()` caching kaise kaam karta hai, aur teeno modes
(`force-cache`/`no-store`/`revalidate`) mein kab kaunsa use karoge?**

Next.js ne native `fetch()` ko patch kiya hai taaki wo Next.js ke data cache ke saath integrate ho sake.
`force-cache` (default) response ko indefinitely cache karta hai — static/rarely-changing data ke liye
(blog content, docs). `no-store` har request pe fresh fetch karta hai — genuinely dynamic/user-specific
data ke liye (live prices, personalized dashboards). `next: { revalidate: N }` time-based
stale-while-revalidate deta hai — N seconds tak cached response serve hota hai, uske baad next request
background mein fresh data fetch trigger karti hai (product catalogs, semi-static listings ke liye
ideal). Sahi mode choose karna directly correctness aur performance dono affect karta hai.

**Q6. Route Handler kab actually zaroori hota hai App Router mein, jab Server Component seedha data
fetch kar sakta hai?**

Route Handler zaroori hai jab ek **Client Component** ko server-side operation trigger karna ho —
kyunki Client Component browser mein run hota hai aur seedha database/secret-protected backend ko touch
nahi kar sakta. Isliye mutations (button click pe POST), webhooks receive karna, ya third-party
integrations ke liye Route Handler chahiye. Lekin Server Component ko khud data chahiye ho (initial
page load ke liye), usse API route ki zaroorat bilkul nahi — wo directly `await fetch()`/`await
db.query()` kar sakta hai, jo traditional SPA+API architecture se genuinely different pattern hai.

**Q7. `layout.tsx` navigation ke beech re-render kyun nahi hota, aur ye kaunsa real bug pattern create
kar sakta hai?**

App Router ka layout persistence model design hai taaki shared UI (sidebar, header, nav) navigation ke
through **remount na ho** — scroll position, open state, animations sab preserve rahein, jaisa
traditional multi-page reload mein impossible tha. Bug pattern: agar developer layout ke andar kisi
Client Component mein state rakhta hai ye assume karke ki har naye route pe reset ho jaayega (jaise ek
form draft, ya "selected tab" state), wo galat hoga — state persist karega jab tak explicit reset logic
(route-change detection ya `key` prop) na ho.

**Q8. Middleware kis runtime pe chalta hai, aur ye Route Handler se kaise different hai use-case ke
hisaab se?**

Middleware Edge runtime pe chalta hai — request complete hone se pehle, CDN edge locations ke close
proximity mein, bahut low latency ke saath. Ye cross-cutting concerns ke liye hai jo **har matching
request** pe chalne chahiye — auth gating, redirects, header injection, geolocation routing. Route
Handler specific endpoint logic hai jo tab hi chalta hai jab explicitly us URL pe request aaye — business
logic/data operations ke liye. Middleware "gatekeeper before routing decision," Route Handler "actual
endpoint implementation."

**Q9. Traditional client-rendered SPA mein SEO problematic kyun tha, aur App Router ka Metadata API
isko kaise solve karta hai?**

SPA mein initial server response sirf ek almost-empty HTML shell hota tha (`<div id="root">`) — actual
content aur meta tags JS execute hone ke baad client-side inject hote the. Search engine crawlers
(especially wo jo JS properly execute nahi karte, ya crawl budget ki wajah se JS-heavy pages skip karte
hain) ko incomplete/empty content milta tha. App Router mein Server Components ki wajah se HTML **already
complete** hota hai (content + meta tags dono) jab crawler request karta hai — `generateMetadata()` ya
static `metadata` export server pe hi resolve ho ke final HTML mein bake ho jaate hain, koi client-side
JS execution ki dependency nahi.

**Q10. Ek naya developer teen Server Components banata hai jo sab independent APIs se data fetch karte
hain, aur sabme sequential `await` likhta hai. Performance issue kya hai, aur kaise fix karoge?**

Ye "request waterfall" problem hai — har `await` agle ko block kar raha hai, chahe unke beech koi
dependency na ho. Total load time teeno fetches ka **sum** ban jaata hai jab ki ideally sirf **sabse
slow wale ka time** hona chahiye. Fix: independent fetches ko `Promise.all([fetch1(), fetch2(),
fetch3()])` mein wrap karo taaki sab parallel start hon. Agar fetches genuinely dependent hain (dusre ka
result pehle wale pe depend karta hai), tab hi sequential await justified hai — waise nahi toh ye ek
avoidable performance regression hai jo code review mein flag karna chahiye.
