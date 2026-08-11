# TanStack Query — Server State Ko Sahi Tarike Se Handle Karna

Chapter 18 (RN handbook) mein humne Zustand/Redux/Jotai dekha tha — aur wahan pe ek line mein mention hua tha ki RTK Query aur TanStack Query "server-state ko cache/invalidate/refetch karte hain, manual `useEffect` + `useState` fetch logic likhe bina." Ye chapter usi ek line ko poora unpack karta hai. Hum dekhenge ki naive fetching pattern exactly kaha break hota hai, TanStack Query internally kaunsa mental model use karta hai (cache keys, staleness, garbage collection), aur production-grade patterns — invalidation, optimistic updates, infinite scroll — kaise likhte hain. Ye web/frontend-specific chapter hai (React ya Next.js context mein), lekin concepts React Native mein `@tanstack/react-query` ke saath 1:1 apply hote hain.

## Is chapter mein

1. [The Problem: Why `useEffect` + `useState` for Data Fetching Doesn't Scale](#the-problem-why-useeffect--usestate-for-data-fetching-doesnt-scale)
2. [Client State vs Server State — The Core Distinction](#client-state-vs-server-state--the-core-distinction)
3. [Query Keys and the Cache Model](#query-keys-and-the-cache-model)
4. [`staleTime` vs `gcTime` — The Most Confused Concept](#staletime-vs-gctime-the-most-confused-concept)
5. [Query Invalidation](#query-invalidation)
6. [Mutations and Optimistic Updates](#mutations-and-optimistic-updates)
7. [Background Refetching](#background-refetching)
8. [Infinite Queries / Pagination](#infinite-queries--pagination)
9. [Real-World Gotchas](#real-world-gotchas)
10. [Key Takeaways](#key-takeaways)
11. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## The Problem: Why `useEffect` + `useState` for Data Fetching Doesn't Scale

Har frontend dev apne career mein ye pattern likhta hai — ye "obvious" lagta hai:

```tsx
function TodoList() { // ek naive todo-list component jo manually fetching karta hai
  const [data, setData] = useState(null);        // fetched data store karne ke liye state
  const [loading, setLoading] = useState(true);   // loading spinner dikhane ke liye flag
  const [error, setError] = useState(null);       // error message store karne ke liye state

  useEffect(() => { // side-effect — component mount hone pe data fetch karna
    setLoading(true);                              // naya fetch shuru hone se pehle loading true kiya
    fetch("/api/todos")                             // API call fire kiya
      .then((res) => res.json())                    // response ko JSON mein parse kiya
      .then((json) => setData(json))                // parsed data ko state mein daal diya
      .catch((err) => setError(err))                 // koi bhi error aaye toh error state mein daala
      .finally(() => setLoading(false));             // success ya fail, loading false kar diya
  }, []);                                            // empty deps — sirf mount pe ek baar chalega

  if (loading) return <p>Loading...</p>;             // loading state ka UI
  if (error) return <p>Error: {error.message}</p>;   // error state ka UI
  return <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>; // success state ka UI
} // component close
```

Ye pattern chhote demo apps mein chalta hai, lekin production app mein har ek line ek chhota landmine hai. Chalo ek-ek problem ko dissect karte hain — ye samajhna zaroori hai kyunki isi list se TanStack Query ka "why" nikalta hai, koi bhi library seedhe nahi seekhni chahiye "kyunki popular hai."

**1. No caching — same data har remount pe refetch hoti hai.** Agar user `TodoList` se `TodoDetail` pe navigate karta hai aur wapas `TodoList` pe aata hai, component fresh mount hota hai, `useEffect` phir chalta hai, aur wahi `/api/todos` request phir se network pe jaati hai — chahe data 2 second pehle hi fetch hua ho aur genuinely change hone ka koi chance na ho. User ko ek unnecessary loading spinner dikhta hai for data jo already usko dikh chuka tha.

**2. No request deduplication — same data, multiple parallel requests.** Socho ek dashboard page pe `<UserAvatar />` aur `<UserGreeting />` dono independently `useEffect` ke through `/api/user/me` fetch karte hain (kyunki dono components apna khud ka data-fetching likhte hain, kyunki koi shared layer nahi hai). Result: same URL ke liye 2 separate HTTP requests fire hoti hain simultaneously, jabki ek hi kaafi thi. Ye scale nahi karta jab tumhare paas 10 components ho jo same user object chahte hain.

**3. No automatic retry.** Mobile network ya flaky WiFi pe ek request fail ho sakti hai transient reason se (ek dropped packet, ek momentary timeout) — real user ko is se poora feature broken dikhta hai ("Error: failed to fetch"), jabki ek simple retry same request ko successfully complete kar deta. Naive pattern mein retry logic manually likhni padti hai — exponential backoff, max attempts, sab kuch custom code.

**4. Loading/error boilerplate — har component mein repeat hota hai.** Upar wala pattern — 3 `useState` calls, `.then().catch().finally()` chain, conditional rendering for 3 states — ye tum literally har single component mein copy-paste karte ho jahan data fetch karna hai. 20 components matlab 20 jagah same boilerplate, aur agar retry logic add karna ho later, 20 jagah edit karna padega.

**5. Race conditions — sabse dangerous problem, jo silently wrong data dikhata hai.** Ye sabse subtle aur production mein sabse zyada damage karne wala bug hai. Socho ek search box hai:

```tsx
function SearchResults({ query }: { query: string }) { // search query prop leke results dikhata hai
  const [results, setResults] = useState([]); // search results store karne ke liye state

  useEffect(() => { // query badalte hi ye effect re-run hoga
    fetch(`/api/search?q=${query}`)             // query change hote hi naya fetch fire hota hai
      .then((res) => res.json())                 // response parse kiya
      .then((json) => setResults(json));         // OVERWRITE — koi check nahi ki ye response kis request ka hai
  }, [query]);                                   // query badalte hi effect phir chalta hai

  return <ul>{results.map((r) => <li key={r.id}>{r.title}</li>)}</ul>; // results render kiye
} // component close
```

User type karta hai "re", fir jaldi se "react" — ye 2 alag fetch requests fire karega ("re" ke liye aur "react" ke liye). Network ki timing unpredictable hoti hai — agar "re" wali request ("react" wali se baad mein fire hui thi, lekin usse **pehle** resolve ho jaati hai, kyunki server ko "re" ke liye kam data process karna pada, ya koi retry hua), toh `setResults()` "re" ke stale results ke saath call hoga **after** "react" wale correct results already set ho chuke the. User ko screen pe "react" type karke bhi "re" ke results dikh rahe honge — completely silently, koi error nahi, koi console warning nahi. Ye bug production mein hafto tak unnoticed reh sakta hai kyunki reproduce karna network timing pe depend karta hai.

TanStack Query in sab 5 problems ko **default behavior** se solve karta hai — caching by key, automatic deduplication for identical in-flight requests, configurable retry with backoff, `isLoading`/`isError`/`data` as a unified return shape, aur race conditions ka fix built-in hai (jab query key change hoti hai, purani in-flight request ka result silently discard ho jaata hai jab result apne aap ko "stale/cancelled" pata karta hai — TanStack Query internally request cancellation aur "is this still the latest request for this key" tracking karta hai).

---

## Client State vs Server State — The Core Distinction

Ye distinction samajhna TanStack Query ko sahi jagah use karne ke liye sabse zaroori concept hai — aur ye exact wahi jagah hai jahan bahut saare teams architecturally galat decision lete hain.

**Client state** — wo state jo poori tarah tumhare app ke andar "born" hoti hai aur jiska lifecycle tum fully control karte ho:
- Kya ek modal open hai ya closed (`isModalOpen`)
- Form input ki current value jab user type kar raha hai
- Kaunsa tab currently selected hai
- Theme preference (dark/light)

Is state ka koi "source of truth" tumhare app ke bahar nahi hai. Ye kabhi "stale" nahi hoti — jo tumne `setState` kiya, wahi current truth hai, har waqt.

**Server state** — data jo ek remote source (database, API) se aata hai, aur fundamentally alag properties rakhta hai:
- Ye tumhare app ke **bahar owned** hai — ek doosra user, ek background job, ya khud tumhara backend isse independently change kar sakta hai, tumhare knowledge ke bina.
- Ye **stale ho sakta hai** — jo data tumne 30 second pehle fetch kiya, wo abhi bhi accurate hai ya nahi, ye guarantee nahi hai.
- Isko **cache karna, sync karna, aur invalidate karna** padta hai — ek single source of truth (server) ko multiple local copies (different components mein) ke saath consistent rakhna ek genuinely hard distributed-systems-jaisa problem hai (chhoti scale pe, lekin conceptually similar).
- Ismein **async fetching lifecycle** hota hai — loading, error, success, refetching — jo client state mein exist nahi karta (client state instantly available hai, kabhi "loading" nahi hoti).

**Common architectural mistake** — server state ko Redux/Zustand mein daalna. Ye kyun problematic hai:

```ts
// ANTI-PATTERN — Zustand store mein server data manually manage karna
type UserStore = { // store ka shape — state fields aur manual action dono
  user: User | null;          // fetched user data
  loading: boolean;           // manually tracked loading flag
  error: string | null;       // manually tracked error
  fetchUser: () => Promise<void>; // manual fetch action jo upar ke teeno ko manage karta hai
}; // type definition close

const useUserStore = create<UserStore>((set) => ({ // Zustand store banaya jisme server data manually rakha
  user: null,                                    // initial state
  loading: false,                                // initial loading
  error: null,                                   // initial error
  fetchUser: async () => { // manual fetch action — poora lifecycle khud handle karna padta hai
    set({ loading: true });                      // loading start
    try { // fetch try block
      const res = await fetch("/api/user/me");    // fetch fire kiya
      const user = await res.json();               // parse kiya
      set({ user, loading: false });               // success — data set kiya, loading off
    } catch (err) { // fetch fail hone ka case
      set({ error: String(err), loading: false }); // fail — error set kiya, loading off
    } // catch close
  }, // fetchUser close
})); // create() call close
```

Ye code compile hota hai, kaam bhi karta hai — lekin tum manually re-implement kar rahe ho jo TanStack Query already solve kar chuka hai: caching (nahi hai yahan — har `fetchUser()` call fresh fetch karta hai), deduplication (nahi hai — 2 components ne call kiya toh 2 requests), staleness tracking (nahi hai — "ye data kab tak fresh hai" ka koi concept nahi), background refetch (nahi hai), retry (nahi hai). Zustand/Redux **client state ke liye designed hain** — synchronous updates, no built-in concept of "this data has a server-side lifecycle." Unko server state ke liye use karna matlab in ki simplicity ka fayda lena but caching library ki complexity manually reinvent karna.

**Sahi split**: Zustand/Redux/Context → client state (UI state, modals, form drafts, theme). TanStack Query → server state (API data, cache, sync). Ek modern app mein dono coexist karte hain — competing tools nahi hain, **different problems solve karte hain**. (RN handbook chapter 18 ka comparison table isi split ko implicitly assume karta hai jab wo RTK Query ko "server-state caching layer" bolta hai — RTK Query aur TanStack Query dono is exact niche mein compete karte hain, Redux ka core store client-state ke liye hi reh jaata hai.)

---

## Query Keys and the Cache Model

Pehle ek zaroori setup step — TanStack Query ka cache ek `QueryClient` instance ke andar rehta hai, aur poore app ko is client ka access dena hota hai ek Provider ke through (Redux ke `<Provider store={store}>` jaisa hi pattern, RN handbook chapter 18 mein dekha tha):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // client class aur Provider component

// Module-level (component ke bahar) create kiya — agar render ke andar banaya, har re-render pe naya client
// ban jaata, aur poora cache reset ho jaata (Gotchas section mein isi mistake ka detail hai)
const queryClient = new QueryClient({ // ek client instance banaya jo poora cache hold karega
  defaultOptions: { // sab queries ke liye default settings
    queries: { // sirf useQuery-type queries pe apply honge (mutations ke defaults alag block mein hote)
      staleTime: 60_000,  // global default — jab tak query apna khud ka staleTime na de, ye 60s use hoga
      retry: 2,           // failed query ko max 2 baar retry karega (total 3 attempts) before erroring out
    }, // queries defaults close
  }, // defaultOptions close
}); // QueryClient construction close

function App() { // root component jo poore app ko client se wrap karta hai
  return ( // JSX return
    <QueryClientProvider client={queryClient}> {/* poore app tree ko client se wrap kiya */}
      <TodoList userId="user-1" /> {/* ab is subtree ka koi bhi component useQuery/useMutation call kar sakta hai */}
    </QueryClientProvider>
  ); // return close
} // App close
```

`defaultOptions` mein set kiya gaya `staleTime`/`retry` **global fallback** hai — individual `useQuery` calls apna khud ka value pass karke isko override kar sakte hain. Ye pattern useful hai jab tumhari app mein consistent default behavior chahiye (jaise "sab kuch by default 1 min tak fresh treat karo") lekin specific queries (jaise live stock price) ko alag treatment chahiye.

Ab core cache model samajhte hain. TanStack Query ka cache ek **key-value store** hai jahan key ek array hai (`queryKey`) aur value cached server response hai, plus metadata (staleness, fetch status, error state). `useQuery` hook is cache se read/write karta hai:

```tsx
import { useQuery } from "@tanstack/react-query"; // main hook import kiya

function TodoList({ userId }: { userId: string }) { // userId prop se scoped todos dikhata hai
  const { data, isLoading, isError, error } = useQuery({ // TanStack Query ka main data-fetching hook
    queryKey: ["todos", userId],       // cache key — array format, userId include kiya taaki har user ka data alag cache ho
    queryFn: async () => { // ye function actual network call karega
      const res = await fetch(`/api/todos?userId=${userId}`); // actual fetch logic
      if (!res.ok) throw new Error("Failed to fetch todos");   // non-2xx response ko explicitly error banaya (fetch khud reject nahi karta HTTP errors pe)
      return res.json();                                        // parsed JSON return kiya — yahi `data` banega
    }, // queryFn close
  }); // useQuery call close

  if (isLoading) return <p>Loading...</p>;   // pehli baar fetch ho rahi hai aur cache mein kuch nahi hai
  if (isError) return <p>Error: {error.message}</p>; // fetch fail hui
  return <ul>{data.map((t: any) => <li key={t.id}>{t.title}</li>)}</ul>; // success
} // component close
```

Yahan critical part hai `queryKey: ["todos", userId]`. TanStack Query is array ko **deeply serialize** karke ek internal cache key banata hai. Isliye:

- `["todos", "user-1"]` aur `["todos", "user-2"]` — **alag cache entries**, alag data, independently fetched/cached.
- Do components jo **exact same key** ke saath `useQuery` call karte hain — chahe unrelated component tree mein ho — automatically **same cache entry share karte hain**, aur agar ek saath mount hote hain, sirf **ek** network request fire hoti hai (deduplication, jo problem #2 upar solve karta hai).

Key structure ko object-based filters ke saath bhi likh sakte ho, jo **broad aur narrow invalidation dono** enable karta hai:

```tsx
// Query key mein object filters daalna — ye pattern list queries ke liye common hai
useQuery({ // "active" status wale todos ke liye ek query
  queryKey: ["todos", { userId, status: "active" }], // key mein userId aur status dono filters
  queryFn: () => fetchTodos({ userId, status: "active" }), // filters ke hisaab se fetch
}); // call close

useQuery({ // "completed" status wale todos ke liye alag query
  queryKey: ["todos", { userId, status: "completed" }], // SAME prefix ("todos"), lekin different status
  queryFn: () => fetchTodos({ userId, status: "completed" }), // alag data, alag cache entry
}); // call close
```

Dono queries `"todos"` prefix share karte hain, lekin unke object filters alag hain — isliye ye 2 **separate cache entries** hain. Section 5 (invalidation) mein dekhenge ki ye prefix-sharing kyun powerful hai: tum `["todos"]` invalidate karke **dono** ko ek saath stale mark kar sakte ho, ya sirf `["todos", { userId, status: "active" }]` invalidate karke **sirf ek specific slice** ko target kar sakte ho. Ye granularity Redux/manual-fetch approach mein manually implement karni padti — TanStack Query mein ye array-key design se free milti hai.

**Conditional fetching — `enabled` option.** Kabhi-kabhi query fire hi nahi karni chahiye jab tak ek dependency ready na ho — jaise `userId` khud abhi tak `undefined` hai (auth load ho raha hai):

```tsx
const { data } = useQuery({ // conditional query — dependency ready hone tak nahi chalegi
  queryKey: ["todos", userId],       // userId undefined bhi ho sakta hai initially
  queryFn: () => fetchTodos(userId), // agar ye chal gaya userId undefined ke saath, backend error dega
  enabled: !!userId,                 // JAB TAK userId truthy nahi hai, query bilkul fire hi nahi hogi
}); // call close
```

`enabled: false` hone pe query "paused" state mein rehti hai — na fetch hoti hai, na error deti hai, sirf wait karti hai jab tak `enabled` true na ho jaaye (aur us waqt automatically fire ho jaayegi, koi manual trigger ki zaroorat nahi).

**Data transform without extra render — `select` option.** Agar tumhe cache mein poora response chahiye lekin component ko sirf ek derived/transformed slice chahiye, `select` use karo — ye sirf memoized transform hai, extra cache entry nahi banata:

```tsx
const { data: completedCount } = useQuery({ // select transform ke saath query
  queryKey: ["todos", userId],                     // same cache key jaisa poore-list query ka hota
  queryFn: () => fetchTodos(userId),               // poora todos array fetch/cache hota hai as usual
  select: (todos) => todos.filter((t) => t.completed).length, // component ko sirf count chahiye, poora array nahi
}); // call close
```

Fayda ye hai ki agar `todos` array ka koi unrelated field change ho (jisse `completed` count same rahe), `select` ka result memoized rehta hai aur component re-render **nahi** hota — bilkul Zustand ke selector-pattern jaisa (RN handbook ch.18, section 8) hi philosophy, bas server-state cache pe applied.

---

## `staleTime` vs `gcTime` — The Most Confused Concept

Ye do options TanStack Query seekhne wale har developer ko confuse karte hain kam se kam ek baar — aur interview mein ye ek favorite "does this person actually understand the library" question hai. Dono time-based hain, dono milliseconds mein configure hote hain, lekin **completely different concerns** control karte hain.

**`staleTime`** — kitne time tak data ko **"fresh"** consider kiya jaaye. Jab tak data fresh hai, TanStack Query usse refetch **nahi** karega chahe component remount ho, chahe window refocus ho — cache se seedha wahi data serve hoga, bina network call ke. `staleTime` khatam hone ke baad data "stale" ho jaata hai — iska matlab ye **nahi** ki data cache se gayab ho jaata hai, sirf ye ki agla trigger (remount, refocus, reconnect) ek **background refetch** launch karega.

**`gcTime`** (pehle `cacheTime` naam tha v4 mein, v5 mein rename hua) — kitne time tak **unused/inactive** cache data memory mein rakha jaaye before garbage collection. "Unused" ka matlab hai koi active component currently us query ko subscribe nahi kar raha (e.g., component unmount ho gaya). Jab last component unmounts hota hai, ek timer start hota hai — agar `gcTime` ke andar koi naya component wapas same key subscribe nahi karta, data cache se **completely delete** ho jaata hai, aur next time genuinely ek fresh fetch (with loading state) hoga.

Concrete timeline se dekhte hain (`staleTime: 30_000` yaani 30 sec, `gcTime: 5 * 60_000` yaani 5 min — jo ki actually TanStack Query ka **default** hai `staleTime: 0` ke bajaye hum yahan example ke liye explicit set kar rahe hain):

```tsx
useQuery({ // staleTime/gcTime dono explicitly set kiye gaye ek example query
  queryKey: ["todos"],    // cache key
  queryFn: fetchTodos,    // fetch function
  staleTime: 30_000,      // data 30 second tak "fresh" rahega
  gcTime: 5 * 60_000,     // unused data 5 minute tak memory mein rahega before deletion
}); // call close
```

Timeline:

```
t=0s    Component mount hota hai → cache empty hai → fetch fires → loading state → data aata hai, cache mein store hota hai
t=10s   User navigate away karta hai (component unmounts) → data ab "unused" hai → gcTime countdown SHURU (5 min)
t=15s   User wapas aata hai, component remounts → data abhi "fresh" hai (staleTime 30s cross nahi hua from t=0)
        → CACHE SE INSTANTLY data mil jaata hai, koi loading spinner, koi network call
t=35s   staleTime (30s from t=0) cross ho gaya → data "stale" ho gaya
        → agar ab component remount hota hai (ya window refocus), TanStack Query STILL turant cache
          se stale data dikhaega (better UX — kuch na dikhana se), LEKIN background mein silently
          refetch bhi fire karega — jab fresh data aata hai, UI silently update ho jaata hai
t=5m10s (gcTime cross ho gaya agar is beech koi component subscribe nahi hua) → data cache se DELETE
        → agle mount pe genuinely fresh fetch, loading spinner se shuru
```

Sabse common confusion: log sochte hain "staleTime = how long data cached rehta hai" — **galat**. `staleTime` sirf control karta hai "refetch trigger hoga ya nahi", data cache mein tab tak rehta hai jab tak `gcTime` cross nahi hota (unused case mein) ya jab tak query active hai (used case mein — active queries kabhi garbage-collect nahi hoti, chahe staleTime kitna bhi expire ho jaaye, kyunki koi component abhi bhi use kar raha hai).

Practical guidance: **rarely-changing data** (jaise app config, user profile jo shayad hi change ho) → high `staleTime` (jaise 5-10 min) taaki unnecessary refetches na ho. **Frequently-changing data** (live dashboard, chat) → low ya `0` `staleTime` taaki hamesha latest data mile. `gcTime` usually default (5 min) hi kaafi hota hai — isko tweak karne ki zaroorat kam padti hai, sirf memory-constrained scenarios mein.

---

## Query Invalidation

Invalidation ka matlab hai — TanStack Query ko explicitly bolna "ye cached data ab stale hai, isko refetch karo (agar koi active observer hai)." Ye tab use hota hai jab tumhe **pata hai** ki server-side data change ho gaya hai — sabse common case: ek mutation (create/update/delete) successful hone ke baad related list ko refresh karna.

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // queryClient hook bhi chahiye invalidation ke liye

function AddTodoForm() { // naya todo create karne wala form component
  const queryClient = useQueryClient(); // current QueryClient instance ka reference nikaala (Provider se aata hai)

  const { mutate, isPending } = useMutation({ // useMutation hook — side-effect operation ke liye
    mutationFn: async (title: string) => { // ye function actual create-request karega
      const res = await fetch("/api/todos", {          // POST request naya todo banane ke liye
        method: "POST",                                  // HTTP method
        headers: { "Content-Type": "application/json" }, // JSON body bhej rahe hain
        body: JSON.stringify({ title }),                 // request body serialize kiya
      }); // fetch call close
      if (!res.ok) throw new Error("Failed to create todo"); // error case explicitly throw kiya
      return res.json();                                       // created todo object return kiya
    }, // mutationFn close
    onSuccess: () => { // mutation success hone pe callback
      // mutation successful hone ke baad — list query ko stale mark karo taaki wo refetch ho
      queryClient.invalidateQueries({ queryKey: ["todos"] }); // "todos" PREFIX se match karne wali SAARI queries invalidate hoti hain
    }, // onSuccess close
  }); // useMutation call close

  return ( // JSX return
    <button disabled={isPending} onClick={() => mutate("New todo")}> {/* click pe mutation trigger */}
      {isPending ? "Adding..." : "Add Todo"} {/* pending state ke hisaab se button text */}
    </button>
  ); // return close
} // component close
```

`invalidateQueries({ queryKey: ["todos"] })` ek **partial match** karta hai by default — isse `["todos"]`, `["todos", "user-1"]`, `["todos", { status: "active" }]` — sab match ho jaayenge aur sab invalidate ho jaayenge, kyunki inka pehla element `"todos"` common hai. Ye "invalidate by prefix" pattern hai — extremely useful jab tumhe pata nahi (ya care nahi) ki exactly kaunse specific filtered variants currently cache mein hain, tumhe sirf pata hai "todos" se related sab kuch stale ho gaya hai.

Agar tumhe **sirf ek specific query** invalidate karni ho, poora exact key do:

```tsx
queryClient.invalidateQueries({ queryKey: ["todos", { userId: "user-1", status: "active" }] }); // SIRF is specific user ke active todos invalidate honge, doosre users/status wale nahi
```

Important detail: `invalidateQueries` sirf data ko **"stale" mark** karta hai — agar koi active component currently us query ko observe kar raha hai, TanStack Query **immediately background refetch** trigger karta hai (component ko turant naya data milta hai, automatically). Agar koi active observer nahi hai (jaise list screen currently mount hi nahi hai), toh refetch **turant nahi** hota — data sirf stale mark hoke reh jaata hai, aur jab next time koi component isko subscribe karega, tab fresh fetch hoga. Ye lazy behavior hai by design — unnecessary background network calls avoid karta hai jab koi dekh hi nahi raha.

---

## Mutations and Optimistic Updates

`useMutation` hook side-effect-producing operations (POST/PUT/DELETE) ke liye hai — `useQuery` se fundamentally alag kyunki mutations **automatically trigger nahi hoti** (query mount pe automatically fetch hoti hai, mutation sirf `mutate()` call karne pe chalti hai) aur unka koi caching concept nahi hai (har mutation call ek fresh operation hai, cache se serve nahi hota).

**Optimistic update** ka matlab hai — server ka response wait kiye bina, UI ko **turant** update kar dena jaise operation already succeed ho gaya ho, aur agar server actually reject kare, to silently rollback kar dena. Ye UX ke liye massive improvement hai — user ko koi "loading" delay nahi dikhta for simple actions jaise "mark todo complete."

Iska lifecycle 3 callbacks se implement hota hai:

- **`onMutate`** — mutation fire hone se **pehle** chalta hai. Yahan hum manually cache ko update karte hain (optimistic value likh dete hain) aur **purana value save** karte hain (rollback ke liye).
- **`onError`** — mutation fail hone pe chalta hai. Yahan hum `onMutate` mein save kiya hua purana value wapas cache mein daal dete hain (rollback).
- **`onSettled`** — mutation success ya fail, dono cases mein **aakhir mein** chalta hai. Yahan hum ek final `invalidateQueries` call karte hain taaki cache server ke actual truth ke saath guaranteed sync ho jaaye (chahe optimistic update sahi tha ya nahi).

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"; // dono hooks chahiye

type Todo = { id: string; title: string; completed: boolean }; // todo ka shape

function useToggleTodo() { // reusable custom hook jo optimistic toggle-mutation encapsulate karta hai
  const queryClient = useQueryClient(); // cache manipulate karne ke liye client reference

  return useMutation({ // ye poora mutation object hook se return hota hai
    mutationFn: async (todoId: string) => { // actual server call
      const res = await fetch(`/api/todos/${todoId}/toggle`, { method: "PATCH" }); // server ko actual toggle request
      if (!res.ok) throw new Error("Toggle failed"); // server ne reject kiya toh error throw
      return res.json(); // updated todo return
    }, // mutationFn close

    onMutate: async (todoId: string) => { // optimistic-update lifecycle callback
      // server response se PEHLE chalta hai — yahan optimistic update likhte hain
      await queryClient.cancelQueries({ queryKey: ["todos"] }); // koi in-flight refetch cancel kiya, taaki wo humari optimistic update ko overwrite na kare

      const previousTodos = queryClient.getQueryData<Todo[]>(["todos"]); // CURRENT cache value save kiya — rollback ke liye zaroori

      queryClient.setQueryData<Todo[]>(["todos"], (old) => // cache ko directly optimistically update kiya
        old?.map((todo) => // har existing todo ko iterate kiya
          todo.id === todoId ? { ...todo, completed: !todo.completed } : todo // matching todo ka completed flip kiya, baaki same
        ) // map close
      ); // cache ko manually optimistically update kiya — UI turant naya value dikhaega

      return { previousTodos }; // ye return value onError/onSettled ke "context" argument mein milega
    }, // onMutate close

    onError: (_err, _todoId, context) => { // mutation fail hone pe rollback callback
      // mutation fail hui — context mein humara saved previousTodos hai, usse wapas cache mein daal do
      if (context?.previousTodos) { // sirf tabhi rollback karo jab previous value save hui thi
        queryClient.setQueryData(["todos"], context.previousTodos); // ROLLBACK — optimistic change undo ho gaya
      } // if close
    }, // onError close

    onSettled: () => { // success ya fail, dono cases mein chalega
      // success ya fail, dono cases mein — server ke real state se cache ko sync karo (source of truth wins)
      queryClient.invalidateQueries({ queryKey: ["todos"] }); // final safety-net refetch
    }, // onSettled close
  }); // useMutation call close
} // hook close
```

Component mein use karna simple hai:

```tsx
function TodoItem({ todo }: { todo: Todo }) { // ek single todo row render karta hai
  const { mutate: toggleTodo } = useToggleTodo(); // hamara custom mutation hook

  return ( // JSX return
    <li> {/* ek list item, ek todo ke liye */}
      <input // checkbox input
        type="checkbox"                              // checkbox type
        checked={todo.completed}                     // current (optimistically updated) state se checked
        onChange={() => toggleTodo(todo.id)}          // click pe mutation fire — UI turant update, server background mein confirm karega
      /> {/* checkbox close */}
      {todo.title} {/* todo ka title */}
    </li>
  ); // return close
} // component close
```

Yahan senior-level detail: `onMutate` mein `cancelQueries` call karna easy hai miss karna, lekin critical hai — agar ek background refetch already in-flight hai jab user toggle click karta hai, aur wo refetch humari optimistic update ke **baad** resolve hoti hai (purana server data ke saath), toh wo humari optimistic update ko silently overwrite kar degi. `cancelQueries` isi race ko rokta hai.

**Mutations by default retry nahi karte.** Ye `useQuery` se ek important behavioral difference hai — `useQuery` default `retry: 3` ke saath aata hai (transient failures ko silently retry karta hai), lekin `useMutation` ka default `retry` hai `0`. Wajah simple hai: query sirf **read** operation hai — usko safely retry karna harmless hai (GET request dobara chalane se koi side-effect duplicate nahi hota). Mutation aksar **non-idempotent** hoti hai — agar "create todo" POST request server pe pahunch gayi aur process ho gayi, lekin response client tak aane se pehle network drop hua, ek automatic retry duplicate todo bana degi. Isliye mutations ke liye retry ek explicit, deliberate choice honi chahiye:

```tsx
useMutation({ // explicit retry enable karne ka example
  mutationFn: createTodo, // actual create request function
  retry: 1, // sirf tab set karo jab tumhe pata ho backend idempotent hai (e.g. idempotency-key header use ho raha ho)
}); // call close
```

Agar backend idempotency-safe nahi hai (jaise koi idempotency key mechanism nahi hai), mutation retry ko off hi rakhna chahiye aur failure ko explicitly `onError` mein user ko dikhana chahiye ("Failed to add todo, please try again") — user manually retry decide kare, silent-automatic-duplicate se better hai.

---

## Background Refetching

TanStack Query ka default behavior — jab browser tab **background mein jaata hai** aur user wapas usko focus karta hai (`refetchOnWindowFocus`), ya jab device **offline se online** aata hai (`refetchOnReconnect`) — active queries ko automatically background mein refetch karta hai (agar wo stale hain, `staleTime` ke hisaab se).

```tsx
useQuery({ // background refetch flags explicitly dikhaye gaye (defaults already true hain)
  queryKey: ["dashboard-stats"],  // cache key
  queryFn: fetchDashboardStats,   // fetch function
  refetchOnWindowFocus: true,   // default true hi hai — tab switch karke wapas aane pe auto-refresh
  refetchOnReconnect: true,     // default true hi hai — WiFi drop hone ke baad wapas connect hone pe auto-refresh
}); // call close
```

Ye feature exist kyun karta hai — real user behavior socho: user tumhari dashboard app khol ke rakhta hai, 20 minute ke liye kisi doosre tab pe chala jaata hai (email check karna, Slack), aur wapas aata hai. Us 20 minute mein backend data significantly change ho sakta hai (naye orders aaye, stats update hue). Bina background refetch ke, user ko **stale 20-minute-purana data** dikhega jab tak wo manually refresh na kare ya naya navigation na kare. Background refetch is problem ko automatically solve karta hai — jaise hi tab focus hota hai, TanStack Query silently check karta hai "kya ye data stale hai?" aur agar haan, background mein fresh data laata hai — user ko koi loading spinner bhi nahi dikhta (jab tak `data` already cache mein tha), sirf UI silently updated data ke saath refresh ho jaata hai. Ye "always feels fresh" UX polling ke bina milta hai — koi `setInterval` nahi, koi manual "refresh every N seconds" logic nahi, sirf event-driven refresh jab genuinely relevant hota hai (focus/reconnect).

Trade-off: agar tumhara data extremely rarely change hota hai aur tum unnecessary network calls minimize karna chahte ho (jaise mobile data-conscious users), tum `refetchOnWindowFocus: false` set kar sakte ho per-query ya globally in `QueryClient` defaults.

**`refetchInterval` — polling, jab genuinely zaroori ho.** Focus/reconnect-based refetch event-driven hai, lekin kabhi-kabhi tumhe genuinely **time-based polling** chahiye hota hai — jaise ek "order status: preparing → out for delivery → delivered" tracker jaha tum background mein bhi periodically check karna chahte ho, chahe user tab active rakhe:

```tsx
useQuery({ // fixed-interval polling ka example
  queryKey: ["order-status", orderId],    // cache key
  queryFn: () => fetchOrderStatus(orderId), // fetch function
  refetchInterval: 5_000,              // har 5 second mein poll karo
  refetchIntervalInBackground: false,  // default false — tab background mein ho toh polling pause ho jaati hai (battery/bandwidth save)
}); // call close
```

Ye `setInterval`-based manual polling se better hai kyunki TanStack Query automatically ise component unmount hone pe cleanup kar deta hai, aur `refetchIntervalInBackground: false` (default) ki wajah se jab tab background mein hai, polling khud-ba-khud pause ho jaati hai — koi manual visibility-API handling likhne ki zaroorat nahi. Ek common pattern: `refetchInterval` ko conditionally set karna based on data ki current value — jaise order "delivered" ho jaaye toh polling band kar do:

```tsx
useQuery({ // conditional/dynamic polling interval ka example
  queryKey: ["order-status", orderId],    // cache key
  queryFn: () => fetchOrderStatus(orderId), // fetch function
  refetchInterval: (query) => (query.state.data?.status === "delivered" ? false : 5_000), // delivered ho gaya toh polling stop, warna 5s interval
}); // call close
```

---

## Infinite Queries / Pagination

`useInfiniteQuery` un cases ke liye hai jahan data **pages mein** aata hai aur user scroll karte-karte next page load karta hai (classic "infinite feed" pattern — Twitter/Instagram jaisa).

```tsx
import { useInfiniteQuery } from "@tanstack/react-query"; // infinite query ka dedicated hook

type Post = { id: string; title: string }; // ek post ka shape
type PostsPage = { posts: Post[]; nextCursor: string | null }; // server response ka shape — posts + next page ka pointer

function usePostsFeed() { // reusable custom hook jo pagination logic encapsulate karta hai
  return useInfiniteQuery({ // useInfiniteQuery hook — multiple pages ko sequence mein maintain karta hai
    queryKey: ["posts-feed"], // feed ka cache key
    queryFn: async ({ pageParam }) => { // har page ke liye ye function chalta hai
      // pageParam automatically getNextPageParam se aata hai, pehli call mein initialPageParam use hota hai
      const res = await fetch(`/api/posts?cursor=${pageParam ?? ""}`); // cursor-based pagination — cursor ko query param mein bheja
      if (!res.ok) throw new Error("Failed to fetch posts"); // error handling
      return res.json() as Promise<PostsPage>; // response ko typed page object mein parse kiya
    }, // queryFn close
    initialPageParam: null, // pehli fetch ke liye pageParam ka starting value (no cursor yet)
    getNextPageParam: (lastPage) => lastPage.nextCursor, // last fetched page se next cursor nikaala — null aane par "no more pages" maana jaata hai
  }); // useInfiniteQuery call close
} // hook close
```

Component mein use karna:

```tsx
function PostsFeed() { // button-click-based "Load More" pagination UI
  const { // hook se multiple values destructure kiye
    data,                  // { pages: PostsPage[], pageParams: unknown[] } shape mein saara fetched data
    fetchNextPage,         // next page trigger karne wala function
    hasNextPage,           // boolean — kya aur pages available hain (getNextPageParam ke last result se derive hota hai)
    isFetchingNextPage,    // next-page-specific loading flag — initial load se ALAG flag hai
  } = usePostsFeed(); // destructure kiya hamare custom hook se

  return ( // JSX return
    <div> {/* poore feed ka wrapper */}
      {data?.pages.map((page, i) => (            // har fetched page ko iterate kiya
        <React.Fragment key={i}> {/* key required hai list rendering ke liye, Fragment koi extra DOM node nahi banata */}
          {page.posts.map((post) => (             // har page ke andar ke posts render kiye
            <p key={post.id}>{post.title}</p>      // individual post render
          ))} {/* inner map close */}
        </React.Fragment> // fragment close
      ))} {/* outer map close */}
      {hasNextPage && (                            // aur pages hain toh hi button dikhao
        <button // load-more button
          onClick={() => fetchNextPage()}           // click pe next page fetch trigger
          disabled={isFetchingNextPage}              // already fetching ho toh double-click disable
        > {/* button attributes close */}
          {isFetchingNextPage ? "Loading more..." : "Load More"} {/* loading state ke hisaab se text */}
        </button>
      )} {/* conditional close */}
    </div>
  ); // return close
} // component close
```

Key insight: `data.pages` ek **array of arrays** jaisa structure hai — har fetched page apna alag entry hai, TanStack Query automatically inko sequence mein maintain karta hai, sequential-fetch order ko preserve karte hue (chahe underlying fetches kisi bhi order mein technically complete hue ho, wo request order maintain karta hai display ke liye). `isFetchingNextPage` ka `isLoading` se alag hona important hai — `isLoading` sirf **first-ever** fetch ke liye true hota hai; jab user "Load More" click karta hai, ye `isFetchingNextPage`, jo already-visible content ko disturb nahi karta (poora list re-loading spinner mein nahi chala jaata, sirf button ka state change hota hai).

**Infinite scroll ke saath integrate karna** — button-click ke bajaye, real feeds mein aksar user scroll karte-karte automatically next page load hoti hai. Iske liye ek intersection observer (ya `react-intersection-observer` library) ke saath list ke bottom pe ek "sentinel" element rakha jaata hai:

```tsx
function PostsFeed() { // scroll-triggered automatic pagination UI
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePostsFeed(); // same hook jo upar define kiya
  const { ref, inView } = useInView(); // react-intersection-observer ka hook — ref wale element ke viewport mein aane pe inView true hota hai

  useEffect(() => { // inView badalte hi ye check chalega
    if (inView && hasNextPage && !isFetchingNextPage) { // sentinel visible hai, aur next page hai, aur already fetch nahi chal rahi
      fetchNextPage(); // automatically next page load karo — user ko button click nahi karna pada
    } // if close
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]); // in sab dependencies change hone pe re-check karo

  return ( // JSX return
    <div> {/* poore feed ka wrapper */}
      {data?.pages.map((page, i) => (            // pages render, jaisa upar dikha
        <React.Fragment key={i}> {/* fragment key ke saath */}
          {page.posts.map((post) => <p key={post.id}>{post.title}</p>)} {/* individual posts */}
        </React.Fragment> // fragment close
      ))} {/* map close */}
      <div ref={ref} style={{ height: 1 }} /> {/* invisible sentinel — jab ye viewport mein aata hai, useInView trigger hota hai */}
    </div>
  ); // return close
} // component close
```

`!isFetchingNextPage` guard important hai — bina iske, jab tak sentinel viewport mein visible rehta hai, `fetchNextPage()` repeatedly call ho sakta hai (har render pe), duplicate requests fire karte hue. TanStack Query internally bhi ek guard rakhta hai (already-fetching state mein dusri `fetchNextPage()` call ko ignore kar deta hai), lekin explicit check likhna intent ko clear rakhta hai.

**Bidirectional pagination** — kabhi-kabhi tumhe upar (`getPreviousPageParam`) aur neeche (`getNextPageParam`) dono directions mein scroll support karna hota hai (jaise ek chat window jaha purane messages upar scroll karke load hote hain):

```tsx
useInfiniteQuery({ // bidirectional pagination — chat-window jaisa use-case
  queryKey: ["messages", chatId],  // cache key, chatId se scoped
  queryFn: ({ pageParam }) => fetchMessages(chatId, pageParam), // same queryFn, direction-agnostic
  initialPageParam: 0, // starting point
  getNextPageParam: (lastPage) => lastPage.nextCursor,     // aage (naye messages) ke liye cursor
  getPreviousPageParam: (firstPage) => firstPage.prevCursor, // peeche (purane messages) ke liye cursor
}); // call close
```

Return value mein `fetchPreviousPage`, `hasPreviousPage`, `isFetchingPreviousPage` bhi milte hain — exact same pattern jo `fetchNextPage` ke liye dekha, bas opposite direction ke liye.

---

## Real-World Gotchas

- **Query key mein saare relevant variables include karna bhool jaana** — sabse common production bug. Agar `useQuery({ queryKey: ["todos"], queryFn: () => fetchTodos({ status }) })` likha (status ko key mein include nahi kiya lekin `queryFn` ke andar use kiya), toh jab `status` prop change hoti hai, TanStack Query ko **pata hi nahi chalta** ki data refetch karna hai (kyunki key same reh gayi, "todos"), aur component **purane status ka stale data** dikhata rahega naye status ke liye. Fix simple hai: `queryKey: ["todos", status]` — key mein har wo variable daalo jispe `queryFn` ka result depend karta hai. Mental rule: "queryFn ke andar jo bhi external variable use hoti hai, wo queryKey mein bhi honi chahiye" (ESLint plugin `@tanstack/eslint-plugin-query` isko lint-time catch kar sakta hai).

- **`staleTime: 0` (ya default) ko har jagah leave karna aur excessive refetching complain karna.** Default `staleTime` hai `0` — matlab data **immediately** stale ho jaata hai fetch hone ke baad, aur har remount/refocus pe refetch trigger hota hai. Chhote apps mein ye fine hai (bandwidth-wise negligible), lekin agar tumhara query expensive hai (bada payload, slow endpoint) aur data rarely change hota hai, `staleTime: 0` ka matlab hai user tab switch karte hi har baar ek unnecessary network round-trip experience karta hai. Fix: query-specific `staleTime` set karo based on data ki actual freshness requirement, sab jagah default mat chhodo blindly.

- **`isLoading` aur `isFetching` ko confuse karna.** `isLoading` sirf true hota hai jab **koi cached data exist nahi karta** aur fetch chal raha hai (pehli baar ya cache-miss). `isFetching` true hota hai **har baar** jab koi fetch chal raha hai — chahe background refetch ho aur `data` already available ho cache se. Agar tum `isLoading` use karke poora page-level spinner dikhate ho, aur background refetch ke time bhi `isLoading` galti se true expect karte ho, tum wrong UX bana dete ho (existing content spinner se replace ho jaata hai jabki actually stale-while-revalidate pattern chahiye tha — purana data dikhao, background mein silently update karo). Rule: initial/empty-state loading ke liye `isLoading`, "background refresh ho raha hai" indicator (jaise ek chhota spinner icon corner mein) ke liye `isFetching`.

- **Mutations ke baad invalidation bhool jaana** — mutation successful hone ke baad agar related query invalidate nahi ki, list UI **stale reh jaata hai** jab tak koi unrelated remount na ho. Har mutation ke `onSuccess`/`onSettled` mein relevant `invalidateQueries` call check karne ki habit banao.

- **`QueryClient` ko component render ke andar create karna** — `const queryClient = new QueryClient()` agar component body mein likha (Provider ke andar, render function ke top pe), har re-render pe **naya QueryClient** banega, matlab poora cache reset ho jaayega. Ye instance module-level ya `useState(() => new QueryClient())` ke andar lazily-once create hona chahiye.

- **Mutation ko idempotent maan ke retry on kar dena** — jaisa mutations section mein dekha, `retry` default `0` hai mutations ke liye kisi wajah se. Agar backend idempotency-key support nahi karta aur tumne blindly `retry: 3` set kar diya "resilience ke liye," ek transient network glitch **duplicate side-effects** create kar sakta hai (do baar charge lagna, do baar todo create hona). Ye ek genuinely production-dangerous mistake hai jo silently, rarely reproduce hoti hai — isliye code review mein flag karna zaroori hai.

- **Server-driven pagination/filter state ko URL state ke saath sync na karna** — agar tumhara list page filters (`status`, `sortBy`) sirf local component state mein rakhta hai (na URL query params mein), user page refresh karega ya link share karega toh filters reset ho jaayenge. Ye TanStack Query ka bug nahi hai, lekin ek common integration mistake hai — query key ko URL search params se derive karo (`useSearchParams` Next.js/React Router mein) taaki cache key aur URL dono consistent rahen, aur deep-linking/refresh correctly kaam kare.

---

## Key Takeaways

- Naive `useEffect` + `fetch` pattern mein 5 concrete production problems hain — no caching, no deduplication, no retry, repeated boilerplate, aur race conditions (jo silently wrong data dikhate hain). TanStack Query ye sab default behavior se solve karta hai.
- **Server state ≠ client state.** Server state remote-owned, stale-able, sync-needing data hai — Redux/Zustand jaise client-state tools mein isko manually manage karna unnecessary reinvention hai.
- **Query keys array-based hain** aur partial-matching support karte hain — isi se broad ("todos" prefix) aur narrow (`["todos", {userId, status}]`) invalidation dono possible hoti hai.
- **`staleTime`** = kab tak data ko fresh treat karna hai (refetch trigger control karta hai). **`gcTime`** = kab tak UNUSED cached data memory mein rakhna hai (memory cleanup control karta hai). Dono independent concerns hain.
- **`invalidateQueries`** data ko stale mark karta hai aur agar active observer hai, immediate background refetch trigger karta hai — mutation ke baad list refresh karne ka standard pattern.
- **Optimistic updates** `onMutate` (immediate UI update + save previous value) → `onError` (rollback using saved value) → `onSettled` (final invalidation for source-of-truth sync) lifecycle se implement hote hain.
- **Background refetching** (`refetchOnWindowFocus`, `refetchOnReconnect`) polling ke bina "always fresh" UX deta hai — event-driven refresh, na ki interval-based.
- **`useInfiniteQuery`** cursor/page-based pagination ke liye designed hai, aur `isFetchingNextPage` ko `isLoading` se separate rakhna zaroori hai UX ke liye.
- Sabse common real-world bug: query key mein saari relevant dependencies include karna bhool jaana — isse stale data serve hota hai bina kisi visible error ke.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. `useEffect` + `useState` ke saath data fetching mein kya-kya specific problems hain jo TanStack Query solve karta hai?**
No caching (same data repeatedly refetch hoti hai remount pe), no request deduplication (multiple components same data ke liye separate requests fire karte hain), no automatic retry on transient failures, repeated loading/error boilerplate har component mein, aur sabse critical — race conditions jab fast-changing input (jaise search query) multiple in-flight requests fire karta hai aur ek purani request ka response ek nayi request ke response ko overwrite kar deta hai (out-of-order resolution), jisse UI silently wrong/stale data dikhata hai bina kisi error ke.

**Q2. Client state aur server state mein kya fundamental difference hai, aur ye distinction architecturally kyun matter karta hai?**
Client state app ke andar born hoti hai aur fully app-owned hai (modal open/closed, form input) — kabhi stale nahi hoti, koi async lifecycle nahi. Server state remote source se aati hai, external entities (doosre users, backend jobs) isko change kar sakte hain independently, ye stale ho sakti hai, aur isko caching/sync/invalidation ki zaroorat hoti hai. Ye distinction matter karta hai kyunki server state ko client-state tools (Redux/Zustand) mein manage karna matlab caching/dedup/staleness-tracking manually reimplement karna — jo TanStack Query jaisi dedicated library already solve kar chuki hai. Sahi architecture dono tools ko unke respective concerns ke liye use karta hai.

**Q3. `staleTime` aur `gcTime` mein exact difference batao, ek concrete example ke saath.**
`staleTime` control karta hai data kab tak "fresh" treat hota hai — jab tak fresh hai, remount/refocus pe refetch trigger nahi hoga, cache se turant serve hoga. `gcTime` control karta hai kab tak **unused** (koi active observer nahi) cached data memory mein rehta hai before deletion. Example: `staleTime: 30_000, gcTime: 300_000` ke saath — agar component 10 second baad unmount hota hai aur 15 second baad remount hota hai (total 25s elapsed, staleTime abhi cross nahi hua), fresh cache se instantly data milega. Agar remount 35 second baad hota hai (staleTime cross ho gaya), stale data turant dikhega but background refetch bhi fire hoga. Agar remount 6 minute baad hota hai (gcTime bhi cross ho gaya), cache mein data hi nahi bacha — fresh loading state se shuru hoga.

**Q4. `invalidateQueries` exactly kya karta hai, aur ye guaranteed immediate refetch trigger karta hai kya?**
`invalidateQueries` matching queries (key ya prefix se) ko "stale" mark karta hai. Agar koi active component currently us query ko observe kar raha hai, TanStack Query immediately background refetch trigger karta hai. Agar koi active observer nahi hai (query currently mounted nahi hai kisi bhi component mein), refetch **immediately nahi** hota — data sirf stale mark hota hai, aur jab next baar koi component subscribe karega, tabhi fresh fetch hoga. Isliye "guaranteed immediate refetch" nahi hai — ye observer-dependent lazy behavior hai.

**Q5. Optimistic update implement karte waqt `onMutate` mein `cancelQueries` call karna kyun zaroori hai?**
Agar `onMutate` ke time ek background refetch already in-flight hai (jo purane, pre-mutation data ke saath resolve hogi), aur wo refetch humari optimistic update ke baad resolve hoti hai, toh wo purane data se humari optimistic update ko silently overwrite kar degi — user ko lagega action revert ho gaya jabki actually ek race condition thi. `cancelQueries` is in-flight request ko cancel karta hai taaki optimistic update safely stand rahe jab tak `onSettled` ka final invalidation na chale.

**Q6. Agar mutation fail ho jaaye, optimistic update ko rollback kaise karte hain?**
`onMutate` callback mein, cache update karne se pehle, current (pre-update) value ko `queryClient.getQueryData()` se read karke ek context object mein return karte hain. `onError` callback ko ye context (as third argument) milta hai — usmein saved previous value ko `queryClient.setQueryData()` se wapas cache mein daal dete hain, effectively optimistic change ko undo karke.

**Q7. `refetchOnWindowFocus` kis problem ko solve karta hai, aur ye polling se better kyun hai?**
User tab ko background mein chhodkar wapas aata hai — us beech data server-side change ho sakta hai. `refetchOnWindowFocus` automatically stale data ko refresh kar deta hai jab tab focus hota hai, bina user ko manually refresh karna pade. Ye `setInterval`-based polling se better hai kyunki polling **fixed interval** pe hamesha network call karta hai (chahe tab background mein ho, chahe data change hua ho ya nahi) — resource-wasteful hai. Focus/reconnect-triggered refetch **event-driven** hai — sirf tab genuinely relevant ho (user actively dekh raha ho) tab refresh karta hai, aur sirf stale data ke liye (staleTime respect karta hai).

**Q8. `useInfiniteQuery` mein `getNextPageParam` ka role kya hai, aur `isLoading` vs `isFetchingNextPage` mein kya difference hai?**
`getNextPageParam` last fetched page se next page ka pointer (cursor ya page number) extract karta hai — jo agli `fetchNextPage()` call mein `queryFn` ko `pageParam` argument ke through milta hai. Ye function `null`/`undefined` return karke bata sakta hai "no more pages" (jisse `hasNextPage` false ho jaata hai). `isLoading` sirf true hota hai jab **koi bhi data cache mein nahi hai** aur first fetch chal raha hai. `isFetchingNextPage` specifically true hota hai jab ek additional page fetch ho rahi hai — existing pages already visible rehte hain, sirf "Load More" area mein loading indicator dikhta hai, poora list re-render/disappear nahi hota.

**Q9. Query key mein ek zaroori variable include karna bhool jaana kya bug produce karta hai? Real example do.**
Agar `queryFn` internally kisi variable (jaise `status` filter) pe depend karta hai lekin wo variable `queryKey` mein include nahi hai, TanStack Query us variable ke change ko detect nahi kar sakta — cache key same rehta hai, isliye naya fetch trigger hi nahi hota, aur component **purane variable-value ka stale data** dikhata rehta hai jab tak koi doosra unrelated trigger (jaise window refocus, jo staleTime expire hone pe refetch karega) na aa jaaye. Example: `useQuery({ queryKey: ["todos"], queryFn: () => fetchTodos({ userId }) })` — jab `userId` prop change hota hai, query key wahi "todos" rehti hai, toh **purane user ka data** naye user ke liye dikhta reh sakta hai. Fix: `queryKey: ["todos", userId]`.

**Q10. Zustand/Redux mein server data cache karna kyun "architectural mistake" consider kiya jaata hai — kya ye kaam nahi karega?**
Ye kaam karega — code compile hoga, feature functionally chalega. Problem ye hai ki tum manually wo sab reimplement karte ho jo TanStack Query already battle-tested tareeke se solve kar chuka hai: staleness tracking (kab refetch karna hai), request deduplication (multiple components same data maang rahe ho toh ek hi request), automatic retry, background refetch on focus/reconnect, aur cache garbage collection. Ye sab client-state tools mein "by hand" likhna extra maintenance burden banata hai, aur subtle bugs (jaise race conditions, jo section 1 mein dekhe) introduce karne ka risk badhata hai jinko TanStack Query ne already carefully handle kiya hua hai. Sahi approach: Redux/Zustand ko sirf genuine client state ke liye use karo, server state ke liye TanStack Query (ya RTK Query agar already Redux ecosystem mein deeply invested ho) use karo.
