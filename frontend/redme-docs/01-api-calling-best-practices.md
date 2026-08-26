# API Calling Best Practices — Senior Frontend Ke Liye

Ye chapter frontend engineering ka wo hissa hai jo har senior dev ke daily code review mein sabse zyada baar aata hai — API calls. Har junior fetch/axios call likh leta hai, lekin real difference dikhta hai jab network flaky ho, user tab close kar de, ya same request 3 baar race karke aaye. Yahan hum REST conventions se shuru karke error handling, retries, cancellation, debounce/throttle, idempotency, pagination, auth token refresh, aur optimistic updates — sab production-grade depth se cover karenge, real TypeScript code ke saath jisme har line commented hai.

## Table of Contents

1. [REST API Conventions](#rest-api-conventions)
2. [Error Handling Patterns](#error-handling-patterns)
3. [Retries with Exponential Backoff](#retries-with-exponential-backoff)
4. [Request Cancellation](#request-cancellation)
5. [Debouncing vs Throttling](#debouncing-vs-throttling)
6. [Idempotency](#idempotency)
7. [Pagination Patterns](#pagination-patterns)
8. [Auth Token Injection & Refresh](#auth-token-injection--refresh)
9. [Optimistic Updates](#optimistic-updates)
10. [Real-World Gotchas](#real-world-gotchas)
11. [Key Takeaways](#key-takeaways)
12. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## REST API Conventions

REST ka core idea simple hai — har URL ek **resource** ko represent karta hai (jaise `/users`, `/orders/42`), aur HTTP verb batata hai us resource pe kya operation karna hai. Jo log verbs ko galat use karte hain (jaise GET se data mutate karna, ya sab kuch POST se karna), unki API "RESTful" nahi hoti, sirf HTTP pe chalne wala RPC hoti hai — aur ye maintainability, caching, aur tooling (browser prefetch, HTTP caching layers) sab break kar deta hai.

### HTTP Verbs — semantics jo matter karti hai

| Verb | Semantics | Idempotent? | Safe (no side-effect)? |
|---|---|---|---|
| `GET` | Resource read karo | Haan | Haan |
| `POST` | Naya resource create karo (ya non-idempotent action trigger karo) | Nahi | Nahi |
| `PUT` | Poora resource replace karo | Haan | Nahi |
| `PATCH` | Resource ka partial update karo | Depends (usually treat as non-idempotent unless designed carefully) | Nahi |
| `DELETE` | Resource delete karo | Haan (dobara delete karo, same end-state — "already gone") | Nahi |

"Idempotent" ka matlab — same request ko 1 baar chalao ya 10 baar, server ka final state same rehna chahiye. Ye retries (section 3) ke liye critical hai — agar tumhara verb idempotent hai, retry safely kar sakte ho; agar nahi, careful rehna padega (idempotency keys, section 6).

### Resource-based URL naming

```typescript
// GOOD — nouns, plural resources, hierarchy clear hai
GET    /users              // sabhi users ki list
GET    /users/42           // specific user (id=42)
POST   /users              // naya user create
PATCH  /users/42           // user 42 ka partial update
DELETE /users/42           // user 42 delete

GET    /users/42/orders    // user 42 ke saare orders (nested resource)

// BAD — verbs URL mein, RPC-style, RESTful nahi
POST   /getUser?id=42      // GET hona chahiye tha, verb URL mein bhi hai
POST   /deleteUser         // DELETE hona chahiye, id kahan hai pata nahi
POST   /updateUserStatus   // PATCH /users/42 { status } hona chahiye
```

### Status codes — matlab samajhna zaroori hai

- **2xx (Success)**: `200 OK` (generic success, body hai), `201 Created` (naya resource bana, `Location` header mein URL milta hai), `204 No Content` (success, body khali — jaise DELETE ke baad).
- **3xx (Redirection)**: `301`/`302` resource move ho gaya, `304 Not Modified` caching ke liye (client ka cached version abhi bhi valid hai).
- **4xx (Client Error)**: `400 Bad Request` (malformed request), `401 Unauthorized` (auth missing/invalid — actually "unauthenticated" hona chahiye tha naam se, historical naming issue hai), `403 Forbidden` (authenticated ho lekin permission nahi), `404 Not Found`, `409 Conflict` (jaise duplicate email pe signup), `422 Unprocessable Entity` (validation failed), `429 Too Many Requests` (rate limited).
- **5xx (Server Error)**: `500 Internal Server Error` (generic server crash), `502 Bad Gateway`, `503 Service Unavailable` (temporarily down, retry-able), `504 Gateway Timeout`.

### Anti-pattern: 200 OK ke saath error body

Ye ek bahut common mistake hai jo bahut real backends mein dikhti hai:

```typescript
// ANTI-PATTERN — backend ye response bhejta hai, HTTP status 200 hai
// {
//   "success": false,          // actual success/failure yahan chhupi hai
//   "error": "User not found", // body ke andar hai, status code mein nahi
//   "data": null
// }

// Client ko is design ke saath manually check karna padega
const res = await fetch("/api/users/999"); // network layer isse "success" treat karega, status 200 hai
const body = await res.json(); // body parse karo
if (!body.success) { // ab manually success field check karna padega
  throw new Error(body.error); // yahan khud throw karna pad raha hai, fetch ne nahi kiya
}
```

Ye anti-pattern kyun problematic hai:

- **HTTP infra bypass ho jaati hai** — CDN caching, monitoring/alerting tools (jo status codes pe based hote hain), browser devtools network tab filters — sab galat signal dekhte hain ki request "successful" thi.
- **Client code inconsistent ho jaata hai** — har response ko `response.ok` se check karne ke bajaye, ab har response ke andar bhi `success`/`error` field check karna padta hai. Do jagah error-checking logic likhna padta hai.
- **Correct approach**: status code ko truthfully set karo (`404` for not found, `422` for validation error, `500` for server crash), aur body mein sirf **details/context** do, status ka duplicate signal nahi.

```typescript
// CORRECT — status code khud truth bolta hai
// HTTP 404 Not Found
// { "error": "User with id 999 not found" }  <- ye sirf detail hai, primary signal status code hai
```

---

## Error Handling Patterns

Ye sabse underrated concept hai jo mostly juniors galat samajhte hain: **`fetch` network errors pe throw karta hai, lekin HTTP error responses (4xx/5xx) pe throw NAHI karta.** `response.ok` explicitly check karna tumhari responsibility hai.

```typescript
// try/catch sirf NETWORK-level errors (DNS fail, connection refused, timeout, CORS block) catch karega
try {
  // ye call agar server 404 ya 500 bhi return kare, throw NAHI karega — fetch resolve ho jaayega normally
  const response = await fetch("https://api.example.com/users/999"); // request bheji

  // isliye status manually check karna zaroori hai — ye HTTP-error-level check hai
  if (!response.ok) {
    // response.ok = status >= 200 && status < 300, iske bahar sab "not ok" hai
    throw new Error(`HTTP error: ${response.status}`); // yahan hum khud throw kar rahe hain taaki catch block isse pick kare
  }

  const data = await response.json(); // sirf ab safe hai JSON parse karna, response successful hai
  console.log(data); // parsed data use karo
} catch (err) {
  // yahan dono types aa sakte hain: network-level throw, ya humara khud ka manual throw upar se
  console.error("Request failed:", err); // dono cases ko yahan log kar rahe hain, differentiate karna hoga (neeche dekho)
}
```

### Reusable `apiClient` wrapper

Real projects mein har jagah `if (!response.ok) throw ...` likhna repetitive hai — isliye ek central wrapper banate hain jo error classification bhi karta hai:

```typescript
// custom error class banaya taaki hum HTTP-specific info (status, body) carry kar sakein
class ApiError extends Error {
  status: number; // HTTP status code store karne ke liye field
  body: unknown; // server ne jo error body bheja, wo bhi store karte hain debugging ke liye
  isRetryable: boolean; // classification flag — kya isse retry karna sensible hai

  constructor(message: string, status: number, body: unknown) {
    super(message); // parent Error class ka constructor call kiya, message set karne ke liye
    this.name = "ApiError"; // error ka naam override kiya, stack traces mein "ApiError" dikhega
    this.status = status; // status assign kiya instance pe
    this.body = body; // body assign kiya instance pe
    // 408 (timeout), 429 (rate limit), aur sabhi 5xx errors generally retryable hote hain
    this.isRetryable = status === 408 || status === 429 || status >= 500; // classification logic yahan encapsulated hai
  }
}

// network-level failure ke liye alag class — isse HTTP error se differentiate kar sakte hain
class NetworkError extends Error {
  constructor(message: string) {
    super(message); // parent constructor call
    this.name = "NetworkError"; // stack trace mein clear naam
  }
}

// central wrapper function — saari API calls isse guzarengi
async function apiClient<T>(
  url: string, // request ka URL
  options: RequestInit = {} // fetch options, default empty object
): Promise<T> {
  let response: Response; // response variable pehle declare kiya, try/catch dono mein use hoga

  try {
    response = await fetch(url, options); // actual network call yahan ho rahi hai
  } catch (err) {
    // ye catch block sirf tab chalega jab fetch khud throw kare — matlab TRUE network failure
    throw new NetworkError(
      `Network request failed: ${err instanceof Error ? err.message : "unknown"}` // original error message wrap kiya
    ); // apna typed NetworkError throw kiya, generic Error nahi
  }

  if (!response.ok) {
    // yahan hum HTTP-level error handle kar rahe hain, ye network error se alag category hai
    let body: unknown; // error body store karne ke liye
    try {
      body = await response.json(); // server ka error body parse karne ki koshish
    } catch {
      body = null; // agar body JSON nahi hai (ya empty), null fallback
    }
    // typed ApiError throw kiya jisme status aur body dono carry ho rahe hain
    throw new ApiError(`Request failed with status ${response.status}`, response.status, body);
  }

  return response.json() as Promise<T>; // success case — JSON parse karke generic type T mein return kiya
}
```

### Error classification — retryable vs non-retryable

```typescript
// caller side pe ab hum classification ke basis pe decide kar sakte hain
try {
  const user = await apiClient<{ id: string; name: string }>("/api/users/42"); // typed API call
  console.log(user.name); // safe access, TypeScript ko pata hai shape kya hai
} catch (err) {
  if (err instanceof NetworkError) {
    // network down hai — user ko "check your internet" dikhana sensible hai
    showToast("Network issue — please check your connection"); // user-facing generic message
  } else if (err instanceof ApiError) {
    if (err.isRetryable) {
      // 5xx/429/408 — temporary issue, retry logic trigger kar sakte hain (section 3 dekho)
      scheduleRetry(); // retry wrapper ko call kiya
    } else if (err.status === 401) {
      // authentication expired/invalid — refresh flow trigger karo (section 8)
      redirectToLogin(); // ya token refresh attempt karo
    } else if (err.status === 404) {
      // resource hi exist nahi karta — retry karne ka koi fayda nahi
      showToast("User not found"); // specific, actionable message
    } else {
      // 400/422 jaisi validation errors — client ki galti hai, retry se kuch nahi badlega
      showToast(`Request invalid: ${err.message}`); // generic fallback message
    }
  }
}

// helper stubs — real app mein inki actual implementation hogi
function showToast(msg: string) {} // UI toast dikhane ka placeholder
function scheduleRetry() {} // retry logic trigger karne ka placeholder
function redirectToLogin() {} // navigation logic ka placeholder
```

---

## Retries with Exponential Backoff

Naive retry — matlab fail hote hi **immediately** dobara try karna — production mein khatarnak hai. Socho: server already overloaded hai (503 return kar raha hai), aur tumhare 10,000 clients sab ek saath immediately retry kar rahe hain — ye **thundering herd** problem create karta hai jo server ko aur zyada overload karta hai, outage ko recovery se rok deta hai.

**Exponential backoff** ka idea: har retry ke beech wait time exponentially badhao (1s, 2s, 4s, 8s...), taaki server ko recover hone ka time mile. **Jitter** (random variation add karna) isliye zaroori hai taaki saare clients ka retry timing thoda alag-alag ho jaaye — synchronized retries khud ek mini thundering herd ban jaate hain.

```typescript
// backoff delay calculate karne ka helper — exponential + jitter
function getBackoffDelay(attempt: number, baseMs = 500, maxMs = 30000): number {
  // exponential growth: attempt 0 -> base, attempt 1 -> base*2, attempt 2 -> base*4, ...
  const exponential = Math.min(baseMs * 2 ** attempt, maxMs); // maxMs se cap kiya taaki wait infinite na ho jaaye
  // jitter — 0 se exponential value ke beech random value, isse clients desynchronize ho jaate hain
  const jitter = Math.random() * exponential; // "full jitter" strategy — AWS ki recommended approach
  return jitter; // final delay return kiya, milliseconds mein
}

// sleep helper — Promise-based delay
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms)); // setTimeout ko Promise mein wrap kiya, await-able bana diya
}

// retry wrapper — kisi bhi async function ko retry logic ke saath wrap karta hai
async function withRetry<T>(
  fn: () => Promise<T>, // actual operation jo retry karni hai (jaise apiClient call)
  options: { maxAttempts?: number; isRetryable?: (err: unknown) => boolean } = {} // config, defaults neeche
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4; // default 4 attempts (1 original + 3 retries)
  // default classification — sirf ApiError.isRetryable ya NetworkError ko retry karo
  const isRetryable =
    options.isRetryable ??
    ((err: unknown) =>
      err instanceof NetworkError || (err instanceof ApiError && err.isRetryable)); // default logic

  let lastError: unknown; // last error track karne ke liye, sab attempts fail hone pe throw karenge

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // attempt counter 0 se maxAttempts-1 tak loop
    try {
      return await fn(); // actual operation try kiya, success hone pe seedha return
    } catch (err) {
      lastError = err; // error ko store kiya, agle iteration ya final throw ke liye

      const isLastAttempt = attempt === maxAttempts - 1; // check kiya ki ye last attempt tha ya nahi
      if (isLastAttempt || !isRetryable(err)) {
        // agar last attempt tha, ya error retryable nahi hai (jaise 404/validation error), retry mat karo
        throw err; // seedha propagate kar do, loop se bahar nikal jaao
      }

      const delay = getBackoffDelay(attempt); // is attempt number ke liye backoff delay calculate kiya
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`); // debug visibility ke liye log
      await sleep(delay); // calculated delay tak wait kiya before next attempt
    }
  }

  throw lastError; // theoretically yahan kabhi nahi pahunchega (loop ke andar hi throw ho jaata hai), TS ko satisfy karne ke liye
}
```

Usage:

```typescript
// apiClient call ko retry wrapper mein lapet diya
const user = await withRetry(
  () => apiClient<{ id: string }>("/api/users/42"), // actual fetch operation, function ke roop mein pass kiya (lazy execution)
  { maxAttempts: 3 } // sirf 3 attempts allow kiye is specific call ke liye
);
```

**Senior note**: POST requests ko retry karte waqt idempotency keys (section 6) ka use zaroor karo — warna retry ek duplicate side-effect (jaise double payment) create kar sakta hai.

---

## Request Cancellation

Do common real-world scenarios jahan cancellation zaroori hai:

1. **User navigate away kar gaya** (component unmount ho gaya) — response aane pe usse handle karna ya toh crash karega (unmounted component pe `setState`), ya wasted memory/bandwidth hai.
2. **Search-as-you-type race condition** — user "r", "re", "rea", "reac" type karta hai, 4 requests fire hoti hain. Agar "r" ki request "reac" ki request se **baad** resolve hoti hai (network timing unpredictable hai), toh purani, stale result final UI mein dikh jaayega — ye ek classic race condition bug hai.

`AbortController` in dono problems ko solve karta hai — ye fetch ko explicitly cancel karne ka native browser API hai.

```typescript
// AbortController — ek controller banate hain jiske paas ek "signal" hota hai
function fetchWithAbort(url: string, signal: AbortSignal) {
  // fetch ka second argument mein signal pass kiya — jab signal.abort() call hoga, fetch reject ho jaayega
  return fetch(url, { signal }); // signal fetch ko is request se "linked" kar deta hai
}
```

### Full example — search-as-you-type

```typescript
import { useEffect, useRef, useState } from "react"; // React hooks import kiye

function SearchBox() {
  const [query, setQuery] = useState(""); // current search text state mein
  const [results, setResults] = useState<string[]>([]); // search results state mein
  const abortControllerRef = useRef<AbortController | null>(null); // pichhle request ka controller track karne ke liye ref (re-render pe persist rehta hai)

  useEffect(() => {
    if (query === "") {
      // empty query pe results clear kar do, API call ki zaroorat nahi
      setResults([]); // results reset kiya
      return; // effect se yahin exit
    }

    // agar pichhla request abhi bhi pending hai, usse cancel kar do — naya query aa gaya hai
    abortControllerRef.current?.abort(); // optional chaining kyunki pehli baar ref null hoga

    const controller = new AbortController(); // is specific request ke liye naya controller banaya
    abortControllerRef.current = controller; // ref mein store kiya taaki agla effect run isse abort kar sake

    async function runSearch() {
      try {
        // API call, controller.signal pass kiya taaki ye cancellable ho
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal, // is exact request ko is exact controller se link kiya
        });
        if (!response.ok) throw new Error(`Search failed: ${response.status}`); // HTTP error check
        const data: string[] = await response.json(); // response parse kiya
        setResults(data); // sirf yahan tak pahunche toh ye latest/valid request hai, UI update karo
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // ye "error" actually hamara khud ka intentional cancellation hai, real error nahi
          return; // silently ignore karo — koi toast/log nahi chahiye, ye expected behavior hai
        }
        console.error("Search error:", err); // sirf genuine errors log karo
      }
    }

    runSearch(); // async function ko fire-and-track kiya (React effect sync hona chahiye, isliye andar async function)

    // cleanup function — jab query change ho ya component unmount ho, ye chalega
    return () => {
      controller.abort(); // is effect run ka request cancel kar do, agla effect apna naya controller banayega
    };
  }, [query]); // query change hote hi effect re-run hoga, purana cleanup pehle chalega

  return (
    <input
      value={query} // controlled input, state se value aa rahi hai
      onChange={(e) => setQuery(e.target.value)} // typing pe state update, isse effect trigger hoga
      placeholder="Search..." // placeholder text
    />
  );
}

export default SearchBox; // component export kiya
```

**Key insight**: `useEffect` ka cleanup function yahan double duty kar raha hai — dono "component unmount" aur "dependency change" (naya query type hua) cases handle karta hai. React automatically cleanup ko naye effect run se **pehle** call karta hai, isliye purana request hamesha cancel ho jaata hai naya fire hone se pehle.

---

## Debouncing vs Throttling

Ye do techniques bahar se similar lagti hain (dono "kam calls karo" ka goal rakhti hain) lekin conceptually opposite hain:

- **Debounce**: Wait for a **pause**. Har naye event pe timer reset ho jaata hai — function sirf tab chalega jab events aana **band** ho jaayein aur ek fixed gap guzar jaaye. Search-as-you-type ke liye ideal — user jab tak type kar raha hai, wait karo; jab pause aaye (user ne ruk ke sochna shuru kiya), tab API call karo.
- **Throttle**: Rate **limit** karo. Function har `N` milliseconds mein **max ek baar** chalega, chahe events kitni bhi frequently aa rahe hoon. Scroll events, resize events, ya "save draft every 5 seconds while typing" jaise continuous-action scenarios ke liye ideal.

```typescript
// DEBOUNCE implementation — generic utility
function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void, // wrap karne wala function
  delayMs: number // kitna pause chahiye before firing
): (...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null; // pending timer ka reference, closure mein persist

  return (...args: Args) => {
    // returned function wahi signature rakhta hai jo original fn ka hai
    if (timeoutId !== null) {
      // agar pehle se ek timer pending hai (matlab naya event aaya hai pause se pehle)
      clearTimeout(timeoutId); // purana timer cancel kiya — ye hi debounce ka core behavior hai
    }
    timeoutId = setTimeout(() => {
      // naya timer schedule kiya
      fn(...args); // delay complete hone pe actual function call, latest args ke saath
      timeoutId = null; // reset, taaki agla call fresh timer bana sake
    }, delayMs); // delayMs milliseconds ka wait
  };
}

// THROTTLE implementation — generic utility
function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void, // wrap karne wala function
  intervalMs: number // minimum gap jo do calls ke beech honi chahiye
): (...args: Args) => void {
  let lastCallTime = 0; // last successful call ka timestamp, initially 0 (kabhi call nahi hua)

  return (...args: Args) => {
    const now = Date.now(); // current timestamp liya
    if (now - lastCallTime >= intervalMs) {
      // agar last call se interval guzar gaya hai, tabhi naya call allow karo
      lastCallTime = now; // timestamp update kiya
      fn(...args); // function call kiya
    }
    // agar interval nahi guzra, silently ignore — ye call "dropped" ho gayi
  };
}
```

### Debounced search input — usage example

```typescript
import { useMemo, useState } from "react"; // hooks import kiye

function DebouncedSearch() {
  const [results, setResults] = useState<string[]>([]); // search results

  // debounce function ko useMemo mein wrap kiya — warna har render pe naya debounced fn banega, timer reset hota rahega
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        // actual API call, ye sirf pause ke baad chalega
        fetch(`/api/search?q=${encodeURIComponent(query)}`)
          .then((res) => res.json()) // response parse kiya
          .then((data) => setResults(data)); // results state mein daala
      }, 400), // 400ms pause chahiye typing rukne ke baad
    [] // empty deps — ek hi debounced function poori component lifetime mein reuse hoga
  );

  return (
    <input
      onChange={(e) => debouncedSearch(e.target.value)} // har keystroke pe debounced function call, lekin actual fetch delay hoga
      placeholder="Search (debounced)..." // placeholder
    />
  );
}

