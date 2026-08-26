# TypeScript for Frontend — Senior Depth

Bahut log TypeScript ko "JavaScript with types" kehke underestimate karte hain, aur uska sabse bada practical consequence ye hota hai ki wo TS ko galat use karte hain — jaise `any` ko har jagah spray karna, ya `as` se errors silence karna bina actual problem fix kiye. Is chapter mein hum TypeScript ke real value proposition se shuru karenge (aur usme se sabse bada misconception clear karenge — ki TS runtime pe kuch nahi karta), phir structural typing, generics, utility types, discriminated unions jaise patterns cover karenge jo har senior codebase mein daily use hote hain, aur end mein wo gotchas dekhenge jo production bugs banate hain jab TypeScript ko "trust" kiya jaata hai lekin galat jagah.

## Table of Contents

1. [Why TypeScript — The Actual Value Proposition](#why-typescript--the-actual-value-proposition)
2. [Structural Typing (Duck Typing) — TypeScript's Core Model](#structural-typing-duck-typing--typescripts-core-model)
3. [Generics — Why and How](#generics--why-and-how)
4. [Utility Types — The Ones You'll Actually Use](#utility-types--the-ones-youll-actually-use)
5. [Union Types and Discriminated Unions](#union-types-and-discriminated-unions)
6. [Type Narrowing](#type-narrowing)
7. [`interface` vs `type` — When to Use Which](#interface-vs-type--when-to-use-which)
8. [`unknown` vs `any` — Why `unknown` Is the Safer Escape Hatch](#unknown-vs-any--why-unknown-is-the-safer-escape-hatch)
9. [Strict Mode and Why It Matters](#strict-mode-and-why-it-matters)
10. [Real-World Gotchas](#real-world-gotchas)
11. [Key Takeaways](#key-takeaways)
12. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## Why TypeScript — The Actual Value Proposition

Ye sabse important concept hai poore chapter mein, aur agar ye clear nahi hai toh baaki sab misunderstand hoga: **TypeScript ka type checking sirf COMPILE time pe hota hai.** TypeScript code compile hoke plain JavaScript ban jaata hai — saare types, interfaces, generics **erase** ho jaate hain build step mein. Runtime pe browser ya Node koi bhi type check nahi karta, kyunki JavaScript engine ko TypeScript ke types ka pata hi nahi hota — usne kabhi dekha hi nahi.

```typescript
// ye TypeScript source code hai
interface User {
  id: number; // user ka numeric ID
  name: string; // user ka naam
}

function greet(user: User): string {
  // parameter type annotation — compiler isse check karega, runtime pe kuch nahi
  return `Hello, ${user.name}`; // string template, name field access kiya
}

// compile hone ke baad JavaScript output ye hoga:
// function greet(user) {              <- type annotation gayab ho gaya
//   return `Hello, ${user.name}`;     <- baaki logic same hai
// }
// koi "interface User" JS output mein exist nahi karta — poori tarah erase ho gaya
```

Iska sabse practical implication: **TypeScript tumhe kabhi bhi bad data se bachaata nahi jo runtime pe kahin bahar se (API, user input, localStorage) aata hai.** Agar tumne `User` type declare kiya hai aur API se response aaya jisme `name` field missing hai (server ka bug, ya breaking API change), TypeScript ise kabhi nahi pakdega — kyunki compile time pe TypeScript ko sirf pata hai ki **tumne khud** `fetch(...).then(r => r.json()) as User` likha, aur wo `as` assertion (section 8 mein detail) TS ko bata deta hai "trust me, ye User hi hai" — bina runtime pe validate kiye.

```typescript
type User = { id: number; name: string }; // expected shape

async function getUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`); // network call
  const data = await res.json(); // yahan tak data ka type hai `any` (JSON.parse ka return type)
  return data as User; // ye sirf TypeScript ko bata raha hai "assume karo ye User hai" — koi runtime check nahi ho raha
}

// agar server actually { id: 1 } bhejta hai (name missing), ye function
// bina kisi error ke `undefined` name ke saath User "return" kar dega
// TypeScript compile time pe khush hai — runtime pe crash "user.name.toUpperCase()" pe hoga
```

Toh phir TypeScript ka value kya hai, agar wo runtime pe kuch nahi karta? Teen genuinely bade wins hain:

1. **Bugs pakadna jo TUM khud karte ho, code likhte waqt hi** — jaise galat property naam type karna, function ko galat number of arguments dena, `null` ko forget karna handle karna (section 9 mein detail). Ye woh bugs hain jo JavaScript mein sirf runtime pe crash karke pakde jaate — TypeScript unhe editor mein hi red squiggly line se dikha deta hai, build hone se pehle.
2. **Self-documenting function signatures** — `function fetchUser(id: number): Promise<User>` khud bata deta hai kya lena hai, kya milega — bina docs padhe, bina function body padhe. Bade codebases mein (jahan tum kisi aur ka code use kar rahe ho) ye onboarding time drastically kam karta hai.
3. **IDE autocomplete aur refactoring safety** — jab TypeScript ko pata hai `user` ka type `User` hai, VSCode exact properties suggest karta hai (`user.` type karo, dropdown mein `id`, `name` dikhega, kuch aur nahi). Aur agar tum `User` interface mein `name` ko `fullName` rename karo, TypeScript **har jagah** jahan `.name` use ho raha tha wahan error dikhayega — jisse refactoring safe ho jaata hai bade codebase mein bhi. Plain JS mein ye rename manually grep karke karna padta, aur missed usages sirf runtime pe pata chalte.

**Senior framing**: TypeScript ek "compile-time contract enforcement tool" hai apne khud ke code ke against, external/untrusted data (API responses, form input, third-party libraries without types) ke liye tumhe alag se runtime validation chahiye (jaise Zod, Yup) — ye alag concern hai jo TypeScript solve nahi karta.

---

## Structural Typing (Duck Typing) — TypeScript's Core Model

Java, C# jaise languages **nominal typing** use karte hain — matlab ek class ko explicitly `implements SomeInterface` likhna padta hai taaki wo us interface ke compatible mane jaaye, chahe uska shape match hi kyun na ho. TypeScript **structural typing** use karta hai — koi bhi value kisi type ke "compatible" mani jaati hai agar uska **shape** (properties aur unke types) match karta hai, chahe usne explicitly kabhi wo interface declare hi na kiya ho. Isko "duck typing" bhi kehte hain — famous line: "agar ek cheez duck jaisi chalti hai, duck jaisi awaaz karti hai, toh wo duck hai" — matlab behavior/shape hi matter karta hai, declared identity nahi.

```typescript
// do completely UNRELATED types declare kiye — koi shared interface nahi, koi inheritance nahi
interface Point {
  x: number; // x coordinate
  y: number; // y coordinate
}

interface Coordinate {
  x: number; // same field naam, koi relation nahi Point se
  y: number; // same field naam
}

function printPoint(p: Point): void {
  console.log(`(${p.x}, ${p.y})`); // Point ka x, y print kar rahe hain
}

const coord: Coordinate = { x: 10, y: 20 }; // Coordinate type ka object banaya, Point ka koi zikar nahi

printPoint(coord); // YE VALID HAI! TypeScript error nahi dega
// kyun? kyunki Coordinate ka SHAPE Point ke shape se match karta hai — { x: number, y: number }
// TypeScript ko iska matter nahi ki declared type ka naam Point hai ya Coordinate, sirf shape check hota hai
```

```typescript
// extra properties bhi allowed hain jab tak required properties present hain (excess property checks alag topic hai, section 10 mein)
interface Named {
  name: string; // sirf ye field required hai
}

function greet(entity: Named): string {
  return `Hello, ${entity.name}`; // sirf name access ho raha hai
}

// ek poora "Employee" type banaya jisme Named se bahut zyada fields hain
type Employee = { name: string; salary: number; department: string }; // Named se koi explicit relation nahi

const emp: Employee = { name: "Priya", salary: 90000, department: "Engineering" }; // Employee object

greet(emp); // VALID — Employee ke paas "name: string" hai, baaki extra fields Named ke liye irrelevant hain
```

**Practical implication senior dev ke liye**: mock objects banate waqt tumhe kisi type ko explicitly "implement" karne ki zaroorat nahi — sirf matching shape do. Testing mein ye bahut useful hai — tum ek poora `User` object mock karne ke bajaye, sirf woh fields include karo jo function actually use karta hai (agar function ka parameter type usi subset ko expect karta ho). Lekin isi flexibility ka downside bhi hai — kabhi kabhi ek galat shape wala object accidentally "compatible" ho jaata hai jab wo semantically nahi hona chahiye tha (jaise `UserId` aur `ProductId` dono `number` type ke hain, toh dono interchangeable hain TypeScript ke liye, jo bug-prone hai — iska solution "branded types" hai, jo isse aage ka topic hai).

---

## Generics — Why and How

Problem jo generics solve karte hain: socho tumhe ek function chahiye jo **multiple types** ke saath kaam kare, bina type safety khoye. `any` use karna easiest lagta hai, lekin `any` matlab **poori type safety gayab** — TypeScript us value pe kuch bhi allow kar dega, chahe wo galat ho.

```typescript
// BAD APPROACH — `any` use karke "generic" banaya
function wrapInArray(value: any): any[] {
  return [value]; // value ko array mein wrap kiya
}

const numbers = wrapInArray(42); // return type hai any[] — TypeScript ko pata hi nahi ki andar numbers hain
numbers[0].toUpperCase(); // YE COMPILE HO JAAYEGA! kyunki return type `any[]` hai, TS koi check nahi karega
// runtime pe crash: "42.toUpperCase is not a function" — TypeScript ne isse pakadna chahiye tha, lekin `any` ki wajah se nahi pakda
```

Generics is problem ko solve karte hain — ek **type variable** (convention se `T` naam diya jaata hai) function declare hone ke time nahi, balki **call hone ke time** decide hota hai, aur TypeScript us type ko end-to-end track karta hai:

```typescript
// GOOD APPROACH — generic type parameter <T> use kiya
function wrapInArray<T>(value: T): T[] {
  // T jo bhi type ho, return type usi T ka array hoga — relationship preserved hai
  return [value]; // value ko array mein wrap kiya, type information kho nahi
}

const numbers = wrapInArray(42); // TypeScript infer karta hai T = number (argument dekh ke), toh return type number[] hai
numbers[0].toUpperCase(); // COMPILE ERROR! "Property 'toUpperCase' does not exist on type 'number'"
// TypeScript ne sahi jagah pe pakad liya, build time pe hi — exactly jo `any` version fail hua tha karne mein
```

### Full example — generic `fetchJSON<T>()` wrapper

Ye pattern real projects mein bahut common hai — ek generic fetch wrapper jisse caller apna expected type specify karta hai, aur unhe wapas properly-typed data milta hai (raw `any` nahi):

```typescript
// generic fetch wrapper — T caller decide karega ki response ka shape kya expect kar rahe hain
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  // options optional hai — agar caller extra fetch config (headers, method) dena chahe
  const response = await fetch(url, options); // actual network request

  if (!response.ok) {
    // HTTP-level error check — fetch khud throw nahi karta status errors pe
    throw new Error(`Request to ${url} failed with status ${response.status}`); // descriptive error throw kiya
  }

  const data: unknown = await response.json(); // JSON parse kiya, type ko explicitly `unknown` rakha (safe default, section 8)
  return data as T; // yahan caller ke bataye T mein cast kar rahe hain — ye "trust boundary" hai (runtime validation nahi hai, section 1 dekho)
}

// caller side — type argument explicitly specify kiya <User>
type User = { id: number; name: string; email: string }; // expected shape

async function loadUser(id: number): Promise<User> {
  // fetchJSON<User> call kiya — T = User set kiya explicitly
  const user = await fetchJSON<User>(`/api/users/${id}`); // TypeScript ko pata hai return type User hai
  console.log(user.email); // autocomplete kaam karega, aur galat property (jaise user.emial) compile error dega
  return user; // typed User return kiya
}

// TypeScript T ko caller ke argument se bhi INFER kar sakta hai, explicit specify karna zaroori nahi hamesha
type Post = { id: number; title: string }; // dusra shape

async function loadPosts(): Promise<Post[]> {
  // yahan bhi explicit <Post[]> diya, kyunki fetchJSON ke andar koi argument nahi jisse T infer ho sake
  return fetchJSON<Post[]>("/api/posts"); // array of Post return hoga
}
```

**Senior note**: `fetchJSON<T>` khud data ko **validate** nahi karta — wo `as T` sirf ek compile-time cast hai (section 1 ka wahi caveat). Agar tumhe runtime safety chahiye (API ka shape actually match kare ya nahi), Zod jaisi library ka `schema.parse(data)` use karo jo runtime pe check karta hai aur agar mismatch ho toh throw karta hai — TypeScript ke generics sirf **compile-time** type flow manage karte hain.

---

## Utility Types — The Ones You'll Actually Use

TypeScript built-in utility types deta hai jo existing types se **naye types derive** karne ke liye hain, bina duplicate declaration ke. Ye 5 senior codebases mein sabse zyada dikhte hain:

```typescript
// base type — poora User shape
type User = {
  id: number; // unique identifier
  name: string; // display naam
  email: string; // login email
  password: string; // hashed password — sensitive field, kabhi client ko nahi jaana chahiye
};
```

### `Partial<T>` — saare fields optional bana deta hai

```typescript
// PATCH request body ke liye perfect use case — user sirf jo fields change karna chahta hai wahi bhejega
type UserPatchBody = Partial<User>; // ye equivalent hai: { id?: number; name?: string; email?: string; password?: string }

async function updateUser(id: number, patch: UserPatchBody) {
  // patch mein koi bhi subset of fields ho sakta hai, ya empty object bhi (edge case handle karna padega)
  await fetch(`/api/users/${id}`, {
    method: "PATCH", // partial update verb
    headers: { "Content-Type": "application/json" }, // JSON body
    body: JSON.stringify(patch), // jo bhi fields caller ne diye, wahi serialize honge
  });
}

updateUser(42, { email: "new@example.com" }); // VALID — sirf email diya, baaki fields optional hain Partial ki wajah se
```

### `Required<T>` — saare fields ko mandatory bana deta hai (opposite of Partial)

```typescript
// socho ek config type jisme kuch fields optional declared hain, lekin runtime validation ke baad sab guaranteed hain
type Config = {
  apiUrl?: string; // optional in raw declaration
  timeout?: number; // optional in raw declaration
};

// validation function ke baad hum guarantee karna chahte hain ki sab fields present hain
function validateConfig(config: Config): Required<Config> {
  if (!config.apiUrl || !config.timeout) {
    // runtime check — actual values present hain ya nahi
    throw new Error("Config incomplete"); // agar missing hai, throw karo
  }
  return config as Required<Config>; // ab TypeScript ko bata rahe hain ki sab fields definitely present hain
}
```

### `Pick<T, K>` — sirf specific fields select karke naya type banata hai

```typescript
// login form ke liye sirf email/password chahiye, poora User type nahi
type LoginCredentials = Pick<User, "email" | "password">; // equivalent: { email: string; password: string }

function login(credentials: LoginCredentials) {
  // sirf email, password expect karta hai — id, name jaise irrelevant fields yahan allowed hi nahi
  console.log(credentials.email); // valid access
}
```

### `Omit<T, K>` — specific fields hata ke baaki sab rakhta hai (opposite of Pick)

```typescript
// public-facing API response — password field kabhi client ko expose nahi karna
type PublicUser = Omit<User, "password">; // equivalent: { id: number; name: string; email: string }

function toPublicUser(user: User): PublicUser {
  const { password, ...publicFields } = user; // destructure karke password ko alag kiya, rest spread mein baaki fields
  return publicFields; // password field object mein hi nahi hai ab, TypeScript bhi enforce karta hai iska shape
}

// senior insight: Omit compile-time pe hi enforce karta hai ki accidentally password field return na ho jaaye
// agar koi future dev User mein naya sensitive field add kare aur bhool jaaye Omit list update karna,
// wo field abhi bhi PublicUser mein aa jaayega — isliye critical fields ke liye Pick zyada safe hai (allowlist > denylist)
```

### `Record<K, V>` — key-value map type banata hai, jahan keys ka set known ho

```typescript
// enum jaisa union type — possible statuses
type OrderStatus = "pending" | "shipped" | "delivered" | "cancelled"; // fixed set of string literals

// Record<K, V> — har status ke liye ek display label chahiye, TypeScript ENFORCE karega ki SAB statuses covered hain
const statusLabels: Record<OrderStatus, string> = {
  pending: "Order Placed", // pending ka label
  shipped: "On the Way", // shipped ka label
  delivered: "Delivered", // delivered ka label
  cancelled: "Cancelled", // cancelled ka label
  // agar yahan koi status missing ho (jaise "cancelled" bhool jaao), TypeScript COMPILE ERROR dega
  // aur agar ek extra invalid key ho (jaise "refunded" jo OrderStatus mein nahi hai), wo bhi error dega
};

function getLabel(status: OrderStatus): string {
  return statusLabels[status]; // safe access — TypeScript ko guarantee hai ki key exist karti hai
}
```

**Senior takeaway**: `Record` ka real power ye hai ki agar tum `OrderStatus` union mein naya status add karo (jaise `"refunded"`), aur `statusLabels` object update karna bhool jaao, **TypeScript build fail kar dega** — kyunki `Record<OrderStatus, string>` ke according har key mandatory hai. Ye exhaustiveness checking ka ek form hai (discriminated union ke `switch` exhaustiveness se related, next section dekho).

---

## Union Types and Discriminated Unions

Union type ka simplest form — ek value **multiple possible types** mein se koi ek ho sakti hai:

```typescript
type Status = "loading" | "success" | "error"; // string literal union — sirf ye 3 exact values valid hain

function renderStatus(status: Status) {
  if (status === "loading") console.log("Loading..."); // "loading" case
  else if (status === "success") console.log("Done!"); // "success" case
  else console.log("Failed"); // sirf "error" bacha hai — TypeScript ko pata hai exhaustive hai
}

renderStatus("pending"); // COMPILE ERROR — "pending" Status union mein hai hi nahi, typo ya galat value pakad liya
```

Ye simple union kaafi hai jab har state independent hai, lekin real-world async states mein har status ke saath **different data** associated hoti hai — jaise "success" ke paas data hoga, "error" ke paas error message hoga, lekin "loading" ke paas kuch nahi. Yahan **discriminated union** pattern kaam aata hai — ek common literal "tag" field (usually `status` ya `type` naam ka) use karke TypeScript ko exact shape narrow karne dena har branch mein.

```typescript
// discriminated union — teen possible shapes, har ek ka apna "status" tag hai jo unique hai
type ApiResponse<T> =
  | { status: "loading" } // loading state mein koi data/error field hi nahi hai
  | { status: "success"; data: T } // success state mein sirf `data` field hai
  | { status: "error"; error: string }; // error state mein sirf `error` field hai

function handleResponse<T>(response: ApiResponse<T>) {
  switch (response.status) {
    // discriminant field pe switch kiya — TypeScript "status" ki value dekh ke poora shape narrow karta hai
    case "loading":
      console.log("Fetching..."); // is branch mein TS ko pata hai response ka type { status: "loading" } hai
      // response.data yahan likhna COMPILE ERROR dega — loading shape mein data field exist nahi karta
      break; // switch case end

    case "success":
      console.log("Data:", response.data); // is branch mein TS ko pata hai response mein `data: T` guaranteed hai
      // response.error yahan likhna COMPILE ERROR dega — success shape mein error field nahi hai
      break; // switch case end

    case "error":
      console.error("Error:", response.error); // is branch mein TS ko pata hai response mein `error: string` guaranteed hai
      break; // switch case end

    default:
      // exhaustiveness check — agar future mein naya status add ho (jaise "cancelled") aur yahan handle na ho,
      // ye default branch trigger hoga aur agar `never` assign kiya jaaye, compile error milega (neeche dekho)
      const _exhaustiveCheck: never = response; // agar response ka type yahan `never` nahi hai, matlab koi case miss hua
      break; // switch case end
  }
}
```

### Usage — React component mein async state modeling

```typescript
import { useEffect, useState } from "react"; // hooks import kiye

type User = { id: number; name: string }; // user shape
type UserState = ApiResponse<User>; // discriminated union reuse kiya, T = User

function UserProfile({ userId }: { userId: number }) {
  const [state, setState] = useState<UserState>({ status: "loading" }); // initial state — loading

  useEffect(() => {
    setState({ status: "loading" }); // naya userId aane pe reset kiya loading pe
    fetch(`/api/users/${userId}`) // fetch call
      .then((res) => res.json()) // JSON parse
      .then((data: User) => setState({ status: "success", data })) // success shape set kiya, data field ke saath
      .catch((err) => setState({ status: "error", error: String(err) })); // error shape set kiya
  }, [userId]); // userId change pe re-fetch

  if (state.status === "loading") return <p>Loading...</p>; // narrow ho gaya loading shape mein
  if (state.status === "error") return <p>Error: {state.error}</p>; // narrow ho gaya error shape mein, error field access safe
  return <p>{state.data.name}</p>; // yahan tak pahunche matlab sirf "success" bacha hai, data.name safely accessible
}

export default UserProfile; // component export kiya
```

**Kyun ye powerful pattern hai**: simple union (`Status` jaisa upar) mein tumhe manually yaad rakhna padta ki "success" state mein `data` field kahan se aayegi — usually ek alag optional field (`data?: User`) jo **har state mein technically present** hota hai, chahe wo relevant ho ya nahi (jaise loading state mein bhi `data` field exist karega, `undefined` value ke saath). Discriminated union isse eliminate karta hai — har shape ka apna exact set of fields hai, aur TypeScript automatically detect karta hai kaun se fields kis branch mein safe hain, bina manual `if (state.data)` null checks ke.

---

## Type Narrowing

Type narrowing ka matlab — TypeScript runtime checks (jaise `typeof`, `instanceof`, truthy checks) ko dekh ke automatically ek broader type ko **narrower, specific type** mein "narrow" kar deta hai us check ke andar wale code block mein.

```typescript
// typeof narrowing — primitive types ke liye
function formatValue(value: string | number): string {
  if (typeof value === "string") {
    // is block ke andar TypeScript ko pata hai value definitely `string` hai
    return value.toUpperCase(); // string methods safely accessible, TS ne narrow kar diya
  }
  // yahan tak pahunche matlab typeof check false tha, TS ko pata hai value ab `number` hai
  return value.toFixed(2); // number methods safely accessible
}
```

```typescript
// instanceof narrowing — class instances ke liye
class ApiError extends Error {
  status: number; // extra field jo generic Error mein nahi hota
  constructor(message: string, status: number) {
    super(message); // parent constructor call
    this.status = status; // status set kiya
  }
}

function handleError(err: Error | ApiError) {
  if (err instanceof ApiError) {
    // is block ke andar TypeScript ko pata hai err specifically ApiError hai, extra field bhi accessible
    console.log(`API error with status ${err.status}`); // .status safely accessible, plain Error mein nahi hota
  } else {
    console.log(`Generic error: ${err.message}`); // yahan sirf base Error fields accessible hain
  }
}
```

```typescript
// truthy narrowing — null/undefined eliminate karne ke liye
function greetUser(name: string | null) {
  if (!name) {
    // falsy check — name null ya empty string dono cases cover karta hai
    console.log("Hello, guest"); // fallback path
    return; // early return
  }
  // yahan tak pahunche matlab name truthy hai — TypeScript ne `null` possibility eliminate kar di
  console.log(`Hello, ${name.toUpperCase()}`); // .toUpperCase() safely callable, null nahi ho sakta ab
}
```

### Custom type guard functions

Kabhi kabhi built-in checks (`typeof`, `instanceof`) kaafi nahi hote — jaise ek plain object ka shape check karna. Yahan **custom type guard** likhte hain — ek function jo `x is SomeType` return type use karta hai, jisse TypeScript samajh jaata hai ki is function ka `true` return matlab narrowing ho sakti hai:

```typescript
type User = { id: number; name: string }; // shape jo hum check karna chahte hain
type Admin = { id: number; name: string; permissions: string[] }; // extra field wala shape

// custom type guard — return type "x is Admin" TypeScript ko batata hai ki
// agar ye function true return kare, caller ke andar x ko Admin maano
function isAdmin(x: User | Admin): x is Admin {
  return "permissions" in x; // runtime check — "permissions" property object mein exist karti hai ya nahi
}

function describeUser(user: User | Admin) {
  if (isAdmin(user)) {
    // TypeScript custom guard ke `x is Admin` signature ki wajah se yahan narrow kar deta hai
    console.log(`Admin with ${user.permissions.length} permissions`); // .permissions safely accessible
  } else {
    console.log(`Regular user: ${user.name}`); // yahan TypeScript ko pata hai ye plain User hai
  }
}
```

**Senior note**: custom type guard ke andar ka runtime check **tumhari responsibility** hai ki sahi ho — TypeScript sirf tumhare declared `x is Admin` signature ko **trust** karta hai, wo khud verify nahi karta ki tumhara check logically correct hai. Agar tum galat check likho (jaise `"permissions" in x` ke bajaye kuch unrelated check), TypeScript still narrow kar dega — aur ye ek silent bug source ban sakta hai jo bahut subtle hota hai debug karna.

---

## `interface` vs `type` — When to Use Which

Ye ek bahut common interview/debate topic hai, aur senior-level jawab "dono same hain" nahi hai — real differences hain, lekin practical impact mostly narrow use-cases mein hoti hai.

```typescript
// dono se equivalent object shape define kar sakte ho — simple cases mein no real difference
interface UserInterface {
  id: number; // field
  name: string; // field
}

type UserType = {
  id: number; // same field
  name: string; // same field
};
```

### Difference 1 — Declaration merging (sirf `interface` kar sakta hai)

```typescript
// interface ko multiple baar declare karo, TypeScript automatically MERGE kar deta hai
interface Window {
  myCustomProperty: string; // ek jagah declare kiya
}

interface Window {
  anotherProperty: number; // dusri jagah declare kiya (jaise kisi doosri .d.ts file mein)
}

// final merged type: Window ke paas ab dono properties hain (myCustomProperty aur anotherProperty)
// ye pattern global types extend karne ke liye common hai (jaise third-party library ke ambient types)

// type alias ke saath yahi try karo:
type Config = { apiUrl: string }; // pehli declaration
// type Config = { timeout: number }; // COMPILE ERROR — "Duplicate identifier 'Config'", merge NAHI hota
```

### Difference 2 — sirf `type` union/intersection/mapped types express kar sakta hai

```typescript
// union type — sirf `type` se possible, interface se nahi
type Status = "loading" | "success" | "error"; // interface ye express nahi kar sakta

// intersection type — dono types ko combine kiya
type WithTimestamps = { createdAt: string; updatedAt: string }; // timestamp fields
type UserRecord = UserType & WithTimestamps; // & se intersection — UserRecord ke paas dono ke fields hain

// mapped type — existing type ke properties ko transform karke naya type banaya
type ReadonlyUser = { readonly [K in keyof UserType]: UserType[K] }; // har field ko readonly bana diya, keyof se keys iterate ki
```

### Senior pragmatic answer

Simple object shapes ke liye **koi bhi use karo**, real difference nahi padta. Lekin practical rule of thumb:

- **`type` use karo** jab tumhe union types, intersection types, ya mapped types express karne hain — `interface` ye simply kar hi nahi sakta.
- **`interface` use karo** jab tum ek **public API surface** design kar rahe ho (jaise ek library ka exported type, ya ek component ka `Props` type) jise future mein koi consumer **extend** kar sakta hai — declaration merging aur `extends` keyword (jo interface mein zyada natural feel hota hai) is use case ke liye better fit hain.

```typescript
// interface extends karna syntactically clean hai
interface BaseProps {
  className?: string; // common prop
}
interface ButtonProps extends BaseProps {
  onClick: () => void; // button-specific prop
}

// type ke saath bhi ho sakta hai (intersection se), lekin thoda less idiomatic feel hota hai object shapes ke liye
type ButtonPropsAlt = BaseProps & { onClick: () => void }; // functionally equivalent
```

Kai large codebases (jaise React ka apna type system) historically `interface` ko component Props ke liye prefer karte aaye hain, lekin modern teams mein `type` bhi equally common hai — **consistency within a team/codebase** zyada matter karta hai is choice ke absolute "correctness" se.

---

## `unknown` vs `any` — Why `unknown` Is the Safer Escape Hatch

`any` type checking ko **poori tarah disable** kar deta hai us value ke liye — TypeScript us value pe **kuch bhi** allow karega, chahe wo galat ho. Aur ye **contagious** hai — jo bhi value `any` ko touch karti hai, wo bhi implicitly `any` ban jaati hai, jisse type safety poore codebase mein spread hoke gayab ho sakti hai.

```typescript
// `any` — bug silently through nikal jaata hai
function processData(data: any) {
  return data.toUpperCase(); // TypeScript kuch bhi check nahi karega — data ke paas toUpperCase ho ya na ho
}

processData(42); // COMPILES FINE — koi error nahi milega
// RUNTIME CRASH: "42.toUpperCase is not a function" — TypeScript ne bilkul kuch nahi pakda, jo iska poora point tha
```

`unknown` bhi "kisi bhi type ki value ho sakti hai" represent karta hai, lekin farq ye hai — TypeScript tumhe **force** karta hai ki value ko use karne se pehle uska type **narrow/check** karo. Bina check kiye kuch bhi operation (method call, property access) allowed hi nahi hai.

```typescript
// `unknown` — bug COMPILE TIME pe pakda jaata hai
function processData(data: unknown) {
  return data.toUpperCase(); // COMPILE ERROR: "Object is of type 'unknown'" — TypeScript operation allow nahi karega
}

// sahi approach — narrow karna zaroori hai use karne se pehle
function processDataSafe(data: unknown): string {
  if (typeof data === "string") {
    // type narrowing (section 6) — is block ke andar TS ko pata hai data ek string hai
    return data.toUpperCase(); // ab safely callable
  }
  throw new Error("Expected a string"); // agar type match nahi hua, explicitly handle kiya
}

processDataSafe(42); // COMPILE ERROR yahan nahi milega (function accepts unknown), lekin RUNTIME pe clean error throw hoga
// "Expected a string" — controlled failure, silent wrong behavior nahi
```

**Senior rule**: jab bhi koi value ka type genuinely unknown hai compile time pe (jaise `JSON.parse()` ka return, ya external library se aayi hui untyped data), `unknown` use karo `any` ke bajaye. `unknown` tumhe **force** karta hai explicit runtime check likhne ke liye pehle use karne se, jo exactly wo safety net hai jo `any` remove kar deta hai. `any` sirf tab acceptable hai jab genuinely migration ke beech mein ho (legacy JS code ko gradually TypeScript mein convert kar rahe ho) ya kisi third-party library ke types itne broken hain ki koi behtar option nahi — aur inhe bhi ideally isolated, well-commented jagah pe rakhna chahiye, spread nahi hone dena chahiye.

---

## Strict Mode and Why It Matters

`tsconfig.json` mein `"strict": true` set karna ek **bundle of stricter checks** enable karta hai ek single flag se — individually inhe on/off kiya ja sakta hai, lekin `strict: true` sabse recommended default hai naye projects ke liye.

```json
{
  "compilerOptions": {
    "strict": true // ye ek flag kai stricter checks enable karta hai, jinme se sabse impactful strictNullChecks hai
  }
}
```

`strict: true` andar ye sab enable karta hai (kuch important ones): `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, aur kuch aur. Inme se **`strictNullChecks` sabse zyada impactful** hai:

```typescript
// STRICT MODE OFF (strictNullChecks: false) — DANGEROUS
function getUserName(user: { name: string } | null): string {
  return user.name; // ⚠️ bina strict mode ke, ye COMPILE HO JAATA HAI bina kisi warning ke
  // kyunki null/undefined silently kisi bhi type ko assignable maane jaate hain — matlab
  // `user` yahan type-wise "{ name: string }" treat hota hai, `null` possibility ignore ho jaati hai
}

getUserName(null); // RUNTIME CRASH: "Cannot read properties of null (reading 'name')"
// TypeScript ne is bug ko bilkul nahi pakda, jabki iska exact type signature mein "| null" tha
```

```typescript
// STRICT MODE ON (strictNullChecks: true) — SAFE
function getUserName(user: { name: string } | null): string {
  return user.name; // ✅ COMPILE ERROR: "Object is possibly 'null'"
  // TypeScript force kar raha hai ki null case explicitly handle karo, isse aage badhne se pehle
}

// sahi version — null explicitly handle kiya
function getUserNameSafe(user: { name: string } | null): string {
  if (user === null) {
    // explicit null check — strict mode ye likhne ko FORCE karta hai
    return "Unknown"; // fallback value
  }
  return user.name; // yahan tak pahunche matlab TypeScript ne narrow kar diya, user null nahi ho sakta
}
```

**Kyun ye itna impactful hai**: bina `strictNullChecks` ke, `null` aur `undefined` **silently assignable** hote hain kisi bhi type ko — matlab tumhara `string` type actually secretly `string | null | undefined` ho sakta hai kisi bhi jagah se, aur TypeScript kuch nahi bolega. Ye poora "TypeScript ne guarantee kiya ki ye field definitely present hai" wala value proposition **defeat** kar deta hai — jo TypeScript ka sabse practical, daily-use benefit hai (null pointer exceptions catch karna build time pe).

### Senior advice — strict mode se shuru karo, retrofit mat karo

Naye project mein `strict: true` **din 1 se** enable karna chahiye. Reason simple hai — jitna zyada code likha jaayega bina strict mode ke, utne zyada jagah `null`/`undefined` ke implicit assumptions ban jaate hain, jinhe fix karna baad mein exponentially painful ho jaata hai. Ek 200,000-line legacy codebase mein `strictNullChecks` retrofit karna matlab **sainkdon jagah** compile errors aana ek saath, jinhe manually review karke fix karna padta hai (kya yahan actually null aa sakta hai, ya sirf TypeScript ko satisfy karne ke liye `!` laga do — jo aage section 10 ka gotcha hai). Bahut teams isi wajah se legacy codebase ko strict mode mein migrate karne se avoid karte hain — cost bahut zyada lagta hai upfront, chahe long-term benefit clear ho.

---

## Real-World Gotchas

- **Type assertions (`as SomeType`) ka overuse — errors ko "silence" karna, fix nahi karna.** Jab TypeScript error deta hai aur developer, actual type mismatch samajhne/fix karne ke bajaye, seedha `as SomeType` laga deta hai taaki error gayab ho jaaye — ye **anti-pattern** hai kyunki `as` sirf compiler ko batata hai "trust me", koi runtime check nahi karta. Isse exactly wahi runtime risk reintroduce hoti hai jo TypeScript prevent karne ke liye tha. Jab bhi `as` use karne ka mann ho, pehle socho — "kya ye type mismatch genuine bug hai jo fix hona chahiye, ya genuinely main sahi hoon aur TypeScript ka inference limitation hai?" Sirf doosre case mein `as` justified hai.

  ```typescript
  // ANTI-PATTERN — error ko silence kiya, root cause fix nahi kiya
  function getFirstChar(value: string | number): string {
    return (value as string)[0]; // ⚠️ agar value actually number hai, [0] undefined return karega ya galat behavior dega
  }
  ```

- **Runtime pe TypeScript types exist nahi karte — `instanceof` kisi `interface` pe kaam nahi karega.** `interface`/`type` sirf compile-time constructs hain, JS output mein erase ho jaate hain (section 1 recap). Isliye `if (x instanceof SomeInterface)` likhna **compile error** dega — `instanceof` ko ek actual runtime value (class) chahiye, jo `interface` provide nahi karta.

  ```typescript
  interface Shape {
    area: number; // interface — sirf compile-time construct
  }

  function check(x: unknown) {
    if (x instanceof Shape) {
      // ❌ COMPILE ERROR: "'Shape' only refers to a type, but is being used as a value here"
      console.log("valid shape"); // Shape ek interface hai, runtime pe exist hi nahi karta
    }
  }
  // fix: agar runtime check chahiye, class use karo (jo actual JS mein compile hoti hai), ya custom type guard function (section 6)
  ```

- **Non-null assertion operator (`!`) ka overuse — "TypeScript ne bola safe hai" but runtime crash.** `value!` TypeScript ko batata hai "trust me, ye null/undefined nahi hai" — bina kisi actual check ke. Jaise `as`, ye bhi ek unchecked promise hai. Common source: `document.getElementById("root")!` — agar element genuinely DOM mein exist na kare (typo id mein, ya conditional rendering), runtime crash hoga "Cannot read properties of null", aur TypeScript ne "permission" de di thi is crash ko hone ke liye.

  ```typescript
  const el = document.getElementById("root")!; // "!" TypeScript ko bata raha hai ye null nahi hoga — koi guarantee runtime pe nahi hai
  el.innerHTML = "Hello"; // agar el actually null hai, YE LINE CRASH karegi
  // safer approach: explicit null check karo, ya throw karo meaningful error message ke saath
  const elSafe = document.getElementById("root");
  if (!elSafe) throw new Error("Root element not found — check index.html"); // explicit, debuggable failure
  ```

- **`unknown` se aane wala API response ko bina schema validation ke `as T` karna** — section 3 aur 8 dono ka combination gotcha hai. `fetchJSON<T>()` jaisa generic wrapper convenient hai, lekin remember karo ki `as T` sirf compile-time hai — production mein Zod/Yup jaisa runtime schema validator use karo jab data genuinely external/untrusted source se aa raha ho (especially payment, auth, ya critical business logic involving APIs).

- **Discriminated union ka `switch` exhaustiveness check bhool jaana** — agar naya union member add karo (jaise `ApiResponse` mein `"cancelled"` status) aur `default` case mein `never` assignment check (section 5 dekho) nahi lagaya, TypeScript silently naya case handle nahi karne dega, aur bug production tak pahunch sakta hai bina compile-time warning ke.

---

## Key Takeaways

- TypeScript ka type checking **compile-time only** hai — types build step mein erase ho jaate hain, runtime pe koi enforcement nahi hoti. External/untrusted data ke liye runtime validation (Zod/Yup) alag se chahiye.
- TypeScript **structural typing** use karta hai (duck typing) — value ka shape match karna kaafi hai compatibility ke liye, explicit interface implementation ki zaroorat nahi (Java/C# ke nominal typing se different).
- Generics `any` ke bina multiple types ke saath kaam karne dete hain, bina type information kho — `fetchJSON<T>()` jaisa pattern har real project mein useful hai.
- Utility types (`Partial`, `Required`, `Pick`, `Omit`, `Record`) existing types se derived types banate hain, duplication avoid karte hain — `Omit<User, 'password'>` jaisa pattern public API types ke liye standard hai.
- Discriminated unions (common literal tag field ke saath) TypeScript ko exact shape narrow karne dete hain har `switch` branch mein — async/API response states model karne ka sabse robust pattern hai.
- Type narrowing (`typeof`, `instanceof`, truthy checks, custom type guards `x is T`) TypeScript ko runtime checks ke basis pe automatically types refine karne dete hain.
- `interface` aur `type` mostly interchangeable hain simple shapes ke liye — union/mapped types ke liye `type` mandatory hai, extensible public APIs ke liye `interface` (declaration merging) better fit hai.
- `unknown` `any` se safer hai kyunki wo use karne se pehle explicit type check force karta hai — `any` silently sab type safety disable kar deta hai aur contagious hota hai.
- `strict: true` (especially `strictNullChecks`) din 1 se enable karo — retrofit karna bahut zyada painful hai bade codebase mein, aur bina isse null/undefined bugs silently through nikal jaate hain.
- Type assertions (`as`) aur non-null assertions (`!`) genuine root-cause fixes ke substitute nahi hain — overuse exactly wo runtime risk reintroduce karta hai jo TypeScript prevent karne ke liye tha.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. TypeScript runtime pe kya karta hai — kya wo API se aaye galat data ko catch kar sakta hai?**

Nahi. TypeScript ka type checking **sirf compile time** pe hota hai — build step mein saare types erase ho jaate hain, aur output plain JavaScript hota hai jisme koi type information exist nahi karti. Isliye agar API se aane wale response ka shape expected type se match nahi karta (server bug, breaking change), TypeScript ise runtime pe kabhi nahi pakdega — ye sirf tumhare khud likhe hue code mein mistakes (galat property access, galat argument count) pakadta hai. External/untrusted data ke liye runtime validation (jaise Zod schema parsing) alag se implement karni padti hai.

**Q2. Structural typing kya hai, aur ye Java/C# ke nominal typing se kaise different hai?**

Nominal typing (Java/C#) mein ek class ko explicitly `implements SomeInterface` declare karna padta hai taaki compatible mana jaaye — declared identity matter karti hai. TypeScript structural typing use karta hai — koi bhi value type-compatible mani jaati hai agar uska **shape** (properties aur unke types) required shape se match kare, chahe usne kabhi wo interface explicitly declare na kiya ho. Isse do completely unrelated types interchangeable ho sakte hain agar unka structure same hai.

**Q3. Generics ka use case `any` se kaise better hai — concrete example do.**

`any` type checking poori tarah disable kar deta hai — function `wrapInArray(value: any): any[]` return karega jisme TypeScript ko andar ke actual type ka koi idea nahi hoga, isliye galat operation (jaise number pe `.toUpperCase()`) bhi silently compile ho jaayega. Generic version `wrapInArray<T>(value: T): T[]` type relationship **preserve** karta hai — TypeScript T ko call-site pe infer karta hai (jaise number pass karne pe T=number), aur return type `number[]` hoga, jisse galat operation compile-time pe hi pakdi jaayegi.

**Q4. Discriminated union pattern kya problem solve karta hai jo simple union type solve nahi karta?**

Simple union (`type Status = "loading" | "success" | "error"`) sirf state ka naam represent karta hai, lekin har state ke saath associated data (jaise success ke paas `data`, error ke paas `error message`) ko manually, usually optional fields ke through, model karna padta — jisse manual null-checking chahiye har jagah. Discriminated union ek common literal "tag" field (jaise `status`) use karta hai jisse har shape apna exact set of fields declare karta hai. `switch(response.status)` karne pe TypeScript automatically har `case` branch mein exact shape ko narrow kar deta hai — success case mein `data` field guaranteed accessible hai bina extra null check ke, aur error case mein `data` field access karna hi compile error hoga.

**Q5. `unknown` aur `any` mein practical difference kya hai?**

Dono "kisi bhi type ki value ho sakti hai" represent karte hain, lekin `any` us value pe **kisi bhi operation** ko bina check allow kar deta hai — type safety poori tarah disabled ho jaati hai, aur ye contagious hai (jo touch kare wo bhi `any` ban jaata hai). `unknown` value pe **koi bhi operation allow nahi karta jab tak explicit type narrowing** (typeof check, instanceof, ya custom type guard) na ho. Isse `unknown` "force karta hai check karo pehle use karne se pehle", jabki `any` silently bugs ko through jaane deta hai.

**Q6. `interface` aur `type` mein real differences kya hain — dono kab use karoge?**

Do concrete differences hain: (1) `interface` **declaration merging** support karta hai — same naam se multiple baar declare karo, TypeScript automatically merge kar deta hai (global types extend karne ke liye useful); `type` ye nahi kar sakta, duplicate declaration error dega. (2) sirf `type` **union, intersection, aur mapped types** express kar sakta hai — `interface` ye nahi kar sakta. Practical rule: union/mapped types ke liye `type` use karo (mandatory hai), aur extensible public API surfaces (jaise library exports, component Props jo future mein extend ho sakte hain) ke liye `interface` prefer karo. Simple internal object shapes ke liye dono equally fine hain — team consistency zyada matter karti hai.

**Q7. `strictNullChecks` disabled hone se kya practical risk aata hai?**

Bina `strictNullChecks` ke, `null` aur `undefined` **silently kisi bhi type ko assignable** maane jaate hain — matlab `function getUserName(user: { name: string } | null)` ke andar `user.name` access karna bina null check ke bhi **compile ho jaayega**, koi warning nahi milega. Ye poora "TypeScript build-time pe null pointer bugs pakadta hai" wala value proposition defeat kar deta hai, jo TypeScript ka daily-use mein sabse practical benefit hai. Isliye naye projects mein `strict: true` (jo `strictNullChecks` include karta hai) din 1 se enable karna chahiye — bade legacy codebase mein baad mein retrofit karna bahut painful hota hai (sainkdon compile errors ek saath aate hain jinhe manually triage karna padta hai).

**Q8. Custom type guard function (`x is SomeType`) kaise kaam karta hai, aur uski responsibility kya hai?**

Custom type guard ek function hai jiska return type `x is SomeType` hota hai (jaise `function isAdmin(x: User | Admin): x is Admin`). Jab TypeScript is function ko `if` condition mein use hota dekhta hai, wo us function ke declared return type ko **trust** karke us branch ke andar variable ko narrow kar deta hai. Important caveat: TypeScript us function ke andar ke actual runtime check ki correctness verify nahi karta — sirf declared signature trust karta hai. Isliye guard function ke andar ka logic (jaise `"permissions" in x`) genuinely correct hona zaroori hai, warna ye silent, subtle bugs create kar sakta hai jo TypeScript khud pakad nahi payega.

**Q9. Debugging scenario: production mein ek crash aata hai "Cannot read properties of null" par TypeScript ne code compile hone diya bina kisi error ke. Kya common causes check karoge?**

Sabse pehle check karo `!` (non-null assertion operator) ka overuse — jaise `document.getElementById("root")!` ya `apiResponse.data!` — ye TypeScript ko force karta hai assume karne ke ki value null nahi hai, bina actual runtime guarantee ke. Dusra common cause hai `as SomeType` assertion jo galat type impose kar rahi hai, ya kisi external data (API response) ko bina runtime validation ke `unknown`/`any` se directly cast karna. Teesra check: kya `strictNullChecks` project mein enabled hai — agar disabled hai, toh bahut saare implicit `null` cases already type system se "invisible" hain compile time pe. Fix approach: har `!` aur `as` usage ko audit karo, explicit runtime null checks add karo, aur agar possible ho toh `strict: true` enable karo.

**Q10. `Omit<User, 'password'>` aur `Pick<User, 'id' | 'name'>` mein trade-off kya hai jab public API response type banate ho?**

`Omit` ek **denylist** approach hai — explicit fields hata do, baaki sab automatically include ho jaata hai. Risk ye hai ki agar future mein `User` type mein koi naya sensitive field add ho (jaise `ssn` ya `internalNotes`) aur developer `Omit` list update karna bhool jaaye, wo naya sensitive field **automatically** public type mein leak ho jaayega — TypeScript isse pakad nahi payega, kyunki `Omit` sirf explicitly listed fields ko hata raha hai. `Pick` ek **allowlist** approach hai — explicitly jo fields chahiye unhi ko include karo, baaki sab automatically exclude. Naya field `User` mein add hone pe wo automatically public type mein **nahi** aayega jab tak explicitly `Pick` list mein add na kiya jaaye. Senior-level guidance: security-sensitive types (jaise public API responses) ke liye `Pick` (allowlist) generally safer hai `Omit` (denylist) se, chahe `Omit` thoda kam verbose lage.
