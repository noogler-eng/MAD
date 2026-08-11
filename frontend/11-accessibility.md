# Web Accessibility — Semantic HTML, ARIA, Keyboard, Focus

Ye chapter web accessibility (a11y) ka senior-level breakdown hai — same philosophy jo humne React Native handbook ke Chapter 20 mein cover ki thi ("accessibility ek nice-to-have nahi hai, ye ek real user base hai"), lekin ab hum web-specific mechanisms pe focus karenge: semantic HTML, ARIA attributes, keyboard navigation, aur focus management. Ye genuinely different beast hai RN se — web ka DOM khud accessibility tree banata hai, aur keyboard navigation ek first-class concern hai jo mobile apps mein us tarah exist nahi karta.

## Table of Contents

1. [Why Web Accessibility Is Different From Mobile](#1-why-web-accessibility-is-different-from-mobile)
2. [Semantic HTML — The First Line of Defense](#2-semantic-html--the-first-line-of-defense)
3. [ARIA — When and How to Use It](#3-aria--when-and-how-to-use-it)
4. [Keyboard Navigation and Focus Management](#4-keyboard-navigation-and-focus-management)
5. [Screen Reader Testing on Web](#5-screen-reader-testing-on-web)
6. [Color Contrast and WCAG Guidelines](#6-color-contrast-and-wcag-guidelines)
7. [Forms Accessibility](#7-forms-accessibility)
8. [Real-World Gotchas](#8-real-world-gotchas)
9. [Key Takeaways](#key-takeaways)
10. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## 1. Why Web Accessibility Is Different From Mobile

RN chapter mein humne discuss kiya tha ki accessibility "compliance checkbox" nahi hai — ye ek real user segment hai jo screen readers, switch controls, aur bade font sizes pe depend karta hai. Wo framing web pe bhi 100% apply hoti hai. Lekin web mein **do additional major concerns** hain jo mobile apps mein us intensity se exist nahi karte.

### (a) Keyboard-only navigation — sirf disability ka concern nahi hai

Mobile apps mein primary interaction touch hai — accessibility gestures (VoiceOver swipe, TalkBack swipe) ek "alternate mode" hain jo specifically screen-reader users ke liye activate hoti hain. Web pe situation different hai: **keyboard navigation ek default, always-available interaction mode hai**, aur ye sirf disability-related nahi hai:

- **Power users** jo forms fill karte waqt Tab se field-to-field jump karte hain kyunki mouse se slower hai.
- **Motor-impaired users** jo precise mouse movement nahi kar sakte, lekin keyboard (ya switch device jo keyboard events simulate karta hai) reliably use kar sakte hain.
- **Screen reader users** jo primarily keyboard se hi navigate karte hain (VoiceOver/NVDA/JAWS sab keyboard-driven hain desktop pe).
- **RSI/temporary injury** waale users jo mouse use nahi kar paate.

Matlab agar aapka web app keyboard se broken hai (koi button Tab se focus nahi ho raha, ya Enter dabane pe kaam nahi kar raha), ye sirf "accessibility violation" nahi hai — ye ek functional bug hai jo real, wide user base ko affect karta hai. RN mein iska is scale ka equivalent nahi hai.

### (b) DOM semantics directly drive assistive technology behavior

RN mein `View`/`Pressable`/`Text` jaise components ek abstraction layer hain — RN internally native iOS `UIView`/Android `View` mein compile hote hain, aur accessibility props (`accessibilityRole`, `accessibilityLabel`) explicitly set karne padte hain taaki native accessibility tree correctly build ho.

Web pe, **HTML element khud accessibility semantics carry karta hai** — browser automatically har element ko accessibility tree mein map karta hai based on uska tag. Ek `<button>` automatically "button" role, focusable, aur keyboard-activatable hota hai — bina kisi extra prop ke. Ek `<div>` by default kuch nahi hai — no role, no focus, no keyboard behavior. Ye difference itna fundamental hai ki agar aap sahi HTML element choose karte ho, accessibility ka bahut bada chunk **automatically** sahi ho jaata hai, jabki agar galat element choose karte ho, aapko manually wapas se sab kuch reimplement karna padta hai (jo hum next section mein dekhenge).

> **Senior framing:** RN mein accessibility "props add karna" hai. Web mein accessibility zyada "sahi element choose karna" hai — semantic HTML pehle, ARIA sirf jab HTML kaafi na ho, aur JavaScript-driven behavior (focus management, keyboard handlers) sabse aakhri layer jo genuinely custom interactions ke liye chahiye.

---

## 2. Semantic HTML — The First Line of Defense

Sabse important senior-level accessibility principle web pe ye hai: **sahi HTML element use karna sabse cheap, sabse robust accessibility win hai jo aap kar sakte ho.**

Jab aap `<button>` ke jagah `<div onClick={...}>` use karte ho, aapko manually reimplement karna padta hai:

1. **Keyboard focusability** — `<div>` by default Tab se focus nahi hota, isse `tabIndex="0"` add karna padta hai.
2. **Keyboard activation** — Enter aur Space dono keys se activate hona chahiye button ki tarah, isse `onKeyDown` handler likhna padta hai jo dono keys check kare.
3. **Semantic meaning for screen readers** — bina `role="button"` ke, screen reader "div" ko kuch bolega hi nahi, ya generic text ki tarah treat karega — user ko pata hi nahi chalega ye interactive hai.
4. **Disabled state handling** — real `<button disabled>` automatically focus se hat jaata hai aur click events fire nahi karta; `<div>` ke saath ye sab manually implement karna padta hai.

```jsx
// ❌ GALAT — "fake button" using a div with onClick
// Ye visually button jaisa dikh sakta hai (CSS se), lekin functionally broken hai
function FakeButton({ onSave }) {
  return (
    // div pe onClick laga diya — mouse click toh kaam karega
    <div
      className="button-style" // sirf CSS class se "button jaisa" dikhta hai
      onClick={onSave} // mouse click handler — ye kaam karega
      // <-- YAHAN kuch missing hai: no tabIndex, no onKeyDown, no role
    >
      Save Changes {/* text content, lekin screen reader ko iska "purpose" nahi pata */}
    </div>
    // Problems: (1) Tab se ye element focus hi nahi hoga
    // (2) focus ho bhi jaaye kisi tarah, Enter/Space dabane se onClick trigger nahi hoga
    // (3) screen reader sirf "Save Changes" text bolega, "button" nahi bolega — user ko
    //     pata nahi chalega ye ek actionable element hai ya sirf static text
  );
}

// ✅ SAHI — real <button> element use karo
function RealButton({ onSave }) {
  return (
    // native <button> — browser automatically iske saath sab kuch deta hai
    <button
      className="button-style" // same visual styling, CSS class reuse ho sakta hai
      onClick={onSave} // click handler — ab ye keyboard Enter/Space se bhi trigger hoga automatically
      type="button" // explicit type="button" — forms ke andar accidental submit avoid karta hai
    >
      Save Changes {/* screen reader bolega: "Save Changes, button" — role automatically announce hota hai */}
    </button>
    // Free features jo browser deta hai: Tab-focusable, Enter/Space activates onClick,
    // screen reader announces "button" role, :focus-visible outline automatically applicable,
    // disabled attribute se disabled state properly handle hota hai
  );
}
```

Ye sirf buttons tak limited nahi hai — same principle poore document structure pe apply hoti hai:

```html
<!-- ❌ GALAT — generic divs se page structure banaya gaya, koi semantic meaning nahi -->
<div class="header">
  <!-- ye "header" hai ye sirf CSS class name se pata chal raha hai, browser/screen reader ko nahi -->
  <div class="nav">
    <!-- navigation links yahan hain, lekin <nav> nahi hai isliye AT (assistive tech) ko landmark nahi milta -->
    <div class="link">Home</div>
    <!-- link jaisa dikhta hai, lekin <a> nahi hai — keyboard se focus/activate nahi hoga -->
  </div>
</div>
<div class="content">
  <!-- main content area, lekin <main> nahi hai -->
  <div class="title">Welcome</div>
  <!-- heading jaisa dikhta hai lekin <h1> nahi hai — screen reader "heading" announce nahi karega -->
</div>

<!-- ✅ SAHI — semantic elements se same page banaya gaya -->
<header>
  <!-- <header> landmark — screen reader users "jump to header" shortcut use kar sakte hain -->
  <nav aria-label="Main navigation">
    <!-- <nav> landmark, plus aria-label kyunki agar multiple nav elements hon (Section 3 mein detail) -->
    <a href="/">Home</a>
    <!-- real <a> — automatically focusable, Enter se activate, screen reader "link" bolega -->
  </nav>
</header>
<main>
  <!-- <main> landmark — screen reader users direct "skip to main content" kar sakte hain -->
  <h1>Welcome</h1>
  <!-- real heading — screen reader "heading level 1" announce karega, aur users heading-by-heading navigate kar sakte hain -->
</main>
```

### Heading hierarchy — `<h1>`–`<h6>` order matters

Screen reader users ek page ko **headings ke through skim** karte hain — bahut common navigation pattern hai "next heading" shortcut dabate rehna jab tak relevant section na mile (jaisa sighted user visually scan karta hai page ko). Isliye heading levels **hierarchically nested** hone chahiye — `<h1>` page ka main title, `<h2>` major sections, `<h3>` unke sub-sections, bina level skip kiye (jaise `<h1>` se directly `<h4>` pe jump mat karo sirf isliye kyunki `<h4>` ka default font-size chhota chahiye tha — font size CSS se control karo, heading level semantic hierarchy se).

```html
<!-- ✅ SAHI heading hierarchy — logical nesting, koi level skip nahi -->
<h1>Product Dashboard</h1>
<!-- page ka ek hi h1 — main title -->

<h2>Recent Orders</h2>
<!-- major section -->
<h3>Pending</h3>
<!-- sub-section of "Recent Orders" -->
<h3>Delivered</h3>
<!-- sibling sub-section -->

<h2>Account Settings</h2>
<!-- next major section — h2 level maintained, h1 se directly nahi jump kiya -->
```

### Label association — `<label>` ka `for`/`id` link

Form inputs ke saath `<label>` ko properly associate karna zaroori hai taaki screen reader input ka purpose bole, aur taaki label pe click karne se bhi input focus ho jaaye (bada, easier-to-hit click target — motor-impaired users ke liye bhi helpful):

```html
<!-- ✅ SAHI — label ka "for" attribute input ke "id" se match karta hai -->
<label for="email-input">Email Address</label>
<!-- for="email-input" — ye "id=email-input" waale element se programmatically linked hai -->
<input type="email" id="email-input" name="email" />
<!-- id matches — ab label click karne se input focus hoga, aur screen reader "Email Address, edit text" bolega -->

<!-- ✅ ALTERNATIVE SAHI approach — wrapping (koi id/for match ki zaroorat nahi) -->
<label>
  Email Address
  <!-- label text directly wrapper ke andar -->
  <input type="email" name="email" />
  <!-- input label ke andar nested — implicit association ban jaata hai -->
</label>
```

Section 7 mein forms accessibility detail se cover karenge (error messages, `aria-describedby`, `aria-invalid`).

---

## 3. ARIA — When and How to Use It

**"First Rule of ARIA":** agar koi native HTML element ya attribute already wo semantics/behavior de raha hai jo aapko chahiye, ARIA use mat karo. ARIA ek **last resort** hai — un cases ke liye jinhe HTML genuinely express nahi kar sakta natively: custom widgets jaise tab panels, comboboxes, modal dialogs, custom sliders, autocomplete lists.

Ek common mistake ye hai ki developers ARIA ko "extra accessibility sprinkle" ki tarah treat karte hain — jaise `<div role="button">` likhna, jabki bas `<button>` use kar lete toh saari native behavior (keyboard, focus, activation) **free** mein milti. ARIA sirf **role announce** karta hai — ye keyboard interactivity ya focus behavior automatically nahi deta. `<div role="button">` likhne ka matlab hai ab aapko manually `tabIndex="0"` aur `onKeyDown` (Enter/Space check) bhi likhna padega — jo kaam `<button>` free mein karta.

> **Rule of thumb:** ARIA use karo tabhi jab HTML mein koi native equivalent hi na ho. Kabhi ARIA use mat karo sirf isliye ki native element ki styling "control karna mushkil" lag raha hai — CSS se `<button>` ko kaise bhi style kiya ja sakta hai.

### Common ARIA patterns

| Attribute | Kaam |
|---|---|
| `role` | Element ka semantic type jab HTML tag khud express nahi kar sakta (e.g. `role="dialog"`, `role="tablist"`) |
| `aria-label` | Element ka spoken/accessible name, jab visible text label nahi hai (e.g. icon-only close button) |
| `aria-labelledby` | Element ka accessible name kisi **doosre existing element** ke text se lo (ID reference se) |
| `aria-expanded` | Boolean — batata hai collapsible element (dropdown, accordion) currently open hai ya closed |
| `aria-hidden` | Element ko accessibility tree se hide karo — sirf decorative/duplicate content ke liye, kabhi focusable content pe mat lagao |
| `aria-live` | Dynamically-updating region — screen reader ko batata hai ki jab content change ho, use announce karo (bina user ko explicitly focus kiye) |

### Full example — accessible custom modal dialog

Modal dialog ek classic case hai jahan native HTML `<dialog>` element kaafi kar sakta hai in modern browsers, lekin bahut sare codebases custom-built modals use karte hain (animation control, design system consistency ke liye) — is case mein ARIA zaroori ho jaata hai:

```jsx
import { useEffect, useRef } from "react"; // hooks — side-effects aur DOM ref access ke liye

// Accessible modal dialog component — proper ARIA roles, labels, aur focus handling ke saath
function AccessibleModal({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null); // modal container ka DOM reference — focus trap ke liye chahiye
  const previouslyFocusedElement = useRef(null); // modal khulne se pehle jo element focused tha, usse yaad rakho

  useEffect(() => {
    // ye effect sirf tab chalega jab isOpen value change ho
    if (isOpen) {
      // modal khul raha hai — pehle current active element save karo
      previouslyFocusedElement.current = document.activeElement; // taaki modal band hone pe wapas yahan focus laut sake
      dialogRef.current?.focus(); // modal khulte hi focus ko modal container ke andar bhejo (screen reader turant "dialog" announce karega)
    } else if (previouslyFocusedElement.current) {
      // modal band ho gaya — focus wapas us element pe le jao jahan se modal trigger hua tha
      previouslyFocusedElement.current.focus(); // ye zaroori hai — warna focus "kho" jaata hai, keyboard user confuse ho jaata
    }
  }, [isOpen]); // dependency array — sirf isOpen change hone pe re-run ho

  // Keyboard handler — Escape se close, aur Tab ko modal ke andar trap karo
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      // Escape key press hua
      onClose(); // modal close karo — common, expected keyboard pattern har OS mein
      return; // aur kuch check karne ki zaroorat nahi
    }

    if (event.key === "Tab") {
      // Tab key press hua — focus trap logic yahan chalega
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        // saare focusable elements dhoondo modal ke andar — buttons, links, inputs, explicit tabIndex
      );
      const first = focusableElements[0]; // pehla focusable element modal mein
      const last = focusableElements[focusableElements.length - 1]; // aakhri focusable element modal mein

      if (event.shiftKey && document.activeElement === first) {
        // Shift+Tab pe agar hum pehle element pe hain (backward navigation ka start)
        event.preventDefault(); // default browser Tab behavior rokdo
        last.focus(); // wrap around — aakhri element pe focus le jao
      } else if (!event.shiftKey && document.activeElement === last) {
        // plain Tab pe agar hum aakhri element pe hain (forward navigation ka end)
        event.preventDefault(); // default Tab behavior rokdo
        first.focus(); // wrap around — pehle element pe wapas
      }
      // agar in dono conditions mein se koi match nahi, normal Tab behavior chalne do (modal ke andar hi rahega)
    }
  };

  if (!isOpen) return null; // modal band hai toh kuch render mat karo

  return (
    // overlay — background click se bhi close ho sakta hai (optional UX pattern)
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef} // DOM reference attach — focus() call karne ke liye upar use hua
        className="modal-dialog"
        role="dialog" // ARIA role — screen reader ko batata hai ye ek dialog/modal hai (native <dialog> na use karne ki wajah se explicit)
        aria-modal="true" // batata hai ki ye modal hai — background content abhi "inert" hai, screen reader usse skip karega
        aria-labelledby="modal-title" // accessible name is dialog ka — "modal-title" id waale element ke text se aayega
        tabIndex={-1} // programmatically focusable (dialogRef.current.focus() kaam karega) lekin natural Tab sequence mein NAHI hai
        onKeyDown={handleKeyDown} // upar defined keyboard handler — Escape + focus trap dono yahan se chalte hain
        onClick={(e) => e.stopPropagation()} // dialog ke andar click se overlay ka onClose trigger na ho (event bubbling rokdo)
      >
        <h2 id="modal-title">{title}</h2>
        {/* id="modal-title" — yahi id upar aria-labelledby mein reference hua, isse dialog ka spoken name banta hai */}

        <div className="modal-body">{children}</div>
        {/* actual modal content — form, message, jo bhi caller pass kare */}

        <button
          onClick={onClose} // close button ka click handler
          aria-label="Close dialog" // real <button> hone ke bawajood explicit label, kyunki icon-only ho sakta hai
        >
          ✕ {/* visual close icon — aria-label already accessible name de raha hai isliye ye icon text redundant-but-harmless hai */}
        </button>
      </div>
    </div>
  );
}

export default AccessibleModal; // component export
```

Key ARIA/focus decisions is example mein:

- `role="dialog"` + `aria-modal="true"` — screen reader ko batata hai ye ek modal context hai, background content temporarily irrelevant hai.
- `aria-labelledby` — dialog ka naam heading text se reuse ho raha hai, duplicate string maintain nahi karni padi.
- `tabIndex={-1}` on the dialog container — programmatically focusable (JS se `.focus()` call ho sakta hai) lekin Tab sequence mein khud shamil nahi (Section 4 mein `tabIndex` values detail se explain honge).
- Manual focus trap (`handleKeyDown` ka Tab-handling part) — bina iske, Tab se focus modal se bahar background content pe chala jaata, jo ek **bahut common, real accessibility bug** hai.

---

## 4. Keyboard Navigation and Focus Management

### Tab order — natural DOM order default hai

By default, Tab key page ke DOM order mein hi move karta hai — jo element source code mein pehle aata hai, wo Tab sequence mein pehle focus hota hai. Ye almost hamesha wahi order hona chahiye jo visually logical hai.

### `tabIndex` values — sirf teen values samajhna kaafi hai

```html
<!-- tabIndex ki teen practically-useful values: -->

<!-- 1. tabIndex NAHI diya (default) — natural DOM order mein Tab-focusable, agar element natively focusable hai -->
<button>Default Button</button>
<!-- <button> already natively focusable hai, koi tabIndex zaroorat nahi -->

<!-- 2. tabIndex="0" — non-natively-focusable element ko natural Tab order mein LAAO -->
<div tabIndex="0" role="button" onClick={...}>
  <!-- tabIndex="0" is div ko Tab-focusable banata hai, DOM position ke hisaab se natural order mein -->
  Custom Interactive Element
</div>

<!-- 3. tabIndex="-1" — element ko PROGRAMMATICALLY focusable banao, lekin Tab sequence se HATA do -->
<div tabIndex="-1" id="modal-container">
  <!-- Tab dabane se ye kabhi focus nahi hoga, lekin JS se element.focus() call karke focus ho sakta hai -->
  Modal content
</div>

<!-- ❌ AVOID — positive tabIndex values (1, 2, 3, ...) -->
<input tabIndex="3" />
<input tabIndex="1" />
<input tabIndex="2" />
<!-- Ye ek CUSTOM tab order create karte hain jo DOM order se completely disconnect hai —
     maintainer ko in numbers ko globally track karna padega, aur naya element add karte
     waqt sabko renumber karna pad sakta hai. Extremely fragile, avoid karo — DOM order
     ko hi sahi rakho instead. -->
```

Positive `tabIndex` values ek anti-pattern hain kyunki har naya component/refactor un numbers ko break kar sakta hai — aur do developers alag components mein independently `tabIndex="1"` use kar sakte hain bina ek dusre ko jaante, jisse conflicting/confusing tab order ban jaata hai. Sahi solution almost hamesha ye hai ki DOM order ko hi visually-logical order mein rakho (CSS se visually reposition kar sakte ho `order`/`flex` se bina DOM order badle).

### Focus trapping in modals

Jaisa Section 3 ke modal example mein dikhaya, jab modal open hai, Tab **cycle within the modal** hona chahiye — background page ke elements ko Tab se reach nahi hona chahiye. Iske bina, ek common bug hota hai: user modal ke last button pe Tab dabata hai, focus **modal ke peeche wali page** pe chala jaata hai — visually modal abhi bhi screen pe hai, lekin keyboard focus ek invisible (overlay ke peeche) element pe hai. Sighted keyboard user confused ho jaata hai ("main kahan hoon"), aur screen reader user ke liye ye aur bhi disorienting hai kyunki wo announcement sunega jo visually kahin dikh hi nahi raha.

### Visible focus indicators — `:focus-visible`

```css
/* ❌ GALAT — outline hata diya bina koi replacement diye */
button:focus {
  outline: none; /* visual focus indicator completely gayab ho gaya */
  /* Ab koi bhi keyboard user (sighted ya screen-reader dono) ye nahi bata sakta ki
     kaunsa element currently focused hai — pure app keyboard se navigate karna
     guesswork ban jaata hai */
}

/* ✅ SAHI — :focus-visible use karo, jo sirf keyboard-driven focus pe outline dikhata hai */
button:focus-visible {
  outline: 2px solid #2f81f7; /* clear, visible focus ring */
  outline-offset: 2px; /* thoda gap outline aur element ke beech, better visual clarity */
}

button:focus:not(:focus-visible) {
  outline: none; /* mouse-click se focus hone pe outline hide karo (visual noise kam) */
  /* :focus-visible browser heuristic use karta hai — keyboard navigation pe outline
     dikhega, mouse click pe generally nahi (jo mostly sighted mouse users ke liye
     "unnecessary" visual clutter hota hai) */
}
```

`outline: none` lagana bina replacement diye ek **extremely common, purely aesthetic** decision hai — designer/developer ko lagta hai default browser outline "ugly" hai, toh globally hata dete hain. Iska real-world impact: keyboard-only users (motor-impaired, power users, screen-reader users) ke liye pura app effectively unusable ho jaata hai kyunki unhe pata hi nahi chalta focus kahan hai. Section 8 mein hum dekhenge ki ye specifically **CSS resets** mein kitna common bug hai.

---

## 5. Screen Reader Testing on Web

RN chapter mein humne emphasize kiya tha ki manual screen-reader testing (screen off/eyes closed) hi "the real test" hai, na ki linters. Same philosophy web pe bhi apply hoti hai — **automated tools sirf partial coverage dete hain, real navigation hi asli truth batata hai.**

### Practical workflow

| Tool | Platform | Kaise on karo |
|---|---|---|
| **VoiceOver** | macOS | `Cmd + F5` (ya System Settings → Accessibility → VoiceOver) |
| **NVDA** | Windows | Free download (nvaccess.org), most widely-used free Windows screen reader |
| **JAWS** | Windows | Paid, enterprise-common, especially banking/govt sites mein |
| **TalkBack** | Android Chrome | Settings → Accessibility → TalkBack |

Sabse effective practice: screen reader on karo, **monitor off kar do ya eyes band kar lo**, aur try karo apni app ka core flow navigate karna sirf audio feedback se. Agar aap khud confuse ho jaate ho ki "main kahan hoon" ya "kya focused hai", real users bhi confuse honge.

### Browser + screen-reader combination quirks — web-specific complexity

Ye ek genuine web-specific extra layer hai jo RN mein us intensity se exist nahi karta (RN mein sirf iOS↔VoiceOver aur Android↔TalkBack — do simple pairs). Web pe, **same ARIA pattern different browser+screen-reader combinations mein different behave kar sakta hai**:

- NVDA + Firefox ka combination generally sabse "spec-compliant" behavior deta hai kai ARIA patterns ke liye.
- VoiceOver + Safari kabhi kabhi kuch `aria-live` announcements ko different timing pe process karta hai VoiceOver + Chrome ke comparison mein.
- JAWS + Chrome enterprise environments mein common hai, aur kuch legacy ARIA patterns ke saath quirks hain jo NVDA mein nahi dikhte.

Senior-level takeaway: agar aap ek public-facing, high-traffic product bana rahe ho, **kam se kam 2 combinations** pe test karna (e.g. NVDA+Chrome aur VoiceOver+Safari) high-value hai — sirf ek combination pe "works fine" test karna false confidence de sakta hai.

---

## 6. Color Contrast and WCAG Guidelines

WCAG (Web Content Accessibility Guidelines) contrast ratio requirements define karta hai, **AA level** (jo most teams industry-standard target ke roop mein use karte hain):

- **Normal text:** minimum **4.5:1** contrast ratio (text color vs background color)
- **Large text** (18pt+ regular, ya 14pt+ bold): minimum **3:1**

### Checking tools

Modern browsers ka DevTools ab **built-in contrast checker** deta hai — Chrome DevTools mein kisi text element ka color picker kholo, wahan contrast ratio aur AA/AAA pass/fail directly dikh jaata hai, bina koi external tool ke.

```
Chrome DevTools workflow:
1. Element inspect karo jiska text color check karna hai
2. Styles panel mein "color" property ke saath ek small color swatch dikhta hai
3. Swatch pe click karo — color picker khulega
4. Color picker mein contrast ratio number aur "AA"/"AAA" pass indicator dikhega
5. Agar fail ho raha hai, picker apne aap suggest karega kaunsa nearest color pass karega
```

### Color alone se information convey mat karo

RN chapter mein same principle detail se cover hua tha — red-green color blindness (deuteranopia/protanopia) sabse common form hai, aur agar status sirf color se convey ho raha hai (green text = success, red text = error, bina icon/label ke), colorblind users ke liye difference invisible hai. Web pe same fix applies: icon shape + explicit text label + color teeno together, color kabhi sole indicator na ho.

---

## 7. Forms Accessibility

Forms accessibility ka sabse high-impact area hai — bahut sare real users forms se hi interact karte hain (signup, checkout, settings), aur ek broken form ka matlab hai user literally task complete nahi kar sakta.

### Proper label association

(Section 2 mein `for`/`id` aur wrapping approach already cover ho gaya — dono valid patterns hain.)

### Error message association — `aria-describedby`

Ek bahut common mistake: error message visually input ke paas render kar dena, lekin **programmatically link na karna**. Sighted user visually dekh lega error kahan hai, lekin screen reader user jab input pe focus karega, sirf label + input type sunega — error text tab tak nahi sunega jab tak explicitly navigate karke us error text tak na pahunche (jo bahut sare users nahi karte, kyunki unhe pata hi nahi ki wahan koi error hai).

```jsx
import { useState } from "react"; // state management ke liye

function AccessibleEmailField() {
  const [email, setEmail] = useState(""); // input ki current value
  const [error, setError] = useState(""); // current validation error message, empty string = no error

  // Simple validation — real app mein zyada robust check hoga
  const validateEmail = (value) => {
    if (!value.includes("@")) {
      // basic check — "@" missing hai toh invalid
      setError("Please enter a valid email address"); // error message set karo
    } else {
      setError(""); // valid hai toh error clear karo
    }
  };

  return (
    <div className="form-field">
      <label htmlFor="email-field">
        {/* React mein htmlFor use hota hai (for JS reserved keyword hai), HTML output mein "for" banega */}
        Email Address
      </label>
      <input
        id="email-field" // label ka htmlFor isse match karta hai
        type="email" // semantic input type — mobile keyboards email-optimized layout dikhate hain, browser basic format validation deta hai
        value={email} // controlled input value
        onChange={(e) => setEmail(e.target.value)} // value update karo har keystroke pe
        onBlur={() => validateEmail(email)} // field se bahar jaate waqt validate karo (turant har keystroke pe validate karna annoying UX hota)
        aria-invalid={error ? "true" : "false"} // screen reader ko batata hai field currently invalid state mein hai ya nahi
        aria-describedby={error ? "email-error" : undefined} // JAB error hai, input ko error message se programmatically link karo
        // aria-describedby === undefined jab no error, taaki unnecessary linkage na ho
      />
      {error && (
        // error text sirf tab render hota hai jab error string non-empty ho
        <span id="email-error" role="alert" className="error-text">
          {/* id="email-error" — yahi id upar aria-describedby mein reference hua */}
          {/* role="alert" — screen reader is text ko turant announce karega jab ye DOM mein appear ho, bina user ko explicitly navigate kiye */}
          {error}
        </span>
      )}
    </div>
  );
}

export default AccessibleEmailField; // export component
```

Is pattern ka result: jab screen reader user email field pe focus karta hai (chahe error already present ho, ya tab jab `blur` pe naya error set ho), screen reader bolega kuch is tarah: *"Email Address, edit text, invalid entry. Please enter a valid email address."* — ek single, complete, actionable announcement, bina user ko manually error text dhoondhne ki zaroorat.

`aria-invalid` aur `aria-describedby` do alag jobs karte hain:
- **`aria-invalid`** — batata hai field currently invalid **state** mein hai (screen reader "invalid entry" bolega).
- **`aria-describedby`** — actual error **text ka content** link karta hai, taaki wo specific message bhi announce ho, sirf generic "invalid" nahi.

---

## 8. Real-World Gotchas

- **Accessibility regressions visual QA mein invisible hote hain.** Same point jo RN chapter mein tha — ek page pixel-perfect, visually flawless dikh sakta hai, aur simultaneously keyboard/screen-reader users ke liye completely broken ho sakta hai (missing focus trap, missing labels, broken tab order). Normal visual QA process ye issues kabhi catch nahi karega kyunki QA person mouse aur eyes se test kar raha hai.

- **Automated linters catch sirf ek fraction of real issues.** `eslint-plugin-jsx-a11y` (React ecosystem mein standard) aur axe DevTools (browser extension) high-value hain — CI mein wire karo, obvious misses (missing `alt` text, missing form labels, invalid ARIA usage) commit hone se pehle hi pakad lenge. Lekin ye **necessary, not sufficient** — focus order logic, redundant/useless labels ("button" jo kuch nahi bata raha), aur real screen-reader-experience issues sirf manual testing se pata chalte hain.

- **`outline: none` globally CSS reset mein laga diya jaana, bina `:focus-visible` restore kiye.** Ye probably sabse common real-world bug hai is chapter mein cover kiye gaye sabhi issues mein se — bahut saare popular CSS reset stylesheets (ya kisi developer ka personal "cleanup" reset) `* { outline: none; }` jaisa rule daal dete hain purely visual polish ke liye, bina realize kiye ki isse pure app keyboard-navigable hi nahi raha. Har CSS reset review karte waqt explicitly check karo ki `:focus-visible` styles kahin defined hain — agar nahi, ye ek critical, silent accessibility violation hai jo production mein months tak unnoticed reh sakta hai.

- **SPA route changes screen reader ko announce nahi hote.** Traditional multi-page sites mein, page navigate hone pe browser **automatically** naye page ka title announce karta hai aur focus document ke top pe reset ho jaata hai — screen reader user ko pata chal jaata hai "naya page load hua". SPAs (React Router, Next.js client-side navigation) mein, URL change ho jaata hai lekin actual browser navigation nahi hoti — koi native announcement trigger nahi hota. Agar route-change pe explicitly focus management aur `aria-live` region update nahi kiya gaya, screen reader user ko pata hi nahi chalta ki "page" change hua — wo silently confused reh jaate hain ki content achanak badal gaya bina kisi indication ke.

```jsx
// Route change ke baad screen reader ko announce karne ka pattern (React Router jaisa setup)
import { useEffect, useRef } from "react"; // hooks
import { useLocation } from "react-router-dom"; // current route detect karne ke liye

function RouteAnnouncer() {
  const location = useLocation(); // current route location object — path change hone pe naya reference milta hai
  const announcerRef = useRef(null); // aria-live region ka DOM reference

  useEffect(() => {
    // ye effect har route change pe chalega (location object change hote hi)
    const pageTitle = document.title; // current page ka <title> tag value nikalo (assume ki ye already route-specific set hai)
    if (announcerRef.current) {
      // sirf tab kuch karo jab ref attach ho gaya ho
      announcerRef.current.textContent = `Navigated to ${pageTitle}`; // aria-live region ka text update karo — ye automatically screen reader se announce hoga
    }
    document.getElementById("main-content")?.focus(); // main content area pe focus bhi move karo, taaki keyboard user turant naye page ke content se navigate kar sake
  }, [location]); // dependency — sirf location change hone pe re-run

  return (
    // visually-hidden aria-live region — screen reader ke liye hi exist karta hai
    <div
      ref={announcerRef} // upar ka ref attach
      aria-live="polite" // "polite" — current announcement finish hone ka wait karega, urgent interrupt nahi karega
      className="visually-hidden" // CSS se visually hide (sr-only pattern), lekin accessibility tree mein present rahega
    />
  );
}

export default RouteAnnouncer; // export — app ke root layout mein ek baar mount karo
```

---

## Key Takeaways

- Web pe do extra accessibility concerns hain jo mobile apps mein us intensity se exist nahi karte: **keyboard-only navigation** (wide, non-disability user base bhi affect karta hai) aur **DOM semantics directly driving assistive-tech behavior**.
- Semantic HTML (`<button>`, `<nav>`, `<main>`, proper `<h1>`–`<h6>` hierarchy, associated `<label>`) sabse cheap, sabse robust accessibility win hai — bahut kuch **automatically** sahi ho jaata hai bina extra code ke.
- ARIA "First Rule": native HTML element/attribute available hai toh use karo, ARIA sirf tab jab HTML genuinely wo semantics express nahi kar sakti (custom widgets — modals, tabs, comboboxes).
- `tabIndex` sirf `0` (natural order mein add karo) aur `-1` (programmatically focusable, Tab sequence se bahar) use karo — positive values (1, 2, 3...) fragile, hard-to-maintain custom order banate hain, avoid karo.
- Modal/dialog jaisi UI mein focus trap zaroori hai — Tab modal ke andar hi cycle kare, background page pe leak na kare.
- `outline: none` kabhi bina `:focus-visible` replacement ke mat lagao — ye extremely common, purely aesthetic decision hai jo keyboard users ke liye pura app unusable bana deta hai.
- Manual screen-reader testing (screen off/eyes closed navigation) "the real test" hai — automated linters (`eslint-plugin-jsx-a11y`, axe) necessary hain lekin sirf partial coverage dete hain, aur web pe browser+screen-reader combination quirks bhi ek real extra variable hain.
- WCAG AA level: normal text 4.5:1, large text 3:1 contrast ratio — browser DevTools ka built-in contrast checker use karo, aur color ko kabhi sole information carrier mat banao.
- Forms mein error messages ko `aria-describedby` se input se programmatically link karo, aur `aria-invalid` se validation state explicit karo — visually-nearby error text kaafi nahi hai.
- SPA route changes ko explicitly announce karna padta hai (`aria-live` region + focus management) kyunki browser ka native "page navigated" announcement client-side routing mein automatically trigger nahi hota.

---

## 🎯 Interview Questions — Senior Frontend Developer

### Q1. Ek developer ne ek clickable card `<div onClick={...}>` se banaya hai, aur claim kar raha hai ki "visually button jaisa dikhta hai toh accessibility fine hai." Aap kya point out karoge?

**Answer:** Visual appearance aur functional accessibility bilkul alag concerns hain. `<div onClick>` mein kai things missing hongi jo real `<button>` free mein deta hai: (1) Tab se focus nahi hoga by default (`tabIndex="0"` manually add karna padega), (2) Enter/Space se activate nahi hoga (manual `onKeyDown` handler chahiye jo dono keys check kare), (3) screen reader isse ek generic, non-interactive text ki tarah treat karega — koi "button" role announce nahi hoga bina explicit `role="button"` ke. Sahi fix hai simply native `<button>` element use karna aur CSS se usko jaisa bhi visual style chahiye do — native element sab kuch automatically deta hai jo manually reimplement karna padta agar div use karo.

### Q2. "First Rule of ARIA" kya hai, aur ek concrete example do jahan iska violation ek real bug create karta hai.

**Answer:** First Rule of ARIA kehta hai: agar koi native HTML element/attribute already required semantics/behavior de raha hai, ARIA use mat karo — ARIA sirf tab use karo jab HTML genuinely wo express nahi kar sakti. Concrete violation example: `<div role="button" onClick={...}>` likhna jabki `<button onClick={...}>` available tha. `role="button"` sirf screen reader ko "ye button hai" bolwata hai, lekin keyboard focusability ya Enter/Space activation automatically nahi milti — developer ko manually `tabIndex="0"` aur `onKeyDown` add karna padega. Agar wo miss ho jaaye (jo bahut common hai), result hai ek element jo screen reader "button" announce karta hai, lekin keyboard se actually operate nahi hota — ek confusing, broken experience jahan announcement expectation set karta hai jo reality match nahi karti.

### Q3. Modal dialog mein focus trap implement na karne ka real-world impact kya hota hai? Concrete scenario batao.

**Answer:** Bina focus trap ke, jab modal open hai aur user Tab dabata hai modal ke last focusable element (e.g. "Save" button) pe pahunch ke, next Tab press focus ko **background page ke elements** pe le jaata hai — jo visually modal ke peeche, overlay se hidden hain. Sighted keyboard user ke liye ye disorienting hai kyunki focus indicator kahin dikhta hi nahi (element hidden hai overlay ke peeche). Screen reader user ke liye ye aur zyada confusing hai — wo ek background element ka announcement sunenge jo unke current visual/mental context (modal) se completely unrelated hai, aur unhe pata nahi chalega ki wo "modal se bahar nikal gaye". Sahi fix: modal open hone pe Tab ko explicitly modal ke andar hi cycle karwao (last element → wrap to first, aur Shift+Tab pe first → wrap to last), jaisa Section 3 ke code example mein dikhaya.

### Q4. Positive `tabIndex` values (jaise `tabIndex="1"`, `tabIndex="2"`) kyun avoid karni chahiye?

**Answer:** Positive `tabIndex` values ek custom, DOM-order-independent tab sequence create karti hain jo globally track karni padti hai — agar do independent components (jo alag developers ne likhe hain, kabhi ek dusre ko jaante hue bina) dono `tabIndex="1"` use kar lein, unpredictable, conflicting tab order ban jaata hai. Iske alawa, jab bhi naya interactive element add hota hai beech mein, existing sabhi positive tabIndex values ko renumber karna pad sakta hai — extremely fragile aur maintenance-heavy. Sahi approach hai DOM order ko hi visually-logical order mein rakhna (kyunki Tab by default DOM order follow karta hai), aur agar visual position CSS se change karni ho (`order`, `flex-direction`) toh DOM order alag rakh ke bhi keyboard order predictable rehta hai — sirf `tabIndex="0"` (natural order mein shamil karo) aur `tabIndex="-1"` (programmatic focus, Tab se exclude) practically use karni chahiye.

### Q5. `outline: none` CSS reset mein lagana kyun ek serious accessibility violation hai, sirf ek design choice nahi?

**Answer:** Default browser focus outline **sole visual indicator** hai jo keyboard-only users (motor-impaired, screen-reader users navigating visually, power users) ko batata hai currently kaunsa element focused hai. Jab `outline: none` global reset mein laga diya jaata hai bina replacement diye, purely aesthetic reasoning se ("default outline ugly dikhta hai"), effectively pura app keyboard se non-navigable ho jaata hai — user Tab dabate rehta hai, lekin visually kuch indicate nahi hota ki wo kahan hai. Ye "design polish" nahi hai kyunki iska trade-off ek functional capability (keyboard navigability) hai, na ki cosmetic detail. Sahi fix: `:focus-visible` pseudo-class use karo jo default outline ko style karta hai (color, thickness customize kar sakte ho) sirf keyboard-driven focus ke liye, aur `:focus:not(:focus-visible)` se mouse-click-driven focus outline hide kar sakte ho agar wo visually distracting lagta hai — but replacement zaroor honi chahiye, complete removal nahi.

### Q6. SPA (Single Page Application) mein client-side route navigation ke baad screen reader users ko kya problem face hoti hai, aur solution kya hai?

**Answer:** Traditional full-page navigation mein browser automatically naye page ka title announce karta hai aur focus document top pe reset karta hai — ye ek native browser behavior hai jo screen reader ko "context changed" signal deta hai. SPAs mein URL change ho jaata hai (React Router/Next.js client-side routing se) lekin actual browser-level navigation nahi hoti, isliye ye native announcement trigger nahi hota. Result: screen reader user ko koi indication nahi milta ki "page" badal gaya — content silently change ho jaata hai unke perspective se, jo confusing hai. Solution: route change ko explicitly detect karo (route change listener/hook), aur (1) focus ko main content area pe programmatically move karo, aur (2) ek `aria-live="polite"` region update karo jo naye page ka title announce kare ("Navigated to Account Settings"). Dono steps zaroori hain — sirf focus move karna kaafi nahi, kyunki agar focused element khud kuch announce nahi karta, user ko "kya change hua" clear nahi hoga.

### Q7. Ek form field mein error message visually input ke neeche dikh raha hai, lekin screen reader user ko field focus karne pe error sunayi nahi deta. Root cause aur fix kya hai?

**Answer:** Root cause: error message aur input **programmatically linked nahi hain** — sirf visual proximity hai (CSS se error input ke paas positioned hai), jo sighted user ke liye kaafi hai lekin screen reader ke liye koi meaning nahi rakhta. Screen reader sirf wahi announce karta hai jo input ke accessibility metadata mein explicitly linked ho. Fix: `aria-describedby` attribute input pe add karo jo error message element ke `id` ko reference kare — isse jab bhi field focus ho (ya error dynamically set ho), screen reader label ke saath error text bhi announce karega. Additionally `aria-invalid="true"` set karo taaki screen reader explicitly "invalid entry" bhi bole, aur error text pe `role="alert"` lagao taaki naya error appear hone pe wo turant announce ho, bina user ko wapas field navigate karne ki zaroorat ke.

### Q8. Ek team keh rahi hai "humne axe DevTools se scan kar liya, zero issues aaye, humara app fully accessible hai." Aap is claim ko kaise challenge karoge?

**Answer:** Automated tools (axe, `eslint-plugin-jsx-a11y`, Lighthouse accessibility audit) sirf **statically-detectable, syntactic issues** catch kar sakte hain — jaise missing `alt` text, missing form labels, invalid ARIA attribute combinations. Ye **necessary lekin sufficient nahi** hain. Jo ye tools kabhi catch nahi kar sakte: (1) focus order ka logically sahi hona ya nahi (koi absolutely-positioned element focus order break kar raha ho toh linter pass karega lekin experience broken hogi), (2) labels ka **meaningfully useful** hona — "button" jaisa generic label technically present hai (linter pass karega) lekin user ko kuch bataega nahi, (3) focus trap ka correctly kaam karna modals mein, (4) `aria-live` announcements ka sahi timing/content, (5) real cross-browser/screen-reader combination behavior differences. Iska matlab: automated scan "zero issues" ka matlab hai "zero statically-detectable issues", na ki "fully accessible" — manual keyboard-only aur screen-reader navigation testing hi complete confidence de sakta hai.

### Q9. Ek e-commerce checkout page pe "Available" (green text) aur "Out of Stock" (red text) sirf color se differentiate ho rahe hain, bina kisi aur visual indicator ke. Colorblind users ke liye fix design karo.

**Answer:** Core problem: color **sole information carrier** ban gaya hai — red-green colorblindness (deuteranopia/protanopia, sabse common form) waale users ke liye "Available" aur "Out of Stock" visually indistinguishable ho sakte hain. Fix mein redundant, non-color signals add karne honge: (1) **Explicit text label** already hai ("Available"/"Out of Stock" text), jo already ek partial safeguard hai — lekin agar sirf color-differentiated badge/dot use hota (bina text) toh ye bhi add karna padta. (2) **Icon/shape indicator** — checkmark icon "Available" ke saath, cross/prohibited icon "Out of Stock" ke saath — shape colorblind users ke liye bhi clearly distinguishable hai. (3) **Screen reader accessible name** mein status word explicitly include karo (e.g. `aria-label="In stock"` ya `aria-label="Out of stock"`), kyunki blind users ke liye color ka koi matlab nahi hai bilkul. (4) WCAG contrast ratio bhi maintain karo (4.5:1 minimum) taaki low-vision (non-colorblind) users ke liye bhi text clearly readable ho against background.