export default DebouncedSearch; // export kiya
```

**Senior note**: Debounce aur AbortController **complementary** hain, competing nahi — debounce se API calls ki frequency kam karo, aur jo bachi hui calls hain unhe AbortController se race-condition-safe banao. Production search boxes mein aksar dono saath use hote hain.

---

## Idempotency

Idempotency ka matlab: same operation ko multiple baar perform karo, result/end-state same rahe jaise ek baar perform karne se hota. GET/PUT/DELETE naturally idempotent hain apne design se, lekin **POST nahi hai** — aur yehi retry logic (section 3) ke saath problem create karta hai.

Socho scenario: user "Pay ₹500" button dabata hai. Request server tak pahunch jaati hai, payment process ho jaata hai, **lekin response client tak wapas aate-aate network drop ho jaata hai**. Client ko lagta hai request fail hui (timeout), retry logic trigger hoti hai, dobara POST /payments jaata hai — **server ke perspective se ye ek naya, alag payment request hai**, aur customer se **double charge** ho jaata hai.

### Idempotency key pattern — solution

Client ek unique key generate karta hai **har logical operation** ke liye (retries same key reuse karte hain), aur server us key ko dedupe karne ke liye use karta hai:

```typescript
// crypto.randomUUID() browser/Node dono mein available hai (modern versions)
function generateIdempotencyKey(): string {
  return crypto.randomUUID(); // ek globally-unique random ID generate kiya, is operation ke liye
}

