# React Design Patterns — Senior Frontend Ke Liye

React khud koi opinionated framework nahi hai jo tumhe bataye "component kaise likhna hai" — ye sirf ek rendering library hai, aur baaki sab **patterns** community ne organically evolve kiye hain, mostly real pain points solve karte hue. Junior dev ek prop-heavy "God component" likh dega jo 15 boolean flags leta hai; senior dev usi problem ko composition se solve karega. Junior dev har logic ko HOC mein wrap karega kyunki "yehi seekha tha"; senior dev janta hai ki hooks aa jaane ke baad 90% cases mein ek simple custom hook zyada readable hota hai. Ye chapter React ke major structural patterns ko cover karta hai — kab use karo, kab avoid karo, aur kyun ek pattern doosre ko replace kar gaya time ke saath. Ye web-focused hai; agar tumne RN/Expo handbook ka "Components & APIs" chapter padha hai, wahan yehi patterns mobile context mein the — yahan hum web-specific examples (forms, tabs, buttons-as-links) se same concepts ko dobara, deeper angle se dekhenge, plus kuch naye patterns jo sirf web mein relevant hain.

## Table of Contents

1. [Composition Over Configuration — The Core React Philosophy](#composition-over-configuration--the-core-react-philosophy)
2. [Custom Hooks — Extracting Reusable Logic](#custom-hooks--extracting-reusable-logic)
3. [Higher-Order Components (HOCs) — Still Relevant, But Less Common Now](#higher-order-components-hocs--still-relevant-but-less-common-now)
4. [Render Props — What They Were For](#render-props--what-they-were-for)
5. [Compound Components (Web Example)](#compound-components-web-example)
6. [The Polymorphic `as` Prop Pattern (Web Example)](#the-polymorphic-as-prop-pattern-web-example)
7. [Container/Presentational Component Split (Historical Context + Modern Take)](#containerpresentational-component-split-historical-context--modern-take)
8. [Controlled vs Uncontrolled Components (General Pattern)](#controlled-vs-uncontrolled-components-general-pattern)
9. [Real-World Gotchas](#real-world-gotchas)
10. [Key Takeaways](#key-takeaways)
11. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## Composition Over Configuration — The Core React Philosophy

Ye React ka sabse fundamental design principle hai, aur jo devs isse ignore karte hain, unke components 6 mahine mein unmaintainable ho jaate hain. Idea simple hai: **jab ek component ko multiple "variants" support karni ho, usse ek hi component mein saare boolean/enum props se control karne ke bajaye, chhote components ko compose karo.**

### Anti-pattern: prop explosion ("God component")

```tsx
// YE hai "God component" anti-pattern — ek Card jo har possible variation ko prop se control karta hai
type BloatedCardProps = {
  variant: "simple" | "detailed" | "compact"; // pehla flag — layout variant
  showHeader?: boolean; // header dikhana hai ya nahi
  headerTitle?: string; // agar header hai, uska title
  headerSubtitle?: string; // agar header hai, optional subtitle
  showFooter?: boolean; // footer dikhana hai ya nahi
  footerText?: string; // footer ka text
  showFooterButton?: boolean; // footer mein button chahiye ya nahi
  footerButtonLabel?: string; // button ka label
  onFooterButtonClick?: () => void; // button ka click handler
  showDivider?: boolean; // header aur body ke beech divider chahiye ya nahi
  bodyPadding?: "none" | "small" | "large"; // body ka padding variant
  children: React.ReactNode; // actual body content
};

// ye function ab ek combinatorial explosion handle kar raha hai — variant * showHeader * showFooter * ...
function BloatedCard({
  variant, // sabse pehle destructure kiya, isse aage conditional logic mein use hoga
  showHeader, // header render karna hai ya nahi, ye flag decide karega
  headerTitle, // header ke andar title text
  headerSubtitle, // header ke andar subtitle text (optional)
  showFooter, // footer render karna hai ya nahi
  footerText, // footer ka plain text
  showFooterButton, // footer mein action button chahiye ya nahi
  footerButtonLabel, // button ka label text
  onFooterButtonClick, // button click hone pe kya karna hai
  showDivider, // divider line dikhani hai ya nahi
  bodyPadding = "small", // default padding "small" rakha
  children, // body ka actual content
}: BloatedCardProps) {
  return (
    <div className={`card card--${variant}`}> {/* variant className mein inject kiya, styling isi pe depend karti hai */}
      {showHeader && ( // conditional render — sirf tab header dikhega jab flag true ho
        <div className="card-header"> {/* header wrapper */}
          <h3>{headerTitle}</h3> {/* title, ho sakta hai undefined ho aur "undefined" render ho jaaye agar caller bhoole */}
          {headerSubtitle && <p className="card-subtitle">{headerSubtitle}</p>} {/* subtitle sirf agar diya gaya ho */}
        </div>
      )}
      {showDivider && <hr />} {/* divider bhi ek alag flag, independently control karna padta hai */}
      <div className={`card-body card-body--${bodyPadding}`}> {/* body padding variant className mein */}
        {children} {/* actual content */}
      </div>
      {showFooter && ( // footer bhi apna alag conditional block
        <div className="card-footer"> {/* footer wrapper */}
          {footerText && <span>{footerText}</span>} {/* optional footer text */}
          {showFooterButton && ( // footer ke andar bhi ek nested conditional — button independently controlled
            <button onClick={onFooterButtonClick}>{footerButtonLabel}</button> // button, apna alag label aur handler leta hai
          )}
        </div>
      )}
    </div>
  );
}
```

Is component ke saath problem: naya use case aaya (jaise "header mein icon bhi chahiye") toh tumhe ek naya prop add karna padega, jo already-bloated interface ko aur bloat karega. Aur caller side pe dekho ye kitna unreadable hai:

```tsx
// caller ko ye samajhna padega ki kaunsa combination valid hai, kaunsa nahi — koi structural guarantee nahi hai
<BloatedCard
  variant="detailed" // konsa variant chahiye
  showHeader // header on
  headerTitle="Order #4521" // header title
  headerSubtitle="Placed 2 hours ago" // header subtitle
  showDivider // divider on
  bodyPadding="large" // body padding
  showFooter // footer on
  showFooterButton // footer button on
  footerButtonLabel="Track Order" // button label
  onFooterButtonClick={() => console.log("tracking")} // button handler
>
  <p>Order details go here</p> {/* body content children ke through */}
</BloatedCard>
```

### Correct pattern: composition via sub-components

```tsx
// Compound-style composition — har "slot" apna khud ka component hai, JSX structure hi layout define karta hai
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className ?? ""}`}>{children}</div>; // root sirf ek generic wrapper hai, koi variant-specific logic nahi
}

// Header apna khud ka component hai — jo bhi extra structure chahiye (icon, title, subtitle), yahan compose karo
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>; // sirf layout responsibility, content caller decide karta hai
}

// Body bhi apna component — padding variant className prop se, lekin ab sirf ye ek concern handle karta hai
function CardBody({ children, padding = "small" }: { children: React.ReactNode; padding?: "none" | "small" | "large" }) {
  return <div className={`card-body card-body--${padding}`}>{children}</div>; // sirf apne scope ki responsibility
}

// Footer bhi independent — agar button chahiye, caller khud <button> ya koi bhi element compose kar sakta hai
function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="card-footer">{children}</div>; // koi assumption nahi ki footer mein kya hona chahiye
}

// Namespace pattern se sab ek object pe attach kiya — Card.Header, Card.Body, Card.Footer
export const CardWithSlots = Object.assign(Card, {
  Header: CardHeader, // sub-component attach kiya
  Body: CardBody, // sub-component attach kiya
  Footer: CardFooter, // sub-component attach kiya
});
```

```tsx
// caller side ab structural hai — JSX nesting khud "layout" bata deti hai, koi hidden prop-combination samajhna nahi padta
<CardWithSlots className="card--detailed"> {/* variant ab sirf className hai, sub-components independent hain */}
  <CardWithSlots.Header> {/* header slot */}
    <h3>Order #4521</h3> {/* icon, badge, kuch bhi yahan free-form add kar sakte ho — koi naya prop nahi chahiye */}
    <p className="card-subtitle">Placed 2 hours ago</p> {/* subtitle bhi normal JSX hai, "headerSubtitle" prop nahi */}
  </CardWithSlots.Header>
  <hr /> {/* divider chahiye toh seedha JSX mein daal do, koi showDivider flag nahi chahiye */}
  <CardWithSlots.Body padding="large"> {/* padding sirf jahan zaroorat hai wahan control hota hai */}
    <p>Order details go here</p> {/* body content */}
  </CardWithSlots.Body>
  <CardWithSlots.Footer> {/* footer slot */}
    <span>Estimated delivery: Tomorrow</span> {/* text, normal JSX */}
    <button onClick={() => console.log("tracking")}>Track Order</button> {/* button bhi normal JSX, koi footerButtonLabel prop nahi */}
  </CardWithSlots.Footer>
</CardWithSlots>
```

**Senior take**: prop explosion ka fundamental problem ye hai ki tum ek **fixed, closed set of variations** predict karne ki koshish kar rahe ho ahead of time — real UI requirements kabhi itni predictable nahi hoti. Composition har naye use case ko "naya prop add karo" ke bajaye "JSX mein alag arrange karo" bana deta hai, jo infinitely more flexible hai bina component ke API ko touch kiye. Trade-off ye hai ki composition thoda zyada verbose lagta hai caller side pe short/simple cases mein — isliye purely trivial components (jaise ek simple `<Badge color="red">`) ke liye configuration bhi bilkul theek hai. Rule of thumb: jab tumhare boolean props ek doosre pe depend karne lagen (jaise `showFooterButton` sirf `showFooter` true hone pe matter karta hai), ye clear signal hai ki composition better fit hai.

---

## Custom Hooks — Extracting Reusable Logic

Custom hooks aaj ke React mein **stateful logic share karne ka default, primary tool** hain — HOCs aur render props (jo hooks se pehle iska solution the) ab mostly historical/niche use cases ke liye reserved hain (agle do sections mein dekhenge kyun). Ek custom hook bas ek naya function hai jiska naam `use` se start hota hai aur jo internally React ke built-in hooks (`useState`, `useEffect`, etc.) use karta hai — is naming convention se React linter (`eslint-plugin-react-hooks`) rules of hooks enforce kar sakta hai.

### Motivating example: inline logic jo repeat ho rahi hai

Socho ek settings page hai jahan user ka theme preference `localStorage` mein persist karna hai:

```tsx
import { useState, useEffect } from "react"; // hooks import kiye

function SettingsPage() {
  // state initial value localStorage se read karke set kar rahe hain — inline, is component ke andar hi
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem("theme") ?? "light"; // agar localStorage mein kuch nahi hai, "light" default
  });

  useEffect(() => {
    localStorage.setItem("theme", theme); // har baar theme change ho, localStorage sync karo
  }, [theme]); // dependency array — sirf theme change pe re-run

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}> {/* controlled select */}
      <option value="light">Light</option> {/* option 1 */}
      <option value="dark">Dark</option> {/* option 2 */}
    </select>
  );
}
```

Problem: agar ek doosri component (jaise `LanguageSettings`) ko bhi yehi "localStorage-backed state" pattern chahiye, tum ye same 5 lines phir se copy-paste karoge. Isse extract karna zaroori hai.

### `useLocalStorage` — extracted, fully commented

```tsx
import { useState, useEffect, useCallback } from "react"; // hooks import kiye

// generic type T — kisi bhi value type ke liye reusable (string, number, object, etc.)
function useLocalStorage<T>(key: string, defaultValue: T) {
  // lazy initializer function pass kiya useState ko — ye sirf FIRST render pe chalega, har render pe nahi
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key); // localStorage se raw string nikala
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue; // agar mila toh parse karo, warna default use karo
    } catch {
      // JSON.parse fail ho sakta hai agar stored value corrupt hai, ya localStorage access blocked hai (privacy mode)
      return defaultValue; // safe fallback
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value)); // value change hone pe localStorage mein serialize karke save karo
    } catch {
      // localStorage full ho sakta hai (quota exceeded), ya blocked — silently fail karna better hai crash karne se
    }
  }, [key, value]); // key ya value change hote hi re-sync

  // useCallback isliye taaki setter ka reference stable rahe — agar caller ise kisi memoized child ko pass kare
  const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(newValue); // useState ka setter already function-updater support karta hai, isliye seedha pass kar diya
  }, []); // empty deps — setValue khud stable hai React se, isliye ye function bhi stable rahega

  return [value, setStoredValue] as const; // tuple return kiya, useState jaisa hi API feel ho consumer ko
}

