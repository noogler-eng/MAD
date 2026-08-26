# Browser Storage & Web APIs — Senior Frontend Ke Liye

Frontend engineering sirf React components render karne tak limited nahi hai — real apps ko data persist karna hota hai (offline bhi), heavy computation chalani hoti hai bina UI freeze kiye, real-time connections maintain karni hoti hain, aur browser ke native capabilities (clipboard, location, notifications) use karni hoti hain. Ye chapter un sab browser-native APIs ko cover karta hai jo har senior frontend interview mein pucha jaata hai lekin jinhe log sirf surface-level jaante hain. `07-caching.md` mein Service Worker caching strategies (cache-first/network-first/stale-while-revalidate) already deep detail mein cover ho chuki hain — is chapter mein hum Service Worker ko ek alag angle se dekhenge: PWA installability, background sync, aur web push notifications. `12-security.md` ke saath bhi cross-reference hai jab hum token storage ki security implications discuss karenge.

## Table of Contents

1. [localStorage vs sessionStorage vs Cookies vs IndexedDB — Full Comparison](#localstorage-vs-sessionstorage-vs-cookies-vs-indexeddb--full-comparison)
2. [IndexedDB — When localStorage Isn't Enough](#indexeddb--when-localstorage-isnt-enough)
3. [Web Workers — True Multi-threading in the Browser](#web-workers--true-multi-threading-in-the-browser)
4. [WebSockets — Real Bidirectional Communication](#websockets--real-bidirectional-communication)
5. [Service Workers — The PWA Foundation (Beyond Caching)](#service-workers--the-pwa-foundation-beyond-caching)
6. [The `Intl` API — Native Internationalization](#the-intl-api--native-internationalization)
7. [Geolocation, Clipboard, and Other Common Web APIs (Brief Survey)](#geolocation-clipboard-and-other-common-web-apis-brief-survey)
8. [Real-World Gotchas](#real-world-gotchas)
9. [Key Takeaways](#key-takeaways)
10. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## localStorage vs sessionStorage vs Cookies vs IndexedDB — Full Comparison

Ye four storage mechanisms har web app mein use hote hain, aur inke beech confusion bahut common hai — especially "kaunsa kab use karo" ka decision. Har ek ka apna distinct use case hai based on capacity, persistence, aur most importantly — **kya wo automatically server ko bhejta hai ya nahi**.

| Aspect | `localStorage` | `sessionStorage` | Cookies | IndexedDB |
|---|---|---|---|---|
| **Capacity** | ~5-10MB (browser-dependent) | ~5-10MB | ~4KB per cookie | Bahut zyada — effectively disk-limited (sau MB se GBs tak) |
| **Persistence** | Browser restart survive karta hai, explicitly clear na ho tab tak | Sirf current tab ke liye — tab close hone pe clear ho jaata hai | Explicit expiry date hoti hai (ya session cookie, browser close pe gone) | Persists jaise localStorage — browser restart survive karta hai |
| **Sent to server automatically?** | **Kabhi nahi** | **Kabhi nahi** | **Haan — har HTTP request mein automatically attach hota hai** us domain ke liye | **Kabhi nahi** |
| **API style** | Synchronous | Synchronous | Synchronous (`document.cookie`, string-parsing based) | **Asynchronous** (Promise/event-based) |
| **Structured data** | Sirf strings (objects ko manually `JSON.stringify`/`parse` karna padta hai) | Sirf strings, same limitation | Sirf strings | Structured data (objects, arrays, Blobs, files) — koi manual serialization ki zaroorat nahi |
| **Scope** | Origin-wide, saare tabs/windows share karte hain | Sirf ek tab/window (naya tab = naya empty sessionStorage) | Domain + path scoped, `Secure`/`SameSite` flags se control | Origin-wide database, indexes/transactions ke saath |

### Sabse critical distinction — automatic server transmission

Yehi ek property hai jo cookies ko fundamentally alag banati hai teeno se: **cookies har matching request ke saath automatically browser attach kar deta hai** — tumhe explicitly kuch bhejna nahi padta, `Set-Cookie` header ek baar set ho jaaye, uske baad har request (same-origin, aur cross-origin bhi agar `SameSite` allow kare) us cookie ko carry karta hai. `localStorage`, `sessionStorage`, aur IndexedDB mein se koi bhi kabhi automatically network request mein nahi jaata — tumhe explicitly JS code likhna padega unka data fetch karke request body/header mein include karne ke liye.

Yehi exact wajah hai ki cookies **CSRF (Cross-Site Request Forgery)** attacks ka primary target hote hain — `12-security.md` mein ye detail mein cover hua hai. Attacker ka malicious site ek victim ke browser se ek request trigger kar sakta hai (jaise ek hidden form auto-submit), aur browser **automatically** victim ke session cookie ko us request ke saath attach kar dega — chahe request kisi bhi third-party site se aayi ho. `localStorage`/`sessionStorage`/IndexedDB is attack vector se immune hain kyunki koi automatic attachment hi nahi hota — attacker ko explicitly JS execute karni padegi victim ke origin pe (jo already XSS hai, ek alag attack class).

```javascript
// localStorage — synchronous string-only key-value store
localStorage.setItem("theme", "dark"); // string value store kiya, key "theme" ke saath
localStorage.setItem("user", JSON.stringify({ id: 1, name: "Sharad" })); // object ko manually stringify karna pada, localStorage sirf strings leta hai
const theme = localStorage.getItem("theme"); // "dark" string wapas mila, synchronous call — turant return hota hai
const user = JSON.parse(localStorage.getItem("user")); // wapas object mein parse karna pada, manual round-trip
localStorage.removeItem("theme"); // specific key hataya
localStorage.clear(); // saara origin-wide localStorage clear kar diya, sabse destructive call

// sessionStorage — same API shape, lekin tab-scoped aur session-only lifetime
sessionStorage.setItem("draftFormData", JSON.stringify({ step: 2 })); // sirf current tab mein rahega
// naya tab kholo (same site), sessionStorage khali milega — tab-specific isolation hai ye

// cookies — string-based, manual parsing zaroori hai, purana/awkward API
document.cookie = "sessionId=abc123; max-age=3600; path=/; SameSite=Strict"; // ek cookie set kiya, semicolon-separated attributes
// document.cookie ek getter/setter hai jo saari cookies ko EK single string mein return karta hai — parsing manually karni padti hai
console.log(document.cookie); // "sessionId=abc123; theme=dark; ..." — sab cookies ek string mein, khud split/parse karna padta hai
```

### Cross-reference

`12-security.md` mein ye discussion detail mein hai ki auth tokens ko **`localStorage`** mein rakhna XSS-vulnerable hai (kyunki koi bhi injected script `localStorage.getItem("token")` seedha call kar sakta hai), jabki **httpOnly cookie** mein rakha token JavaScript se accessible hi nahi hota (`document.cookie` mein bhi nahi dikhta) — lekin phir CSRF protection zaroori ban jaata hai (kyunki cookie automatically attach hoti hai). Ye trade-off — XSS risk (localStorage) vs CSRF risk (cookie) — senior interview ka ek classic question hai, aur is chapter ki table isi decision ka foundational context deti hai.

### Synchronous vs Asynchronous — ek real performance consideration

`localStorage` aur `sessionStorage` **synchronous** hain — matlab jab tum `localStorage.setItem()` ya `getItem()` call karte ho, main thread **block** ho jaata hai jab tak operation complete na ho. Chhote values (kuch KB) ke liye ye negligible hai, lekin agar tum galti se ek bada JSON blob (jaise 2-3 MB ka cached API response) `localStorage` mein store/read karte ho, ye ek genuine, measurable main-thread jank create kar sakta hai — scroll stutter, input lag, sab kuch is duration mein freeze.

`IndexedDB` explicitly **asynchronous** design kiya gaya hai isi problem se bachne ke liye — har operation (open, read, write) Promise/event-based hai, main thread kabhi block nahi hota, chahe tum kitna bhi bada data read/write kar rahe ho. Yehi wajah hai ki IndexedDB structurally "localStorage ka bada version" nahi hai — ye ek fundamentally different design philosophy follow karta hai, specifically iske liye ki large data ke saath bhi UI responsive rahe.

---

## IndexedDB — When localStorage Isn't Enough

`localStorage` simple key-value pairs ke liye theek hai (user preferences, small flags), lekin jaise hi tumhe **structured data**, **indexes/queries**, **transactions**, ya **large storage** chahiye — jaise ek offline-capable note-taking app jo hazaaron records cache karti hai, ya ek app jo large datasets client-side process karti hai — `localStorage` genuinely insufficient hai. IndexedDB ek **genuine client-side database** hai — object stores (tables jaisa), indexes (fast lookups by non-primary-key fields), aur transactions (atomicity guarantee) sab support karta hai.

Raw IndexedDB API bahut verbose hai (event-based callbacks, Promise-based nahi natively) — production code mein log usually `idb` jaisi library use karte hain jo isi API ko clean Promise-wrapper deti hai. Neeche raw API dikha rahe hain taaki underlying mechanics samajh aaye, phir `idb` ka mention karenge.

```javascript
// Step 1: Database open karna — ye async operation hai, ek "request" object return karta hai jispe events lagte hain
const request = indexedDB.open("MyAppDB", 1); // database naam "MyAppDB", version number 1 (schema versioning ke liye zaroori)

// "upgradeneeded" event tab fire hota hai jab database pehli baar ban raha ho, ya version number badha ho (schema migration)
request.onupgradeneeded = (event) => { // ye handler schema define/modify karta hai
  const db = event.target.result; // is event se hi humein database instance milta hai
  if (!db.objectStoreNames.contains("notes")) { // agar "notes" naam ka object store abhi tak nahi bana
    const store = db.createObjectStore("notes", { keyPath: "id" }); // naya object store banaya, "id" field ko primary key bataya
    store.createIndex("byCreatedAt", "createdAt", { unique: false }); // ek index banaya "createdAt" field pe — fast range-queries ke liye, unique false kyunki multiple notes same time pe ban sakte hain
  }
};

// "success" event tab fire hota hai jab database successfully open ho jaaye (schema already exists ya just create hua)
request.onsuccess = (event) => { // connection ready hone ka handler
  const db = event.target.result; // actual usable database instance
  console.log("DB opened successfully"); // confirmation log

  // Ek naya note insert karna — transaction ke andar hona zaroori hai
  const tx = db.transaction("notes", "readwrite"); // transaction shuru kiya, "notes" store pe, "readwrite" mode (insert/update/delete allowed)
  const store = tx.objectStore("notes"); // is transaction ke andar "notes" store ka reference liya
  store.put({ id: 1, title: "First note", body: "Hello IndexedDB", createdAt: Date.now() }); // ek record insert/update kiya (put = upsert semantics)

  tx.oncomplete = () => console.log("Write transaction complete"); // transaction fully commit hone pe fire hota hai

  // Ek record ko id se read karna — alag transaction, "readonly" mode
  const readTx = db.transaction("notes", "readonly"); // sirf read karna hai, readonly mode zyada efficient hai
  const readStore = readTx.objectStore("notes"); // store reference liya
  const getRequest = readStore.get(1); // id=1 wala record maanga, ye bhi async request hai
  getRequest.onsuccess = () => { // read complete hone pe fire hota hai
    console.log("Fetched note:", getRequest.result); // actual fetched object yahan milta hai
  };
};

request.onerror = (event) => { // agar database open karne mein hi koi error aaye (jaise version conflict, quota exceeded)
  console.error("DB open failed:", event.target.error); // error object log kiya
};
```

**Transactions aur versioning pe senior-level notes**: IndexedDB transactions **auto-committing** hain — ek transaction sirf tab tak "open" rehta hai jab tak current synchronous JS execution chal rahi hai (microtask boundary tak). Matlab agar tum ek transaction ke andar `await fetch(...)` jaisa kuch daal do (ek async gap jo microtask se bada hai), transaction premature close ho jaata hai aur baad ka operation error dega — ye ek genuinely confusing gotcha hai jo naye developers ko surprise karta hai. Isliye transactions ke andar sirf synchronous IndexedDB operations chain karo, external async calls (network, timers) transaction ke bahar rakho.

Version numbers (`indexedDB.open("MyAppDB", 1)` mein wo `1`) schema migrations ka mechanism hain — jab tumhe schema change karna ho (naya object store, naya index), version number increment karo (`2`, `3`, ...). `onupgradeneeded` handler tabhi fire hota hai jab requested version, existing stored version se **zyada** ho — yehi jagah hai jahan tum conditionally purane object stores ko modify/migrate karte ho based on `event.oldVersion`.

Ye code kitna verbose hai — har operation ke liye alag `onsuccess`/`onerror` callbacks, event-based flow jo Promises se compose nahi hota naturally — yehi wajah hai ki almost koi bhi production codebase raw IndexedDB directly use nahi karta. `idb` library (npm package by Jake Archibald, Google Chrome team) isi API ko thin Promise-wrapper deti hai:

```javascript
import { openDB } from "idb"; // idb library ka main function import kiya

async function setupDb() { // async function — Promise-based flow ab natural hai
  const db = await openDB("MyAppDB", 1, { // database open kiya, await-able Promise return hota hai
    upgrade(db) { // schema upgrade callback, raw API jaisa hi concept hai
      db.createObjectStore("notes", { keyPath: "id" }); // object store banaya
    },
  });

  await db.put("notes", { id: 1, title: "First note", body: "Hello idb" }); // ek line mein insert, koi manual transaction/callback nahi
  const note = await db.get("notes", 1); // ek line mein read, seedha awaited value milta hai
  console.log(note); // fetched object
}
```

Yehi core value proposition hai `idb` ka — same underlying IndexedDB, lekin `async/await` ke saath naturally compose hone wala API, bina boilerplate callbacks ke.

---

## Web Workers — True Multi-threading in the Browser

JavaScript apne default execution model mein **single-threaded** hai — matlab tumhara saara JS code (event handlers, promises, rendering-related work) ek hi thread pe chalta hai, jise **main thread** kehte hain. Agar ye thread kisi heavy computation mein busy ho jaaye (jaise 10 lakh items ko sort/filter karna, ya complex image pixel manipulation), poori UI freeze ho jaati hai — clicks respond nahi karte, scrolling atakti hai, animations ruk jaate hain, kyunki wahi thread jo rendering handle karta hai wahi busy hai.

**Web Workers** isi problem ka solution hain — ye JS code ko ek **genuinely separate OS-level thread** pe run karte hain, main thread se completely independent. Ye do critical constraints ke saath aata hai jo interview mein bahut pucha jaata hai:

1. **No shared memory** — worker aur main thread directly ek doosre ke variables ya objects access nahi kar sakte. Communication sirf `postMessage()` ke through hoti hai — ye **message-passing** model hai, data ko serialize/deserialize karke (structured clone algorithm se) copy kiya jaata hai between threads.
2. **No DOM access** — worker thread ke paas `document`, `window` (kuch limited exceptions ke saath), ya koi bhi DOM API access nahi hota. Worker sirf pure computation kar sakta hai, result wapas bhej sakta hai — DOM update karna hamesha main thread ki responsibility rehti hai.

### Full example — offloading heavy computation

Socho ek scenario: ek bada dataset (jaise 5 lakh rows) ko process karna hai (filter + aggregate), aur ye main thread pe karne se UI 2-3 second ke liye freeze ho jaati hai. Worker isse background thread pe bhej deta hai.

```javascript
// worker.js — ye alag file hai, worker ke context mein chalti hai (main thread se alag)

self.onmessage = (event) => { // "message" event fire hota hai jab main thread postMessage() karta hai worker ko
  const { numbers } = event.data; // main thread se bheja gaya data, event.data mein aata hai (structured-clone copy)

  // ek genuinely heavy computation — bade array ka sum aur average calculate karna
  let sum = 0; // running sum initialize kiya
  for (let i = 0; i < numbers.length; i++) { // pura array loop kiya — agar array bada hai (jaise 5 lakh items), ye slow hai
    sum += numbers[i]; // har element sum mein add kiya
  }
  const average = sum / numbers.length; // average calculate kiya

  self.postMessage({ sum, average }); // result ko main thread ko wapas bheja, message-passing ke through
  // ye call bhi ek copy banata hai (structured clone) — koi shared reference nahi hai wapas
};
```

```javascript
// main.js — ye main thread pe chalta hai, jahan tumhara React/DOM code hai

function runHeavyComputation(numbers) { // heavy computation ko worker ke through offload karne wala function
  return new Promise((resolve, reject) => { // Promise mein wrap kiya taaki caller await kar sake, worker ka callback-style API nahi
    const worker = new Worker("worker.js"); // naya Worker instance banaya, worker.js file ko separate thread pe load kiya

    worker.onmessage = (event) => { // worker se result aane pe fire hota hai
      resolve(event.data); // Promise ko resolve kiya, worker ka result data ke saath
      worker.terminate(); // IMPORTANT — worker thread ko explicitly band kiya, warna wo background mein zinda rehta hai (memory leak)
    };

    worker.onerror = (error) => { // worker ke andar koi uncaught error aaye toh yahan fire hota hai
      reject(error); // Promise ko reject kiya
      worker.terminate(); // error case mein bhi cleanup zaroori hai
    };

    worker.postMessage({ numbers }); // actual data worker ko bheja — main thread yahan block NAHI hota, ye async hai
  });
}

// usage — ek button click pe heavy computation trigger karna, UI freeze nahi hoga
async function onCalculateClick() { // button click handler
  const bigArray = Array.from({ length: 500000 }, (_, i) => i); // demo ke liye 5 lakh numbers ka array banaya

  console.log("UI still responsive, computation started in background..."); // ye log turant print hoga, block nahi hua
  const result = await runHeavyComputation(bigArray); // worker se result await kiya, is dauraan UI freeze nahi hui
  console.log("Result:", result); // { sum: ..., average: ... } — final result mila
}
```

**Senior insight**: `worker.terminate()` bhoolna ek genuine memory-leak source hai — har naya `new Worker()` ek OS-level thread spawn karta hai, aur agar tum use explicitly terminate nahi karte, wo background mein zinda rehta hai even after uska kaam khatam ho gaya ho. Long-running apps (SPAs jo kabhi full page reload nahi karti) mein ye especially real problem ban jaata hai — har baar user koi heavy operation trigger kare aur worker leak ho, thread count badhta rehta hai.

---

## WebSockets — Real Bidirectional Communication

Normal HTTP request/response model **client-initiated** hai — client ek request bhejta hai, server response deta hai, connection (logically) khatam. Server kabhi **khud se** client ko kuch nahi bhej sakta bina client ke pehle request kiye — chahe tum polling karo (repeatedly asking "kuch naya hai?"), ye fundamentally client-driven model hai.

**WebSockets** iska solution hain — ek baar connection establish ho jaaye (HTTP se "upgrade" hoke), ye ek **persistent, full-duplex** connection ban jaata hai jahan **dono sides** kabhi bhi message bhej sakti hain, bina doosri side ke request ka wait kiye. Yehi property real-time features (chat apps, live notifications, collaborative editing jaise Google Docs, live stock tickers, multiplayer games) ke liye essential banati hai.

```javascript
// WebSocket client — connection establish karna
const socket = new WebSocket("wss://example.com/chat"); // "wss://" secure WebSocket protocol hai (http/https ke jaisa http/ws relationship)

// "open" event — connection successfully establish hone pe fire hota hai
socket.onopen = () => { // handshake complete hone ka signal
  console.log("WebSocket connected"); // connection ready hai, ab messages bhej sakte hain
  socket.send(JSON.stringify({ type: "join", room: "general" })); // ek JSON message bheja, room join karne ke liye — string hi bhej sakte hain, isliye stringify zaroori
};

// "message" event — server se KABHI BHI message aa sakta hai, client ne kuch request nahi kiya tha explicitly
socket.onmessage = (event) => { // ye core bidirectional-ness dikhata hai — server-initiated push
  const data = JSON.parse(event.data); // incoming message string ko parse kiya (server bhi JSON string bhej raha hai)
  console.log("New message received:", data); // e.g. { type: "chat", user: "Alice", text: "Hello!" }
  // yahan UI update karoge — jaise chat window mein naya message append karna
};

// "error" event — connection-level error (network issue, server crash beech mein)
socket.onerror = (error) => { // koi bhi transport-level problem yahan fire hoti hai
  console.error("WebSocket error:", error); // debug log
};

// "close" event — connection band hone pe fire hota hai (server ne close kiya, ya network drop hua, ya client ne khud close kiya)
socket.onclose = (event) => { // cleanup/reconnect logic yahan jaata hai
  console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`); // close reason debug karne ke liye useful
  // production mein yahan reconnection logic hoti hai — exponential backoff ke saath (01-api-calling-best-practices.md ka retry pattern yahan bhi apply hota hai)
};

// client se message bhejna — kisi bhi time, event handler ke bahar bhi
function sendChatMessage(text) { // user ne message type karke send button dabaya
  if (socket.readyState === WebSocket.OPEN) { // check kiya ki connection abhi bhi open hai (agar band ho gaya, send karna crash karega)
    socket.send(JSON.stringify({ type: "chat", text })); // message ko JSON string bana ke bheja
  } else {
    console.warn("Socket not open, message not sent"); // agar connection nahi hai, user ko feedback dena chahiye
  }
}

// cleanup — jab component unmount ho ya page leave ho, connection explicitly close karo
function cleanup() { // ye React useEffect cleanup mein call hota
  socket.close(); // graceful close — server ko bhi "close" frame milega
}
```

### Server-Sent Events (SSE) — jab sirf ek direction chahiye

Agar tumhe sirf **server-to-client** push chahiye (jaise live notifications, ya progress updates), aur client ko kabhi server ko push karne ki zaroorat nahi hai, WebSocket ek overkill hai — **Server-Sent Events (SSE)** ek simpler alternative hai:

```javascript
// SSE — sirf ek EventSource banana hai, WebSocket jaisa handshake/upgrade complexity nahi
const eventSource = new EventSource("/api/live-updates"); // plain HTTP connection hai jo open rehta hai, server chunks push karta rehta hai

eventSource.onmessage = (event) => { // server se naya event aane pe fire hota hai
  console.log("Update:", event.data); // sirf server-to-client direction hai, client kabhi ismein "send" nahi kar sakta
};

eventSource.onerror = () => { // connection issue pe
  console.error("SSE connection error"); // EventSource khud automatically reconnect try karta hai, WebSocket ke against ye built-in hai
};
```

SSE plain HTTP pe based hai (WebSocket ek alag protocol hai), automatic reconnection built-in hai, aur implementation simpler hai — lekin sirf one-directional communication ke liye. Agar client ko bhi push karna hai (chat mein "typing..." indicator bhejna, jaise), WebSocket zaroori hai.

### Reconnection logic — production WebSockets ka must-have

Raw `WebSocket` object mein **automatic reconnection built-in nahi hai** (SSE ke `EventSource` ke against, jo ye khud handle karta hai) — network drop ya server restart ke baad connection permanently close reh jaata hai jab tak tum khud reconnect logic likho. Yehi ek bahut common production gap hai — demo code mein log ise skip kar dete hain, real apps mein ye zaroori hai.

```javascript
function createReconnectingSocket(url, onMessage) { // reconnecting WebSocket wrapper banane wala factory function
  let socket; // current active socket instance, closure mein persist karega
  let reconnectAttempt = 0; // kitni baar reconnect try ho chuka hai, backoff calculation ke liye

  function connect() { // actual connection establish karne wala internal function
    socket = new WebSocket(url); // naya WebSocket connection banaya

    socket.onopen = () => { // connection successful hone pe
      console.log("Connected"); // confirmation log
      reconnectAttempt = 0; // successful connect hone pe attempt counter reset kiya, agla disconnect fresh backoff se shuru hoga
    };

    socket.onmessage = (event) => onMessage(JSON.parse(event.data)); // incoming message ko caller-provided handler ko forward kiya

    socket.onclose = () => { // connection band hone pe — chahe intentional ho ya network issue
      const delay = Math.min(1000 * 2 ** reconnectAttempt, 30000); // exponential backoff, 01-api-calling-best-practices.md ke pattern jaisa, 30s cap
      reconnectAttempt++; // agli baar ke liye attempt counter badhaya
      console.warn(`Disconnected, reconnecting in ${delay}ms`); // debug visibility
      setTimeout(connect, delay); // calculated delay ke baad khud ko dobara call kiya — naya connection attempt
    };

    socket.onerror = (error) => { // error event pe log kiya, "close" event khud-ba-khud follow karega jo reconnect trigger karega
      console.error("WebSocket error:", error); // debug log, actual reconnect logic onclose mein hai isliye yahan duplicate nahi kiya
    };
  }

  connect(); // pehla connection attempt immediately shuru kiya

  return { // caller ko ek handle diya control ke liye
    send: (data) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(data)), // safe send — sirf open state mein bhejo
    close: () => { // explicit, intentional close — reconnect trigger NAHI hona chahiye is case mein
      socket.onclose = null; // onclose handler hata diya taaki intentional close pe reconnect loop na chale
      socket.close(); // ab safely close kiya
    },
  };
}
```

**Senior note**: intentional close (user ne khud navigate kiya, component unmount hua) aur unintentional disconnect (network drop) ko differentiate karna zaroori hai — upar wale code mein `close()` method explicitly `onclose` handler hata deta hai pehle, warna tumhara "cleanup" khud ek naya reconnect trigger kar dega, jo ek infinite loop jaisa bug create karta hai (component unmount hua, socket close hua, "disconnect" detect hua, reconnect hua, naya socket ban gaya — jo phir kabhi close nahi hoga kyunki component already unmount ho chuka hai).

---

## Service Workers — The PWA Foundation (Beyond Caching)

`07-caching.md` ka Section 4 Service Worker ke **caching strategies** (cache-first, network-first, stale-while-revalidate) ko deep detail mein already cover kar chuka hai — agar wo mechanics revise karna ho, wahan jaao. Ye section focus karta hai Service Worker ki **broader PWA capabilities** pe jo sirf caching se aage jaati hain.

### Background Sync — connectivity wapas aane pe retry

Socho user offline hai (metro mein, weak signal) aur ek form submit karta hai — normally ye request fail ho jaayegi. **Background Sync API** Service Worker ko ye action **queue** karne deta hai, aur jab connectivity wapas aaye (chahe browser tab bhi band ho), Service Worker automatically retry karta hai.

```javascript
// main.js — user offline hai, form submit hota hai
async function submitFormOffline(formData) { // form data ko offline-safe tarike se submit karne wala function
  const registration = await navigator.serviceWorker.ready; // active Service Worker registration liya
  await saveToIndexedDb(formData); // form data ko IndexedDB mein save kiya, taaki SW baad mein isse access kar sake (Section 2 se related)
  await registration.sync.register("submit-form"); // ek sync task register kiya, naam "submit-form" — ye browser ko batata hai "connectivity aane pe ye tag trigger karo"
}

// sw.js — Service Worker ke andar, "sync" event ka listener
self.addEventListener("sync", (event) => { // "sync" event tab fire hota hai jab browser connectivity detect kare AUR registered tag ho
  if (event.tag === "submit-form") { // check kiya ki ye humara wala tag hai (multiple sync tags ho sakte hain)
    event.waitUntil( // waitUntil browser ko batata hai "background sync ko in-progress treat karo jab tak ye Promise resolve na ho"
      getFormDataFromIndexedDb().then((formData) => // IndexedDB se pending form data nikaala
        fetch("/api/submit", { // ab actual network request bheji, connectivity available hai ab
          method: "POST", // form submission POST hai
          body: JSON.stringify(formData), // saved data ko body mein bheja
          headers: { "Content-Type": "application/json" }, // JSON content type
        })
      )
    );
  }
});
```

### Web Push Notifications — mobile push ka web equivalent

RN/Expo handbook mein mobile push notifications cover hui hain (device token, FCM/APNs) — web mein equivalent mechanism **Web Push API** hai, jo Service Worker ke `push` event ke saath integrate hota hai. Server kabhi bhi (chahe app tab band ho, sirf Service Worker registered hona chahiye) ek push notification trigger kar sakta hai.

```javascript
// sw.js — Service Worker ke andar "push" event listener
self.addEventListener("push", (event) => { // "push" event tab fire hota hai jab push service (browser vendor ka backend) ek message deliver kare
  const data = event.data ? event.data.json() : {}; // push payload ko JSON mein parse kiya, agar data hai

  event.waitUntil( // notification dikhane tak SW ko active rakho
    self.registration.showNotification(data.title || "New notification", { // actual OS-level notification dikhaya
      body: data.body || "", // notification ka body text
      icon: "/icons/notification-icon.png", // notification icon
    })
  );
});

// notification pe click hone ka handler — user ko app pe le jaana
self.addEventListener("notificationclick", (event) => { // user ne notification pe click kiya
  event.notification.close(); // notification ko close kiya
  event.waitUntil(clients.openWindow("/")); // app ka homepage khol diya (ya specific deep-link URL)
});
```

Web Push setup karne ke liye client-side subscription (`pushManager.subscribe()` with VAPID keys), aur server-side push-trigger logic bhi chahiye hoti hai — ye full detail is chapter ka scope se bahar hai, lekin core mental model yehi hai: Service Worker background mein `push` events sunta hai, chahe app tab open ho ya nahi.

### Web App Manifest — "Add to Home Screen" ka foundation

`manifest.json` ek JSON file hai jo browser ko batati hai tumhari web app ko ek **installable app** ki tarah kaise treat karna hai — home screen icon, splash screen, theme color, sab yahan define hota hai.

```json
{
  "name": "My Awesome App",
  "short_name": "Awesome",
  "description": "A PWA that works offline",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ff6600",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Har field ka matlab: `name` full app name hai (install prompt mein dikhta hai), `short_name` home screen icon ke neeche chhota label hai, `start_url` batata hai app khulne pe kaunsa URL load ho, `display: "standalone"` browser chrome (address bar, back button) hide kar deta hai taaki native-app jaisa feel aaye, `background_color` splash screen ka background hai app load hone tak, `theme_color` OS status bar/task-switcher ka color set karta hai, aur `icons` array different resolutions ke icons deta hai different devices/contexts ke liye. Is manifest ko HTML mein `<link rel="manifest" href="/manifest.json">` se link karna padta hai, aur ek registered Service Worker ke saath hone pe browser "Add to Home Screen"/install prompt automatically show karta hai (criteria browser-dependent hain, lekin manifest + SW dono zaroori hain).

---

## The `Intl` API — Native Internationalization

Bahut projects poora i18n library (jaise `i18next` ya `react-intl`) sirf **date/number formatting** ke liye include kar lete hain, jabki browser-native `Intl` API bina kisi dependency ke locale-aware formatting deta hai — ye RN handbook ke i18n chapter ke locale-formatting concept ka hi web-native, dependency-free version hai.

```javascript
// Intl.NumberFormat — currency aur number formatting, locale-aware
const priceInINR = new Intl.NumberFormat("en-IN", { // "en-IN" locale — Indian numbering (lakh/crore commas), English labels
  style: "currency", // currency-style formatting chahiye
  currency: "INR", // Indian Rupee symbol/format
}).format(1234567.89); // raw number diya
console.log(priceInINR); // "₹12,34,568" (Indian grouping — lakh/crore pattern, decimals rounded per locale default)

const priceInUS = new Intl.NumberFormat("en-US", { // "en-US" locale — Western numbering (thousand commas)
  style: "currency",
  currency: "USD",
}).format(1234567.89); // same raw number
console.log(priceInUS); // "$1,234,567.89" (thousands-grouping different from Indian style)

const plainNumber = new Intl.NumberFormat("en-IN").format(1234567); // sirf number formatting, currency nahi
console.log(plainNumber); // "12,34,567" — locale-specific digit grouping, koi currency library nahi chahiye

// Intl.DateTimeFormat — locale-aware date formatting
const date = new Date("2026-08-11T10:30:00"); // ek fixed date object banaya

const formattedIndia = new Intl.DateTimeFormat("en-IN", { // Indian date format
  day: "2-digit", // din ko 2-digit mein dikhao (01-31)
  month: "long", // mahine ka pura naam
  year: "numeric", // pura saal
}).format(date); // date object formatted string mein convert kiya
console.log(formattedIndia); // "11 August 2026"

const formattedUS = new Intl.DateTimeFormat("en-US", { // US date format
  month: "short", // mahine ka short naam
  day: "numeric", // din simple number mein
  year: "numeric", // saal
}).format(date); // same date, different locale format
console.log(formattedUS); // "Aug 11, 2026"
```

**Senior note**: `Intl` API ka fayda ye hai ki tumhe manually har locale ke liye grouping rules, currency symbols, ya date-order conventions hardcode nahi karne padte — browser ka built-in ICU (International Components for Unicode) data ye sab handle karta hai, aur ye tree-shakeable bhi hai (koi extra bundle size nahi, native browser feature hai) jabki ek full i18n library sirf date/number formatting ke liye kilobytes add kar sakti hai.

---

## Geolocation, Clipboard, and Other Common Web APIs (Brief Survey)

Modern browser APIs ka common pattern hai — zyada tar **Promise-based** hain, aur privacy-sensitive capabilities **explicit user permission** maangte hain (privacy-by-design principle — browser vendors ne ye ensure kiya hai ki koi site silently location/camera/clipboard access na kar sake).

### Geolocation API

```javascript
navigator.geolocation.getCurrentPosition( // user ki current location maangi
  (position) => { // success callback — user ne permission grant ki
    console.log(position.coords.latitude, position.coords.longitude); // lat/long values mile
  },
  (error) => { // error callback — permission denied, ya location unavailable, ya timeout
    console.error("Geolocation failed:", error.message); // error handle kiya
  },
  { enableHighAccuracy: true, timeout: 5000 } // options — high accuracy chahiye (GPS use karo agar available), 5 second timeout
);
```

Browser pehli baar call pe ek permission prompt dikhata hai ("This site wants to know your location") — user explicit allow/deny kare bina koi data nahi milta.

### Clipboard API

```javascript
async function copyToClipboard(text) { // clipboard mein text copy karne wala function
  try {
    await navigator.clipboard.writeText(text); // modern Promise-based API, directly text likh diya clipboard mein
    console.log("Copied to clipboard!"); // success feedback, UI mein toast dikhaya ja sakta hai
  } catch (err) {
    console.error("Copy failed:", err); // agar permission denied ya secure-context (HTTPS) na ho, fail ho sakta hai
  }
}

// usage — kisi button click pe
document.getElementById("copyBtn").addEventListener("click", () => { // copy button ka click listener
  copyToClipboard("https://example.com/share-link"); // ek link copy kar diya
});
```

`navigator.clipboard` sirf **secure context (HTTPS)** mein kaam karta hai, aur read operations (`readText()`) ke liye zyada strict permission model hai compared to write — ye deliberate hai kyunki clipboard mein sensitive data (passwords, tokens) ho sakta hai jo koi malicious site silently read nahi kar sakti bina explicit permission ke.

Common pattern jo har naye Web API mein dikhta hai: `Promise`-based return values (callback-hell se bacha jaata hai), aur `navigator.permissions.query()` se pehle se check kiya ja sakta hai ki permission already granted hai ya nahi, bina actually API call trigger kiye.

---

## Real-World Gotchas

- **`localStorage` mein bade/frequently-changing data store karna** — Section 1 ka recap: `localStorage` synchronous hai, isliye large values (kuch sau KB se zyada) ke saath repeated reads/writes measurable main-thread jank create karte hain. Agar tumhe frequently-changing ya large data cache karna hai, IndexedDB use karo (async by design) — `localStorage` ko chhote, rarely-changing values (theme preference, feature flags) tak limit rakho.
- **Web Workers DOM access nahi kar sakte — ek common early confusion** — naye developers jab pehli baar Worker likhte hain, wo assume karte hain worker ke andar se `document.getElementById(...)` ya kisi DOM element ko directly update kar sakte hain. Ye kabhi kaam nahi karega — worker ke context mein `document`/`window` (DOM-related parts) exist hi nahi karte. Worker sirf computation kare, result `postMessage` se wapas bheje, aur **main thread hi DOM update kare** — ye separation strict hai, koi workaround nahi hai (ye deliberate design hai, thread-safety ke liye).
- **WebSocket connections cleanup na karna — memory leaks aur zombie connections** — agar ek React component WebSocket connection open karta hai (`useEffect` mein) lekin cleanup function mein `socket.close()` nahi call karta, component unmount hone ke baad bhi connection zinda rehta hai — server side pe bhi ek "zombie" connection reh jaata hai jo kabhi properly close nahi hua. Ye especially SPA navigation mein bura hai (chat page se doosre page pe gaye, socket abhi bhi open hai background mein, events abhi bhi fire ho rahe hain unmounted component ke liye). Hamesha `useEffect` cleanup mein connection explicitly close karo.
- **Service Worker update "dikh nahi raha" — classic PWA debugging confusion** — ye genuinely confusing scenario hai: tumne `sw.js` mein naya code deploy kiya, lekin users ko update nahi dikh raha. Wajah: **browser khud Service Worker script file ko bhi cache karta hai** (HTTP cache level pe), aur by default naya SW sirf tab activate hota hai jab saare purane tabs (jo purana SW use kar rahe the) close ho jaayein — naya SW "waiting" state mein atka rehta hai. Isse debug/fix karne ke liye: (1) `sw.js` ko HTTP level pe `Cache-Control: no-cache` set karo taaki browser hamesha fresh copy check kare, (2) `self.skipWaiting()` call karo naye SW ke `install` event mein taaki wo immediately activate ho bina purane tabs close hone ka wait kiye, aur (3) `clients.claim()` call karo `activate` event mein taaki naya SW immediately currently-open pages ko bhi control le le. Bina in teenon steps ke, "mera SW update reflect nahi ho raha" ek bahut common aur frustrating debugging session ban jaata hai.

---

## Key Takeaways

- Cookies hi **automatically** server ko bheje jaate hain — `localStorage`/`sessionStorage`/IndexedDB kabhi nahi. Yehi property cookies ko CSRF-relevant banati hai aur `12-security.md` ke token-storage trade-off (XSS vs CSRF) ka foundation hai.
- `localStorage`/`sessionStorage` **synchronous** hain — bade values ke saath main-thread jank ka real risk. IndexedDB deliberately **asynchronous** hai exactly isi problem se bachne ke liye.
- IndexedDB ek genuine client-side database hai — structured data, indexes, transactions, aur much larger capacity — raw API verbose hai, `idb` jaisi library isse Promise-based ergonomic banati hai.
- Web Workers genuinely separate OS thread pe chalte hain — message-passing (`postMessage`) ke through communicate karte hain, DOM access nahi kar sakte, aur heavy computation offload karne ka correct tool hain (main thread freeze avoid karne ke liye).
- WebSockets persistent, bidirectional connection dete hain — dono sides kabhi bhi message bhej sakti hain, jo real-time features ke liye essential hai. SSE simpler one-directional alternative hai jab sirf server-to-client push chahiye.
- Service Worker sirf caching ka tool nahi hai — ye poori PWA foundation hai: background sync (offline actions queue karna), web push notifications, aur Web App Manifest (`manifest.json`) installability enable karta hai.
- `Intl.NumberFormat`/`Intl.DateTimeFormat` browser-native, dependency-free locale formatting dete hain — full i18n library ki zaroorat nahi sirf formatting ke liye.
- Modern browser APIs (Geolocation, Clipboard, etc.) mostly Promise-based hain aur explicit user permission maangte hain — privacy-by-design ek consistent pattern hai.
- Service Worker updates immediately reflect nahi hote by default — `skipWaiting()` + `clients.claim()` combination samajhna PWA debugging ke liye essential hai.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. `localStorage` aur cookies mein sabse fundamental difference kya hai jo security implications rakhta hai?**

Cookies **automatically** har matching HTTP request ke saath browser attach kar deta hai — koi explicit JS code ki zaroorat nahi. `localStorage` (aur `sessionStorage`, IndexedDB) kabhi automatically network request mein nahi jaate, sirf explicit JS code se hi bheje ja sakte hain. Yehi property cookies ko CSRF attacks ka target banati hai (attacker victim ke browser se ek request trigger kar sakta hai, cookie automatically attach ho jaayegi), jabki `localStorage` isse immune hai — lekin `localStorage` XSS-vulnerable hai kyunki koi bhi injected script directly `localStorage.getItem()` call kar sakta hai. Yehi wo classic XSS-vs-CSRF trade-off hai jo auth token storage decisions drive karta hai.

**Q2. `localStorage`/`sessionStorage` synchronous hain jabki IndexedDB asynchronous hai — ye design difference kyun hai, aur practically kya matter karta hai?**

`localStorage`/`sessionStorage` main thread ko block karte hain har operation ke liye — chhote values ke liye negligible hai, lekin bade/frequent operations ke saath measurable jank (scroll stutter, input lag) create kar sakte hain. IndexedDB deliberately Promise/event-based async API leke design kiya gaya hai specifically isi problem ko avoid karne ke liye — bade datasets ke saath bhi main thread kabhi block nahi hota. Practically: agar data chhota aur rarely-changing hai, `localStorage` theek hai; agar data bada ya frequently-changing hai, IndexedDB use karo.

**Q3. Web Worker main-thread variables ya DOM ko directly access kyun nahi kar sakta? Data kaise transfer hota hai?**

Web Worker ek genuinely separate OS thread pe chalta hai — no shared memory between main thread aur worker. Communication sirf `postMessage()` ke through hota hai, jo data ko **structured clone algorithm** se serialize karke ek copy banata hai — original reference nahi share hota. DOM specifically worker context mein exist hi nahi karta (`document`/`window` unavailable) — ye deliberate architectural decision hai jo thread-safety guarantee karta hai (agar worker directly DOM touch kar sake, race conditions aur corruption ka risk hota main thread ke rendering ke saath).

**Q4. Ek scenario do jahan Web Worker use karna genuinely zaroori hai, aur ek scenario jahan overkill hoga.**

Zaroori: ek large CSV file (lakhs rows) client-side parse karke aggregate karna — ye CPU-heavy hai, main thread pe karne se UI seconds ke liye freeze ho jaayegi. Worker isse background mein chalata hai, UI responsive rehti hai. Overkill: ek simple `array.map()` ya `filter()` jo milliseconds mein complete ho jaata hai — worker spawn karne ka overhead (thread creation, message-passing serialization) khud us operation se zyada expensive hai. Rule of thumb: worker sirf genuinely CPU-intensive, blocking-duration-noticeable operations ke liye use karo.

**Q5. WebSocket aur regular HTTP polling mein fundamental difference kya hai?**

HTTP polling mein client repeatedly request bhejta hai ("kuch naya hai?") fixed interval pe — chahe naya data ho ya na ho, request-response cycle chalti rehti hai, jo unnecessary network overhead aur latency (data available hone aur next poll ke beech ka gap) create karta hai. WebSocket ek baar connection establish karke persistent, full-duplex channel banata hai — server **khud se** kabhi bhi client ko push kar sakta hai bina client ke request kiye, real-time (zero polling-delay) hota hai, aur ek hi connection reuse hoti hai (repeated handshake overhead nahi).

**Q6. WebSocket aur Server-Sent Events (SSE) mein kab kya choose karoge?**

WebSocket choose karo jab client ko bhi server ko push karna ho (bidirectional zaroori hai) — jaise chat apps (message send + receive), collaborative editing, multiplayer games. SSE choose karo jab sirf server-to-client direction chahiye — jaise live notifications, progress updates, live score updates — SSE simpler hai (plain HTTP based, koi protocol upgrade nahi), automatic reconnection built-in hai, aur implementation kam complex hai jab bidirectional-ness ki zaroorat hi nahi hai.

**Q7. Service Worker deploy karne ke baad users ko update dikhne mein delay/confusion kyun hota hai, aur ye kaise fix karte ho?**

Do wajah hain: (1) browser Service Worker script file ko bhi HTTP-cache kar sakta hai, isliye naya `sw.js` fetch hi nahi hota jab tak cache expire na ho — fix: `sw.js` ko `Cache-Control: no-cache` ya short max-age ke saath serve karo. (2) By default, naya SW install hone ke baad bhi "waiting" state mein rehta hai jab tak saare purane tabs (jo purane SW ke control mein hain) close na ho jaayein — fix: naye SW ke `install` event mein `self.skipWaiting()` call karo (turant activate ho jaaye), aur `activate` event mein `self.clients.claim()` call karo (currently-open pages ko bhi immediately control le le, page reload ka wait na kare).

**Q8. Background Sync API kya problem solve karta hai jo normal `fetch` retry logic solve nahi karti?**

Normal retry logic (jaise `01-api-calling-best-practices.md` ka exponential backoff pattern) sirf tab kaam karti hai jab tak tumhara JS code/tab active hai — agar user tab band kar de ya browser close kar de offline hone ke dauraan, saara pending retry state kho jaata hai. Background Sync API Service Worker ke through ek **queued action** register karta hai jo browser-level pe track hota hai — jab connectivity wapas aaye (chahe tab band ho, browser bhi background mein ho), Service Worker automatically wake hoke queued action retry karta hai. Ye tab-lifetime se independent hai, jo normal in-memory retry logic nahi de sakti.

**Q9. `Intl.NumberFormat`/`Intl.DateTimeFormat` ka use karna ek full i18n library ke against kya advantage deta hai?**

`Intl` API browser-native hai — koi extra bundle size add nahi karta (i18n libraries date/number formatting ke liye kilobytes add kar sakti hain), aur locale-specific formatting rules (digit grouping, currency symbols, date-order conventions) browser ke built-in ICU data se aate hain — manually hardcode karne ki zaroorat nahi. Trade-off ye hai ki `Intl` sirf **formatting** deta hai — actual translation strings (UI text ka different-language version) ke liye phir bhi ek i18n library ya custom translation-key system chahiye hoga; `Intl` translation solve nahi karta, sirf number/date/currency ka locale-aware presentation solve karta hai.

**Q10. WebSocket connection ko component unmount pe close na karne se kya real problems hoti hain, aur production mein isse kaise detect karoge?**

Do problems: (1) **Memory leak** — closure mein captured references (state setters, callbacks) zinda reh jaate hain kyunki socket abhi bhi listening hai events ke liye, garbage collector unhe clean nahi kar sakta jab tak socket explicitly close na ho. (2) **Zombie server-side connections aur unexpected behavior** — server ko lagta hai client abhi bhi connected/interested hai, resources (connection slot, memory) allocate rakhta hai; aur agar unmounted component ke event handlers abhi bhi fire ho rahe hain (jaise `setState` on unmounted component), React warnings ya subtle bugs aate hain jaise ek doosre page pe navigate karne ke baad bhi purane chat ke messages processing ho rahe hain background mein. Production mein detect karne ka tareeka: server-side active-connections metric monitor karo (agar ye client navigation patterns se disproportionately high hai, cleanup missing hai), aur browser DevTools Network tab mein WebSocket connections list karke check karo kitni "old" connections abhi bhi open hain jab expected UI unmount ho chuka ho. Fix hamesha same hai — `useEffect` cleanup function mein explicitly `socket.close()` call karo.