async function makePayment(amount: number, idempotencyKey: string) {
  // idempotencyKey caller se pass ho raha hai — retry pe wahi key reuse hogi, naya nahi banega
  const response = await fetch("/api/payments", {
    method: "POST", // payment create karna hai
    headers: {
      "Content-Type": "application/json", // JSON body bhej rahe hain
      "Idempotency-Key": idempotencyKey, // server isse dedupe karega — convention hai (Stripe isi pattern ko follow karta hai)
    },
    body: JSON.stringify({ amount }), // payment amount serialize kiya
  });

  if (!response.ok) throw new Error(`Payment failed: ${response.status}`); // HTTP error check
  return response.json(); // success response return kiya
}

// caller side — key EK baar generate hota hai poore retry-cycle ke liye, andar nahi
async function payWithRetry(amount: number) {
  const idempotencyKey = generateIdempotencyKey(); // key ek baar banayi, retries ke bahar

  // withRetry (section 3) yahan reuse kar rahe hain, lekin har attempt SAME key bhejega
  return withRetry(() => makePayment(amount, idempotencyKey), { maxAttempts: 3 }); // 3 attempts, sab same key ke saath
}
```

**Server-side ka kaam** (frontend responsibility nahi, lekin samajhna zaroori hai): server jab bhi ek `Idempotency-Key` dekhta hai jo usne pehle already process kiya hai, wo **dobara payment nahi karta** — sirf **pehle wala stored response wapas bhej deta hai**. Isse client ko retry karna safe ban jaata hai, chahe underlying operation non-idempotent (payment) hi kyun na ho.

---

## Pagination Patterns

Bade datasets ko ek saath load karna impossible hai — pagination zaroori hai. Do main approaches hain, aur inke trade-offs samajhna senior-level knowledge hai.

### Offset-based pagination

```typescript
// URL pattern: /api/posts?offset=20&limit=10
// simple hai — "20 rows skip karo, agle 10 do"
async function fetchPage(offset: number, limit: number) {
  const res = await fetch(`/api/posts?offset=${offset}&limit=${limit}`); // offset aur limit query params
  return res.json(); // rows ka array return
}
```

**Problem — "page drift"**: Socho user page 2 dekh raha hai (offset=10, limit=10). Isi beech koi naya post insert hota hai sabse top pe (jaise chronological feed mein). Ab jab user page 3 pe jaata hai (offset=20), **database ke rows shift ho gaye hain** — jo row pehle offset 20 pe thi, wo ab offset 21 pe hai naye insert ki wajah se. Result: user ko ek row **duplicate** dikhti hai (jo already page 2 pe dekh chuka tha), ya ek row **skip** ho jaati hai. Isi tarah concurrent deletes se rows skip ho sakte hain. Ye especially real-time feeds (social media, notifications) mein bura problem hai.

### Cursor-based pagination

Cursor-based approach offset ki jagah **last-seen item ka reference** (usually ek unique, sortable field jaise `id` ya `created_at`) use karta hai:

```typescript
// URL pattern: /api/posts?cursor=<last_seen_id>&limit=10
// server logic (conceptually): "WHERE id > cursor ORDER BY id LIMIT 10"