export default useLocalStorage; // export kiya, kahin bhi import karke use karo
```

### Usage — ab logic sirf ek line hai

```tsx
function SettingsPage() {
  // saara localStorage sync logic hook ke andar chhupa hai — component sirf "theme state" ke saath deal kar raha hai
  const [theme, setTheme] = useLocalStorage("theme", "light"); // key="theme", default="light"

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}> {/* same UI, koi difference nahi */}
      <option value="light">Light</option> {/* option 1 */}
      <option value="dark">Dark</option> {/* option 2 */}
    </select>
  );
}

function LanguageSettings() {
  // same hook, doosri key ke saath — reuse ho gaya bina copy-paste kiye
  const [lang, setLang] = useLocalStorage("lang", "en"); // key="lang", default="en"

  return (
    <select value={lang} onChange={(e) => setLang(e.target.value)}> {/* controlled select, language ke liye */}
      <option value="en">English</option> {/* option 1 */}
      <option value="hi">Hindi</option> {/* option 2 */}
    </select>
  );
}
```

### Ek aur classic — `useDebouncedValue`

Search-as-you-type ke liye (API-calling chapter mein humne `debounce()` utility function dekha tha) — ye same idea hai lekin ek **value ke roop mein**, jo React state ke saath naturally integrate hota hai:

```tsx
import { useState, useEffect } from "react"; // hooks import kiye

// value ka debounced version return karta hai — actual value turant change hoti hai, debounced version delay ke baad
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value); // debounced state, initially actual value ke equal

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebounced(value); // delay complete hone pe debounced value ko latest value se sync karo
    }, delayMs); // delayMs ka wait

    // cleanup — agar value phir se change ho jaaye is delay ke andar, purana timeout cancel karo (yehi debounce ka core hai)
    return () => clearTimeout(timeoutId); // ye tab chalega jab effect re-run ho (value change) ya component unmount ho
  }, [value, delayMs]); // value ya delay change hone pe effect re-run

  return debounced; // caller ko debounced value milta hai, wo direct render mein use kar sakta hai
}

