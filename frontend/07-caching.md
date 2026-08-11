# Caching — The Full Hierarchy, End to End

Caching web engineering ka woh topic hai jisme har layer apna khud ka caching mechanism leke aati hai — browser, service worker, CDN, reverse proxy, application server, database — aur senior interview mein sabse zyada pucha jaane wala aur sabse zyada galat samjha jaane wala topic bhi yehi hai. Ye chapter tumhe puri hierarchy dikhata hai, top se bottom tak, ek hi request ke journey ke through — kaunsi layer pe cache hit hota hai, kyun hota hai, aur agar galat layer pe galat cache lagi toh kya breaks hota hai (including production security incidents). `06-cdn.md` mein CDN edge caching aur `03-tanstack-query.md` mein client-side data caching apne specific angles se touch hoti hain — ye chapter unko connect karta hai aur poori caching hierarchy ko ek unified mental model deta hai.

## Table of Contents

1. [The Full Caching Hierarchy — A Request's Journey](#1-the-full-caching-hierarchy--a-requests-journey)
2. [HTTP Cache Headers — The Actual Mechanics](#2-http-cache-headers--the-actual-mechanics)
3. [Browser Cache — Memory Cache vs Disk Cache](#3-browser-cache--memory-cache-vs-disk-cache)
4. [Service Worker Caching (Programmable Cache)](#4-service-worker-caching-programmable-cache)
5. [Application-Level Cache (Redis/Memcached)](#5-application-level-cache-redismemcached)
6. [Cache Invalidation Strategies — The Hard Part](#6-cache-invalidation-strategies--the-hard-part)
7. [Client-Side Data Caching (React Query / SWR style)](#7-client-side-data-caching-react-query--swr-style)
8. [Cache Busting](#8-cache-busting)
9. [Real-World Gotchas](#9-real-world-gotchas)
10. [Key Takeaways](#key-takeaways)
11. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## 1. The Full Caching Hierarchy — A Request's Journey

Jab browser mein tum ek URL hit karte ho, wo request actually kitni layers cross karti hai, ye zyada developers ko clearly nahi pata hota. Har layer ek "cache" hai apne aap mein, aur har layer pe ek **cache hit** ka matlab hai — request agli layer tak pahunchi hi nahi. Yehi wo compounding performance benefit hai jiske baare mein senior interviews mein pucha jaata hai.

Zyada precisely bolein toh — is chapter mein hum "cache" ka matlab thoda bhi loosely nahi use karenge. Har layer ka apna alag storage medium hai (RAM, disk, remote edge server, in-memory key-value store), apna alag eviction policy hai (kab purana data hataya jaaye), aur apna alag "kaun control karta hai" answer hai (browser vendor, CDN provider, tumhara khud ka application code, ya database engine). Ye teeno axes samajhna hi senior-level caching knowledge hai — sirf "cache lagao, fast ho jayega" kehna junior-level hai.

```text
User types URL / clicks a link
        |
        v
[1] Browser Memory Cache  ---- HIT? ----> response served instantly, ZERO network call
        | MISS
        v
[2] Browser Disk Cache    ---- HIT? ----> response served from disk, ZERO network call
        | MISS
        v
[3] Service Worker Cache  ---- HIT? ----> response served from SW-controlled cache, request never left the device
        | MISS (or no SW registered)
        v
[4] CDN Edge Cache         ---- HIT? ----> response served from nearest edge PoP, never reaches origin
        | MISS
        v
[5] Reverse Proxy / LB Cache (Nginx, Varnish) ---- HIT? ----> response served from proxy layer, app server never touched
        | MISS
        v
[6] Application-Level Cache (Redis/Memcached)  ---- HIT? ----> data served from in-memory store, DB never queried
        | MISS
        v
[7] Database Query Cache  ---- HIT? ----> cached query plan/result reused
        | MISS
        v
[8] Database itself — actual disk I/O, actual query execution, slowest path
```

Har layer pe jo bhi cache miss hota hai, uska "cost" wapas us layer ke upar wali saari layers ko pay karna padta ha — matlab agar Redis mein cache miss hua aur DB tak jaana pada, toh us latency ka effect application server, reverse proxy, CDN, sab pe percolate hoga (response time badhega). Isi wajah se **sabse upar wali layer pe cache hit maximize karna** sabse zyada leverage deta hai — ek browser-cache hit CDN ka bhi kaam bacha deta hai, jo reverse proxy ka bhi kaam bacha deta hai, jo DB ka bhi.

Senior-level insight: caching layers **independent nahi hain**, wo ek chain hain. Agar tum sirf apni application (Redis) layer optimize karte ho lekin CDN headers galat set kiye hain, toh har single request phir bhi origin tak pahunchegi — CDN cache miss hoga har baar, aur Redis tabhi kaam aayega jab request already origin tak pahunch gayi. Isliye caching ko **top-down** design karna chahiye: sabse pehle browser/CDN layer sahi karo, phir application layer.

Ek practical example — ek e-commerce product page:

- **Static assets** (JS bundles, CSS, images, fonts) — Browser cache + CDN pe long-lived cache, kyunki content-hash filenames hote hain (section 8 dekho).
- **Product listing API response** (semi-dynamic, minute-level staleness acceptable) — CDN edge cache with short TTL + `stale-while-revalidate`, ya reverse proxy cache.
- **User's cart/personalized data** — kabhi bhi shared cache (CDN/proxy) mein nahi jaana chahiye, `private` + `no-store` ya application-level cache jo user-id se keyed ho (Redis mein `cart:user123` jaisi key).
- **Product details from DB** (frequently read, infrequently written) — Redis cache-aside pattern (section 5).

### Checking which layer actually served a response

Production debugging mein sabse pehla sawaal hota hai — "response kahan se aaya?". Kuch practical signals:

```text
Response Headers to check (DevTools Network tab, "Headers" section):

Age: 42
  --> Ye header CDN/proxy caches add karte hain — batata hai response kitne seconds pehle
      origin se fetch hua tha aur cache mein baitha tha. Age: 0 matlab abhi fresh fetch hua.

X-Cache: HIT
X-Cache: MISS
  --> Zyada tar CDN providers (CloudFront, Fastly, Cloudflare) ye custom header add karte hain,
      explicitly batate hain ki edge cache pe hit hua ya miss (origin tak gaya).

CF-Cache-Status: HIT / MISS / EXPIRED / DYNAMIC
  --> Cloudflare-specific version of the same idea.

(from disk cache) / (from memory cache)  [DevTools ke size column mein]
  --> Browser-level cache indicator, network hi nahi gaya.
```

Agar `Age` header high hai aur `X-Cache: HIT` dikh raha hai, toh guaranteed hai ki tumhara latest code change abhi tak us user tak nahi pahuncha — ye code bug nahi hai, ye ek caching layer hai jo purana snapshot serve kar rahi hai (section 9 mein isi ka pura gotcha discussion hai).

### The last two layers — database query cache aur database itself

Hierarchy diagram ke sabse bottom wale layers (7 aur 8) frontend engineer ke direct control mein kam hote hain, lekin unka existence samajhna zaroori hai kyunki "sab kuch cache karna" ka final fallback yehi hai:

- **Database query cache** — kuch databases (jaise MySQL ka purana query cache, ya Postgres ka shared buffer cache) internally same query ke result ko thodi der ke liye cache karte hain, ya query execution plans cache karte hain (parsing/planning overhead bachane ke liye). Ye application code se directly control nahi hoti — DB engine ke configuration ka hissa hai.
- **Database itself** — agar sab upar wali layers miss ho jayein, request yahan tak pahunchti hai — actual disk I/O, actual query execution against real rows. Ye sabse slow path hai, aur yehi wajah hai ki upar wali har layer ka pura purpose hai is layer tak pahunchne wale requests ki count minimize karna.

Senior-level takeaway: agar tumhara application-level cache (Redis) hit-rate consistently low hai (jaise 20-30%), iska matlab tumhari 70-80% traffic seedha DB tak pahunch rahi hai — chahe upar ki saari layers (browser, CDN) perfectly configured hon. Hit-rate metrics monitor karna (Redis `INFO stats` command se `keyspace_hits`/`keyspace_misses`) production caching health ka sabse direct signal hai.

---

## 2. HTTP Cache Headers — The Actual Mechanics

Ye section poore chapter ka foundation hai — kyunki almost saari upar wali layers (browser, CDN, reverse proxy) HTTP headers ke through hi decide karte hain ki kya cache karna hai, kab tak, aur kis se. Agar tumne yahan galti ki, toh CDN aur browser cache dono wrong behave karenge.

### `Cache-Control` — the primary directive

`Cache-Control` header ek ya multiple comma-separated directives leta hai. Inhe confuse karna bahut common hai, especially `no-cache` vs `no-store` — interview mein ye ek classic trick question hai.

| Directive | Actual meaning |
|---|---|
| `max-age=<seconds>` | Response ko itne seconds tak "fresh" (bina revalidate kiye reusable) treat karo |
| `no-cache` | **Confusing naam** — iska matlab "cache mat karo" NAHI hai. Iska matlab hai: cache toh karo, lekin **har use se pehle server se revalidate karo** (conditional request bhejo) |
| `no-store` | Ye actually "kabhi cache mat karo" hai — response memory ya disk kahin bhi store nahi hoga |
| `private` | Sirf ek single user (end-user browser) ke liye cacheable — shared caches (CDN, proxy) isse cache NAHI kar sakte |
| `public` | Kisi bhi cache (browser, CDN, proxy — shared caches included) mein cache ho sakta hai, chahe response mein auth header ho |
| `stale-while-revalidate=<seconds>` | Agar cache stale ho gaya hai, purana (stale) response turant serve karo, aur background mein ek revalidation request bhejo — user ko wait nahi karna padta |
| `must-revalidate` | Ek baar stale hone ke baad, bina revalidate kiye is response ko kabhi use mat karo — even agar origin unreachable hai (network error dikhao, purana data mat dikhao) |

```http
# Static, content-hashed asset — kabhi change nahi hoga is exact URL pe (hash badalne pe naya URL banega)
Cache-Control: public, max-age=31536000, immutable
# public = CDN/proxy bhi cache kar sakte hain
# max-age=31536000 = 1 saal tak fresh treat karo, revalidate ki zaroorat nahi
# immutable = browser ko batata hai ye content kabhi is URL pe change nahi hoga, revalidate check bhi skip kar do (even on reload)

# Semi-dynamic API response — thoda stale chalega, background refresh ke saath
Cache-Control: public, max-age=60, stale-while-revalidate=300
# max-age=60 = 60 second tak fresh
# stale-while-revalidate=300 = us ke baad 300 second tak, stale response turant serve karo aur background mein refresh karo

# Personalized/sensitive data — kabhi shared cache mein nahi jaana chahiye
Cache-Control: private, no-store
# private = sirf end-user browser cache, CDN/proxy exclude
# no-store = actually kahin bhi store hi nahi hoga, sabse strict directive
```

### `Vary` — the header that changes what "same URL" even means

Ek aur header jo caches ke saath deeply interact karta hai — `Vary`. Normally cache ek URL ko as-is key treat karta hai — same URL, same cached response. Lekin kabhi kabhi same URL ke liye **different responses** honi chahiye based on request headers — jaise `Accept-Language` (English vs Hindi content) ya `Accept-Encoding` (gzip vs brotli compressed body). `Vary: Accept-Language` server ko batata hai "is URL ke liye ek se zyada cached versions rakho, request ke `Accept-Language` header ke hisaab se alag-alag".

```http
Cache-Control: public, max-age=3600
Vary: Accept-Language
# CDN/proxy ab is response ko cache karega, lekin key sirf URL nahi — URL + Accept-Language combination
# matlab English request aur Hindi request alag cache entries honge, cross-serve nahi hoga
```

**Common misconfiguration:** agar tum response personalize kar rahe ho based on cookies (jaise auth cookie se user-specific data) lekin `Vary: Cookie` set nahi karte, aur CDN/proxy ko `public` bhi bola hai, toh yehi exact mechanism hai jisse ek user ka personalized response doosre ko serve ho jaata hai — section 9 ke pehle gotcha ki root cause yahi hoti hai.

### `ETag` — a fingerprint for the resource

`ETag` ek hash/fingerprint hai jo server response body se generate karta hai (content hash, ya version identifier). Client isse store karke agli baar request mein `If-None-Match` header ke through wapas bhejta hai — server check karta hai ki resource change hua ya nahi, aur agar nahi hua, `304 Not Modified` return karta hai **bina response body ke** — bandwidth bachta hai, chahe technically ye ek "revalidation" hai, na ki full cache hit.

### `Last-Modified` / `If-Modified-Since` — older, timestamp-based alternative

`ETag` se pehle ye tareeka use hota tha — server response ke saath resource ka last-modified timestamp bhejta hai, client agli request mein `If-Modified-Since` header ke through wapas bhejta hai. Problem: timestamp ki granularity sirf 1-second hoti hai, aur agar content byte-for-byte same hai lekin timestamp update ho gaya (jaise ek build process ne file ko touch kar diya bina actual content change kiye), toh false-positive "changed" mil sakta hai. `ETag` isse zyada precise hai kyunki wo actual content pe based hai, timestamp pe nahi — isliye modern APIs `ETag` prefer karti hain, `Last-Modified` sirf legacy compatibility ke liye rakha jaata hai.

### Server setting these headers correctly — Node/Express example

```js
const express = require("express"); // Express framework import kiya, HTTP server banane ke liye
const crypto = require("crypto"); // Node ka built-in crypto module, ETag hash generate karne ke liye
const app = express(); // Express app instance banaya

app.get("/api/products/:id", async (req, res) => { // /api/products/:id route ka GET handler
  const product = await getProductFromDb(req.params.id); // DB se product fetch kiya (yeh function kahin aur defined hai)

  if (!product) { // agar product exist nahi karta
    return res.status(404).json({ error: "Not found" }); // 404 return karo, cache headers ki zaroorat nahi
  }

  const body = JSON.stringify(product); // response body ko string mein serialize kiya, hash lene ke liye zaroori hai
  const etag = crypto.createHash("sha1").update(body).digest("hex"); // body ka SHA1 hash liya, ye humara ETag fingerprint hai

  res.set("ETag", `"${etag}"`); // ETag header set kiya, double-quotes HTTP spec ke according zaroori hain
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300"); // 60 sec fresh, phir stale-while-revalidate window

  const clientETag = req.headers["if-none-match"]; // client ne agar pehle se ETag bheja hai, use nikaala
  if (clientETag === `"${etag}"`) { // agar client ka ETag humare current ETag se match karta hai
    return res.status(304).end(); // 304 Not Modified, bina body ke — bandwidth bachaya
  }

  res.status(200).send(body); // ETag match nahi hua (ya first request), poora response body bhejo
});

app.listen(3000, () => { // server ko port 3000 pe start kiya
  console.log("Server running on port 3000"); // confirmation log
});
```

### Client making a conditional request manually

```js
async function fetchProductWithCache(id, cachedEtag) { // product fetch karne wala function, purana ETag param mein leta hai
  const headers = {}; // request headers ka empty object banaya

  if (cachedEtag) { // agar humare paas pehle se ek cached ETag hai
    headers["If-None-Match"] = cachedEtag; // If-None-Match header mein purana ETag daal diya, server ise compare karega
  }

  const res = await fetch(`/api/products/${id}`, { headers }); // fetch call kiya, conditional headers ke saath

  if (res.status === 304) { // agar server ne "not modified" bola
    console.log("Cache hit — using stored data, no new body downloaded"); // koi naya data nahi aaya, purana hi use karo
    return null; // caller ko signal diya ki cached version already valid hai
  }

  const newEtag = res.headers.get("ETag"); // response se naya ETag nikaala, next request ke liye store karna hoga
  const data = await res.json(); // fresh response body ko JSON mein parse kiya

  return { data, etag: newEtag }; // fresh data aur naya ETag caller ko wapas diya
}
```

---

## 3. Browser Cache — Memory Cache vs Disk Cache

Browser ke andar bhi caching ek single layer nahi hai — Chrome DevTools ke Network tab mein tumne "from memory cache" aur "from disk cache" dono labels dekhe honge, aur ye do genuinely different tiers hain.

- **Memory cache** — RAM mein, sabse fast access. Lekin **tab close hone pe (ya kabhi kabhi navigation pe bhi) clear ho jaata hai** — ye ephemeral hai. Browser chhoti/frequently-reused resources (jaise scripts jo same page pe multiple baar reference hoti hain) ko yahan rakhta hai.
- **Disk cache** — persistent storage pe, slower than memory but survives browser restart, tab close, sab kuch (jab tak explicitly clear na ho ya cache full na ho aur eviction na ho). Bade assets (images, fonts, large JS bundles) yahan jaate hain kyunki memory mein rakhna wasteful hota.

Important senior-level point: **developer ko in dono tiers pe koi direct control nahi hota**. Tum sirf `Cache-Control` headers ke through browser ko "hint" de sakte ho ki kitni der cache karo — ye decide karna ki memory mein rakhna hai ya disk pe, ye purely browser ka heuristic hai, based on resource size, likely reuse pattern, available memory, aur browser-specific algorithms (jo Chrome/Firefox/Safari mein different hote hain aur publicly documented bhi nahi hain in full detail). Tum bas iska outcome influence kar sakte ho (headers sahi set karke), internal mechanism control nahi kar sakte.

```text
DevTools Network tab mein dikhne wale size column values:
"(memory cache)"  --> RAM se serve hua, tab reload tak persist, tab close pe gone
"(disk cache)"    --> disk se serve hua, persists across restarts
"200" with actual KB size --> real network request gaya, cache miss tha
"304" --> conditional request, server ne "not modified" bola, minimal bytes transferred
```

Ye bhi note karo: agar tumne DevTools mein "Disable cache" checkbox on kiya hai (jo har developer ko karna chahiye local dev ke waqt — section 9 mein detail), toh dono tiers bypass ho jaate hain aur har request fresh network call banti hai.

---

## 4. Service Worker Caching (Programmable Cache)

Browser ka default HTTP cache **heuristic-based** hai — browser decide karta hai kya cache karna hai based on headers, lekin final control browser ke haath mein hai. Service Worker ek fundamentally different model deta hai: **developer ko full programmatic control** milta hai. Tum JavaScript likhte ho jo literally har single network request ko intercept karta hai (jaise ek proxy jo browser aur network ke beech baithta hai), aur exact decide karta hai — cache se serve karna hai, network se fetch karna hai, ya dono ka combination.

Ye teen common strategies hain jo code mein implement hoti hain:

- **Cache-first** — pehle cache check karo, mile toh serve karo, na mile toh network se fetch karo aur cache mein daalo. Static assets ke liye best (CSS, JS, fonts, logos).
- **Network-first** — pehle network try karo, fail ho (offline) toh cache se fallback karo. Frequently-changing data ke liye best (news feed, live prices).
- **Stale-while-revalidate** — cache se turant serve karo (fast response), simultaneously background mein network se fresh version fetch karo aur cache update karo next time ke liye. Balance between speed aur freshness.

Ye pattern hi **offline-capable PWAs** ka foundation hai — agar Service Worker ne static assets ko cache-first strategy se pehle se cache kar rakha hai, toh app poori tarah offline bhi load ho sakti hai, network ki zaroorat hi nahi.

### Full example — cache-first strategy for static assets

```js
// sw.js — ye file service worker ke roop mein register hoti hai (main.js se navigator.serviceWorker.register("/sw.js"))

const CACHE_NAME = "static-assets-v1"; // cache ka naam, versioned — deploy pe naya version banayenge (section 6 invalidation se related)

const ASSETS_TO_CACHE = [ // ye list of URLs hai jo install ke waqt pre-cache honge
  "/", // homepage HTML
  "/styles/main.css", // main stylesheet
  "/scripts/app.js", // main JS bundle
  "/images/logo.png", // logo image
];

self.addEventListener("install", (event) => { // "install" event tab fire hota hai jab SW pehli baar register ya update hota hai
  event.waitUntil( // waitUntil browser ko batata hai ki install tab tak "in-progress" treat karo jab tak promise resolve na ho
    caches.open(CACHE_NAME).then((cache) => { // naya (ya existing) named cache storage open kiya
      return cache.addAll(ASSETS_TO_CACHE); // saare pre-defined assets ko fetch karke cache mein daal diya, ek saath
    })
  );
});

self.addEventListener("activate", (event) => { // "activate" event tab fire hota hai jab naya SW purane ko replace karta hai
  event.waitUntil( // activation ko async cleanup complete hone tak pending rakho
    caches.keys().then((cacheNames) => { // saare existing cache-storage names list kiye
      return Promise.all( // saare deletion promises ko parallel mein resolve karo
        cacheNames
          .filter((name) => name !== CACHE_NAME) // sirf purane (current version se alag) cache names filter kiye
          .map((name) => caches.delete(name)) // har purane cache ko delete kiya — stale cached assets cleanup (invalidation!)
      );
    })
  );
});

self.addEventListener("fetch", (event) => { // "fetch" event HAR SINGLE network request pe fire hota hai jo page se jaata hai
  event.respondWith( // respondWith browser ko batata hai "is request ka response main khud decide karunga"
    caches.match(event.request).then((cachedResponse) => { // current request ko cache mein dhoondha (URL match based)
      if (cachedResponse) { // agar cache mein mil gaya
        return cachedResponse; // cached response turant return kar do — network call hi nahi hua, cache-first ka core idea
      }
      return fetch(event.request).then((networkResponse) => { // cache miss — actual network request bhejo
        return caches.open(CACHE_NAME).then((cache) => { // response cache karne ke liye cache storage open kiya
          cache.put(event.request, networkResponse.clone()); // response ko cache mein store kiya (clone zaroori hai kyunki response body ek baar hi read ho sakti hai, ek copy cache ke liye ek browser ke liye)
          return networkResponse; // original response browser ko wapas de diya taaki page render kar sake
        });
      });
    })
  );
});
```

Line-by-line breakdown ka core insight: `install` event pe critical assets pre-cache hote hain, `activate` event pe purane cache versions cleanup hote hain (yehi service-worker-level cache invalidation hai), aur `fetch` event pe har request ke liye runtime decision liya jaata hai. Ye teeno events milke ek complete programmable caching pipeline banate hain jo poori tarah developer ke control mein hai — browser ka koi heuristic beech mein nahi aata.

### Network-first strategy — for frequently-changing data

Cache-first sab kuch ke liye galat hai — jaise ek news feed ya live price ticker ke liye tum kabhi nahi chahoge ki purana cached data pehle dikhe. Network-first strategy iska opposite karti hai: pehle network try karo, fail ho (offline/timeout) toh hi cache pe fallback karo.

```js
self.addEventListener("fetch", (event) => { // har network request ke liye ye handler chalega
  if (event.request.url.includes("/api/live-prices")) { // sirf frequently-changing endpoint ke liye ye strategy apply kar rahe hain
    event.respondWith( // response decision hum khud le rahe hain
      fetch(event.request) // pehle seedha network try kiya — freshest possible data
        .then((networkResponse) => { // network call successful hui
          const clone = networkResponse.clone(); // response clone kiya, ek copy cache ke liye, ek return ke liye
          caches.open("dynamic-data-v1").then((cache) => cache.put(event.request, clone)); // fresh response ko cache mein bhi update kar diya, future offline fallback ke liye
          return networkResponse; // fresh data caller ko diya
        })
        .catch(() => { // network fail hua (offline, timeout, ya server down)
          return caches.match(event.request); // is case mein hi cache se fallback response try kiya
        })
    );
  }
});
```

### Stale-while-revalidate strategy — the balanced option

Ye strategy speed aur freshness dono balance karti hai — cache se turant serve karo (user ko zero wait), aur parallel mein background fetch chalao jo cache ko update kar de future ke liye.

```js
self.addEventListener("fetch", (event) => { // fetch event listener
  event.respondWith( // response hum manually control karenge
    caches.open("swr-cache-v1").then((cache) => { // named cache open kiya
      return cache.match(event.request).then((cachedResponse) => { // pehle cache check kiya
        const networkFetch = fetch(event.request).then((networkResponse) => { // background mein network call bhi shuru kar diya, parallel
          cache.put(event.request, networkResponse.clone()); // fresh response se cache update kiya, next time ke liye
          return networkResponse; // fresh response bhi return-able hai agar cache empty tha
        });
        return cachedResponse || networkFetch; // agar cache mein kuch tha, turant wahi return karo; nahi toh network wait karo
        // yehi core idea hai — user ko turant response mila (cache se), lekin cache silently fresh ho gaya background mein
      });
    })
  );
});
```

---

## 5. Application-Level Cache (Redis/Memcached)

Ye caching layer server-side hoti hai — app server aur database ke beech mein baithi hai. Purpose simple hai: agar ek expensive database query ya third-party API call repeatedly same result deta hai, toh use har baar re-run karne ki zaroorat nahi — result ko fast in-memory store (Redis/Memcached) mein rakh do, aur baar baar wahin se serve karo.

### Cache-aside (lazy loading) pattern

Ye sabse common pattern hai: application code cache check karta hai, miss hone pe DB query karta hai, phir result ko cache mein daal deta hai next time ke liye.

```text
1. Request aayi data ke liye
2. Cache check karo (Redis GET)
3. HIT -> cached data return karo, DB touch hi nahi hua
4. MISS -> DB se query karo
5. DB result ko cache mein store karo (Redis SET with TTL)
6. Result caller ko return karo
```

### Write-through pattern (for comparison)

Write-through mein, jab data write hota hai, cache aur DB **dono simultaneously update** hote hain — matlab cache kabhi stale nahi hota reads ke liye (kyunki write ke sath sath hi update ho gaya), lekin har write thoda slower hota hai (dono jagah likhna padta hai) aur agar data kabhi read hi nahi hoga, cache mein unnecessary space bhi le sakta hai. Cache-aside iske against lazy hai — sirf demand pe cache populate hota hai, isliye zyada common hai general-purpose use cases mein.

### Cache-aside implementation — Node.js API route

```js
const express = require("express"); // Express framework
const Redis = require("ioredis"); // Redis client library import kiya
const redis = new Redis(process.env.REDIS_URL); // Redis connection banaya, URL env var se (jaise redis://localhost:6379)
const app = express(); // Express app instance

async function getProductFromDb(id) { // ye function actual (expensive maana ja raha) DB query karta hai
  // ... yahan real DB query hoti (Postgres/MongoDB etc), abhi ke liye placeholder
  return { id, name: "Sample Product", price: 999 }; // dummy return, real code mein DB se aayega
}

app.get("/api/products/:id", async (req, res) => { // product-by-id route ka handler
  const { id } = req.params; // URL param se product id nikaala
  const cacheKey = `product:${id}`; // cache key banayi, namespaced format (type:id) — collision se bachne ke liye

  const cached = await redis.get(cacheKey); // Redis se pehle cache check kiya

  if (cached) { // agar cache mein data mil gaya
    console.log("Cache HIT — DB touch nahi hua"); // debug log, production mein metrics/tracing se replace karo
    return res.json(JSON.parse(cached)); // Redis mein data string ke roop mein store hota hai, parse karke wapas bheja
  }

  console.log("Cache MISS — DB query chal rahi hai"); // debug log
  const product = await getProductFromDb(id); // cache miss, actual DB (ya expensive computation) call kiya

  if (!product) { // agar DB mein bhi product nahi mila
    return res.status(404).json({ error: "Not found" }); // 404, cache mein negative result store nahi kar rahe (design choice)
  }

  await redis.set(cacheKey, JSON.stringify(product), "EX", 300); // result ko Redis mein store kiya, "EX 300" = 300 second (5 min) TTL
  // EX flag Redis ko batata hai ki is key ko itne seconds baad automatically expire/delete kar do — TTL-based invalidation (section 6)

  res.json(product); // fresh product data caller ko return kiya
});

app.listen(3000, () => console.log("Server running on port 3000")); // server start
```

Yahan `EX 300` wahi TTL-based invalidation hai jo section 6 mein detail se cover hoga — Redis khud is key ko expire karke delete kar dega, humein manually kuch nahi karna.

---

## 6. Cache Invalidation Strategies — The Hard Part

Ek famous quote hai (thoda joke ki tarah, lekin sach): *"There are only two hard things in Computer Science: cache invalidation and naming things."* Iski wajah simple hai — caching ka pura point ye hai ki tum data ka ek "purana copy" rakh rahe ho performance ke liye, lekin agar underlying data change ho gaya aur tumhara cache ko pata nahi chala, toh tum users ko **wrong data** serve kar rahe ho. Teen main strategies hain, har ek ka apna trade-off:

### 1. TTL-based expiry (simplest)

Har cache entry ek fixed lifetime (Time To Live) ke saath store hoti hai — jaise Redis mein upar dekha `EX 300`. Us duration ke baad entry automatically expire/delete ho jaati hai, agli request DB se fresh data laayegi.

**Trade-off:** Simple to implement, koi extra coordination logic nahi chahiye. Lekin ek "staleness window" accept karna padta hai — agar TTL 5 minutes hai aur underlying data 1 second baad change ho gaya, toh baaki 4 minutes 59 seconds tak users ko stale data milta rahega. Jitna chhota TTL, kam staleness, lekin cache hit-rate bhi kam (zyada DB queries).

### 2. Explicit invalidation (delete on write)

Jab bhi underlying data change hota hai (update/delete), application code explicitly cache entry ko delete ya update karta hai **usi waqt** — staleness window zero ho jaata hai (theoretically).

```js
app.put("/api/products/:id", async (req, res) => { // product update route
  const { id } = req.params; // id nikaala
  const updatedProduct = await updateProductInDb(id, req.body); // DB mein update kiya (function kahin aur defined)

  await redis.del(`product:${id}`); // CRITICAL LINE — jaise hi DB update hua, cache entry ko explicitly delete kar diya
  // agli GET request pe cache-aside pattern (section 5) automatically fresh data DB se laayega aur re-populate karega

  res.json(updatedProduct); // updated product return kiya
});
```

**Trade-off aur common bug:** Ye approach har write-path ko cache-aware banana padta hai. Agar koi developer baad mein data update karne ka **naya raasta** add kare (jaise ek bulk-update admin script, ya ek doosra API route jo same table update karta hai) aur wahan cache invalidation add karna bhool jaaye, toh cache silently stale ho jaata hai — aur ye bug production mein hafton tak unnoticed reh sakta hai kyunki "kabhi kabhi purana data dikhta hai" jaisa symptom debugging mein bahut misleading hota hai. Ye asli senior-level gotcha hai jo interview mein bhi pucha jaata hai.

### 3. Event-based invalidation (pub/sub)

Distributed systems mein (jahan multiple app server instances chal rahe hain, har ek apna khud ka local ya shared cache use kar raha hai), sirf ek instance mein cache delete karna kaafi nahi hai — baaki instances ko bhi pata chalna chahiye. Iske liye pub/sub pattern use hota hai: data change hone pe ek "event" publish hota hai (jaise Redis Pub/Sub, Kafka, ya database change-data-capture), aur saare subscribed instances us event ko sunke apna local cache invalidate karte hain.

```js
// Publisher side — jab data change hoti hai
async function updateProduct(id, data) { // product update karne wala function
  await db.products.update(id, data); // DB mein actual update kiya
  await redisPubSub.publish("product-updated", JSON.stringify({ id })); // "product-updated" channel pe event publish kiya, sirf changed id bheja
}

// Subscriber side — har app server instance pe ye chalta rehta hai
redisPubSub.subscribe("product-updated"); // is channel ko subscribe kiya, background mein continuously sunta rahega
redisPubSub.on("message", (channel, message) => { // jab bhi is channel pe koi message aaye
  if (channel === "product-updated") { // channel confirm kiya (multiple channels ho sakte hain)
    const { id } = JSON.parse(message); // event payload se changed product ka id nikaala
    localCache.delete(`product:${id}`); // is instance ke apne local in-memory cache se entry delete kar diya
    // agar shared Redis use kar rahe ho toh ye zaroori nahi (already ek hi jagah delete ho gaya), ye pattern zyada relevant hai jab har instance apna local (in-process memory) cache rakhta hai
  }
});
```

Real-world mein zyada tar teenon ka combination use hota hai — explicit invalidation primary defense ke roop mein, TTL ek safety-net ke roop mein (agar explicit invalidation kisi bug ki wajah se miss ho jaaye, TTL eventually cache ko clean kar dega), aur event-based invalidation distributed multi-instance setups mein consistency ke liye.

---

## 7. Client-Side Data Caching (React Query / SWR style)

`03-tanstack-query.md` mein TanStack Query ka deep dive already hai (query keys, staleTime/gcTime, background refetching, mutations) — yahan sirf ek conceptual clarity chahiye jo bahut developers miss karte hain: **HTTP caching aur application data caching genuinely alag layers hain**, aur wo saath-saath coexist karte hain, ek doosre ko replace nahi karte.

| | HTTP Cache (browser/CDN) | Application Data Cache (React Query/SWR) |
|---|---|---|
| **Kya cache hota hai** | Raw HTTP response (bytes, headers) | Parsed, structured JS objects (already deserialized) |
| **Kaunsi layer** | Protocol-level (network stack, CDN) | Application-level, framework-specific, in-memory JS |
| **Kis se controlled** | HTTP headers (`Cache-Control`, `ETag`) | Application code (`staleTime`, `queryKey`, manual invalidation) |
| **Scope** | URL-keyed, browser/CDN infrastructure ka concern | Query-key based, tumhara component tree ka concern |
| **Survives kya** | Page reload (disk cache), tab close (kuch extent tak) | Sirf in-memory — page reload pe gone (unless persisted explicitly) |

Practical example jo clarity deta hai: socho tumne `fetch("/api/products/1")` call kiya. Ye request pehle HTTP cache check karegi (`Cache-Control` headers ke hisaab se) — agar hit, network layer se hi response mil jaayega without going to server. Lekin agar tum React Query use kar rahe ho, uske apna internal cache (query cache) hai jo already-fetched-and-parsed data ko JS memory mein rakhta hai — agar same `queryKey` (`["product", 1]`) dobara request ho, React Query bina fetch call kiye hi (agar `staleTime` window ke andar hai) cached JS object return kar dega, HTTP layer tak jaane ki zaroorat hi nahi.

```js
import { useQuery } from "@tanstack/react-query"; // React Query ka main hook import kiya

function ProductDetail({ id }) { // product detail component, id prop leta hai
  const { data, isLoading } = useQuery({ // useQuery hook call kiya, cache-aware data fetching ke liye
    queryKey: ["product", id], // cache key — is exact key ke liye result JS memory mein cached rahega
    queryFn: () => fetch(`/api/products/${id}`).then((r) => r.json()), // actual fetch function, sirf cache miss pe chalega
    staleTime: 60_000, // 60 second tak data "fresh" treat hoga, is window mein re-fetch nahi hoga (even on remount)
  });

  if (isLoading) return null; // loading state — pehli baar fetch ho raha hai (cache mein kuch nahi tha)
  return <div>{data.name}</div>; // cached ya fresh data se product name render kiya
}
```

Is code mein do caching layers ek saath kaam kar rahi hain: `fetch` call jo network se guzarti hai (agar guzarti hai) HTTP cache headers respect karegi, aur React Query ka apna internal cache (`queryKey` based) us `fetch` call ko poori tarah skip bhi kar sakta hai agar `staleTime` window active hai. Ye dono layers ek doosre se completely independent hain aur dono apni jagah zaroori hain — HTTP cache network-level efficiency deta hai (bandwidth, latency), application cache UI-level efficiency deta hai (re-renders, loading states, avoiding redundant fetch calls jab component remount hota hai).

---

## 8. Cache Busting

Section 2 mein humne dekha `Cache-Control: public, max-age=31536000, immutable` — matlab browser/CDN is asset ko **1 saal tak** bina revalidate kiye reuse karega. Ye bahut aggressive hai, aur genuinely useful sirf tab hai jab tumhare paas ek reliable tareeka ho purane cached version ko **force-replace** karne ka jab tum naya code deploy karte ho. Yehi problem cache busting solve karta hai.

### The standard solution — content-hashed filenames

Modern bundlers (Webpack, Vite, esbuild) build ke waqt har output file ke naam mein uske **content ka hash** embed karte hain:

```text
Deploy #1: app.a1b2c3.js   (content hash "a1b2c3" is version ke content se derived)
Deploy #2 (code changed):  app.f9e8d7.js   (content change hua, naya hash, NAYA filename)
Deploy #3 (no JS change, only CSS changed): app.a1b2c3.js  (JS content same raha, hash bhi same raha!)
```

Kyunki filename khud content ke basis pe change hota hai, ye guarantee hoti hai ki **agar content same hai toh URL same hai, agar content different hai toh URL bhi different hai**. Isse ek elegant solution milta hai: purane files ko **jitna chahe utna aggressively** cache karo (`max-age=31536000, immutable`), kyunki agar unka content kabhi change hoga, wo naye URL pe honge — browser purane URL pe kabhi accidentally stale content serve nahi karega, kyunki wo URL hi tab exist karta hai jab wo exact content exist karta tha.

```html
<!-- index.html — ye file khud aggressively cache NAHI hoti, short/no cache -->
<!-- taaki naye deploy pe browser turant naya index.html fetch kare jisme naye hashed filenames honge -->
<script src="/app.f9e8d7.js"></script> <!-- naya deploy ka hash, purana cache automatically irrelevant ho gaya -->
<link rel="stylesheet" href="/styles.b4c5d6.css"> <!-- CSS bhi apne content-hash ke saath -->
```

Yehi wajah hai ki HTML entry file (jo hashed filenames reference karti hai) ko khud kabhi long-cache nahi karna chahiye — usko har baar fresh fetch hona chahiye (ya bahut short TTL ke saath) taaki wo naye hashed asset URLs point kare. Ye `06-cdn.md` mein CDN-specific invalidation discussion se directly connect karta hai — content hashing ka matlab hai tumhe CDN se manually purge/invalidate karne ki zaroorat almost kabhi nahi padti asset files ke liye, kyunki har deploy naturally naye URLs banata hai. Ye general web performance technique hai, CDN-specific nahi — same principle browser cache, service worker cache, sabke saath kaam karta hai.

---

## 9. Real-World Gotchas

- **Personalized/sensitive content ko `public` Cache-Control ke saath serve karna** — ye ek serious data leak hai. Agar ek API response mein user-specific data hai (jaise `/api/me/profile`) aur galti se `Cache-Control: public, max-age=300` set kar diya, toh ek shared cache (CDN, corporate proxy) us response ko cache karke **doosre user ko serve kar sakta hai**. Ye theoretical nahi hai — multiple real production incidents ismein hue hain jahan User A ka personal data User B ko dikha diya gaya sirf caching misconfiguration ki wajah se. Rule: kisi bhi personalized response pe `private` ya `no-store` — kabhi bhi `public` nahi, chahe convenience kitni hi lage.

  ```js
  // GALAT — is route se generic middleware ne har response pe blanket "public" cache laga diya
  app.use((req, res, next) => { // koi bhi route pe apply hone wala middleware
    res.set("Cache-Control", "public, max-age=300"); // DANGER: har response ko shared-cacheable bana diya, personalized bhi
    next(); // agle handler ko control diya
  });

  // SAHI — personalized route apna khud ka header explicitly override karta hai
  app.get("/api/me/profile", authMiddleware, (req, res) => { // authenticated, user-specific route
    res.set("Cache-Control", "private, no-store"); // ye specific route ke liye blanket middleware ko explicitly override kiya
    res.json({ email: req.user.email, orders: req.user.orders }); // sensitive, user-specific data
  });
  ```

  Ye galti aksar isliye hoti hai kyunki ek generic caching middleware saari routes pe apply ho jaata hai bina yaad rakhe ki kuch routes personalized hain — code review mein har naye route pe explicitly ye check karna chahiye ki cache header appropriate hai ya nahi.

- **"Why isn't my change showing up" debugging sessions** — production support mein ek bahut badi percentage of "it's not working" bug reports actually caching issues hote hain, code bugs nahi. Developer code deploy karta hai, changes sahi hain, lekin CDN/browser/proxy kisi layer pe purana cached version abhi bhi serve ho raha hai. Debugging approach: sabse pehle check karo response headers (`Cache-Control`, `Age`, `X-Cache: HIT/MISS` jaisa CDN header) — agar `X-Cache: HIT` dikh raha hai, tumhara code bug nahi hai, tumhara cache bug hai.

- **Development mein over-aggressively cache ho jaana** — ye itna common hai ki browser DevTools mein specifically iske liye ek checkbox hai: Network tab mein **"Disable cache"**. Development ke waqt agar tum ise on nahi karte, toh tumhari khud ki browser HTTP cache purane JS/CSS/API responses serve karti rehti hai jab tak hard refresh (`Cmd+Shift+R`) na karo — aur ye "mera change reflect nahi ho raha" confusion ka number-one local-dev source hai. Rule of thumb: DevTools khula rakho with "Disable cache" checked jab bhi actively development kar rahe ho.

- **Cache stampede / thundering herd** — jab ek bahut popular cached item (jaise homepage data, ya ek viral product page) expire hota hai, aur us exact moment pe hazaaron simultaneous requests aati hain, sab ek saath cache miss dekhte hain aur sab ek saath origin/database ko hit karte hain — jo database ko overload kar sakta hai (jo cache ka pura purpose defeat karta hai, jo tha DB ko protect karna). Solutions: **jittered TTLs** (har cache entry ka expiry time thoda randomize karo, taaki sab ek saath expire na hon), **lock/single-flight pattern** (jab pehla request cache-miss dekhe, wo hi DB query kare aur baaki requests ko wait karwaye uska result use karne ke liye, instead of sabko independently DB hit karne dena), ya **stale-while-revalidate** pattern (jo section 2 mein dekha — purana data turant serve karo, background mein ek hi refresh trigger karo).

### Single-flight lock pattern — code example

Ye pattern stampede ka sabse robust fix hai — jab cache miss ho, sirf **ek** request ko DB tak jaane do, baaki sab us ek request ka result reuse karein.

```js
const inFlightRequests = new Map(); // module-level map — key: cacheKey, value: pending Promise (in-flight DB query)

async function getProductWithSingleFlight(id) { // single-flight protection ke saath product fetch karne wala function
  const cacheKey = `product:${id}`; // Redis cache key
  const cached = await redis.get(cacheKey); // pehle cache check kiya

  if (cached) { // cache hit
    return JSON.parse(cached); // seedha cached data return kar diya
  }

  if (inFlightRequests.has(cacheKey)) { // ye check hi single-flight ka core hai
    console.log("Ek dusra request already DB query kar raha hai, uska result await kar rahe hain"); // debug log
    return inFlightRequests.get(cacheKey); // naya DB query mat chalao, existing pending promise ko hi await karo
  }

  const dbPromise = getProductFromDb(id).then(async (product) => { // naya DB query shuru kiya, promise ko variable mein store kiya
    await redis.set(cacheKey, JSON.stringify(product), "EX", 300); // result cache mein daal diya, taaki agli baar cache-hit ho
    inFlightRequests.delete(cacheKey); // query complete ho gaya, in-flight map se entry hata diya (cleanup)
    return product; // final result return kiya
  });

  inFlightRequests.set(cacheKey, dbPromise); // is pending promise ko map mein register kiya, taaki dusre concurrent callers isse reuse karein
  return dbPromise; // yehi original caller ka result bhi hai
}
```

Is pattern ka net effect: agar 1000 requests ek saath cache-miss dekhein, sirf **1 actual DB query** chalegi — baaki 999 wahi ek promise await karenge. Database pe load hamesha bounded rehta hai, chahe traffic spike kitna bhi bada ho.

---

## Key Takeaways

- Caching ek single layer nahi hai — ye ek **hierarchy** hai (browser → service worker → CDN → reverse proxy → application cache → DB), aur har layer pe hit hona matlab agli layer ka load kam hona. Top-down design karo — pehli layers sahi karne ka leverage sabse zyada hai.
- `no-cache` aur `no-store` alag hain — `no-cache` matlab "revalidate karo before use", `no-store` matlab "kabhi cache mat karo". Ye confusion interview mein aur production dono mein common hai.
- `ETag` + `If-None-Match` ka combo `304 Not Modified` ke through bandwidth bachaata hai, chahe technically cache "miss" (revalidation) hi ho.
- Browser memory cache aur disk cache pe developer ka **direct control nahi hota** — sirf headers se influence hota hai, decision browser ka heuristic hota hai.
- Service Worker cache **fully programmable** hai — cache-first, network-first, aur stale-while-revalidate strategies code mein likhi jaati hain, ye offline-capable PWAs ka foundation hai.
- Redis/Memcached ka cache-aside pattern (check cache, miss pe DB query + populate) sabse common application-level caching pattern hai; write-through iska alternative hai jahan cache aur DB dono simultaneously update hote hain.
- Cache invalidation teen tareekon se hoti hai — TTL (simple, staleness window), explicit (precise, lekin missed-invalidation bugs ka risk), event-based pub/sub (distributed systems ke liye zaroori). Real systems teenon ka combination use karte hain.
- HTTP caching (raw response bytes, protocol-level) aur application data caching (parsed JS objects, framework-level jaise React Query) genuinely alag layers hain jo saath-saath kaam karti hain, ek doosre ko replace nahi karti.
- Content-hashed filenames (`app.[hash].js`) cache busting ka standard solution hain — aggressive long-term caching enable karte hain bina staleness risk ke, kyunki content change = naya URL.
- Personalized data ko galti se `public` cache karna ek real security incident category hai — hamesha `private`/`no-store` use karo sensitive/user-specific responses ke liye.

---

## 🎯 Interview Questions — Senior Frontend Developer

**1. `Cache-Control: no-cache` aur `Cache-Control: no-store` mein kya fark hai? Bahut log inhe confuse karte hain.**

`no-cache` ka matlab hai response cache **ho sakta hai**, lekin use karne se pehle server se hamesha revalidate (conditional request via ETag/Last-Modified) karna padega — agar server confirm kare "unchanged", toh cached version use hoga (304 response). `no-store` iske bahut zyada strict hai — response kahin bhi (memory, disk) store hi nahi hoga, har request fresh network round-trip hogi with full response. `no-cache` ka naam misleading hai kyunki wo actually caching allow karta hai, sirf mandatory revalidation ke saath.

**2. ETag kaise kaam karta hai, aur ye `Last-Modified` se better kyun maana jaata hai?**

ETag server-generated ek hash/fingerprint hai jo resource ke actual content se derive hota hai. Client isse `If-None-Match` header mein wapas bhejta hai; server compare karta hai aur agar match ho, `304 Not Modified` bhejta hai bina body ke. `Last-Modified`/`If-Modified-Since` timestamp-based hai — 1-second granularity ki limitation hai, aur agar file touch hui bina content change kiye (jaise deploy pipeline mein timestamp update hua), false-positive "changed" mil sakta hai. ETag content-based hone ki wajah se precise hai.

**3. Browser memory cache aur disk cache mein kya difference hai, aur developer inpe kitna control rakh sakta hai?**

Memory cache RAM-based, fastest, lekin tab close hone pe clear ho jaata hai. Disk cache persistent hai, thoda slower, browser restart survive karta hai. Developer ka in dono pe **direct control nahi** hota — sirf `Cache-Control` headers se influence kar sakta hai (kitni der cache rahe), lekin ye decide karna ki memory ya disk mein rakhna hai, ye purely browser ka internal heuristic hai (resource size, reuse pattern ke basis pe).

**4. Service Worker caching browser HTTP cache se fundamentally kaise alag hai?**

Browser HTTP cache heuristic-based hai — browser decide karta hai based on headers, developer sirf hints deta hai. Service Worker mein developer **full programmatic control** rakhta hai — JS code se har network request intercept hoti hai (`fetch` event), aur exact decide kiya jaata hai cache se serve karna hai ya network se, kis strategy (cache-first/network-first/stale-while-revalidate) ke saath. Ye offline-capable PWAs ka foundation hai kyunki bina network ke bhi pre-cached content serve ho sakta hai.

**5. Cache-aside pattern kya hai, aur write-through se ye kaise alag hai?**

Cache-aside (lazy loading): application pehle cache check karta hai, miss hone pe DB query karta hai aur result ko cache mein daal deta hai — cache sirf "demand pe" populate hota hai. Write-through: jab data write hota hai, cache aur DB dono simultaneously update hote hain — reads ke liye cache kabhi stale nahi hota, lekin writes thodi slower hoti hain (dono jagah likhna padta hai) aur unused data bhi cache mein aa sakta hai. Cache-aside zyada common hai general read-heavy use cases mein.

**6. Cache invalidation ka "explicit invalidation missed" bug kya hai, aur ye production mein kyun itna common hai?**

Explicit invalidation mein, jab bhi data write hota hai, application code ko manually cache entry delete/update karna padta hai. Problem ye hai ki agar future mein koi doosra write-path add ho (naya API endpoint, admin script, bulk update) jo same underlying data ko modify karta hai, aur us naye path mein invalidation call add karna bhool jaaye — cache silently stale ho jaata hai. Ye symptom-wise bahut misleading hota hai ("kabhi kabhi purana data dikhta hai") aur production mein hafton tak unnoticed reh sakta hai. Isliye TTL ko ek safety-net ke roop mein bhi rakha jaata hai, sirf explicit invalidation pe depend nahi karte.

**7. `stale-while-revalidate` kaise kaam karta hai, aur ye user experience ko kaise improve karta hai?**

Jab cached response stale ho chuka ho, server/CDN turant purana (stale) response serve kar deta hai — user ko wait nahi karna padta. Simultaneously, background mein ek fresh request bheji jaati hai jo cache ko update kar deti hai next request ke liye. Isse perceived latency zero rehta hai (kabhi bhi user ko loading spinner nahi dikhta cache-hit ke liye), sirf trade-off ye hai ki kabhi kabhi ek request thoda stale data dekh sakta hai — jo zyada tar use cases mein acceptable hai.

**8. HTTP caching aur application-level data caching (React Query/SWR) genuinely alag kyun hain? Ye ek doosre ko replace kyun nahi karte?**

HTTP caching protocol-level hai — raw response bytes/headers ko cache karta hai, browser/CDN infrastructure control karti hai, URL-keyed hai. Application data caching framework-level hai — already-parsed JS objects ko in-memory rakhta hai, application code control karta hai (query keys, staleTime), aur component-tree ke concerns (re-renders, loading states) solve karta hai. Dono independently kaam karte hain — ek `fetch` call HTTP cache se serve ho sakti hai agar network layer tak jaaye, aur React Query us `fetch` call ko poori tarah skip bhi kar sakta hai agar apna internal cache already valid hai. Dono layers coexist karti hain, replace nahi karti ek doosre ko.

**9. Cache busting ke liye content-hashed filenames (`app.[hash].js`) approach kyun standard hai, aggressive `max-age` caching ke saath?**

Content hash filename mein embed hone se guarantee milti hai ki content change = naya URL, content same = same URL. Isse tum asset files ko bina risk ke bahut aggressively cache kar sakte ho (`max-age=31536000, immutable`) — kyunki naye deploy pe naya URL banega, purana cached URL kabhi accidentally stale content nahi serve karega. Entry HTML file ko khud short/no-cache rakhte hain taaki wo naye hashed URLs ko reference kare har deploy ke baad.

**10. Cache stampede (thundering herd) kya hota hai, aur isse kaise prevent karte hain?**

Jab ek popular cached item expire hota hai aur us exact moment simultaneously bahut saari requests aati hain, sab ek saath cache-miss dekhti hain aur sab origin/DB ko ek saath hit karti hain — jo database ko overload kar sakta hai. Prevention strategies: jittered TTLs (expiry times randomize karo taaki sab ek saath expire na hon), single-flight/lock pattern (pehla request DB query kare, baaki wait karke uska result reuse karein instead of independently query karne ke), aur stale-while-revalidate (purana data turant serve karo, background mein sirf ek refresh trigger karo instead of sabko blocking karna).

**11. `Vary` header kya karta hai, aur galat `Vary` configuration se kya production incident ho sakta hai?**

`Vary` header cache ko batata hai ki same URL ke liye multiple cached versions rakhne hain, based on specific request headers (jaise `Accept-Language`, `Accept-Encoding`, ya `Cookie`). Agar server response ko request-specific banata hai (jaise cookie ke basis pe personalize karta hai) lekin `Vary: Cookie` set nahi karta, aur response `public` bhi cacheable hai, toh ek shared cache (CDN/proxy) sabke liye same cached version serve karega — matlab User A ka personalized response (jo cookie A ke basis pe bana tha) User B ko bhi mil sakta hai. Ye exactly wahi data-leak scenario hai jo section 9 ke pehle gotcha mein discuss hua — `Vary` header ka missing hona iska ek common root cause hai.

**12. Service worker ke `install` aur `activate` events mein kya difference hai, aur deploy ke waqt purane cached assets kaise cleanup hote hain?**

`install` event tab fire hota hai jab browser ek naya (ya updated) service worker file detect karta hai — is event mein typically critical static assets pre-cache kiye jaate hain (`cache.addAll(...)`). `activate` event uske baad fire hota hai jab naya service worker purane ko replace karke control lene ke liye ready hota hai — yehi sahi jagah hai purane cache-storage versions ko cleanup karne ki (`caches.keys()` se saare cache names list karo, jo current version se match nahi karte unhe `caches.delete()` se hata do). Ye pattern versioned cache names (`static-assets-v1`, `static-assets-v2`) ke saath combine hota hai — naya deploy naya version number leke aata hai, `activate` event purane version ka cache poori tarah clean kar deta hai, taaki stale assets kabhi serve na hon.