type Post = { id: string; title: string; createdAt: string }; // post shape
type PagedResponse = { items: Post[]; nextCursor: string | null }; // server response shape, nextCursor null = no more pages

async function fetchPageByCursor(cursor: string | null, limit = 10): Promise<PagedResponse> {
  // agar cursor null hai, matlab pehla page chahiye — query param mein include nahi karte
  const url = cursor
    ? `/api/posts?cursor=${encodeURIComponent(cursor)}&limit=${limit}` // subsequent pages
    : `/api/posts?limit=${limit}`; // first page

  const res = await fetch(url); // request bheja
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`); // error check
  return res.json(); // typed response return kiya
}

// client-side infinite-scroll style consumption
async function loadAllPagesExample() {
  let cursor: string | null = null; // shuru mein cursor null — first page
  const allPosts: Post[] = []; // saare posts accumulate karne ke liye

  do {
    const page = await fetchPageByCursor(cursor); // current cursor ke saath page fetch kiya
    allPosts.push(...page.items); // naye items accumulate kiye
    cursor = page.nextCursor; // agle iteration ke liye cursor update kiya, server jo bataye
  } while (cursor !== null); // jab tak server "more pages hain" na bataye (non-null cursor)

  return allPosts; // saare accumulated posts return kiye
}
```

**Trade-offs table**:

| Aspect | Offset-based | Cursor-based |
|---|---|---|
| Implementation | Simple, easy to understand | Thoda zyada setup (stable sort key chahiye) |
| Jump to arbitrary page (jaise "page 47") | Possible (`offset=460`) | **Not possible** — sirf sequential navigation |
| Stability under concurrent writes | **Breaks** — page drift, duplicates/skips | Stable — cursor "last item" ko point karta hai, insert/delete se unaffected |
| Total count / "Page X of Y" UI | Easy (agar `COUNT(*)` bhi query karo) | Harder — total count ke liye separate query chahiye hoti hai |
| Best for | Admin dashboards, static/rarely-changing data | Feeds, chat, infinite scroll, real-time data |

**Senior rule of thumb**: agar data frequently changes aur "jump to page N" ki zaroorat nahi hai (jaise social feed, chat history), cursor-based use karo. Agar users ko specific page number pe jump karna hai (jaise ek admin table), offset-based simpler aur sufficient hai.

---

## Auth Token Injection & Refresh

Har authenticated API call mein manually token attach karna, aur har jagah 401 handle karna — ye repetitive aur error-prone hai. **Interceptor pattern** (ya fetch wrapper) ek central jagah pe ye logic daal deta hai.

```typescript
// in-memory token store — real app mein secure storage (Keychain/EncryptedSharedPreferences ya httpOnly cookie) use karo
let accessToken: string | null = null; // current access token
let refreshTokenValue: string | null = null; // current refresh token

// naya token pair set karne ka helper (login ya refresh ke baad call hota hai)
function setTokens(access: string, refresh: string) {
  accessToken = access; // access token update kiya
  refreshTokenValue = refresh; // refresh token update kiya
}

// refresh token se naya access token maangne wala function
async function refreshAccessToken(): Promise<string> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST", // refresh endpoint POST hota hai typically
    headers: { "Content-Type": "application/json" }, // JSON body
    body: JSON.stringify({ refreshToken: refreshTokenValue }), // current refresh token bheja
  });

  if (!res.ok) {
    // agar refresh bhi fail ho gaya, matlab refresh token bhi expired/invalid hai
    throw new Error("Refresh failed — user must re-login"); // ye caller ko batayega ki login screen dikhana hai
  }

  const data: { accessToken: string; refreshToken: string } = await res.json(); // naye tokens parse kiye
  setTokens(data.accessToken, data.refreshToken); // store update kiya (refresh tokens rotate hote hain, isliye naya bhi save)
  return data.accessToken; // naya access token return kiya
}

// isse concurrent 401s ke waqt multiple simultaneous refresh calls (race condition) rokte hain
let refreshPromise: Promise<string> | null = null; // pending refresh call ka shared promise

function getRefreshPromise(): Promise<string> {
  if (!refreshPromise) {
    // agar koi refresh already chal nahi raha, naya shuru karo
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null; // complete hone (success ya fail) ke baad reset, taaki agli baar naya refresh ho sake
    });
  }
  return refreshPromise; // jo bhi call kare, same in-flight promise milega — sirf ek actual refresh network call hoga
}

// main authenticated fetch wrapper
async function authFetch(url: string, options: RequestInit = {}, isRetry = false): Promise<Response> {
  // isRetry flag infinite retry loop rokta hai (401 ke baad refresh karke ek hi baar retry karo, uske baad nahi)
  const headers = new Headers(options.headers); // existing headers ko Headers object mein wrap kiya
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`); // current access token inject kiya, agar available hai
  }

  const response = await fetch(url, { ...options, headers }); // request fire kiya, merged headers ke saath

  if (response.status === 401 && !isRetry) {
    // token expired/invalid hai, aur ye pehla attempt hai (retry nahi already)
    try {
      await getRefreshPromise(); // naya access token le aao (ya existing in-flight refresh ka wait karo)
    } catch {
      // refresh khud fail ho gaya — user ko logout/login screen bhejna hoga
      throw new Error("Session expired — please log in again"); // caller isse catch karke navigation kar sakta hai
    }
    return authFetch(url, options, true); // naye token ke saath EK baar retry, isRetry=true taaki loop na bane
  }

  return response; // success ya non-401 error response, jaisa bhi hai wahi return
}
```

Usage:

```typescript
// consumer code bilkul normal fetch jaisa lagta hai, saara token/refresh logic hidden hai
async function getProfile() {
  const res = await authFetch("/api/profile"); // authFetch automatically token attach + 401 handle karega
  if (!res.ok) throw new Error(`Failed: ${res.status}`); // normal HTTP error check
  return res.json(); // parsed data return
}
```

**Senior note**: `getRefreshPromise` ka shared-promise pattern critical hai — agar UI mein 5 components simultaneously 401 pate hain (jaise page load pe 5 parallel API calls), bina iske 5 alag refresh requests fire ho jaayengi server ko, jinme se sirf pehli valid hoti (baaki race karke fail ho sakte hain kyunki refresh tokens aksar single-use/rotating hote hain). Shared promise ensure karta hai sirf **ek** refresh call ho, aur sab waiters usi ka result use karein.

---

## Optimistic Updates

Optimistic update ka idea: server response ka wait mat karo — UI **immediately** update kar do jaise operation already succeed ho gaya, aur agar server error de, tab UI ko **rollback** karo. Ye perceived performance ko dramatically better banata hai (jaise Twitter/X ka like button — instantly fill ho jaata hai, network call background mein hoti hai).

```typescript
import { useState } from "react"; // state hook import kiya