export default useDebouncedValue; // export kiya
```

```tsx
function SearchBox() {
  const [query, setQuery] = useState(""); // raw, immediate input value
  const debouncedQuery = useDebouncedValue(query, 400); // 400ms baad hi ye update hoga

  useEffect(() => {
    if (debouncedQuery === "") return; // empty query pe kuch mat karo
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`) // sirf debounced value change hone pe API call
      .then((res) => res.json()) // response parse
      .then((data) => console.log(data)); // results handle karo (real app mein state mein daalo)
  }, [debouncedQuery]); // debouncedQuery badalte hi effect chalega, raw query pe nahi

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />; // input turant update hota hai, feel snappy
}
```

**Senior note**: is pattern ka faayda — input **turant** responsive lagta hai (koi lag typing mein nahi), lekin expensive operation (API call) sirf pause ke baad trigger hoti hai. Ye `debounce()` function-wrapping approach se zyada "React-idiomatic" hai kyunki state flow declarative rehta hai — koi manual `useMemo`-wrapped debounced function nahi chahiye.

---

## Higher-Order Components (HOCs) — Still Relevant, But Less Common Now

HOC ek function hai jo ek component leta hai aur ek **naya, enhanced component** return karta hai — pattern signature: `withSomething(Component) => EnhancedComponent`. Hooks se pehle (React 16.8 se pehle), ye stateful logic share karne ka primary tareeka tha, kyunki function components mein state hold karne ka koi tareeka hi nahi tha (sirf class components state rakh sakte the), aur ek class ki logic ko doosri class mein reuse karne ke liye HOC hi option tha.

```tsx
import { useEffect, useState, type ComponentType } from "react"; // types aur hooks import kiye

type AuthState = { isAuthenticated: boolean; isLoading: boolean }; // auth check ka result shape

// HOC function — kisi bhi component ko wrap karke uske aage auth-gate laga deta hai
function withAuth<P extends object>(WrappedComponent: ComponentType<P>) {
  // return kiya gaya naya component — isi ko caller actually render karega
  function WithAuthComponent(props: P) {
    const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false, isLoading: true }); // initial: loading

    useEffect(() => {
      // real app mein ye ek actual API call/token check hoga — yahan simplified
      checkAuth().then((isAuthenticated) => {
        setAuthState({ isAuthenticated, isLoading: false }); // result mil gaya, loading khatam
      });
    }, []); // sirf mount pe ek baar check karo

    if (authState.isLoading) return <div>Checking session...</div>; // loading UI, wrapped component render hi nahi hua abhi
    if (!authState.isAuthenticated) return <div>Please log in</div>; // auth fail — wrapped component render nahi hoga

    return <WrappedComponent {...props} />; // sab theek hai — original component ko saare original props ke saath render kiya
  }

  return WithAuthComponent; // ye naya, enhanced component return kiya HOC ne
}

// dummy auth check — real app mein ye token validate karega server se
async function checkAuth(): Promise<boolean> {
  return new Promise((resolve) => setTimeout(() => resolve(true), 500)); // simulate 500ms network delay
}

// original, plain component
function Dashboard({ userName }: { userName: string }) {
  return <h1>Welcome, {userName}</h1>; // simple render, koi auth-awareness nahi isme khud
}

// enhanced version — auth logic Dashboard ke andar nahi hai, HOC ke through inject hui
const ProtectedDashboard = withAuth(Dashboard); // usage: <ProtectedDashboard userName="Sharad" />
```

### HOCs ke pain points — kyun hooks ne inhe replace kiya

- **"Wrapper hell"** — agar tum multiple HOCs compose karte ho (`withAuth(withTheme(withLogging(Dashboard)))`), React DevTools ke component tree mein ye nested wrapper components ka ek pura stack dikhata hai, jisse actual component dhoondhna aur debug karna painful ho jaata hai.
- **Prop name collisions** — agar `withAuth` aur `withTheme` dono apne-apne `data` naam ka prop inject karte hain wrapped component mein, ek doosre ko silently overwrite kar dega — aur ye runtime pe pakadna mushkil hota hai, TypeScript bhi isse pura catch nahi karta agar types loose hain.
- **Static typing complex ho jaati hai** — generic `P extends object` types ke saath inferred props ka flow samajhna, especially multiple HOCs stack karne pe, TypeScript mein genuinely painful hai.

Custom hooks yehi problems avoid karte hain kyunki ek hook sirf **values return karta hai** (extra wrapping component nahi banata), aur multiple hooks ko ek component mein use karna sirf multiple function calls hai — koi nesting, koi naam-collision-via-injection nahi.

### Jab HOC aaj bhi sahi choice hai

Hook ek **specific component instance ke andar hi** call ho sakta hai — usse "call" karne ke liye ek component function chahiye hota hai. Kabhi kabhi tumhe logic **routing/page level** pe apply karni hoti hai, jahan koi single component instance nahi hai jiske andar hook call karo — jaise ek **page-level auth guard** jo kisi bhi route ke around wrap ho sake, route definitions mein:

```tsx
// React Router jaisi library mein, route-level wrapping — yahan koi ek "component instance" nahi hai jiske andar hook chale
// isliye HOC pattern yahan genuinely better fit hai — ye structural wrapping hai, logic-sharing nahi
const routes = [
  { path: "/dashboard", element: <ProtectedDashboard userName="Sharad" /> }, // HOC-wrapped component route definition mein seedha use hua
  { path: "/login", element: <Dashboard userName="Guest" /> }, // login page ko wrap nahi kiya, wahan auth check nahi chahiye
];
```

**Senior take**: naye feature code ke liye default choice custom hook honi chahiye. HOC ko reach for karo sirf jab tumhe **structurally ek component ko wrap** karna ho (cross-cutting concern jo component tree mein "outside" se apply hoti hai, jaise route guards, error boundaries — jo khud bhi technically class-based hone chahiye kyunki `componentDidCatch` ka hook equivalent nahi hai), na ki jab tumhe sirf kuch state/logic share karni ho.

---

## Render Props — What They Were For

Render prop pattern mein ek component apna internal state/data ek **function ke through expose karta hai**, aur wo function `children` (ya kisi named prop) ke roop mein pass hota hai. Component internally us function ko call karta hai apne data ke saath, aur jo bhi wo function return kare, wahi render hota hai — matlab **caller decide karta hai UI kaisi dikhegi, component sirf data/logic control karta hai.**

```tsx
import { useState, useEffect } from "react"; // hooks import kiye

type MouseRenderProps = { x: number; y: number }; // mouse position ka shape jo hum expose karenge

// component apna internal mouse-tracking state maintain karta hai, lekin render decision caller pe chhod deta hai
function MouseTracker({ children }: { children: (pos: MouseRenderProps) => React.ReactNode }) {
  const [position, setPosition] = useState<MouseRenderProps>({ x: 0, y: 0 }); // internal state, mouse position

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      setPosition({ x: e.clientX, y: e.clientY }); // window-level mouse position track kiya
    }
    window.addEventListener("mousemove", handleMouseMove); // listener attach kiya
    return () => window.removeEventListener("mousemove", handleMouseMove); // cleanup — memory leak/duplicate listener avoid karne ke liye
  }, []); // sirf mount pe ek baar listener lagao

  return children(position); // children yahan function hai, data pass karke call kiya — jo return hoga wahi render hoga
}
```

```tsx
// usage — caller apna khud ka UI decide kar raha hai, MouseTracker ko koi idea nahi ki UI kaisi dikhegi
<MouseTracker>
  {({ x, y }) => ( // function-as-children — destructure kiya position object se x, y
    <p>Mouse is at ({x}, {y})</p> // caller ka apna render decision
  )}
</MouseTracker>
```

Yehi cheez aaj **custom hook** se zyada clean hoti hai, koi extra component nesting ke bina:

```tsx
import { useState, useEffect } from "react"; // hooks import kiye

// same logic, ab hook ke roop mein — koi wrapper component nahi, direct value return
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 }); // same internal state
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      setPosition({ x: e.clientX, y: e.clientY }); // same tracking logic
    }
    window.addEventListener("mousemove", handleMouseMove); // listener attach
    return () => window.removeEventListener("mousemove", handleMouseMove); // cleanup
  }, []); // mount pe ek baar
  return position; // seedha value return, function-as-children ki zaroorat nahi
}

function CursorDisplay() {
  const { x, y } = useMousePosition(); // ek line mein consume kiya, koi nesting nahi
  return <p>Mouse is at ({x}, {y})</p>; // normal render
}
```

**Senior note**: render props aaj **library APIs** mein occasionally milte hain jahan library maximum rendering flexibility dena chahti hai lekin apna khud ka data/behavior control apne paas rakhna chahti hai — jaise downshift (autocomplete library) ya kuch drag-and-drop libraries, jinke API mein tumhe render function milta hai jisme wo internal state (`isOpen`, `highlightedIndex`, etc.) pass karte hain, aur tum decide karte ho DOM structure kaisa ho. Apne khud ke app code mein naya render-prop pattern likhna aaj rarely justify hota hai — custom hook almost always simpler hoga.

---

## Compound Components (Web Example)

Compound components pattern ek parent component internally React Context banata hai, aur uske "family members" (sub-components) us context ko implicitly consume karte hain — bina parent ko explicitly har child ko props pass karne ki zaroorat ke ("prop drilling" avoid ho jaata hai). RN handbook mein humne ye pattern ek simple `Card` ke saath dekha tha; yahan hum isi idea ko ek genuinely common, real-world web UI component pe apply karenge — ek **accessible Tabs component**.

```tsx
import { createContext, useContext, useState, type ReactNode } from "react"; // Context aur hooks import kiye

// context value ka shape — active tab id, aur usse change karne ka function
type TabsContextValue = {
  activeTab: string; // currently selected tab ki id
  setActiveTab: (id: string) => void; // tab change karne ka function, Tab click pe call hoga
};

// null default diya — agar koi sub-component Tabs ke bahar use ho jaaye, humein pata chal jaayega (runtime error se)
const TabsContext = createContext<TabsContextValue | null>(null);

// helper hook — context read karta hai aur null-check enforce karta hai, taaki har sub-component mein ye repeat na karna pade
function useTabsContext() {
  const ctx = useContext(TabsContext); // context se current value nikala
  if (!ctx) throw new Error("Tabs.* components must be used inside <Tabs>"); // misuse ko turant, clearly fail-fast karo
  return ctx; // valid context guaranteed return
}

// root Tabs component — state yahan live karta hai, Provider yahan setup hota hai
function Tabs({ defaultTab, children }: { defaultTab: string; children: ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultTab); // active tab state, initial value caller deta hai

  return (
    // Provider value object har render pe naya banega — chhoti sa perf consideration hai, real apps mein useMemo wrap kar sakte ho
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs-root">{children}</div> {/* generic wrapper, layout children decide karte hain */}
    </TabsContext.Provider>
  );
}

// TabsList — tab buttons ka container, accessibility role "tablist" ke saath
function TabsList({ children }: { children: ReactNode }) {
  return (
    <div role="tablist" className="tabs-list"> {/* role="tablist" screen readers ko batata hai ye ek tab-group hai */}
      {children} {/* individual Tab components yahan aayenge */}
    </div>
  );
}

// individual Tab button — context se activeTab compare karta hai, aur click pe setActiveTab call karta hai
function Tab({ id, children }: { id: string; children: ReactNode }) {
  const { activeTab, setActiveTab } = useTabsContext(); // shared state — koi prop drilling nahi, seedha context se
  const isActive = activeTab === id; // ye tab currently selected hai ya nahi, boolean

  return (
    <button
      role="tab" // accessibility — screen reader ko batata hai ye ek tab hai
      aria-selected={isActive} // screen reader ko current selection state batata hai
      aria-controls={`panel-${id}`} // is tab se konsa panel associated hai, id se link kiya
      id={`tab-${id}`} // panel se reverse link karne ke liye (aria-labelledby neeche)
      className={isActive ? "tab tab--active" : "tab"} // conditional styling className
      onClick={() => setActiveTab(id)} // click pe context ka state update — isse sab sub-components re-render honge jo isse read karte hain
    >
      {children} {/* tab label */}
    </button>
  );
}

// TabsPanels — sirf ek semantic wrapper, panels ke around
function TabsPanels({ children }: { children: ReactNode }) {
  return <div className="tabs-panels">{children}</div>; // simple wrapper, koi extra logic nahi
}

// individual TabPanel — sirf apna content render karta hai jab wo tab active ho, warna null
function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const { activeTab } = useTabsContext(); // context se active tab check kiya
  if (activeTab !== id) return null; // agar ye panel active nahi hai, kuch bhi render mat karo (DOM se hata do)

  return (
    <div
      role="tabpanel" // accessibility — batata hai ye panel content hai
      id={`panel-${id}`} // Tab ke aria-controls se match karta hai
      aria-labelledby={`tab-${id}`} // is panel ko konsa tab "label" de raha hai, wo batata hai
    >
      {children} {/* panel ka actual content */}
    </div>
  );
}

// namespace pattern — sab sub-components ek object pe attach, taaki <Tabs.List>, <Tabs.Tab> syntax mile
export const AccessibleTabs = Object.assign(Tabs, {
  List: TabsList, // sub-component attach
  Tab: Tab, // sub-component attach
  Panels: TabsPanels, // sub-component attach
  Panel: TabPanel, // sub-component attach
});
```

```tsx
// usage — koi prop drilling nahi, structure khud describe karta hai kya render hoga
<AccessibleTabs defaultTab="overview"> {/* root, initial active tab "overview" */}
  <AccessibleTabs.List> {/* tab buttons ka group */}
    <AccessibleTabs.Tab id="overview">Overview</AccessibleTabs.Tab> {/* tab 1 */}
    <AccessibleTabs.Tab id="billing">Billing</AccessibleTabs.Tab> {/* tab 2 */}
    <AccessibleTabs.Tab id="settings">Settings</AccessibleTabs.Tab> {/* tab 3 */}
  </AccessibleTabs.List>
  <AccessibleTabs.Panels> {/* panels ka group */}
    <AccessibleTabs.Panel id="overview">Overview content here.</AccessibleTabs.Panel> {/* sirf active hone pe render hoga */}
    <AccessibleTabs.Panel id="billing">Billing content here.</AccessibleTabs.Panel> {/* sirf active hone pe render hoga */}
    <AccessibleTabs.Panel id="settings">Settings content here.</AccessibleTabs.Panel> {/* sirf active hone pe render hoga */}
  </AccessibleTabs.Panels>
</AccessibleTabs>
```

**Senior note**: is pattern ka real power ye hai ki `Tab` aur `TabPanel` ko koi idea nahi hai ki kaun sa "sibling" active hai — sab kuch `TabsContext` se implicitly flow ho raha hai. Consumer bhi flexibly `TabsList`/`TabsPanels` ke andar order, extra elements (jaise ek icon button beech mein) daal sakta hai bina component API todhe — ye exact wahi composition-over-configuration philosophy hai jo section 1 mein dekhi thi, sirf ab Context ke saath implicit state-sharing add ho gaya hai.

---

## The Polymorphic `as` Prop Pattern (Web Example)

Web mein ek genuinely common requirement hai: ek `Button` component jo visually consistent dikhna chahiye (same padding, colors, hover states), lekin kabhi `<button>` ke roop mein render ho (form submit ke liye), kabhi `<a>` ke roop mein (navigation link ke liye, jahan `href` chahiye), aur kabhi Next.js jaisa `Link` component ho. `as` prop pattern isse solve karta hai — component ek prop leta hai jo batata hai underlying element/component kya hoga, aur baaki styling/API same rehta hai.

### Naive (broken) typing attempt

```tsx
// NAIVE attempt — ye compile toh ho jaayega lekin type safety chali jaati hai
type NaiveButtonProps = {
  as?: any; // "any" ka matlab TypeScript ne haar maan li — koi type-checking nahi hogi as pe
  children: React.ReactNode; // button ka content
};
// problem: agar as="a" hai, TypeScript ko pata nahi chalega ki href valid prop hai ya nahi — koi autocomplete, koi error checking
```

### Correct, fully-typed polymorphic pattern

```tsx
import { type ElementType, type ComponentPropsWithoutRef, type ReactNode } from "react"; // TypeScript utility types import kiye

// generic type — C represents jo bhi element/component "as" prop mein diya jaayega
type PolymorphicButtonProps<C extends ElementType> = {
  as?: C; // "as" prop — optional, default hum neeche function mein "button" rakhenge
  children: ReactNode; // button ka content, sab variants mein common
  variant?: "primary" | "secondary"; // apna khud ka custom styling prop, sab variants mein common
} & Omit<ComponentPropsWithoutRef<C>, "as" | "children" | "variant">; // C ke saare native props inherit kiye, sirf apne custom props ko exclude karke conflict avoid karne ke liye

// generic function component — C ka default "button" hai agar caller kuch na de
function Button<C extends ElementType = "button">({
  as, // konsa element/component render karna hai
  variant = "primary", // default styling variant
  children, // content
  ...rest // baaki saare props (href, onClick, type, target, etc.) jo underlying element ko chahiye honge
}: PolymorphicButtonProps<C>) {
  const Component = as ?? "button"; // agar as nahi diya, default "button" tag use karo — TypeScript ke liye ye ek runtime value hai jo JSX mein tag ban sakta hai

  return (
    <Component className={`btn btn--${variant}`} {...rest}> {/* Component yahan variable hai — JSX capital-letter variable ko element/component treat karta hai */}
      {children} {/* content pass-through */}
    </Component>
  );
}

export default Button; // export kiya
```

```tsx
// usage 1 — default, as nahi diya, "button" tag banega
<Button variant="primary" onClick={() => console.log("clicked")}> {/* onClick valid hai kyunki default C="button" */}
  Submit
</Button>

// usage 2 — as="a" diya, ab TypeScript href ko VALID aur REQUIRED-if-anchor-semantics prop maanta hai
<Button as="a" href="/dashboard" variant="secondary"> {/* href yahan type-checked hai — "a" tag ke props inherit hue */}
  Go to Dashboard
</Button>

// usage 3 — galat prop use kiya, TypeScript ise pakad lega
<Button as="a" onClick={() => {}}>
  {/* @ts-expect-error — href missing hai, aur agar "download" jaisa button-only prop diya hota, wo bhi error dega */}
  Broken example
</Button>
```

**Senior note**: is pattern ki asli value type-safety hai — `as="a"` doge toh TypeScript automatically `href`, `target`, `rel` jaise anchor-specific props allow/expect karega, aur `as="button"` (ya default) mein `type="submit"` jaisa button-specific prop. Ye TypeScript ka **conditional type narrowing** generics ke through hai — `ComponentPropsWithoutRef<C>` compile-time pe `C` ki actual value ke basis pe resolve hota hai. Real-world design systems (Chakra UI, Radix) isi pattern ka use karte hain apne primitives mein. Trade-off: generic types thoda ramp-up time lete hain samajhne mein, aur agar overused ho (har chhote component ko polymorphic banana), codebase mein unnecessary complexity aa jaati hai — sirf genuinely-multi-element components (Button, Text, Box jaise layout primitives) ke liye reach for karo.

---

## Container/Presentational Component Split (Historical Context + Modern Take)

Ye pattern (Dan Abramov ne popularize kiya tha ~2015 mein) suggest karta hai components ko strictly do categories mein split karo: **container components** ("smart" — data-fetching, state management karte hain, koi styling/markup nahi) aur **presentational components** ("dumb" — sirf props leke UI render karte hain, koi data-fetching ya business logic nahi).

```tsx
// OLD-STYLE — Container component: sirf data-fetching/state, koi JSX styling logic
function UserProfileContainer({ userId }: { userId: string }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null); // fetched data state
  const [isLoading, setIsLoading] = useState(true); // loading state

  useEffect(() => {
    fetch(`/api/users/${userId}`) // data-fetching logic — sirf container ka concern hai
      .then((res) => res.json()) // response parse
      .then((data) => {
        setUser(data); // fetched user set kiya
        setIsLoading(false); // loading khatam
      });
  }, [userId]); // userId change hone pe re-fetch

  // presentational component ko sirf props pass kiya — container ko UI ka koi idea nahi
  return <UserProfileView user={user} isLoading={isLoading} />;
}

// OLD-STYLE — Presentational component: sirf props leke render, koi fetch/state logic
function UserProfileView({ user, isLoading }: { user: { name: string; email: string } | null; isLoading: boolean }) {
  if (isLoading) return <p>Loading...</p>; // loading UI
  if (!user) return <p>User not found</p>; // empty state UI
  return (
    <div> {/* pure rendering, koi data-fetching awareness nahi */}
      <h2>{user.name}</h2> {/* name render */}
      <p>{user.email}</p> {/* email render */}
    </div>
  );
}
```

### Senior retrospective — ye split kyun aaj utna rigid nahi hai

Ye pattern apne time (Redux-heavy era, hooks se pehle) mein genuinely useful tha — data-fetching logic ko UI se decouple karna testing aur reuse ke liye helpful tha jab function components state hold hi nahi kar sakte the (sirf class components karte the), toh separate karna practically zaroori bhi tha kyunki "smart" logic sirf class mein rehti thi.

Aaj, do developments ne is **strict** split ki zaroorat ko kam kar diya hai:

1. **Custom hooks** — data-fetching logic ko ek `useUserProfile(userId)` hook mein extract kar sakte ho, aur usi component mein directly use kar sakte ho jo UI render karta hai. Container/presentational split ka fetching-vs-rendering separation ab **file-level split ke bajaye function-level split** ban gaya hai — same component file mein, logic (hook call) aur rendering (JSX) clearly alag dikhte hain, bina ek poora extra component banane ke.

```tsx
// MODERN — ek hi component, hook se logic extract hui hai, lekin koi separate "container" file/component nahi
function useUserProfile(userId: string) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null); // same state
  const [isLoading, setIsLoading] = useState(true); // same loading flag

  useEffect(() => {
    fetch(`/api/users/${userId}`) // same fetch logic
      .then((res) => res.json()) // parse
      .then((data) => {
        setUser(data); // set data
        setIsLoading(false); // loading off
      });
  }, [userId]); // same dependency

  return { user, isLoading }; // hook se seedha data return
}

function UserProfile({ userId }: { userId: string }) {
  const { user, isLoading } = useUserProfile(userId); // ek line mein data-fetching logic consumed

  if (isLoading) return <p>Loading...</p>; // same UI logic, ab isi component mein
  if (!user) return <p>User not found</p>; // same
  return (
    <div>
      <h2>{user.name}</h2> {/* render */}
      <p>{user.email}</p> {/* render */}
    </div>
  );
}
```

2. **Colocated data-fetching (Server Components, TanStack Query)** — React Server Components mein data-fetching aur rendering ek hi Server Component ke andar naturally colocated hote hain (server pe fetch karo, seedha wahi JSX use kare). TanStack Query jaisi libraries mein `useQuery(...)` bhi ek custom hook hi hai jo caching/refetching/loading-state sab handle karta hai — ye "container" component ki responsibility ko ek reusable hook mein normalize kar deta hai, jise koi bhi component seedha call kar sakta hai.

**Senior take (honest retrospective)**: original container/presentational advice apne time ke liye reasonable tha, lekin practice mein ye jitna **structural rigidity** demand karta tha (har feature ke liye do separate files/components banana, chahe logic simple ho), utni zaroorat nahi thi — ye "one size fits all" rule ban gaya tha jab actual principle ("data-fetching concerns ko rendering concerns se separate rakho, kisi reusable unit mein") kaafi simpler tareeke se follow ho sakta tha. Aaj bhi **principle** valid hai (mix mat karo fetching logic ko deeply UI ke saath, taaki testing/reuse mushkil ho jaaye) — sirf implementation mechanism badal gaya hai: alag *component* ki jagah ab alag *hook* use karte hain. Jab component genuinely complex ho (jaise ek page jisme 4-5 independent data sources hain), tab bhi ek explicit "page container" component banana reasonable hai — lekin ye ab default rule nahi hai, ek judgment call hai.

---

## Controlled vs Uncontrolled Components (General Pattern)

Ye pattern form inputs tak limited nahi hai (wo specific case `19-forms-and-validation.md` mein already covered hai) — ye ek **general React component design pattern** hai jo kisi bhi component pe apply hota hai jiska koi internal "state" ho. Sawaal ye hai: **state kaun "owns" karta hai — parent (controlled) ya component khud (uncontrolled)?**

```tsx
import { useState } from "react"; // hook import kiya

// CONTROLLED version — Accordion apna khud ka open/closed state nahi rakhta, parent se aata hai
function ControlledAccordion({
  isOpen, // parent se aane wala current state
  onToggle, // parent ko batane ka function ki toggle hua
  title, // accordion ka header text
  children, // accordion ka body content
}: {
  isOpen: boolean; // parent decide karta hai open hai ya nahi
  onToggle: () => void; // component sirf "request" karta hai toggle ka, decision parent leta hai
  title: string; // header
  children: React.ReactNode; // body
}) {
  return (
    <div className="accordion"> {/* wrapper */}
      <button onClick={onToggle}>{title}</button> {/* click pe parent ko inform karo, khud state mat badlo */}
      {isOpen && <div className="accordion-body">{children}</div>} {/* parent ke diye state ke basis pe render */}
    </div>
  );
}

// UNCONTROLLED version — Accordion apna khud ka state internally maintain karta hai
function UncontrolledAccordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen); // internal state, parent ko iski koi khabar nahi

  return (
    <div className="accordion"> {/* wrapper */}
      <button onClick={() => setIsOpen((prev) => !prev)}>{title}</button> {/* click pe khud hi state flip kar liya */}
      {isOpen && <div className="accordion-body">{children}</div>} {/* internal state ke basis pe render */}
    </div>
  );
}
```

### Hybrid pattern — real component libraries jo karte hain

Real-world design systems (Radix, MUI, Reach UI) mostly ek **hybrid approach** use karte hain — component by default uncontrolled kaam karta hai (simple use case ke liye zero setup), lekin agar parent ko control chahiye, wo optional `value`/`onChange`-style props de sakta hai:

```tsx
import { useState } from "react"; // hook import kiya

function Accordion({
  title, // header text
  children, // body content
  isOpen: controlledIsOpen, // optional — agar diya gaya, component "controlled mode" mein chala jaayega
  onToggle, // optional — sirf controlled mode mein use hota hai
  defaultOpen = false, // uncontrolled mode ke liye initial value
}: {
  title: string; // header
  children: React.ReactNode; // body
  isOpen?: boolean; // agar undefined hai, matlab caller ne control nahi maanga
  onToggle?: () => void; // controlled mode ka callback
  defaultOpen?: boolean; // uncontrolled mode ka default
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen); // internal state, sirf uncontrolled mode mein use hoga

  // agar controlledIsOpen defined hai (undefined nahi), matlab parent control kar raha hai — hamesha isi check se decide karo, "isOpen" ki value se nahi
  const isControlled = controlledIsOpen !== undefined; // boolean flag — kya ye controlled mode mein chal raha hai

  // effective state — controlled mode mein parent ka diya value, warna internal state
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen; // single source of truth is render ke liye

  function handleToggle() {
    if (isControlled) {
      onToggle?.(); // controlled mode — sirf parent ko inform karo, khud state mat badlo (parent hi decide karega naya value)
    } else {
      setInternalIsOpen((prev) => !prev); // uncontrolled mode — khud state manage karo
    }
  }

  return (
    <div className="accordion"> {/* wrapper, dono modes mein same */}
      <button onClick={handleToggle}>{title}</button> {/* single handler jo mode ke basis pe branch karta hai */}
      {isOpen && <div className="accordion-body">{children}</div>} {/* effective state se render */}
    </div>
  );
}
```

```tsx
// uncontrolled usage — zero setup, component khud handle karta hai
<Accordion title="FAQ Item" defaultOpen={false}>Content here</Accordion>

// controlled usage — parent ko control chahiye (jaise "only one accordion open at a time" logic ke liye)
function FAQList() {
  const [openId, setOpenId] = useState<string | null>(null); // sirf ek hi accordion open track karne ke liye parent-level state
  return (
    <>
      <Accordion title="Q1" isOpen={openId === "q1"} onToggle={() => setOpenId(openId === "q1" ? null : "q1")}>A1</Accordion> {/* parent decide kar raha hai */}
      <Accordion title="Q2" isOpen={openId === "q2"} onToggle={() => setOpenId(openId === "q2" ? null : "q2")}>A2</Accordion> {/* same pattern */}
    </>
  );
}
```

**Senior note**: `isControlled` ka decision `controlledIsOpen !== undefined` se hona chahiye, na ki koi separate prop se — ye ek subtle lekin important detail hai. Agar tum galti se render ke beech mode switch kar do (kabhi controlled prop pass karo, kabhi na karo), React warning dega ("component is changing from uncontrolled to controlled") — mode ek component ki lifetime mein consistent rehna chahiye.

---

## Real-World Gotchas

- **Component ko doosre component ke andar define karna** — ye ek genuinely confusing bug hai naye devs ke liye. Agar tum ek component function ke **andar** ek naya component function define karte ho, har render pe React ek **naya function reference** dekhta hai, aur ise ek bilkul naya component type samajhta hai — matlab purana instance unmount hota hai, naya mount hota hai, aur uska poora internal state (aur DOM, aur focus) **reset ho jaata hai** har render pe.

```tsx
// BUG — Inner har render pe naya function reference hai, React ise naya component type maanta hai
function Outer() {
  const [count, setCount] = useState(0); // parent state, jab bhi change ho, Outer re-render hoga

  // YE GALAT HAI — Inner ye function-body ke andar define ho raha hai, isliye har Outer render pe naya banta hai
  function Inner() {
    const [text, setText] = useState(""); // Inner ka apna internal state
    return <input value={text} onChange={(e) => setText(e.target.value)} />; // input jisme user type karega
  }

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button> {/* har click pe Outer re-render hoga */}
      <Inner /> {/* har Outer render pe ye "naya" component treat hoga, Inner ka text state RESET ho jaayega */}
    </div>
  );
}
```

  Fix: `Inner` ko `Outer` ke bahar move karo (module-level define karo), taaki uska function reference stable rahe render-to-render.

```tsx
// FIX — Inner module-level pe define kiya, ab reference stable hai har render mein
function Inner() {
  const [text, setText] = useState(""); // Inner ka state ab safe hai, reset nahi hoga Outer re-render pe
  return <input value={text} onChange={(e) => setText(e.target.value)} />; // same input
}

function Outer() {
  const [count, setCount] = useState(0); // parent state
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button> {/* re-render trigger */}
      <Inner /> {/* ab same reference hai har baar, React isse "same" component treat karega — state persist */}
    </div>
  );
}
```

- **Over-engineering — HOC/render-prop lagana jahan simple custom hook kaafi tha** — kabhi kabhi devs (especially jo purane React se aaye hain) "safe" default ke roop mein HOC likh dete hain jab actual requirement sirf ek chhota-sa stateful logic share karna tha. Isse extra component nesting, extra indirection, aur onboarding devs ke liye "ye wrapper kya kar raha hai" confusion create hota hai. Test: agar tumhara HOC/render-prop sirf **data/state return** kar raha hai (koi structural JSX wrapping nahi), ye almost certainly ek custom hook honi chahiye thi.
- **Prop drilling jab Context/compound components better fit hote** — agar tum ek value ko 4-5 component layers se pass kar rahe ho sirf isliye ki 5th layer ko chahiye (jabki beech ke 3-4 layers ko us value se koi matlab nahi), ye ek clear signal hai ki Context (ya compound component pattern, section 5) use karna chahiye. Prop drilling khud "wrong" nahi hai 1-2 layers ke liye (Context ka apna overhead hai — testing thoda harder, aur `useContext` consumer ko implicit dependency deta hai jo grep se dhoondhna thoda mushkil hota hai) — lekin deep drilling ek maintenance burden hai jo refactor ke waqt sabse pehle todhta hai.
- **`useLocalStorage`/`useDebouncedValue` jaise hooks ko galat dependency array ke saath likhna** — jaise `useLocalStorage` mein agar `key` ko dependency array se accidentally hata diya jaaye, aur component kabhi dynamically different key ke saath reuse ho, purana localStorage sync stale key pe hi hota rahega. Custom hooks likhte waqt `eslint-plugin-react-hooks` ka `exhaustive-deps` rule zaroor on rakho.

---

## Key Takeaways

- Composition over configuration — jab boolean props ek doosre pe conditionally depend karne lagen, ye signal hai ki component ko chhote, composable pieces mein todhna chahiye, na ki naye prop add karte jaana.
- Custom hooks aaj stateful logic sharing ka default tool hain — HOCs aur render props ko sirf specific structural cases ke liye reserve karo (route-level wrapping, ya library APIs jahan max rendering flexibility chahiye).
- HOCs "wrapper hell" aur prop-name-collision problems laate hain jab multiple HOCs stack hote hain — hooks isse fundamentally avoid karte hain kyunki wo koi extra component nahi banate.
- Compound components (Context ke through) sibling components ko prop-drilling ke bina implicitly state share karne dete hain — accessible UI patterns (Tabs, Accordion, Select) ke liye ye industry-standard approach hai.
- Polymorphic `as` prop pattern ek component ko multiple underlying elements ke roop mein render karne deta hai, lekin sahi TypeScript typing (`ComponentPropsWithoutRef<C>`) ke bina type-safety kho jaati hai.
- Container/presentational split ka "principle" (fetching ko rendering se separate rakho) aaj bhi valid hai, lekin "strict separate component/file" wala rigid implementation ab custom hooks aur colocated data-fetching (Server Components, TanStack Query) ne replace kar diya hai.
- Controlled/uncontrolled ek general pattern hai (forms tak limited nahi) — real component libraries hybrid approach use karte hain: uncontrolled by default, `value`/`onChange` diye jaane pe controlled ban jaana.
- Component ko kisi doosre component ke function body ke andar define karna sabse confusing, common bug hai — isse child ka state har parent-render pe reset ho jaata hai kyunki React naya function reference dekh ke naya component type samajhta hai.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. `<Card variant="detailed" showHeader showFooter headerTitle="X" />` jaisa component design karna kyun problematic hai, aur composition ise kaise better banata hai?**

Ye "God component" anti-pattern hai jahan ek single component saari possible UI variations ko boolean/enum props ke through control karne ki koshish karta hai. Problem yeh hai ki naye use cases (jaise "header mein icon bhi chahiye") ke liye har baar naya prop add karna padta hai, jo component ke API surface ko continuously bloat karta hai, aur caller side pe ye samajhna mushkil ho jaata hai ki kaunse prop-combinations valid hain (kyunki kuch props sirf tab matter karte hain jab koi doosra prop true ho). Composition isse solve karta hai components ko chhote, single-responsibility sub-components mein todh ke (`Card.Header`, `Card.Body`, `Card.Footer`) jo `children` ke through JSX mein arrange hote hain — naya use case ab "naya prop add karo" nahi, "JSX mein differently compose karo" ban jaata hai, bina component API touch kiye.

**Q2. Custom hooks ne HOCs aur render props ko largely replace kyun kar diya? Konsi specific problems hooks solve karte hain jo unke predecessors nahi karte the?**

HOCs aur render props hooks se pehle (pre-React 16.8) stateful logic share karne ka primary tareeka the, kyunki function components state hold nahi kar sakte the. Dono patterns ka fundamental issue: wo ek **extra component layer** create karte hain logic-sharing ke liye. Multiple HOCs stack karo (`withAuth(withTheme(withLogging(Component)))`) aur React DevTools mein "wrapper hell" dikhta hai — debugging painful ho jaati hai. Render props similarly extra nesting create karte hain (`<DataProvider>{(data) => <UI data={data} />}</DataProvider>`). HOCs mein additionally prop-name collisions ka risk hai jab do HOCs same-named prop inject karte hain. Custom hooks in dono problems ko avoid karte hain kyunki ek hook sirf **values return karta hai** — koi wrapping component nahi banta, aur multiple hooks use karna sirf multiple function calls hain, koi nesting nahi.

**Q3. Ek scenario do jahan HOC pattern aaj bhi custom hook se better fit hai.**

Route-level auth guarding — jaise ek page-level wrapper jo kisi bhi route component ko "protect" kare bina us route component ke andar hook call kiye. Hooks ko call hone ke liye ek specific component instance ke andar hona zaroori hai; route configuration (jaise `{ path: "/dashboard", element: <ProtectedDashboard /> }`) mein koi single component instance nahi hota jiske andar hook seedha call ho sake — yahan structural wrapping (`withAuth(Dashboard)`) genuinely better fit hai kyunki concern "outside" se apply ho raha hai, component ke internal logic ka hissa nahi hai.

**Q4. Compound components pattern mein Context ka role kya hai, aur ye prop drilling se kaise better hai?**

Compound components (jaise `<Tabs><Tabs.List><Tabs.Tab/></Tabs.List></Tabs>`) internally ek Context create karte hain jisme shared state (jaise `activeTab`, aur usse change karne wala function) rehta hai. Sub-components (`Tab`, `TabPanel`) is Context ko `useContext` se implicitly consume karte hain, bina root component ko explicitly har sub-component ko props pass karne ki zaroorat ke. Prop drilling ke comparison mein ye better hai kyunki: (1) intermediate layers (jaise `TabsList`, jo sirf layout wrapper hai) ko un values ka koi idea nahi rakhna padta jo sirf deeper children ko chahiye, (2) consumer flexibly children ko rearrange/nest kar sakta hai bina explicit prop-passing chain todhe.

**Q5. Polymorphic `as` prop pattern ko TypeScript mein correctly type karne ka challenge kya hai, aur `ComponentPropsWithoutRef<C>` kya solve karta hai?**

Naive approach (`as?: any` ya `as?: string`) type safety completely kho deta hai — TypeScript ko pata nahi chalta ki `as="a"` diye jaane pe `href` valid prop hai, ya `as="button"` pe `type="submit"` valid hai. `ComponentPropsWithoutRef<C>` (jahan `C extends ElementType` ek generic hai) TypeScript ko batata hai ki jo bhi actual element/component `as` prop mein diya jaaye, uske **native props ko automatically infer aur allow** karo, compile-time pe. Isse `Component` generic reh sakta hai lekin type-checking still full-strength rehti hai — galat prop pass karne pe (jaise `as="a"` ke saath `href` bhoolna, ya `as="button"` pe anchor-only prop dena) TypeScript error dega.

**Q6. Container/Presentational split kya tha, aur aaj ke React mein isse rigidly follow karna kyun unnecessary hai?**

Container/presentational pattern components ko strictly do categories mein split karta tha — container (data-fetching/state, no styling) aur presentational (pure rendering, props leke UI dikhana). Ye pattern class-components era mein useful tha jab function components state hold nahi kar sakte the, isliye "smart" logic sirf class mein reh sakti thi aur separate rakhna practically zaroori bhi tha. Aaj custom hooks (jaise `useUserProfile(userId)`) usi separation-of-concerns ko **function-level** pe achieve kar dete hain, bina do alag components/files banaye — data-fetching logic hook mein hai, rendering JSX mein, ek hi component file mein colocated. Server Components aur TanStack Query jaise tools ne colocated data-fetching ko normalize kar diya hai, jisse strict file-level split ki zaroorat kam ho gayi hai. Principle (fetching ko rendering se decouple rakho testing/reuse ke liye) abhi bhi valid hai — sirf mechanism badla hai.

**Q7. Controlled vs uncontrolled pattern — ye sirf form inputs ke liye specific hai ya ek general React concept hai? Ek non-form example do.**

Ye ek general pattern hai jo kisi bhi component pe apply hota hai jiska internal "state" ho — form inputs sirf sabse common example hain, lekin fundamental concept same rehta hai kisi bhi stateful UI component ke liye. Non-form example: ek `Accordion` component — controlled version mein `isOpen` prop parent se aata hai aur `onToggle` callback parent ko inform karta hai (parent decide karta hai state), uncontrolled version mein `Accordion` apna khud ka `useState` internal open/closed state maintain karta hai. Real libraries hybrid approach use karte hain — by default uncontrolled (zero-setup simplicity), lekin optional `isOpen`/`onToggle` props diye jaane pe automatically controlled mode mein switch ho jaata hai (jaise "only one accordion open at a time" jaisi cross-component coordination ke liye zaroori hota hai).

**Q8. Ye bug explain karo: ek nested component ka internal state har parent re-render pe reset ho jaata hai. Root cause kya hai?**

Ye tab hota hai jab ek component ko doosre component ke **function body ke andar** define kiya jaata hai. Har baar jab outer/parent component re-render hota hai, JavaScript us inner function definition ko **phir se evaluate** karta hai, jisse ek bilkul **naya function reference** create hota hai. React components ko unke function reference (aur position) se identify karta hai — naya reference dekh ke React ise ek completely naya component type samajhta hai, purane instance ko unmount karta hai (uska poora internal state/DOM/focus discard karke) aur naye instance ko fresh mount karta hai. Fix simple hai: inner component ko module-level (ya kam se kam outer component ke bahar) define karo, taaki uska reference render-to-render stable rahe.

**Q9. Kab render props aaj bhi ek reasonable choice hain, custom hook ke bajaye?**

Jab component ko **data ke saath-saath rendering control** bhi caller ko dena ho — matlab component sirf logic/state manage karta hai, lekin actual DOM structure decide karna caller ka kaam hai, aur ye kaafi flexible/dynamic hona chahiye. Library APIs jaise autocomplete/combobox libraries (jinme internal state jaise `isOpen`, `highlightedIndex` hota hai lekin DOM markup consumer decide karta hai) is pattern ko still use karte hain. Agar tumhe sirf **state/logic** return karna hai (koi rendering-control requirement nahi), custom hook simpler aur cleaner hai — render prop unnecessary extra component nesting create karega bina kisi extra benefit ke.

**Q10. Prop drilling kab acceptable hai, aur kab Context/compound components mein migrate karna chahiye?**

1-2 component layers tak prop drilling generally fine hai — Context ka apna cost hai (testing mein thoda extra setup, aur `useContext` consumers ka dependency implicit ho jaata hai jo grep/search se turant nahi dikhta jaise explicit props dikhte hain). Migrate karne ka signal tab aata hai jab: (1) value ko 3+ layers se pass karna pad raha ho jahan beech ke layers ko us value se koi matlab nahi (sirf pass-through kar rahe hain), (2) multiple sibling components ko same shared state chahiye jo unke common parent mein hai, jisse Context/compound-component pattern (jahan sab implicitly context consume karte hain) prop-passing chain se cleaner hota hai, ya (3) refactoring frequently in intermediate layers ko todh rahi ho sirf isliye ki drilled value ka path change ho gaya.
