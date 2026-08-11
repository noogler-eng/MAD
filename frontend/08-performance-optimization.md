# Performance Optimization (Web)

Ye chapter web frontend performance ke root-level concepts cover karta hai — same depth jaise humne MAD (RN/Expo) handbook ke chapter 2 mein memoization aur FlatList windowing discuss kiya tha, lekin yahan focus purely **web** ke unique constraints pe hai: browser rendering pipeline, network waterfall, bundle sizes, aur DOM ka scale. RN mein tumhara "canvas" native views the jinka count usually chota hota hai. Web pe DOM trees deep aur wide dono ho sakte hain, aur browser ko HTML parse karke, CSS resolve karke, layout+paint karna padta hai — ek pura pipeline jo RN mein exist nahi karta (Yoga seedha layout karta hai, no CSSOM step). Is chapter mein hum Core Web Vitals se shuru karenge (kyunki ye ab business metric bhi hain, sirf engineering nahi), phir code splitting, images, critical rendering path, virtualization, memoization ka web-context nuance, measurement tools, aur real-world gotchas cover karenge.

## Is chapter mein

1. [Core Web Vitals — What They Actually Measure](#core-web-vitals)
2. [Code Splitting and Lazy Loading](#code-splitting)
3. [Image Optimization](#image-optimization)
4. [Critical Rendering Path](#critical-rendering-path)
5. [Debouncing Expensive Renders and Virtualization](#virtualization)
6. [Memoization on the Web (React.memo, useMemo, useCallback)](#memoization)
7. [Measuring Performance — Tools](#measuring-performance)
8. [Real-World Gotchas](#gotchas)
9. [Key Takeaways](#key-takeaways)
10. [🎯 Interview Questions — Senior Frontend Developer](#interview-questions)

---

## Core Web Vitals — What They Actually Measure

Google ne 2020 mein Core Web Vitals launch kiye — teen specific metrics jo "user-perceived quality" ko measure karte hain, generic technical numbers (jaise "Time to First Byte") ki jagah jo directly user experience se map nahi hote. Har metric ek alag dimension cover karta hai, aur teeno milke poori user journey cover kar lete hain: **loading**, **interactivity**, aur **visual stability**.

### LCP — Largest Contentful Paint

LCP measure karta hai ki page ka sabse bada visible element (usually hero image, heading, ya video) kab render hua — matlab "page load hua feel hota hai kab". Ye `<img>`, `<video>` poster, ya large text block ho sakta hai. Google ka target: **2.5 seconds ya usse kam** (good), 2.5-4s needs improvement, 4s+ poor.

LCP first paint se different hai — first paint sirf "kuch bhi render hua" batata hai (jaise background color ya empty header), jabki LCP batata hai "wo content jo user actually dekhna chahta tha, wo aa gaya". Isliye ye "does the page feel loaded" ka best proxy hai.

### INP — Interaction to Next Paint

INP ne March 2024 mein **FID (First Input Delay)** ko replace kiya. FID ka problem — ye sirf **pehli** interaction ki responsiveness measure karta tha (jaise first click ka delay), poore page lifecycle ke baaki interactions ignore ho jaate the. Ek page jo shuru mein fast tha lekin baad mein (heavy state update ke baad) laggy ho gaya, FID mein wo pakda nahi jaata tha.

INP is gap ko fix karta hai — ye **poore page lifetime mein har interaction** ko track karta hai (click, tap, keypress) aur worst (ya near-worst, 98th percentile) interaction latency report karta hai. Target: **200ms ya kam** (good). INP measure karta hai — input se lekar browser ke next frame paint hone tak ka total time, jisme event handlers ka execution time aur browser ka rendering work dono shaamil hain.

### CLS — Cumulative Layout Shift

CLS measure karta hai visual stability — jab page load ho rahi hoti hai aur beech mein koi element (ad, image, font) achanak layout ko shift kar deta hai, jisse user ka click miss-click ban jaata hai (classic example — "Accept Cookies" button pe click karne jaate ho aur last moment pe ek ad load hoke button ko neeche push kar deta hai, tum kisi galat cheez pe click kar dete ho). Target: **0.1 ya kam**.

CLS ek score hai jo "impact fraction" (kitna viewport area shift hua) ko "distance fraction" (kitna dur shift hua) se multiply karke calculate hota hai, aur poore page lifecycle mein sabhi unexpected shifts sum ho jaate hain (with a session window logic for continued shifts).

### Why exactly these three?

Google ne random metrics nahi chuni — har ek real user-perceived quality dimension map karta hai:

| Metric | Dimension | User ka sawaal |
|---|---|---|
| LCP | Loading | "Page load ho gaya kya?" |
| INP | Interactivity | "Jab main click karta hoon, kya turant response milta hai?" |
| CLS | Visual Stability | "Kya page mere niche se hatt jaata hai jab main use karne ki koshish karta hoon?" |

Aur ye sirf "nice to have" metrics nahi hain — Google Search ne 2021 se Core Web Vitals ko **ranking factor** bana diya hai (Page Experience update). Matlab agar tumhari site slow hai ya janky hai, tumhari Google Search ranking directly impact hoti hai — ye ek genuine **business** concern ban jaata hai, sirf engineering elegance ka mudda nahi. Product managers aur leadership ko performance pitch karte waqt yahi angle use karo — "slow site = kam organic traffic = kam revenue", sirf "code clean hai" wala argument nahi.

---

## Code Splitting and Lazy Loading

### Problem statement

Default mein, ek modern React/Next.js app bundlers (Webpack, Vite, Turbopack) tumhara **saara** JavaScript ek ya chand bade files mein bundle kar dete hain. Agar tumhari e-commerce site mein checkout flow, admin dashboard, aur analytics charts sab same bundle mein hain, to jo user sirf homepage dekh raha hai, wo bhi checkout aur admin ka code download kar raha hai — code jo wo shaayad kabhi use hi nahi karega. Ye directly LCP ko hurt karta hai kyunki browser ko pehle is bade JS file ko download+parse+execute karna padta hai.

### React.lazy() + Suspense — component-level splitting

`React.lazy()` ek component ko **dynamically** import karta hai — matlab uska code tabhi download hota hai jab wo component actually render hone wala ho, initial bundle mein nahi. `Suspense` ek fallback UI dikhata hai jab tak wo lazy component load ho raha hota hai.

```tsx
// App.tsx
import { lazy, Suspense, useState } from 'react';
// lazy() react se import — ye function lene wali hai ek dynamic import promise
// useState normal state ke liye, tab switching demonstrate karne ke liye

// Heavy chart library wala component — sirf tab load hoga jab user "Analytics" tab kholega
const AnalyticsChart = lazy(() => import('./AnalyticsChart'));
// lazy() ek function leta hai jo import() promise return kare — Webpack/Vite isko
// automatically ek alag chunk file mein split kar dega (e.g. AnalyticsChart.[hash].js)

function App() {
  // activeTab state track karta hai konsa tab currently selected hai
  const [activeTab, setActiveTab] = useState<'home' | 'analytics'>('home');

  return (
    // wrapper div — page ka root container
    <div>
      {/* Home tab pe click karne se activeTab 'home' ho jaayega */}
      <button onClick={() => setActiveTab('home')}>Home</button>
      {/* Analytics tab pe click karne se activeTab 'analytics' ho jaayega — */}
      {/* yahi click AnalyticsChart ke code ko network se fetch trigger karega */}
      <button onClick={() => setActiveTab('analytics')}>Analytics</button>

      {activeTab === 'home' && <p>Welcome home!</p>}
      {/* home tab ka content — lightweight, koi lazy loading zaroorat nahi */}

      {activeTab === 'analytics' && (
        // Suspense boundary — jab tak AnalyticsChart ka chunk download+parse
        // nahi hota, fallback UI dikhega instead of blank screen ya crash
        <Suspense fallback={<p>Loading chart...</p>}>
          <AnalyticsChart />
          {/* actual heavy component — sirf yahan pahunchne pe download hota hai */}
        </Suspense>
      )}
    </div>
  );
}

export default App;
// default export — App.tsx ka entry component
```

```tsx
// AnalyticsChart.tsx — ye file apna alag JS chunk banegi build time pe
import { LineChart } from 'heavy-charting-library';
// heavy-charting-library ek badi dependency hai — isko main bundle mein
// nahi chahiye, sirf yahan chahiye

export default function AnalyticsChart() {
  // default export zaroori hai kyunki React.lazy() default export expect karta hai
  return <LineChart data={[]} />;
  // chart render — real app mein data prop pass hoga
}
```

### Dynamic import() — route-level splitting

Route-level splitting sabse common aur high-value pattern hai — har route apna alag chunk hota hai, aur user sirf jo route visit karta hai uska code download hota hai. Next.js App Router mein ye automatic hai (har `page.tsx` apna chunk hai by default), lekin manual routers (React Router) mein tumhe explicitly karna padta hai.

```tsx
// routes.tsx — React Router ke saath manual route-level code splitting
import { lazy } from 'react';
// lazy import karo React se

// har route apna alag dynamic import — Webpack automatically alag chunks banayega
const HomePage = lazy(() => import('./pages/HomePage'));
// homepage ka chunk — likely sabse pehle load hoga kyunki ye landing route hai

const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
// checkout ka chunk — sirf tab download hoga jab user /checkout pe navigate kare

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
// admin dashboard ka chunk — normal users ke liye kabhi download hi nahi hoga

export const routes = [
  // routes array — path aur component ka mapping
  { path: '/', component: HomePage },
  // root path pe HomePage lazily load hogi
  { path: '/checkout', component: CheckoutPage },
  // checkout path pe CheckoutPage lazily load hogi
  { path: '/admin', component: AdminDashboard },
  // admin path pe AdminDashboard lazily load hogi — most users kabhi yahan nahi jaate
];
```

### Trade-off — kitna split karna chahiye?

Code splitting free nahi hai — har split point matlab ek **extra HTTP request** jab wo chunk load hoga. Bahut zyada fine-grained splitting (har chhote button ko apna chunk banana) waterfall of small requests create karta hai — network overhead (connection setup, headers) chunk ke actual size se zyada ho sakta hai, especially HTTP/1.1 pe (HTTP/2 multiplexing se thoda better hota hai). Bahut kam splitting (sab ek bundle mein) matlab ek giant initial download, chahe user usme se 20% code hi use kare.

**Balance point** — route ya major-feature boundaries pe split karo, not every component. Route-level splitting almost always worth it (user navigation ek natural "loading pause" point hai). Feature-level splitting (jaise "checkout modal", "video player") bhi worth hai agar wo feature heavy hai aur sabhi users use nahi karte. Chhote presentational components ko individually lazy-load karna usually overhead se zyada nahi deta.

---

## Image Optimization

Images typically kisi bhi web page ka sabse bada byte-weight contributor hote hain — aur ye directly LCP ko hit karte hain agar LCP element khud ek image hai (jo bahut common hai — hero banners, product photos).

### Modern formats — WebP / AVIF

JPEG aur PNG purane formats hain. **WebP** (Google, 2010) same visual quality pe typically 25-35% smaller file size deta hai JPEG ke comparison mein. **AVIF** (AV1-based, newer) isse bhi better compression deta hai (~50% smaller than JPEG kabhi kabhi), lekin encoding thoda slower hai aur older browsers (Safari pre-16) support nahi karte the. Practical approach — `<picture>` element se multiple formats provide karo, browser khud best-supported format choose kar lega (fallback chain).

### Responsive images — srcset aur sizes

Ek 4000px-wide image sabko serve karna wasteful hai — mobile user jiske viewport 375px wide hai, usko bhi wahi heavy file milegi jo desktop 4K user ko milti hai, sirf CSS se resize hoke chhoti dikhegi (bytes waste, download time waste). `srcset` browser ko multiple resolution options deta hai, `sizes` batata hai ki har viewport width pe image kitni jagah lene wali hai — browser in dono ke combination se **khud** best-fit image choose karta hai (based on device pixel density aur viewport size).

```html
<!-- responsive image example -->
<img
  src="/images/hero-800w.jpg"
  <!-- fallback src — purane browsers ke liye jo srcset support nahi karte -->
  srcset="
    /images/hero-400w.jpg 400w,
    /images/hero-800w.jpg 800w,
    /images/hero-1200w.jpg 1200w,
    /images/hero-1600w.jpg 1600w
  "
  <!-- srcset — har image ka actual pixel-width label ke saath (400w = 400px wide) -->
  <!-- browser apni viewport aur device pixel ratio dekh ke best match download karega -->
  sizes="
    (max-width: 600px) 100vw,
    (max-width: 1200px) 50vw,
    800px
  "
  <!-- sizes — batata hai display width kitna hoga har breakpoint pe -->
  <!-- 600px se kam viewport => image full width lega (100vw) -->
  <!-- 600-1200px viewport => half width (50vw, e.g. two-column layout) -->
  <!-- 1200px se zyada => fixed 800px width -->
  alt="Product hero banner"
  <!-- alt text — accessibility aur SEO ke liye zaroori, screen readers isko read karte hain -->
  loading="lazy"
  <!-- native lazy loading — browser is image ko fetch nahi karega jab tak -->
  <!-- ye viewport ke paas na aaye (scroll-triggered), below-the-fold images ke liye ideal -->
  width="800"
  height="450"
  <!-- explicit width/height — browser ko layout space reserve karne deta hai -->
  <!-- image load hone se pehle hi, isse CLS (layout shift) prevent hota hai -->
/>
```

### Lazy loading below-the-fold images

`loading="lazy"` ek native HTML attribute hai — koi JS library ki zaroorat nahi. Browser image ko fetch nahi karta jab tak wo viewport ke kaafi close na aaye (browser apna heuristic use karta hai, usually kuch viewport-heights ka buffer). Above-the-fold images (jaise hero banner jo LCP element ho sakta hai) pe **lazy loading mat lagao** — usse LCP delay ho jaata hai kyunki browser download start hi late karega. Instead unhe `fetchpriority="high"` de sakte ho.

### next/image — automatic optimization

Next.js apps mein `next/image` component ye sab automatically handle karta hai — automatic WebP/AVIF conversion (agar browser support karta hai), automatic responsive `srcset` generation, built-in lazy loading, aur layout-shift prevention via required `width`/`height`. Isko detail mein hum `04-nextjs.md` mein already cover kar chuke hain — yahan bas itna samajh lo ki agar tum Next.js use kar rahe ho, `<img>` ki jagah `next/image` use karna almost always better default hai, manual srcset likhne ki zaroorat nahi padti.

---

## Critical Rendering Path

Browser ek page ko screen pe laane ke liye ek fixed sequence follow karta hai — ye samajhna zaroori hai taaki pata chale render-blocking resources kaise pipeline ko delay karte hain.

```
HTML parse → DOM build → CSS parse → CSSOM build → Render Tree → Layout → Paint
```

1. **Parse HTML** — browser HTML ko top-to-bottom parse karta hai, tags ko tokens mein convert karta hai.
2. **Build DOM** — tokens se Document Object Model tree banta hai — actual node hierarchy jo tum `document.querySelector` se access karte ho.
3. **Parse CSS** — jitne bhi stylesheets (`<link>`, `<style>`) hain, wo parse hote hain.
4. **Build CSSOM** — CSS Object Model — selectors aur unke computed styles ka tree.
5. **Render Tree** — DOM + CSSOM combine hote hain sirf **visible** nodes ke liye (jo `display: none` hain wo exclude hote hain, `visibility: hidden` wale include hote hain because wo space lete hain).
6. **Layout (Reflow)** — har visible node ki exact position aur size calculate hoti hai (box model — width, height, margins).
7. **Paint** — actual pixels screen pe draw hote hain (colors, text, images, shadows, borders).

### Render-blocking resources

Jab browser HTML parse kar raha hota hai aur usse ek **synchronous** `<script>` tag milta hai `<head>` mein (bina `defer`/`async`), parsing **pause** ho jaati hai — browser script ko download karega, execute karega, aur **tab tak** aage HTML parse nahi karega. Ye seedha DOM build ko delay karta hai, jo aage CSSOM, render tree, layout, paint sabko delay karta hai.

Stylesheets bhi render-blocking hain by default — browser render tree nahi bana sakta jab tak CSSOM complete na ho (kyunki use pata nahi hai final styles kya honge, isliye wo paint nahi karega — flash of unstyled content avoid karne ke liye ye intentional hai).

### Mitigations

```html
<!-- head mein — critical CSS ko inline karo taaki extra network request na lagey -->
<style>
  /* sirf above-the-fold ke liye zaroori styles yahan inline — */
  /* baaki CSS async load hoga */
  body { margin: 0; font-family: sans-serif; }
  .hero { height: 400px; background: #111; }
</style>

<!-- defer — script download parallel mein hota hai HTML parsing ke saath, -->
<!-- lekin execute sirf DOM fully parse hone ke baad hota hai, order preserved -->
<script src="/js/app.js" defer></script>

<!-- async — download parallel mein, execute hote hi jaise hi download complete -->
<!-- ho jaaye (parsing ko interrupt kar sakta hai) — order guaranteed nahi -->
<!-- analytics/tracking scripts ke liye best (independent, order matter nahi karta) -->
<script src="/js/analytics.js" async></script>

<!-- non-critical scripts ko body ke end mein daalo -->
<!-- taaki wo sirf DOM fully parse hone ke baad load start karein -->
<script src="/js/non-critical-widget.js"></script>
```

Practical rule of thumb — apni khud ki app logic ke liye `defer` use karo (order matter karta hai, DOM ready chahiye), third-party independent scripts (analytics, chat widgets) ke liye `async` use karo, aur critical above-the-fold CSS ko inline karo jabki baaki CSS ko `<link rel="stylesheet">` se non-blocking tareeke se load karo (`media="print"` trick ya `rel="preload"` + onload swap jaise techniques bhi use hoti hain advanced cases mein).

---

## Debouncing Expensive Renders and Virtualization

Agar tumhe ek list render karni hai jisme hazaaron items hain (chat history, product catalog, log viewer), sab ek saath DOM mein render karna do problems create karta hai — **initial render time** (browser ko hazaaron DOM nodes create+layout+paint karne padte hain) aur **memory usage** (har DOM node ka apna memory footprint hota hai, browser ke internal structures ke saath).

Ye exactly wahi problem hai jo hum MAD RN handbook ke chapter 2 mein FlatList ke context mein discuss kar chuke hain — sirf yahan "native views" ki jagah "DOM nodes" hain. Concept identical hai: **virtualization / windowing** — sirf wahi items render karo jo currently viewport mein visible hain, plus ek chhota overscan buffer (upar-neeche thoda extra taaki fast scroll pe blank flash na dikhe). Jaise item viewport se bahut door chala jaata hai, uska DOM node **unmount** ho jaata hai; naya visible item mount hota hai.

Web pe iske liye popular libraries — **react-window** (chhota, simple, fixed-size lists ke liye best) aur **@tanstack/react-virtual** (zyada flexible, variable-size items, grid support, framework-agnostic core).

```tsx
// LongList.tsx — react-window se ek virtualized list
import { FixedSizeList } from 'react-window';
// FixedSizeList — jab har item ki height same/fixed hai, sabse simple aur fast option

type Row = { id: string; title: string };
// Row type — list ka har item kaisa dikhta hai

function LongList({ items }: { items: Row[] }) {
  // items — poori data array, chahe 10 items ho ya 100,000

  // Row component — sirf visible items ke liye actually call hoga
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    // style prop react-window internally deta hai — absolute positioning ke liye
    // zaroori hai, isse har row apni correct scroll position pe rehta hai
    <div style={style}>
      {items[index].title}
      {/* index ke basis pe correct item ka data dikhao */}
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      // container ki visible height — 600px ka viewport, iske andar hi scroll hota hai
      itemCount={items.length}
      // total items ki count — library ko batata hai scrollbar ka range kya hoga
      itemSize={50}
      // har row ki fixed height (px mein) — isi se library calculate karti hai
      // ki current scroll position pe konse indices visible hain
      width="100%"
      // container ki width — full available width le lo
      overscanCount={5}
      // viewport ke bahar bhi 5 extra items render karo (upar aur neeche) —
      // taaki fast scroll pe blank white gaps na dikhein
    >
      {Row}
      {/* render function — library isko har visible index ke liye call karegi */}
    </FixedSizeList>
  );
}

export default LongList;
```

### Debouncing expensive re-renders

Virtualization list rendering ke liye hai, lekin ek related problem hai — jab **input** (jaise search box) har keystroke pe koi expensive operation trigger karta hai (API call, heavy filter/sort on a large array). Debouncing us operation ko delay karta hai jab tak user typing **pause** na kare (typically 200-500ms), taaki har single keystroke pe expensive work na ho, sirf final value pe ho.

```tsx
// useDebouncedValue.ts — generic debounce hook
import { useState, useEffect } from 'react';
// useState value store karne ke liye, useEffect timer set/clear karne ke liye

function useDebouncedValue<T>(value: T, delayMs: number): T {
  // value — jo actual value change ho rahi hai (e.g. search input text)
  // delayMs — kitni der ruko stable value maanne se pehle

  const [debounced, setDebounced] = useState(value);
  // debounced — wo value jo hum actually return karenge, delayed update ke saath

  useEffect(() => {
    // har baar jab 'value' change hoti hai, ye effect chalega
    const timer = setTimeout(() => {
      // delayMs ke baad debounced value ko update karo
      setDebounced(value);
    }, delayMs);

    return () => clearTimeout(timer);
    // cleanup — agar value phir se change ho gayi delay complete hone se pehle,
    // purana timer cancel karo (isse hi debouncing kaam karta hai)
  }, [value, delayMs]);

  return debounced;
  // caller ko delayed/stable value milta hai, raw fast-changing value nahi
}

export default useDebouncedValue;
```

---

## Memoization on the Web (React.memo, useMemo, useCallback)

Concept RN se largely overlap karta hai (MAD chapter 2 dekho detail ke liye) — `React.memo` component ka render skip karta hai agar props shallow-equal hain, `useMemo` expensive computation ka result cache karta hai, `useCallback` function reference ko stable rakhta hai taaki memoized children unnecessarily re-render na hon.

Web-specific nuance — **DOM reconciliation cost scales with actual DOM node count**, aur web apps mein DOM trees typically RN ke native view trees se **kaafi zyada deep aur wide** hote hain. Ek single "card" component jo RN mein 3-4 native views banata hai, web pe (with wrapper divs, icon spans, pseudo-elements, nested flex containers for CSS reasons) 15-20 DOM nodes bana sakta hai. Isliye jab tumhare paas ek list ho 100+ cards ki, aur har card unnecessarily re-render ho rahi ho, actual DOM diffing aur reflow cost RN ke equivalent scenario se zyada ho sakta hai — memoization yahan zyada directly measurable difference laata hai, especially forms, tables, aur data grids mein jaha DOM density high hoti hai.

```tsx
// ExpensiveList.tsx — memo + useMemo + useCallback together
import { memo, useMemo, useCallback, useState } from 'react';

type Item = { id: string; name: string; price: number };

// memo — sirf tab re-render hoga jab props actually change hon (shallow compare)
const ListRow = memo(function ListRow({
  item,
  onSelect,
}: {
  item: Item;
  onSelect: (id: string) => void;
}) {
  return (
    <div onClick={() => onSelect(item.id)}>
      {item.name} — ${item.price}
    </div>
  );
});

function ExpensiveList({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('');
  // filter — search text jo user type karta hai

  // useMemo — filtered array sirf tab recompute hoga jab items ya filter change ho,
  // har render pe naya array nahi banega (jo memo ko bekaar kar deta)
  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase())),
    [items, filter],
  );

  // useCallback — stable function reference, taaki ListRow ka memo kaam kare
  const handleSelect = useCallback((id: string) => {
    console.log('selected:', id);
    // yahan actual selection logic hoga, e.g. navigation ya state update
  }, []);

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {filtered.map((item) => (
        <ListRow key={item.id} item={item} onSelect={handleSelect} />
        // key prop — React ko batata hai kaunsa DOM node kaunse item se corresponds karta hai
      ))}
    </div>
  );
}

export default ExpensiveList;
```

---

## Measuring Performance — Tools

Optimize karne se pehle **measure** karo — bina data ke optimization guesswork hai.

- **Chrome DevTools Performance tab** — ek recording lo page interaction ke dauraan, ye flame graph deta hai jisse tum exactly dekh sakte ho kaunsa function kitna time le raha hai, kaunse "long tasks" (50ms se zyada, main thread block karne wale) exist karte hain jo INP ko hurt karte hain.
- **Lighthouse** — automated audit tool (Chrome DevTools mein built-in, ya CLI/CI mein bhi chala sakte ho). Ye Core Web Vitals ka lab-based score deta hai plus actionable suggestions ("reduce unused JavaScript", "serve images in next-gen formats"). Important — Lighthouse **lab data** hai, controlled/simulated network+CPU conditions pe, tumhare actual users ke real conditions nahi.
- **WebPageTest** — real-world network condition simulation ke liye best — different locations, different connection speeds (3G, slow 4G) pe test kar sakte ho, waterfall charts milte hain jo dikhate hain konsi request kab shuru/khatam hui.
- **web-vitals JS library** — Google ka official library jo production mein real users ke browsers se actual LCP/INP/CLS values capture karta hai (Real User Monitoring, RUM). Isse tumhe pata chalta hai ki tumhare **actual** users ka experience kaisa hai, na sirf lab simulation.

```js
// reportWebVitals.js — production mein real user metrics capture karna
import { onLCP, onINP, onCLS } from 'web-vitals';
// web-vitals library se teen core functions import — har ek apne metric ko measure karta hai

function sendToAnalytics(metric) {
  // metric object mein { name, value, id, rating } jaisi info hoti hai
  fetch('/api/analytics/vitals', {
    method: 'POST',
    // POST request — metric data ko backend pe bhejna hai storage/aggregation ke liye
    body: JSON.stringify(metric),
    // metric object ko JSON string mein convert karo
  });
}

onLCP(sendToAnalytics);
// jab bhi LCP finalize hoti hai (page ke life mein), callback trigger hoga
onINP(sendToAnalytics);
// jab bhi INP value update hoti hai (interactions ke response mein), callback trigger hoga
onCLS(sendToAnalytics);
// jab bhi CLS score change hota hai (layout shift hone pe), callback trigger hoga
```

**Lab data (Lighthouse) aur RUM data (web-vitals) dono zaroori hain, alag reasons se** — lab data consistent, reproducible, aur CI mein regression catch karne ke liye best hai (same conditions har baar, isliye tum before/after compare kar sakte ho). RUM data batata hai actual users kya experience kar rahe hain — jo device/network diversity ke wajah se lab data se bahut different ho sakta hai.

---

## Real-World Gotchas

- **Sirf Lighthouse pe optimize karna, real users ko ignore karna** — Lighthouse fast simulated network aur decent CPU pe chalta hai. Tumhara actual user base agar mostly mid-range Android phones pe slow 4G se browse kar raha hai, unka real experience Lighthouse ke green scores se bahut worse ho sakta hai. Hamesha RUM data (web-vitals) bhi check karo, sirf lab score pe mat rely karo.
- **Har jagah memo/useMemo/useCallback laga dena ("premature optimization")** — memoization free nahi hai, khud ek cost hai (comparison overhead, extra memory for cached values). Agar ek component chhota hai aur rarely re-render hota hai, usko memo karna sirf complexity add karta hai bina measurable benefit ke. Pehle profile karo (React DevTools Profiler), phir decide karo kahan memoization actually matter karti hai.
- **Ek bada third-party script silently sab kuch barbaad kar deta hai** — analytics SDKs, chat widgets (Intercom, Zendesk), ad scripts — ye third-party scripts tumhare khud ke optimized code ke bawajood Core Web Vitals ko crash kar sakte hain. Ek heavy chat widget jo main thread block karta hai INP ko badha dega, ya ek ad jo layout shift karta hai CLS spike kar dega — chahe tumhara khud ka application code perfectly optimized ho. Third-party script audit regularly karo (Chrome DevTools "Performance" tab mein third-party attribution feature use karo).
- **`width`/`height` attributes images pe bhool jaana** — agar image ka size pehle se HTML/CSS mein reserved nahi hai, jab image actually load hoti hai, layout shift ho jaata hai (CLS spike). Explicit dimensions do, ya aspect-ratio CSS use karo.
- **Fonts ka Flash of Invisible Text (FOIT) ya layout shift** — custom web fonts load hone mein time lete hain; agar fallback font ka metrics custom font se bahut different hai, text "jump" karta hai jab font swap hota hai. `font-display: optional` ya matching fallback fonts (`size-adjust`) se mitigate karo.

---

## Key Takeaways

- Core Web Vitals (LCP, INP, CLS) real user-perceived quality measure karte hain — loading, interactivity, stability — aur ye ab Google Search ranking factor hain, isliye performance ek business metric bhi hai.
- Code splitting (React.lazy + Suspense, dynamic import) route/feature boundaries pe karo — bahut fine-grained splitting request overhead badhata hai, bahut kam splitting giant bundles banata hai.
- Modern image formats (WebP/AVIF) + responsive `srcset`/`sizes` + native `loading="lazy"` — images typically page ka sabse bada byte contributor hote hain, isliye highest-leverage optimization area hai.
- Critical Rendering Path samajhna zaroori hai — HTML parse se paint tak — render-blocking scripts/stylesheets ko `defer`/`async` aur critical CSS inlining se mitigate karo.
- List virtualization (react-window, react-virtual) exactly RN ke FlatList windowing jaisa concept hai — sirf visible items ke DOM nodes render karo, thousands nahi.
- Web pe DOM reconciliation cost DOM node count se scale karta hai — jo often RN ke native view count se zyada hota hai, isliye memoization ka measurable impact web pe kaafi real hai (lekin premature optimization se bacho).
- Measurement layers alag purpose serve karte hain — Lighthouse (lab, reproducible, CI-friendly), WebPageTest (real network conditions), `web-vitals` (production RUM, actual users).
- Third-party scripts (analytics, chat widgets, ads) apne khud ke optimized code ke bawajood metrics crash kar sakte hain — inhe regularly audit karo.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. INP ne FID ko kyun replace kiya? Difference kya hai?**

FID sirf pehli interaction ki responsiveness measure karta tha — page load ke baad user ka pehla click/tap kitni jaldi respond hua. Problem ye thi ki agar page baad mein (heavy state update, memory leak, ya third-party script ke wajah se) laggy ho jaaye, FID us degradation ko capture nahi karta tha kyunki wo sirf ek data point tha. INP poore page lifecycle mein har interaction ko track karta hai aur worst-case (near-98th percentile) latency report karta hai — isse ek zyada honest signal milta hai ki page **hamesha** kitna responsive rehta hai, sirf shuruaat mein nahi.

**Q2. Agar Lighthouse score 95+ hai lekin real users complain kar rahe hain slow experience ki, kya ho sakta hai?**

Lighthouse lab data hai — controlled, simulated network aur CPU conditions pe (usually decent throttling but consistent). Real users diverse devices (purane low-end Android phones), diverse networks (slow 3G, unstable WiFi), aur diverse geographic locations (CDN se dur) se aa rahe ho sakte hain. Ye gap explain karta hai kyun lab score high hone ke bawajood RUM data (web-vitals library se collected) bahut worse dikha sakta hai. Solution — production mein RUM setup karo aur usi data ko primary source of truth maano, Lighthouse ko sirf regression-catching CI tool ki tarah use karo.

**Q3. Code splitting bahut fine-grained kar dena (har button apna chunk) kyun bad idea hai?**

Har split point ek extra HTTP request create karta hai jab wo chunk load hota hai. Bahut chhote chunks ke liye, network overhead (TCP/TLS handshake amortization, HTTP headers, request queuing) actual JS payload se zyada ho sakta hai — especially HTTP/1.1 pe jaha parallel connections limited hain. Practical rule — route ya major feature boundaries pe split karo, individual small components ko nahi, jab tak wo component genuinely heavy (e.g. chart library, rich text editor) na ho.

**Q4. Render-blocking CSS/JS ka DOM building pe kya effect hota hai, aur kaise mitigate karte ho?**

Synchronous `<script>` (bina defer/async) HTML parsing ko pause kar deta hai jab tak wo download+execute na ho jaaye — isse DOM build directly delay hota hai. Stylesheets bhi render-blocking hain kyunki browser CSSOM complete hone se pehle render tree/paint nahi kar sakta (flash of unstyled content avoid karne ke liye). Mitigation — apne khud ke app scripts pe `defer` (DOM-dependent, order matters), independent third-party scripts pe `async`, critical above-the-fold CSS ko inline karo, aur non-critical CSS ko async load karo (preload + onload swap pattern).

**Q5. List virtualization internally kaise kaam karta hai — react-window jaisi library kya track karti hai?**

Virtualization library scroll container ki current scroll position, item height (fixed ya calculated), aur container ki visible height se calculate karti hai ki abhi kaunse indices viewport mein hain. Sirf unhi indices ke liye DOM nodes render hote hain, plus ek chhota overscan buffer (config se, e.g. 5 extra items upar-neeche) taaki fast scroll pe blank gaps na dikhein. Har DOM node ko `position: absolute` aur calculated `top` offset diya jaata hai (`style` prop se) taaki wo apni correct scroll position pe render ho, chahe uske pehle wale hundreds items DOM mein exist na karte hon. Jab scroll hota hai, library re-calculate karti hai konse indices ab visible hain, purane unmount hote hain, naye mount hote hain.

**Q6. Web pe memoization RN se different kyun matter karti hai?**

RN mein re-render ka main historical cost tha bridge serialization (JSON serialize karke native side bhejna), jo New Architecture (JSI/Fabric) mein kaafi kam ho gaya hai, aur layout recalculation (Yoga pass). Web pe DOM reconciliation ka cost seedha actual DOM node count se scale karta hai — aur web apps ke DOM trees usually RN ke native view trees se deeper/wider hote hain (extra wrapper divs, spans, pseudo-elements CSS ke liye). Isliye ek unnecessarily re-rendering list jisme 100+ complex cards hain, web pe often zyada measurable slowdown deta hai — memoization ka ROI web pe list-heavy/table-heavy UIs mein directly observable hota hai.

**Q7. `next/image` manual `<img srcset>` se better kyun hai, aur kab manual approach zaroori hai?**

`next/image` automatically responsive `srcset` generate karta hai (multiple widths), format conversion karta hai (WebP/AVIF agar browser support kare), native lazy loading integrate karta hai, aur required `width`/`height` se CLS prevent karta hai — sab kuch bina manually har breakpoint ke liye image variants banaye. Manual `<img srcset>` zaroori hai jab tum Next.js use nahi kar rahe (plain React/Vite app), ya jab image source external CDN se aa raha hai jo already apna resizing/format logic handle karta hai (e.g. Cloudinary, Imgix) — un cases mein tum CDN ke query params se directly responsive URLs generate karte ho.

**Q8. CLS ka real-world example do jaha ek innocent-looking code change production mein CLS spike kar de.**

Classic example — ek third-party ad slot ya "recommended products" widget jo initially empty `<div>` reserve karta hai bina fixed height ke, aur data load hone ke baad content (with actual height) inject karta hai. Page load ke initial moments mein user scroll kar raha hota hai ya kisi button pe click karne ja raha hota hai, aur achanak ye widget apni height le leta hai, sab kuch neeche push ho jaata hai — user ka click kisi galat element pe land ho jaata hai. Fix — widget container ko ek reserved min-height do (skeleton state ke through), ya CSS `aspect-ratio` use karo taaki space pehle se allocated rahe, content load hone se layout shift na ho.

**Q9. Third-party scripts performance ko kaise silently degrade karte hain, aur tum unhe kaise diagnose/control karte ho?**

Third-party scripts (analytics, chat widgets, ad networks) apna khud ka JS parse+execute karte hain main thread pe — agar wo heavy hain ya poorly written (synchronous DOM manipulation, large bundle size), wo INP ko directly hurt karte hain (long tasks create karke) chahe tumhara khud ka application code perfectly optimized ho. Kai baar wo apna CSS bhi inject karte hain jo layout shift cause karta hai (CLS). Diagnose karne ke liye Chrome DevTools Performance tab mein "third-party" attribution filter use karo — ye batata hai kaunsa script kitna main-thread time le raha hai. Control ke liye — scripts ko `async`/`defer` do (jab possible ho), unhe lazy-load karo (jaise chat widget sirf user interaction ke baad load karo, immediate page load pe nahi), aur periodically audit karo ki kaunse third-party scripts actually zaroori hain — kai baar teams purane analytics tools remove karna bhool jaate hain.