type Todo = { id: string; title: string; done: boolean }; // todo item shape

function TodoItem({ todo, onTodoChange }: { todo: Todo; onTodoChange: (t: Todo) => void }) {
  const [isSaving, setIsSaving] = useState(false); // optional loading indicator ke liye (blocking UI nahi, sirf visual hint)

  async function toggleDone() {
    const previousState = todo; // rollback ke liye original state save kar liya, mutation se pehle
    const optimisticState: Todo = { ...todo, done: !todo.done }; // naya state calculate kiya, done flag flip kiya

    onTodoChange(optimisticState); // UI IMMEDIATELY update kar diya — server ka wait nahi kiya
    setIsSaving(true); // optional: background save indicator on

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH", // partial update hai, PATCH sahi verb hai
        headers: { "Content-Type": "application/json" }, // JSON body
        body: JSON.stringify({ done: optimisticState.done }), // naya done value server ko bheja
      });

      if (!res.ok) {
        // server ne reject kiya — rollback zaroori hai
        throw new Error(`Update failed: ${res.status}`); // error throw karke catch block mein jaayenge
      }

      const confirmed: Todo = await res.json(); // server se confirmed/canonical state liya
      onTodoChange(confirmed); // UI ko server ke actual state se sync kiya (edge cases handle karta hai, jaise concurrent edits)
    } catch (err) {
      console.error("Toggle failed, rolling back:", err); // debug log
      onTodoChange(previousState); // ROLLBACK — UI ko wapas original state pe le aaye
      // yahan ek toast/snackbar dikhana bhi common practice hai: "Update failed, reverted"
    } finally {
      setIsSaving(false); // saving indicator off, success ya failure dono cases mein
    }
  }

  return (
    <div style={{ opacity: isSaving ? 0.6 : 1 }}> {/* saving ke waqt thoda faded dikhaya, visual feedback */}
      <input type="checkbox" checked={todo.done} onChange={toggleDone} /> {/* checkbox click pe toggle trigger hota hai */}
      <span>{todo.title}</span> {/* todo ka title dikhaya */}
    </div>
  );
}

