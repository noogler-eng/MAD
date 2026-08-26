# Testing — Vitest, React Testing Library, MSW & Playwright

Testing wo cheez hai jo web frontend mein bhi wahi "baad mein karenge" fate face karti hai jo RN mein karti hai — aur phir ek chhota CSS refactor production mein checkout button ko silently break kar deta hai. Ye chapter wahi "test like a user" philosophy follow karta hai jo humne RN handbook ke Testing chapter mein dekhi thi (Jest + RNTL + Maestro), lekin ab web-specific tools ke saath — Vitest/Jest for unit tests, React Testing Library for component tests, MSW for network mocking, aur Playwright for full browser E2E. Underlying trade-offs same hain (fast-vs-slow, isolated-vs-realistic), lekin web ke apne unique gotchas hain: real browsers, real DOM, real network stack.

## Is chapter mein

- [1. The Testing Pyramid for Web Frontend](#pyramid)
- [2. Unit Testing with Vitest/Jest](#unit-testing)
- [3. React Testing Library — Philosophy](#rtl)
- [4. Mocking Network Requests with MSW](#msw)
- [5. E2E Testing with Playwright](#playwright)
- [6. Playwright vs Cypress — Senior Decision Framework](#playwright-vs-cypress)
- [7. Visual Regression Testing](#visual-regression)
- [8. Real-World Gotchas](#gotchas)
- [Key Takeaways](#key-takeaways)
- [🎯 Interview Questions — Senior Frontend Developer](#interview-questions)

<a id="pyramid"></a>
## 1. The Testing Pyramid for Web Frontend

Testing pyramid ek mental model hai jo batata hai tumhare test suite mein kaunse layer ke tests **kitni matra** mein hone chahiye. Web frontend ke liye ye teen layers mein divide hota hai:

| Layer | Tool | Kya test karta hai | Speed | Confidence |
|---|---|---|---|---|
| **Unit** | Vitest/Jest | Pure functions, utility logic, reducers — isolated, koi rendering nahi | Bahut fast (ms) | Low-medium |
| **Component** | Vitest/Jest + RTL | Component ka behavior user perspective se — render karo, interact karo, assert karo | Fast (sec) | Medium-high |
| **E2E** | Playwright/Cypress | Poora app, real browser mein, full user flow (login → checkout) | Slow (seconds-minutes) | Highest |

Classic pyramid shape ka matlab: **bahut saare unit tests** (foundation, fast feedback loop), **kaafi component tests** (middle layer, user-facing behavior), aur **bahut kam E2E tests** (sirf critical journeys — login, checkout, signup). Jitna upar jaoge, utna zyada confidence milta hai ki app *actually* kaam kar rahi hai, lekin utna hi zyada cost — setup complexity, runtime, aur maintenance burden — bhi lagta hai.

**Senior Dev Note — Web mein bhi E2E-heavy strategy kyun fail hoti hai:** RN handbook mein humne dekha tha ki native build times (2-10 min) E2E-heavy strategy ko impractical bana dete hain. Web mein native build ka wo specific problem nahi hai (browser reload fast hota hai), lekin underlying trade-off same hi hai, sirf different reasons se. Playwright/Cypress tests **real browser automation** hain — ek actual Chromium/Firefox/WebKit instance spin hota hai, real DOM render hota hai, real network calls jaate hain (ya intercept hote hain). Isme moving parts RN ke Maestro se bhi zyada hain: browser process launch karna, network requests ka timing, third-party scripts (analytics, ads) ka load hona, CSS animations/transitions ka complete hona, aur backend API ki availability — sab combine hoke flakiness create karte hain. Agar tumhara pura suite E2E-based hai, har chhota logic change bhi ek slow, flaky feedback loop trigger karega, aur team "red build ignore karo, re-run karo" ki habit develop kar legi — jo trust hi khatam kar deti hai. Rule of thumb same rehta hai: business logic aur component behavior ko unit/RTL se cover karo (fast, deterministic, run har save pe), aur Playwright/Cypress sirf 5-15 "must never break" user journeys ke liye reserve karo.

**Quick tip:** Agar test ka goal hai "ye function sahi output deta hai" ya "ye component sahi render hota hai given props/state" — unit ya component test candidate hai. Agar goal hai "poora flow, real browser mein, real navigation ke saath kaam karta hai ya nahi" — E2E candidate hai.

<a id="unit-testing"></a>
## 2. Unit Testing with Vitest/Jest

Sabse pehla aur sabse asaan test kya likhna chahiye? **Pure functions** — jo koi rendering involve nahi karte, sirf input leke deterministic output dete hain. Ye tests likhne mein sabse fast hain, sabse kam flaky, aur refactor karte waqt sabse zyada confidence dete hain.

**Vitest vs Jest:** Agar tumhara project Vite pe bana hai (aaj-kal zyadatar naye React/Vue projects), Vitest use karo — ye Vite-native hai, isi config/transform pipeline ko reuse karta hai jo tumhara dev server use karta hai, aur isliye setup almost zero-config hota hai aur test runs Jest se noticeably fast hote hain (esbuild-based transform, native ESM support). API level pe Vitest aur Jest almost identical hain (`describe`, `it`, `expect`, `vi.fn()` vs `jest.fn()`) — isliye Jest se migration low-friction hai, zyadatar sirf import statements badalte hain. Agar tum ek purana CRA/webpack-based project maintain kar rahe ho jahan Jest already wired hai, switch karne ki zaroorat nahi — dono production-grade hain.

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
# vitest: test runner, Vite config reuse karta hai
# @testing-library/react: component rendering + query utilities (section 3 mein detail)
# @testing-library/jest-dom: extra DOM matchers jaise toBeVisible(), toHaveTextContent()
# jsdom: browser-jaisa DOM environment Node.js ke andar simulate karta hai (asli browser nahi, lekin kaafi close)
```

```js
// vitest.config.ts
import { defineConfig } from "vitest/config"; // Vitest ka config helper import kiya
import react from "@vitejs/plugin-react"; // React JSX transform plugin, dev server jaisa hi

export default defineConfig({ // config object export kiya, Vitest ise auto-detect karega
  plugins: [react()], // JSX/TSX files ko transform karne ke liye plugin add kiya
  test: { // test-specific config block
    environment: "jsdom", // DOM APIs simulate karne ke liye jsdom environment use karo
    globals: true, // describe/it/expect ko globally available kar do, import na karna pade har file mein
    setupFiles: "./src/test/setup.ts", // har test file se pehle ye setup file run hogi (jest-dom matchers register karne ke liye)
  }, // test block close
}); // config close
```

Neeche ek `debounce()` utility ka full example hai — real-world use case: search input jahan har keystroke pe API call nahi karni, balki user ke typing rukne ke baad hi karni hai.

```ts
// utils/debounce.ts
export function debounce<Args extends unknown[]>( // generic function — kisi bhi argument shape ke saath kaam karega
  fn: (...args: Args) => void, // wrap kiya jaane wala original function
  delayMs: number // milliseconds jitna delay chahiye trigger hone se pehle
): (...args: Args) => void { // return type: same signature ka naya debounced function
  let timeoutId: ReturnType<typeof setTimeout> | undefined; // pending timer ka reference store karne ke liye, initially undefined

  return (...args: Args) => { // debounced wrapper function jo actual call site pe use hoga
    if (timeoutId !== undefined) { // agar pehle se ek timer chal raha hai
      clearTimeout(timeoutId); // usse cancel karo — naya call aaya, purana ignore karna hai
    } // if block close
    timeoutId = setTimeout(() => { // naya timer schedule karo
      fn(...args); // delay poora hone ke baad original function ko latest arguments ke saath call karo
    }, delayMs); // setTimeout ka delay parameter
  }; // wrapper function close
} // debounce close
```

```ts
// utils/debounce.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"; // Vitest ke core APIs import kiye, "vi" Jest ke "jest" jaisa hai
import { debounce } from "./debounce"; // jis function ko test karna hai

describe("debounce", () => { // related tests ko group kiya
  beforeEach(() => { // har test se pehle chalega
    vi.useFakeTimers(); // real setTimeout ko fake, controllable timer se replace kiya — waiting real time nahi lagega
  }); // beforeEach close

  afterEach(() => { // har test ke baad chalega
    vi.useRealTimers(); // fake timers ko wapas real timers se restore kiya, taaki dusre tests affect na hon
  }); // afterEach close

  it("delays the function call by the given delay", () => { // basic delay behavior test
    const fn = vi.fn(); // fake function jiske calls hum track kar sakte hain
    const debounced = debounce(fn, 300); // 300ms delay wala debounced wrapper banaya

    debounced(); // wrapper ko call kiya
    expect(fn).not.toHaveBeenCalled(); // turant assert — original function abhi tak call nahi hua (delay pending hai)

    vi.advanceTimersByTime(300); // fake clock ko 300ms aage badhaya
    expect(fn).toHaveBeenCalledTimes(1); // ab assert karo — timer poora hone ke baad exactly ek baar call hua
  }); // test close

  it("cancels the previous pending call when called again before delay", () => { // rapid-fire calls test — real debounce use case
    const fn = vi.fn(); // fake function
    const debounced = debounce(fn, 300); // 300ms debounced wrapper

    debounced(); // pehla call — timer #1 start
    vi.advanceTimersByTime(200); // 200ms guzre, abhi 300 poore nahi hue
    debounced(); // dusra call aaya — pehla timer cancel hoga, naya timer #2 start hoga
    vi.advanceTimersByTime(200); // aur 200ms guzre (total 400ms se pehla call ke, lekin 200ms se doosra)
    expect(fn).not.toHaveBeenCalled(); // assert — abhi tak call nahi hua kyunki doosre call ka 300ms poora nahi hua

    vi.advanceTimersByTime(100); // baaki 100ms aage badhaya, doosre timer ke poore 300ms ho gaye
    expect(fn).toHaveBeenCalledTimes(1); // assert — ab exactly ek baar call hua, sirf latest args ke saath
  }); // test close
}); // describe block close
```

<a id="rtl"></a>
## 3. React Testing Library — Philosophy

React Testing Library (RTL) ki core philosophy ek line mein wahi hai jo RNTL ki thi: **"test like a user, not implementation details."** Matlab tumhare tests ko component ke internal state, props, ya CSS class names ko directly access nahi karna chahiye — balki wahi query karo jo ek real user browser mein *dekh* sakta hai ya *interact* kar sakta hai: visible text, accessibility role (button, textbox, heading), ya label.

Isse fayda: agar tum component ka internal implementation refactor karte ho (jaise `useState` se `useReducer`, ya CSS Modules se Tailwind classes) bina user-facing behavior change kiye, tests **pass hote rehte hain** — kyunki wo implementation detail ko jaante hi nahi the. Yehi refactor-resistance long-term maintenance ke liye sabse valuable property hai.

| API | Kaam |
|---|---|
| `render()` | Component ko jsdom-based virtual DOM mein render karta hai |
| `screen` | Global query object — render ke baad DOM mein jo bhi hai use query karne ke liye |
| `getByRole()` | Accessibility role se element dhoondta hai (button, textbox, heading) — most preferred query |
| `fireEvent` | Low-level, single synthetic DOM event dispatch karta hai (click, change) |
| `userEvent` | Higher-level API — real browser interaction ki poori sequence simulate karta hai (async) |
| `waitFor` | Async UI update ka wait karta hai — state update ke baad DOM change hone tak retry karta hai |

**`userEvent` vs `fireEvent`:** `fireEvent.click()` sirf ek single synthetic `click` event dispatch karta hai — DOM level pe minimal. Real user jab button click karta hai, browser actually multiple events fire karta hai sequence mein (`pointerdown`, `mousedown`, `focus`, `pointerup`, `mouseup`, `click`), aur type karte waqt har character ke liye `keydown`/`keypress`/`input`/`keyup` full cycle chalta hai. `userEvent` ye poori realistic sequence simulate karta hai, plus disabled elements pe interact karne ki koshish karne pe sahi tarah fail hota hai (jaise real browser karega). Isliye `userEvent` modern best practice hai — `fireEvent` sirf low-level edge cases ke liye reserve karo jahan tumhe ek specific single event control karna ho.

Ab ek full example — `LoginForm` component aur uska test, line-by-line commented.

```tsx
// components/LoginForm.tsx
import { useState } from "react"; // form field state ke liye useState chahiye

type Props = { // component props ka type
  onSubmit: (email: string, password: string) => Promise<void>; // parent se aane wala async submit handler
}; // Props type close

export function LoginForm({ onSubmit }: Props) { // LoginForm component, onSubmit prop destructure kiya
  const [email, setEmail] = useState(""); // email input ka controlled state
  const [password, setPassword] = useState(""); // password input ka controlled state
  const [error, setError] = useState(""); // validation/submit error message ka state

  const handleSubmit = async (e: React.FormEvent) => { // form submit hone pe chalne wala async handler
    e.preventDefault(); // browser ka default full-page-reload-on-submit behavior rokna zaroori hai
    if (!email) { // agar email khaali hai
      setError("Email required"); // error message set karo
      return; // aage mat badho, API call mat karo
    } // if block close
    try { // error handling ke liye try block
      await onSubmit(email, password); // parent ka submit handler call karo, await karo kyunki async hai
      setError(""); // success pe purana error clear kar do
    } catch { // agar onSubmit reject ho (jaise galat password, 401 response)
      setError("Invalid credentials"); // user ko readable error dikhao
    } // try/catch close
  }; // handleSubmit close

  return ( // JSX return
    <form onSubmit={handleSubmit}> {/* form tag — Enter key se bhi submit chalega, native browser behavior */}
      <label htmlFor="email">Email</label> {/* accessible label, input se htmlFor/id ke through linked */}
      <input // email input field
        id="email" // label se link karne ke liye id
        type="email" // browser-level email validation hint bhi milta hai isse
        value={email} // controlled input — value state se bound
        onChange={(e) => setEmail(e.target.value)} // har keystroke pe state update
      />
      <label htmlFor="password">Password</label> {/* password field ka accessible label */}
      <input // password input field
        id="password" // label linking ke liye
        type="password" // characters ko mask karega browser mein
        value={password} // controlled value
        onChange={(e) => setPassword(e.target.value)} // keystroke pe update
      />
      <button type="submit">Submit</button> {/* submit button — accessible role "button" as text "Submit" */}
      {error ? <p role="alert">{error}</p> : null} {/* error hone pe hi error text render karo, role="alert" screen readers ke liye */}
    </form>
  ); // return close
} // component function close
```

```tsx
// components/LoginForm.test.tsx
import { render, screen, waitFor } from "@testing-library/react"; // RTL ke core utilities import kiye
import userEvent from "@testing-library/user-event"; // realistic user interaction simulate karne wala package
import { describe, it, expect, vi } from "vitest"; // Vitest APIs
import { LoginForm } from "./LoginForm"; // jis component ko test karna hai

describe("LoginForm", () => { // sab LoginForm tests ko group kiya
  it("shows error when email is empty", async () => { // validation test case
    const onSubmit = vi.fn(); // fake onSubmit prop, taaki actual API call na ho
    const user = userEvent.setup(); // userEvent ka session setup kiya — internally realistic timing simulate karta hai
    render(<LoginForm onSubmit={onSubmit} />); // component ko DOM mein render kiya

    await user.click(screen.getByRole("button", { name: "Submit" })); // Submit button ko accessible role+name se dhoondha aur click kiya

    expect(await screen.findByRole("alert")).toHaveTextContent("Email required"); // async query — error render hone ka wait karta hai, phir text assert
    expect(onSubmit).not.toHaveBeenCalled(); // assert — validation fail hone pe API call bilkul nahi hui
  }); // test case close

  it("submits with entered credentials", async () => { // happy-path test case
    const onSubmit = vi.fn().mockResolvedValue(undefined); // onSubmit ko resolve karne wala mock (success simulate)
    const user = userEvent.setup(); // fresh userEvent session
    render(<LoginForm onSubmit={onSubmit} />); // render karo

    await user.type(screen.getByLabelText("Email"), "sharad@clear.in"); // label text se input dhoondha, realistic typing simulate kiya
    await user.type(screen.getByLabelText("Password"), "secret123"); // password field mein type kiya
    await user.click(screen.getByRole("button", { name: "Submit" })); // submit button click kiya

    await waitFor(() => { // waitFor — async state update poora hone tak retry karta rehta hai
      expect(onSubmit).toHaveBeenCalledWith("sharad@clear.in", "secret123"); // assert — sahi values ke saath call hua
    }); // waitFor close
  }); // test case close

  it("shows error when onSubmit rejects", async () => { // failure-path test case
    const onSubmit = vi.fn().mockRejectedValue(new Error("401")); // onSubmit ko reject karne wala mock (galat credentials simulate)
    const user = userEvent.setup(); // userEvent session
    render(<LoginForm onSubmit={onSubmit} />); // render karo

    await user.type(screen.getByLabelText("Email"), "sharad@clear.in"); // email bhara
    await user.click(screen.getByRole("button", { name: "Submit" })); // submit dabaya

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials"); // catch block wala error message dikha
  }); // test case close
}); // describe block close
```

**Gotcha — `getBy` vs `findBy` vs `queryBy`:** `getByX` turant throw karega agar element nahi mila (sync). `findByX` async hai — andar hi andar `waitFor` use karta hai, isliye state update ke baad aane wale elements ke liye ye sahi choice hai. `queryByX` throw nahi karta, `null` return karta hai — isko use karo jab tum assert kar rahe ho ki koi element **absent** hai (`expect(screen.queryByRole("alert")).toBeNull()`).

<a id="msw"></a>
## 4. Mocking Network Requests with MSW (Mock Service Worker)

Purana approach network mocking ke liye tha: `fetch` ya `axios` ko module-level mock kar do (`vi.mock("axios")` ya `global.fetch = vi.fn()`), phir manually har call pe fake response return karo. Ye kaam karta hai lekin ek fundamental problem hai — tum apne actual data-fetching code ko test hi nahi kar rahe ho, tum sirf assert kar rahe ho ki "fetch ko sahi arguments ke saath call kiya gaya." Agar tumhara actual `fetch(url, options)` call malformed hai (galat header, galat URL construction, missing query param), module mock ye kabhi catch nahi karega — kyunki `fetch` khud replace ho gaya hai, uske andar ka real network-request-building logic kabhi chala hi nahi.

**MSW is the modern best practice** kyunki ye network **level** pe intercept karta hai, module level pe nahi. Browser mein ye ek actual Service Worker register karta hai jo outgoing requests ko intercept karta hai; Node.js/test environment mein ye ek request interceptor use karta hai jo `fetch`/`http` module ke level pe hook karta hai. Matlab: tumhara application code **real** `fetch()` call karta hai, exactly jaisa production mein karega — request actually banti hai, URL construct hoti hai, headers set hote hain — aur MSW usse network boundary pe intercept karke fake response deta hai. Tum apna **actual data-fetching code path** test kar rahe ho, ek mocked-out stub nahi.

```bash
npm install -D msw
# msw: network-level request interception, browser Service Worker + Node interceptor dono support karta hai
```

```ts
// mocks/handlers.ts
import { http, HttpResponse } from "msw"; // MSW ke core APIs — "http" request matcher banata hai, "HttpResponse" response banata hai

export const handlers = [ // saare handlers ka array — jitne bhi endpoints mock karne hain
  http.get("/api/users", () => { // GET /api/users route ke liye handler define kiya
    return HttpResponse.json([ // JSON response banaya, Content-Type header automatically set hota hai
      { id: "1", name: "Sharad" }, // fake user 1
      { id: "2", name: "Riya" }, // fake user 2
    ]); // response array close
  }), // GET /api/users handler close

  http.get("/api/users/:id", ({ params }) => { // dynamic path param — :id URL se extract hoga
    const { id } = params; // params object se id nikaala
    if (id === "404") { // special-case test scenario — 404 simulate karne ke liye
      return new HttpResponse(null, { status: 404 }); // empty body, 404 status — real not-found response jaisa
    } // if close
    return HttpResponse.json({ id, name: "Sharad" }); // matched id ke saath fake user return kiya
  }), // dynamic route handler close
]; // handlers array close
```

```ts
// mocks/server.ts
import { setupServer } from "msw/node"; // Node.js environment (test runs) ke liye MSW server setup
import { handlers } from "./handlers"; // upar define kiye gaye handlers import kiye

export const server = setupServer(...handlers); // handlers ke saath ek mock server instance banaya, tests mein use hoga
```

```ts
// src/test/setup.ts
import { beforeAll, afterEach, afterAll } from "vitest"; // Vitest ke lifecycle hooks
import "@testing-library/jest-dom/vitest"; // jest-dom matchers ko Vitest ke expect mein register kiya
import { server } from "../../mocks/server"; // MSW mock server import kiya

beforeAll(() => server.listen({ onUnhandledRequest: "error" })); // saare tests se pehle server start karo; unmocked request aaye toh error throw karo (silent bugs pakadne ke liye)
afterEach(() => server.resetHandlers()); // har test ke baad handlers reset karo, taaki ek test ka runtime override doosre test ko leak na kare
afterAll(() => server.close()); // saare tests khatam hone ke baad server band karo, cleanup
```

```tsx
// components/UserList.test.tsx
import { render, screen } from "@testing-library/react"; // RTL utilities
import { describe, it, expect } from "vitest"; // Vitest APIs
import { http, HttpResponse } from "msw"; // per-test override ke liye MSW APIs
import { server } from "../../mocks/server"; // shared mock server
import { UserList } from "./UserList"; // jis component ko test karna hai — ye internally fetch("/api/users") karta hai

describe("UserList", () => { // test group
  it("renders users fetched from the API", async () => { // happy-path — default handler use hoga
    render(<UserList />); // component render kiya, ye mount hote hi real fetch("/api/users") call karega

    expect(await screen.findByText("Sharad")).toBeInTheDocument(); // async wait — network round-trip (mocked) poora hone tak
    expect(await screen.findByText("Riya")).toBeInTheDocument(); // dusra user bhi render hona chahiye
  }); // test close

  it("shows an error state when the API fails", async () => { // failure-path — is specific test ke liye handler override kiya
    server.use( // sirf is test ke liye default handler ko temporarily override kiya
      http.get("/api/users", () => { // same route, alag response
        return new HttpResponse(null, { status: 500 }); // server error simulate kiya
      }) // override handler close
    ); // server.use close

    render(<UserList />); // component render kiya, ab ye 500 response milega

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument(); // component ke error UI ko assert kiya
  }); // test close
}); // describe close
```

<a id="playwright"></a>
## 5. E2E Testing with Playwright

Playwright ek cross-browser automation framework hai — same test script Chromium, Firefox, aur WebKit (Safari ka engine) teeno pe chalti hai, jo cross-browser bugs pakadne ke liye valuable hai (jaise Safari-specific date-picker issues jo sirf WebKit pe dikhte hain). Playwright ka sabse bada differentiator **auto-waiting** hai: purane tools (Selenium) mein tumhe manually `sleep()` ya explicit wait conditions likhni padti thi ("element visible hone tak wait karo, phir click karo"). Playwright ye internally automatically karta hai — jab tum `.click()` call karte ho, ye khud element ke actionable (visible, stable, not-disabled) hone tak wait karta hai, phir click karta hai. Ye animation-timing aur network-latency-based flakiness ko drastically kam kar deta hai.

```bash
npm init playwright@latest
# ye interactively Playwright install karta hai, config file banata hai, aur browsers download karta hai (Chromium/Firefox/WebKit)
```

```ts
// e2e/login.spec.ts
import { test, expect } from "@playwright/test"; // Playwright ke test runner aur assertion library

test.describe("login flow", () => { // related E2E tests ka group
  test("user can log in and see the dashboard", async ({ page }) => { // "page" fixture — Playwright automatically ek fresh browser tab deta hai
    await page.goto("/login"); // login page pe navigate kiya, baseURL config se resolve hota hai

    await page.getByLabel("Email").fill("sharad@clear.in"); // accessible label se email field dhoonda aur fill kiya
    await page.getByLabel("Password").fill("secret123"); // password field fill kiya
    await page.getByRole("button", { name: "Submit" }).click(); // Submit button ko role+name se click kiya — auto-waits internally

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible(); // navigation ke baad dashboard heading visible hone ka assertion — auto-retries jab tak timeout na ho
    await expect(page).toHaveURL(/\/dashboard$/); // URL bhi assert kiya — confirm karta hai actual navigation hua, sirf UI text nahi badla
  }); // test close

  test("shows an error for invalid credentials", async ({ page }) => { // failure-path E2E test
    await page.goto("/login"); // login page pe gaye

    await page.getByLabel("Email").fill("wrong@clear.in"); // galat email
    await page.getByLabel("Password").fill("wrongpass"); // galat password
    await page.getByRole("button", { name: "Submit" }).click(); // submit kiya

    await expect(page.getByRole("alert")).toHaveText("Invalid credentials"); // real backend (ya test backend) se aaya error message assert kiya
    await expect(page).toHaveURL(/\/login$/); // confirm karo login page pe hi reh gaye, redirect nahi hua
  }); // test close
}); // describe close
```

```bash
npx playwright test # saare e2e/*.spec.ts files ko headless mode mein run karo, saare configured browsers pe
npx playwright test --ui # interactive UI mode — step-by-step timeline, DOM snapshots, time-travel debugging
npx playwright test login.spec.ts --headed # ek specific file ko real visible browser window mein run karo, debugging ke liye
npx playwright show-report # last run ka HTML report kholo — failures ke screenshots/traces ke saath
```

**Senior Dev Note:** Playwright har failed test ke liye automatically trace, screenshot, aur video capture kar sakta hai (config mein `trace: "on-first-retry"` set karke) — CI mein flaky failure debug karne ke liye ye invaluable hai, kyunki tumhe locally reproduce karne ki koshish nahi karni padti, seedha trace file dekh sakte ho ki exact us moment pe DOM kaisa tha.

<a id="playwright-vs-cypress"></a>
## 6. Playwright vs Cypress — Senior Decision Framework

Dono popular E2E tools hain lekin fundamentally different architecture pe bane hain, aur ye architecture difference hi unki strengths/weaknesses decide karti hai.

**Cypress** apne test code ko **browser ke andar** run karta hai, same execution context mein jaha application chal rahi hai. Isse fayda: debugging experience simpler hai — Cypress ka signature feature "time-travel debugging" hai jaha tum test run ke har step ka DOM snapshot dekh sakte ho, browser DevTools directly available hain. Nuksaan: architecturally ye historically single-tab, single-origin limited raha hai (recent versions ne multi-tab/cross-origin support add kiya hai lekin workarounds ke saath), aur cross-browser support (Firefox, WebKit) baad mein aayi aur kam mature hai compared to Playwright.

**Playwright** apne test code ko **browser se bahar** run karta hai — ek separate Node.js process browser ko ek protocol connection (jaisa Chrome DevTools Protocol) ke through control karta hai, isolated se. Isse fayda: true multi-tab, multi-browser, aur multi-context testing possible hai (ek single test mein 2 alag users ko 2 alag browser contexts mein simulate karna, jaise ek chat app test karna jaha dono sides interact karte hain) — ye Cypress mein bahut harder hai. Playwright generally CI mein faster bhi hai kyunki ye parallel workers ko efficiently manage karta hai aur browser contexts lightweight hote hain (naye browser process spin karne ki zaroorat nahi, sirf naya context).

**Recommendation for new projects:** Playwright choose karo. Iska cross-browser support mature hai, multi-context capability real-world apps (multi-user flows, iframes, popups) ke liye zaroori hoti hai, aur Microsoft ka active investment + built-in trace viewer + auto-waiting ise 2024+ ke naye projects ke liye default choice banate hain. Cypress abhi bhi valid hai agar team already deeply invested hai uske ecosystem mein (existing large suite, custom commands, plugins) — migration cost usually justify nahi hota sirf "Playwright better hai" ke liye.

<a id="visual-regression"></a>
## 7. Visual Regression Testing

Functional tests (RTL, Playwright assertions) sirf wo check karte hain jo tumne explicitly assert kiya — text present hai, button clickable hai, URL change hui. Lekin ek CSS change jo layout ko visually break kare (overlapping elements, wrong spacing, broken responsive breakpoint) bina koi text ya functionality change kiye — functional tests ise miss kar denge.

**Visual regression testing** iska solution hai: tool ek component/page ka screenshot leta hai, use ek stored "baseline" screenshot se pixel-diff karta hai, aur agar difference threshold se zyada hai toh test fail ho jaata hai. Popular options: **Chromatic** (Storybook-integrated, cloud-hosted diffing UI), **Percy** (similar, CI-integrated), ya **Playwright ka built-in `toHaveScreenshot()`** (self-hosted, free, lekin baseline images tumhe khud manage karni padti hain).

**Trade-off** — same caveat jo RN handbook ke testing chapter mein mention hua tha snapshot tests ke liye: visual regression **noisy** ho sakta hai. Font rendering, anti-aliasing, aur sub-pixel rendering CI runners ke beech (different OS, different GPU/software rendering) slightly differ kar sakte hain, jisse false-positive diffs aate hain jo actual visual bug nahi hain. Isliye ye catch karta hai jo functional tests nahi kar sakte (genuinely valuable for design-sensitive UIs), lekin threshold tuning aur consistent CI environment (same Docker image, same font set) zaroori hai warna team false positives se irritate hoke tool ko ignore karna shuru kar degi.

<a id="gotchas"></a>
## 8. Real-World Gotchas

- **Implementation details test karna** — CSS class names ya excessive `data-testid` se query karna instead of accessible roles/labels. Ye tests brittle ho jaate hain: koi bhi refactor jo class name badal de (Tailwind se CSS Modules migration, ya bas naming convention change) test ko break kar deta hai, chahe user-facing behavior bilkul same rahe ho. `getByRole`/`getByLabelText` ko default prefer karo, `testId` ko last-resort fallback rakho.
- **Async assertions ko properly await na karna** — `waitFor` ya `findBy*` ke bina, seedha `expect(screen.getByText(...))` likhna jab UI update abhi async hone wala hai. Test kabhi pass hoga, kabhi fail (machine speed, CPU load pe depend karega) — classic flaky test signature. Rule: agar assertion ke pehle koi state update/network call ho raha hai, `await`/`findBy`/`waitFor` use karo.
- **E2E tests ke beech state/data share hona** — ek test dusre test ka database record use kar leta hai (jaise test #1 ne user create kiya, test #2 assume karta hai wo user already exists). Isse order-dependent flakiness aati hai — tests individually pass hote hain lekin parallel run ya reordered run mein fail. Har E2E test ko apna khud ka isolated data setup/teardown karna chahiye (fresh test user per test, ya database transaction rollback per test).
- **Snapshot tests ko bina dekhe blindly "accept" karna** — jab snapshot test fail ho aur tum bas `--updateSnapshot`/`-u` flag chalake diff ko accept kar do bina actually review kiye ki output mein kya change hua — ye ek anti-pattern hai jo dheere-dheere test suite ki value ko zero kar deta hai. Har snapshot update ek deliberate decision honi chahiye ("ye change intentional tha, expected hai"), na ki ek reflex jo failing CI ko green karne ke liye kiya gaya.

<a id="key-takeaways"></a>
## Key Takeaways

- Testing pyramid follow karo: bahut saare fast unit tests, kaafi component tests, aur bahut kam E2E tests — sirf critical journeys ke liye.
- Vitest aur Jest API-level pe near-identical hain; Vite-based project ho toh Vitest choose karo (faster, native config reuse).
- React Testing Library ki philosophy "test like a user" hai — role/label se query karo, implementation details (class names, internal state) se nahi.
- `userEvent` ko `fireEvent` pe prefer karo — real multi-event user interaction sequences simulate karta hai, single synthetic event nahi.
- MSW network-level pe intercept karta hai, module-level mocking nahi karta — matlab tumhara actual `fetch`/`axios` code path test hota hai, ek stub nahi.
- Playwright cross-browser hai (Chromium/Firefox/WebKit) aur auto-waiting ke through flakiness kam karta hai — new projects ke liye default E2E choice.
- Playwright browser se bahar protocol-based control karta hai (true multi-context/multi-browser); Cypress browser ke andar run hota hai (simpler debugging, historically single-origin limits).
- Visual regression testing (Chromatic/Percy/Playwright screenshots) functional tests se miss hui visual bugs pakadta hai, lekin cross-CI-runner font-rendering noise ka risk leke aata hai.
- Async assertions ko always `waitFor`/`findBy` se wrap karo; test data ko har E2E test mein isolate karo; snapshot diffs ko actually review karo, blindly accept mat karo.

<a id="interview-questions"></a>
## 🎯 Interview Questions — Senior Frontend Developer

**Q1: Testing pyramid web frontend ke liye kaisi honi chahiye, aur E2E-heavy strategy web apps mein kyun problematic hai?**

A: Pyramid shape honi chahiye — bahut saare fast unit tests (pure functions/utilities), kaafi component tests (RTL se user-facing behavior), aur bahut kam E2E tests (5-15 critical journeys). E2E-heavy strategy problematic hai kyunki Playwright/Cypress real browser automation hain jinme moving parts zyada hain — browser launch, network timing, third-party scripts, CSS animations — jo sab combine hoke flakiness create karte hain. Slow, flaky feedback loop team ko "red build ignore karo" ki habit develop karwa deta hai, jo CI trust khatam kar deta hai.

**Q2: `userEvent` `fireEvent` se better kyun hai RTL mein?**

A: `fireEvent` sirf ek single synthetic DOM event dispatch karta hai (jaise sirf `click`). Real browser mein user interaction actually multiple events ki sequence trigger karta hai (`pointerdown` → `mousedown` → `focus` → `pointerup` → `mouseup` → `click`, ya typing ke liye har character pe `keydown`/`input`/`keyup`). `userEvent` ye poori realistic sequence simulate karta hai (async), plus disabled elements pe interaction ko sahi tarah fail karta hai jaisa real browser karega — isliye ye production behavior ke zyada kareeb hai.

**Q3: MSW module-level mocking (jaise `jest.mock("axios")`) se better kyun consider kiya jaata hai?**

A: Module mocking `fetch`/`axios` ko poora replace kar deta hai — matlab tumhara actual request-building code (URL construction, headers, serialization) kabhi execute hi nahi hota test mein, sirf assert hota hai ki mock function ko call kiya gaya. MSW network **level** pe intercept karta hai (Service Worker browser mein, request interceptor Node mein) — tumhara application real `fetch()` call karta hai exactly production jaisa, MSW usse boundary pe intercept karke fake response deta hai. Isse tumhara actual data-fetching code path test hota hai, ek disconnected stub nahi.

**Q4: Playwright ka "auto-waiting" kya hai aur ye flakiness kaise reduce karta hai?**

A: Purane tools (Selenium) mein developer ko manually wait conditions likhni padti thi (`sleep()` ya explicit "wait until visible"). Playwright jab bhi tum `.click()`, `.fill()` jaisi action calls karte ho, internally automatically wait karta hai ki element actionable ho (attached to DOM, visible, stable — animation complete, not disabled, receiving events) — phir action perform karta hai, ek configurable timeout tak retry karte hue. Isse timing-based race conditions (element render hone se pehle click try karna) elimination ho jaate hain jo manually-timed waits mein common flakiness source hote hain.

**Q5: Playwright aur Cypress ka architectural difference kya hai, aur ye difference kya capabilities enable/limit karta hai?**

A: Cypress apna test code browser ke andar, same execution context mein run karta hai — isse debugging simple hai (time-travel snapshots, direct DevTools access) lekin architecturally single-tab/single-origin limitations historically rahi hain. Playwright test code browser se bahar, ek protocol connection (CDP-jaisa) ke through browser ko control karta hai — isse true multi-tab, multi-browser, aur multi-context testing possible hai (ek test mein do alag users ko do alag isolated browser contexts mein simulate karna), aur parallel execution generally faster hai kyunki contexts lightweight hote hain.

**Q6: Naye project ke liye Playwright ya Cypress — kaunsa choose karoge aur kyun?**

A: Naye projects ke liye Playwright — mature cross-browser support (Chromium/Firefox/WebKit ek hi test script se), multi-context capability jo real-world multi-user flows ke liye zaroori hoti hai, built-in trace viewer jo CI debugging ko drastically easy banata hai, aur generally faster CI runs. Cypress sirf tab justify hota hai jab team already deeply invested ho uske ecosystem mein — naye project ke liye migration cost ka koi justification nahi hai.

**Q7: `getByRole`/`getByLabelText` ko `data-testid` pe kyun prefer karna chahiye?**

A: `getByRole`/`getByLabelText` wahi query karte hain jo ek real user (ya screen reader) dekh/interact kar sakta hai — accessible role, visible text, ya label. Ye do fayde dete hain: (1) tests refactor-resistant hote hain kyunki implementation details (class names, DOM structure) se decoupled hain, aur (2) as a side-effect ye tumhe accessibility issues bhi pakadne mein help karte hain — agar tumhara element `getByRole` se query hi nahi ho pa raha, matlab uska accessible markup weak hai. `data-testid` ek escape hatch hai jab koi meaningful role/label available na ho, last resort ke taur pe.

**Q8: Visual regression testing kya problem solve karta hai jo functional tests nahi kar sakte, aur iska trade-off kya hai?**

A: Functional tests (RTL assertions, Playwright element checks) sirf explicit assertions verify karte hain — text present hai, click work kar raha hai. Ek pure-CSS regression (layout break, overlapping elements, broken spacing) bina text/functionality change kiye functional tests se miss ho jaata hai. Visual regression (Chromatic/Percy/Playwright screenshots) screenshot-diff karke ye pakadta hai. Trade-off: pixel-level diffing font-rendering/anti-aliasing differences ke against bhi sensitive ho jaata hai across different CI runners/OS, jisse false-positive noise aata hai — consistent rendering environment aur tuned threshold zaroori hai isse manage karne ke liye.

**Q9: Kaunse common patterns E2E/component test suites ko flaky ya low-value bana dete hain, aur kaise fix karte ho?**

A: Char main patterns: (1) implementation-detail queries (class names/excessive testid) jo refactor pe unnecessarily break hote hain — fix: role/label-based queries; (2) async assertions bina `waitFor`/`findBy` ke — fix: har state-update-dependent assertion ko properly await karo; (3) E2E tests ke beech shared state (test A ka data test B assume karta hai) jo order-dependent failures deta hai — fix: har test apna isolated data setup/teardown kare; (4) snapshot test failures ko bina review kiye blindly `-u` flag se accept karna — fix: har snapshot update ko ek deliberate, reviewed decision banao, reflex action nahi.