export default TodoItem; // component export kiya
```

**Senior considerations**:

- **Rollback strategy** simple case mein "previous value wapas rakh do" hai, lekin complex mutations (jaise list se item remove karna, phir naya add karna in sequence) mein rollback logic tricky ho jaata hai — kabhi kabhi poori list ko re-fetch karna hi safest fallback hota hai.
- **Conflict resolution** — agar server ka confirmed state client ke optimistic guess se **different** ho (jaise koi doosra user ne bhi isi record ko edit kiya), server ka response hamesha "source of truth" maano aur usi se UI sync karo (jaisa upar `onTodoChange(confirmed)` kar raha hai).
- Optimistic updates ko sirf un operations pe use karo jinka failure rate low ho aur jinka UX impact worth karta ho — critical/irreversible actions (jaise payment) ke liye generally optimistic UI avoid karte hain.

---

## Real-World Gotchas

- **`response.ok` check bhoolna** — sabse common silent-failure bug. `fetch("/api/x").then(r => r.json())` bina `r.ok` check kiye likhna matlab 404/500 responses bhi "successfully" JSON parse ho jaayenge (agar server error body bhi JSON return karta hai), aur tumhara code galat data ko valid data samajh ke aage process kar dega — koi crash nahi, koi error log nahi, sirf silently wrong behavior.
- **`AbortError` ko real error treat karna** — jab tum khud `controller.abort()` call karte ho, fetch ek `AbortError` ke saath reject hota hai. Ye **expected, intentional** behavior hai, koi genuine failure nahi — agar tum ise normal catch block mein log/toast kar do, users ko galat error messages dikhenge jab wo sirf search box mein type kar rahe the ya navigate kar gaye the. Hamesha `err.name === "AbortError"` check karke isse alag handle karo (section 4 ka example dekho).
- **Fire-and-forget calls se race conditions** — jab tum `someAsyncCall()` likhte ho bina `await` ke (ya bina result track kiye), aur user turant ek doosra related action trigger kar de, do concurrent requests race karte hain — jo **later resolve** hoti hai wahi final state banati hai, chahe wo chronologically pehle trigger hui ho ya baad mein. Isko fix karne ke liye ya toh AbortController use karo (section 4), ya ek request-id/sequence-number track karo aur sirf **latest** request ka result apply karo, stale results ko discard karo.
- **Component unmount pe requests cancel na karna — memory leaks aur warnings** — agar ek component unmount ho jaata hai jab uska fetch abhi pending hai, aur response aane pe `setState` call hota hai, React warning deta hai ("Cannot update state on unmounted component") kam se kam, aur worst case mein stale closures ki wajah se memory leak. `useEffect` cleanup mein `AbortController.abort()` call karna (section 4) ye dono problems solve karta hai.
- **Retry logic ko non-idempotent operations (POST) pe bina idempotency key ke lagana** — duplicate side-effects (double payment, duplicate order creation) create kar sakta hai. Hamesha idempotency key attach karo POST retries pe (section 6).
- **Debounce delay ko bahut zyada ya bahut kam rakhna** — bahut kam (jaise 50ms) debounce ka fayda hi khatam kar deta hai (still bahut requests), bahut zyada (jaise 2000ms) UX ko sluggish bana deta hai. 300-500ms search-as-you-type ke liye typical sweet spot hai.
- **Token refresh race condition** — multiple simultaneous 401s pe bina shared-promise pattern (section 8) ke, multiple parallel refresh calls fire ho sakti hain, jisse rotating refresh tokens ke saath sab except one fail ho jaate hain — inconsistent, hard-to-debug auth bugs.

---

## Key Takeaways

- REST conventions (correct verbs, correct status codes, resource-based URLs) infra tooling (caching, monitoring) ko sahi kaam karne dete hain — inhe todna sirf "style" issue nahi hai, real functional cost hai.
- `fetch` sirf network-level failures pe throw karta hai — `response.ok` explicitly check karna hamesha tumhari responsibility hai; ise bhoolna silent-failure bugs ka sabse bada source hai.
- Retries ko exponential backoff + jitter ke saath karo, warna outages ke waqt thundering herd create karke situation aur bigaad sakte ho.
- `AbortController` do problems solve karta hai — resource cleanup (unmount) aur race conditions (search-as-you-type) — aur `AbortError` ko normal error se differentiate karna zaroori hai.
- Debounce = wait for pause (search input); throttle = rate limit (scroll/resize) — dono complementary hain AbortController ke saath.
- POST/non-idempotent operations ko safely retry karne ke liye idempotency keys chahiye, warna duplicate side-effects (double charge) ho sakte hain.
- Cursor-based pagination offset-based se zyada stable hai concurrent writes ke against, lekin arbitrary page-jump ki capability kho deta hai.
- Auth interceptor pattern (401 → refresh → retry) ko shared in-flight promise ke saath implement karo, taaki concurrent 401s multiple parallel refresh calls na trigger karein.
- Optimistic updates perceived performance improve karte hain, lekin rollback logic aur server-confirmed-state-as-source-of-truth ka discipline zaroori hai.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. `fetch("/api/x")` ek 404 return karta hai. Kya `try/catch` isse catch karega? Explain.**

Nahi, by default nahi. `fetch` ek **rejected Promise** sirf network-level failures pe deta hai (DNS resolution fail, connection refused, CORS block, request aborted). HTTP error status codes (4xx/5xx) valid, complete HTTP responses hain — `fetch` unhe successfully resolved Promise ke roop mein treat karta hai. Isliye `response.ok` (ya `response.status`) explicitly check karna zaroori hai, aur agar tumhe throw karna hai toh manually `throw new Error(...)` likhna padega jab `!response.ok` ho.

**Q2. Naive immediate retry (bina backoff ke) production mein kyun dangerous hai?**

Agar ek server already degraded/overloaded hai (isliye 503 return kar raha hai) aur saare clients immediately retry karte hain, ye extra load server ko recovery se hi rok deta hai — jise "thundering herd" kehte hain. Exponential backoff har retry ke beech gap badhata hai (server ko breathing room deta hai), aur jitter (random variation) clients ke retries ko desynchronize karta hai taaki wo ek saath wave mein na aayein.

**Q3. Search-as-you-type feature mein race condition kaise hoti hai, aur AbortController usse kaise fix karta hai?**

User "r" type karta hai — request A fires. User jaldi "reac" type karta hai — request B fires. Network timing unpredictable hai, isliye request A (jo pehle bheja gaya) response B se **baad** aa sakta hai. Bina protection ke, jo bhi response last aata hai wahi final UI state banata hai — matlab stale result ("r" ke results) final UI mein dikh sakta hai, chahe user "reac" tak type kar chuka ho. AbortController fix karta hai isse: har naye keystroke pe, purana in-flight request explicitly `.abort()` kar diya jaata hai before naya fire hone se — isliye sirf latest request ever successfully resolve hoti hai.

**Q4. Debounce aur throttle mein practical difference kya hai — ek concrete example do.**

Debounce timer ko har naye event pe **reset** karta hai — function sirf tab chalta hai jab events aana **ruk** jaayein aur ek gap guzre. Search input ideal example hai: user jab tak type kar raha hai, wait karo. Throttle function ko fixed interval mein **max ek baar** chalne deta hai, events kitni bhi frequent hoon. Scroll-position tracking ideal example hai — scroll events per-frame fire hote hain, lekin tumhe sirf har 200ms mein ek baar position check karni hai, continuously nahi.

**Q5. Idempotency key kya problem solve karti hai jo sirf HTTP retry logic solve nahi kar sakti?**

Retry logic ye assume karti hai ki agar request fail ho (ya timeout ho), dobara bhejna safe hai. Ye idempotent operations (GET/PUT/DELETE) ke liye sahi hai, lekin POST jaisi non-idempotent operations ke liye nahi — jaise payment creation. Problem ye hai ki client ko pata nahi chalta ki original request **server tak pahunchi thi ya nahi** — agar request server tak pahunch gayi thi aur sirf response wapas aate waqt drop hua, retry ek **duplicate operation** create karega (double charge). Idempotency key server ko batati hai "ye retry hai, is exact operation ka" — server dedupe kar leta hai aur original ka stored result wapas bhej deta hai, dobara process nahi karta.

**Q6. Offset-based pagination mein "page drift" bug kaise hota hai? Real scenario do.**

Socho ek chronological feed hai, user page 2 dekh raha hai (`offset=10, limit=10`). Isi beech koi naya post top pe insert hota hai. Ab jab user page 3 pe click karta hai (`offset=20`), database ke rows ek position shift ho gaye hain naye insert ki wajah se — jo item pehle position 20 pe thi (jo page 3 pe dikhni chahiye thi), wo ab position 21 pe hai. Result: ek item jo already page 2 pe dekhi thi, wo dobara page 3 pe dikh jaati hai (duplicate), ya koi item completely skip ho jaati hai. Cursor-based pagination isse avoid karta hai kyunki wo "last-seen item ke baad ke items" query karta hai, absolute position pe depend nahi karta.

**Q7. Multiple components simultaneously 401 receive karte hain aur sab independently token refresh trigger karte hain — kya problem hoti hai, aur kaise fix karo?**

Agar 5 API calls parallel mein 401 receive karte hain, aur har ek independently `refreshAccessToken()` call kare, 5 alag refresh requests server ko jaati hain. Agar refresh tokens **rotating** hain (jo security best practice hai — har refresh ek naya refresh token deta hai, purana invalidate ho jaata hai), toh sirf pehla refresh call succeed hoga; baaki 4 ek already-invalidated refresh token use karne ki koshish karenge aur fail ho jaayenge — jisse unrelated, confusing auth failures dikhte hain. Fix: ek **shared in-flight promise** pattern use karo — jab refresh already chal raha ho, naye callers ko naya refresh call trigger karne ke bajaye existing pending promise ka result do.

**Q8. Optimistic update ke baad server ka response, client ke optimistic guess se different aata hai — kya karna chahiye?**

Server ka confirmed response ko hamesha **source of truth** treat karo aur UI ko usi se sync karo — optimistic guess ko permanently mat rakho. Ye important hai kyunki server-side concurrent modifications (jaise doosra user ne bhi same record edit kiya), server-side computed fields (jaise `updatedAt` timestamp), ya validation/normalization (server ne input ko thoda modify kiya) ho sakte hain jo client accurately predict nahi kar sakta. Optimistic update sirf **perceived latency** kam karne ke liye hai, final truth ka source nahi hai.

**Q9. Debugging scenario: production mein users complain kar rahe hain ki search results kabhi kabhi "wrong"/stale dikhte hain, especially slow network pe. Root cause kya check karoge?**

Pehla suspect: race condition from unawaited/unabored concurrent requests — check karo ki search input debounced hai ya nahi, aur zyada importantly, check karo ki purane in-flight requests explicitly cancel (AbortController) ho rahe hain jab naya query type hota hai. Agar dono missing hain, slow network pe ye exactly ho sakta hai — purani request jo pehle bheji gayi thi, naye/latest query ki request se **baad** resolve ho sakti hai (server-side processing time variance ki wajah se), aur agar code sirf "jo bhi response aakhri aaye wahi set karo" karta hai (bina sequence-tracking ke), stale results overwrite kar dete hain fresh results ko.

**Q10. `PATCH` aur `PUT` mein difference kya hai, aur idempotency angle se dono kaise compare karte hain?**

`PUT` **poore resource ko replace** karta hai — tumhe complete representation bhejna hota hai, aur missing fields typically null/default ho jaate hain. Ye idempotent hai — same complete payload N baar bhejo, end state same rahega. `PATCH` sirf **specified fields** ko update karta hai, baaki untouched rehte hain. `PATCH` ki idempotency depends karti hai operation ki nature pe — agar tum `{ status: "completed" }` PATCH karte ho, wo idempotent hai (dobara bhejo, same result). Lekin agar tum `{ views: current + 1 }` jaisa relative/incremental update karte ho, wo **non-idempotent** hai — har retry ek extra increment add karega. Isliye PATCH endpoints design karte waqt explicitly socho ki tumhara semantic absolute-value-set hai ya relative-increment — dono ka retry-safety alag hai.
