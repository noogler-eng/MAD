# JavaScript Core Concepts — Senior Frontend Ke Liye

Ye chapter thoda different hai pichhle 12 se — wahan hum "kaise API calls karo", "kaise rendering strategy choose karo" jaisi practical/applied problems solve kar rahe the. Yahan hum ek level neeche jaa rahe hain — JS engine ke andar actually kya ho raha hai jab tumhara code chalta hai. Ye wo concepts hain jo har senior frontend interview mein aate hain (event loop, closures, `this`, prototypes, promises), aur jo tumhe production bugs debug karne mein directly help karte hain — jaise "mera `setTimeout` callback mein `this` undefined kyun hai" ya "mera loop variable sab iterations mein same value kyun dikha raha hai". Har code block ki har line commented hai — matlab hai sirf "kya" nahi, "kyun" bhi samajhna.

## Table of Contents

1. [The Event Loop — How JavaScript Actually Runs Single-Threaded Async Code](#the-event-loop--how-javascript-actually-runs-single-threaded-async-code)
2. [Closures — What They Actually Are Internally](#closures--what-they-actually-are-internally)
3. [Prototypes and Prototypal Inheritance](#prototypes-and-prototypal-inheritance)
4. [`this` Binding — The Four Rules](#this-binding--the-four-rules)
5. [`async`/`await` — What It Actually Compiles To](#asyncawait--what-it-actually-compiles-to)
6. [Promise Internals — States and Chaining](#promise-internals--states-and-chaining)
7. [Debouncing and Throttling — Implemented From Scratch](#debouncing-and-throttling--implemented-from-scratch)
8. [Memory Leaks in JS — Common Causes](#memory-leaks-in-js--common-causes)
9. [Real-World Gotchas](#real-world-gotchas)
10. [Key Takeaways](#key-takeaways)
11. [🎯 Interview Questions — Senior Frontend Developer](#-interview-questions--senior-frontend-developer)

---

## The Event Loop — How JavaScript Actually Runs Single-Threaded Async Code

Ye sabse misunderstood concept hai — log kehte hain "JavaScript async hai", lekin technically **JavaScript language khud single-threaded hai**. Ek time pe sirf ek statement execute hota hai, ek **call stack** pe. Async capability (setTimeout, network calls, DOM events) JS language se nahi aati — wo **runtime environment** (browser ya Node.js) provide karta hai. Runtime ke paas extra threads/mechanisms hote hain (browser mein Web APIs jaise `setTimeout`, network stack; Node mein libuv), aur wo JS engine ke saath **event loop** ke through coordinate karte hain.

### Core pieces

- **Call stack**: jahan currently executing function calls track hote hain, LIFO (last in, first out).
- **Web APIs / Node APIs**: `setTimeout`, `fetch`, file I/O jaise operations engine se bahar, runtime mein chalte hain — isliye ye "blocking" nahi hote.
- **Macrotask queue** (a.k.a. task queue): `setTimeout`, `setInterval`, I/O callbacks, UI rendering yahan queue hote hain.
- **Microtask queue**: Promise `.then()`/`.catch()`/`.finally()` callbacks, aur `queueMicrotask()` yahan queue hote hain.
- **Event loop**: ek continuous loop jo check karta hai — call stack empty hai? Agar haan, microtask queue se **saare** pending microtasks drain karo (ek-ek karke, jab tak khali na ho jaaye), phir **ek** macrotask queue se le lo aur chalao, phir wapas microtasks check karo. Repeat.

**Classic interview gotcha**: microtasks **hamesha** next macrotask se pehle poori tarah drain hote hain — chahe microtask queue mein 100 items hoon aur macrotask queue mein sirf 1, sab 100 microtasks pehle chalenge, tab macrotask chalega.

```javascript
// Ye classic interview question hai — output order predict karo

console.log("1: script start"); // ye synchronous hai, call stack pe seedha chalega — SABSE PEHLE print hoga

setTimeout(() => {
  // ye callback macrotask queue mein jaata hai, chahe delay 0ms ho
  console.log("2: setTimeout callback"); // ye sabse AAKHIR mein print hoga — macrotask hai
}, 0); // 0ms delay bhi guarantee nahi karta immediate execution, sirf minimum wait hai

Promise.resolve().then(() => {
  // .then() callback microtask queue mein jaata hai
  console.log("3: promise then 1"); // ye macrotask se PEHLE print hoga, kyunki microtasks pehle drain hote hain
});

Promise.resolve().then(() => {
  // ye doosra .then() bhi microtask hai
  console.log("4: promise then 2"); // ye bhi setTimeout se pehle, microtask queue FIFO order follow karti hai
});

console.log("5: script end"); // ye bhi synchronous hai, isliye "1" ke turant baad print hoga

// ACTUAL OUTPUT ORDER:
// "1: script start"        <- synchronous code sabse pehle, top-to-bottom
// "5: script end"          <- ye bhi synchronous hai, isliye 1 ke baad seedha ye chalta hai (setTimeout/promise abhi queue mein hain)
// "3: promise then 1"      <- call stack empty hone ke baad, event loop microtask queue check karta hai — ye pehla microtask hai
// "4: promise then 2"      <- doosra microtask, FIFO order mein
// "2: setTimeout callback" <- microtask queue poori khali hone ke BAAD hi event loop macrotask queue se ye uthata hai
```

**Why ye order hai**: jab script run hoti hai, `console.log("1"...)` aur `console.log("5"...)` synchronous statements hain — ye seedha call stack pe execute hote hain, koi queue involve nahi. `setTimeout` ka callback macrotask queue mein jaake wait karta hai (0ms delay ka matlab hai "jaldi se jaldi", turant nahi). Dono `Promise.resolve().then()` calls apna callback microtask queue mein daal dete hain. Jab main script ka synchronous code khatam ho jaata hai (call stack empty), event loop rule follow karta hai: pehle **saare** microtasks drain karo, phir **ek** macrotask lo. Isliye promise callbacks (microtasks) setTimeout callback (macrotask) se pehle print hote hain, chahe setTimeout code mein pehle likha gaya ho.

```javascript
// Ek aur variant — nested microtasks bhi macrotask se pehle chalte hain, ye depth infinite nahi honi chahiye warna macrotask starve ho jaata hai

setTimeout(() => console.log("A: macrotask"), 0); // macrotask queue mein gaya

Promise.resolve().then(() => {
  console.log("B: microtask 1"); // pehla microtask
  Promise.resolve().then(() => {
    console.log("C: nested microtask"); // ye NAYA microtask hai, jo microtask ke andar se schedule hua — ye bhi current drain cycle mein hi chalega
  });
});

Promise.resolve().then(() => console.log("D: microtask 2")); // teesra top-level microtask

// OUTPUT: "B: microtask 1", "D: microtask 2", "C: nested microtask", "A: macrotask"
// D pehle chalta hai C se kyunki D queue mein C se pehle add hua tha (B ke andar C add hua jab D already queue mein tha)
// C, A se pehle chalta hai kyunki event loop macrotask lene se pehle microtask queue COMPLETELY empty hone ka wait karta hai
```

---

## Closures — What They Actually Are Internally

Closure ka textbook definition hai "a function that remembers its enclosing scope" — lekin senior-level samajhna zaroori hai ki ye **internally kaise** kaam karta hai. Jab ek inner function ek outer function ke andar define hoti hai aur outer function ke variables ko reference karti hai, JS engine us outer scope ko **garbage collect nahi karta** jab tak inner function kahin bhi reachable hai — chahe outer function ka execution already khatam ho chuka ho aur normally uska stack frame pop ho jaana chahiye tha. Engine ek internal reference (scope chain ke through) maintain karta hai jo us memory ko "alive" rakhta hai.

### Counter via closure — classic pattern

```javascript
function createCounter() {
  let count = 0; // ye variable createCounter ke local scope mein hai — normally function return hone pe ye garbage collect ho jaata

  // returned function "count" ko reference kar rahi hai — isse count ka scope alive rehta hai closure ki wajah se
  return function increment() {
    count = count + 1; // outer scope ka "count" modify kiya — same memory location, naya copy nahi
    return count; // updated value return kiya
  };
}

const counterA = createCounter(); // createCounter() ek baar call hua, apna khud ka "count" scope banaya, aur return ho gaya
const counterB = createCounter(); // ye DOOSRA independent call hai — apna alag, fresh "count" scope banata hai

console.log(counterA()); // 1 — counterA ke apne closure ka count 0 se 1 hua
console.log(counterA()); // 2 — same closure reuse ho raha hai, count ab 1 se 2
console.log(counterB()); // 1 — counterB ka apna ALAG count hai, counterA se completely independent
```

**Why ye important hai**: har `createCounter()` call apna khud ka fresh `count` variable banata hai, apne khud ke closure scope mein. Ye encapsulation ka natural way hai bina classes ke — `count` ko bahar se directly access/mutate nahi kiya ja sakta, sirf returned function ke through.

### Classic bug — loop variable closure (var vs let)

```javascript
// BUGGY VERSION — var use kar rahe hain
for (var i = 0; i < 3; i++) {
  // var FUNCTION-SCOPED hai, block-scoped nahi — matlab poore loop mein sirf EK "i" variable exist karta hai, sab iterations SHARE karte hain
  setTimeout(() => {
    console.log("var i:", i); // ye callback "i" ko closure se reference kar raha hai — lekin "i" shared hai, apna copy nahi
  }, 100); // 100ms baad chalega — loop TAB TAK poora khatam ho chuka hoga
}
// OUTPUT: "var i: 3", "var i: 3", "var i: 3"
// Kyun? Loop synchronously turant 3 baar chal jaata hai (i=0,1,2, phir i=3 pe condition false hoke loop exit),
// tab tak koi bhi setTimeout callback nahi chala hai (macrotask hai, baad mein chalega).
// Jab callbacks BAAD mein chalte hain, sab EK HI shared "i" variable dekhte hain, jiski final value 3 hai.

// FIXED VERSION — let use kar rahe hain
for (let j = 0; j < 3; j++) {
  // let BLOCK-SCOPED hai — har loop iteration apna NAYA, alag "j" binding banata hai (engine internally ek naya scope create karta hai har baar)
  setTimeout(() => {
    console.log("let j:", j); // har callback apne khud ke iteration ke "j" ko closure se reference karta hai — independent copy
  }, 100); // same delay
}
// OUTPUT: "let j: 0", "let j: 1", "let j: 2"
// Kyun? Har iteration ka apna "j" hai jo us specific iteration ki value freeze kar deta hai apne closure mein.
```

**Senior explanation for interviews**: `var` function-scoped hai — pura `for` loop ek hi variable declaration share karta hai, isliye jab async callbacks baad mein chalte hain, wo sab us EK variable ki **final** value dekhte hain. `let` block-scoped hai, aur spec ke mutabik `for` loop ke saath `let` use karne pe, JS engine **har iteration ke liye ek naya lexical binding** create karta hai — isliye har closure apni khud ki, us specific iteration ki value capture karta hai. Pre-ES6 fix `var` ke saath ek IIFE (immediately invoked function expression) use karna hota tha har iteration ki value ko manually capture karne ke liye — `let` ne wo boilerplate khatam kar diya.

```javascript
// Pre-ES6 fix, sirf reference/historical context ke liye — IIFE se value capture karna
for (var k = 0; k < 3; k++) {
  (function (capturedK) {
    // IIFE ek naya function scope create karta hai, aur "k" ki CURRENT value ko "capturedK" parameter mein copy kar deta hai
    setTimeout(() => {
      console.log("IIFE capturedK:", capturedK); // ye ab apna khud ka independent copy use kar raha hai, shared "k" nahi
    }, 100);
  })(k); // turant invoke kiya, "k" ki abhi ki value pass ki
}
// OUTPUT: "IIFE capturedK: 0", "IIFE capturedK: 1", "IIFE capturedK: 2" — same result jo let se milta hai, lekin manual effort se
```

---

## Prototypes and Prototypal Inheritance

JavaScript mein classical inheritance nahi hoti (jaise Java/C++ mein) — iske bajaye **prototypal inheritance** hoti hai. Har object ke paas ek internal link hota hai kisi doosre object ko, jise `[[Prototype]]` kehte hain (spec-level naam, double square brackets internal slot ko denote karte hain). Jab tum ek property ko access karte ho jo object pe khud nahi hai, JS engine us `[[Prototype]]` link ko follow karta hai upar, aur upar, jab tak property mil na jaaye ya chain `null` pe khatam ho jaaye — isko **prototype chain** kehte hain.

```javascript
// Object.create() se explicitly prototype chain banate hain, taaki mechanism clearly dikhe

const animal = {
  // ye base object hai, "prototype" ke roop mein use hoga
  eat() {
    console.log(`${this.name} is eating`); // "this" call-site pe decide hoga (section 4 dekho), yahan lexically bound nahi
  },
};

const dog = Object.create(animal); // "dog" ka [[Prototype]] ab "animal" hai — dog khud khali hai, sirf link hai
dog.name = "Rex"; // "name" property dog pe DIRECTLY set ki, animal pe nahi

dog.eat(); // "Rex is eating" — eat() dog pe nahi mila, engine ne [[Prototype]] chain follow ki aur animal pe mila

console.log(Object.getPrototypeOf(dog) === animal); // true — official/modern way prototype check karne ka
console.log(dog.__proto__ === animal); // true — same cheez, lekin __proto__ DEPRECATED hai (legacy getter/setter), production code mein avoid karo

console.log(dog.hasOwnProperty("name")); // true — "name" dog pe khud hai
console.log(dog.hasOwnProperty("eat")); // false — "eat" dog pe khud NAHI hai, wo prototype (animal) pe hai
```

### `class` syntax — sirf syntactic sugar hai prototype ke upar

Bahut log sochte hain `class` JS mein "real" classes laata hai (jaise Java mein), lekin internally ye **exactly wahi prototype mechanism** use karta hai — sirf syntax cleaner hai.

```javascript
class Animal {
  constructor(name) {
    this.name = name; // instance-specific data — har instance ka apna, alag copy hota hai
  }

  eat() {
    // ye method class BODY mein likha hai, lekin ye instance pe NAHI jaata
    console.log(`${this.name} is eating`); // "this" call-time pe resolve hota hai
  }
}

const cat = new Animal("Whiskers"); // "new" keyword — naya object banata hai, uska [[Prototype]] Animal.prototype set karta hai, constructor call karta hai

console.log(Object.getPrototypeOf(cat) === Animal.prototype); // true — cat ka prototype Animal.prototype hai, class syntax ke bawajood
console.log(cat.hasOwnProperty("eat")); // false — eat() cat instance pe COPY nahi hua, ye Animal.prototype pe SHARED hai
console.log(Animal.prototype.hasOwnProperty("eat")); // true — eat() sirf ek jagah exist karta hai, prototype pe

const dog2 = new Animal("Buddy"); // doosra instance banaya
console.log(cat.eat === dog2.eat); // true — DONO instances EXACT SAME function reference share kar rahe hain, do alag copies nahi
```

**Memory efficiency point (senior-level insight)**: agar `eat` method har instance pe copy hoti (jaise agar tum galti se `this.eat = function() {...}` constructor ke andar likh dete), toh 10,000 `Animal` instances = 10,000 alag function objects memory mein, sab identical code ke saath — wasteful. Prototype pe rakhne se sirf **ek** function object exist karta hai, saare instances usi ko share karte hain apne `[[Prototype]]` link ke through. Ye class methods ka default, correct behavior hai — instance methods (properties jo tum `this.x = ...` se constructor mein set karte ho) ke liye har instance ka apna copy hota hai, kyunki wo per-instance **data** hai, shared **behavior** nahi.

---

## `this` Binding — The Four Rules

`this` JS mein sabse confusing concept hai kyunki iski value **call-time** pe decide hoti hai (kaise function call hua), function **define** kahan hua wahan nahi (except arrow functions — neeche dekho). Char rules hain, priority order mein (upar wala rule niche wale ko override karta hai):

### Rule 1 — Default binding (sabse low priority)

```javascript
function showThis() {
  console.log(this); // koi object ke through call nahi hua, "standalone" call hai
}

showThis(); // non-strict mode mein: global object (browser mein "window"); strict mode mein: undefined
// "use strict" ya ES module context mein ye automatically strict hota hai, isliye undefined milega
```

### Rule 2 — Implicit binding (method call)

```javascript
const user = {
  name: "Sharad", // object property
  greet() {
    console.log(`Hi, I'm ${this.name}`); // "this" yahan "user" object ko refer karega — dot ke pehle wala object
  },
};

user.greet(); // "Hi, I'm Sharad" — "this" = user, kyunki call user.greet() hua, dot se pehle "user" hai
```

### Rule 3 — Explicit binding (`call`, `apply`, `bind`)

```javascript
function greet() {
  console.log(`Hi, I'm ${this.name}`); // "this" explicitly decide hoga call-time pe
}

const person1 = { name: "Aditi" }; // koi bhi object jise hum "this" banana chahte hain
const person2 = { name: "Rahul" };

greet.call(person1); // "Hi, I'm Aditi" — call() "this" ko person1 set karta hai, args individually pass hote hain
greet.apply(person2); // "Hi, I'm Rahul" — apply() same kaam karta hai call jaisa, lekin args ARRAY ke roop mein lete hai

const boundGreet = greet.bind(person1); // bind() NAYA function return karta hai jiska "this" PERMANENTLY person1 pe fix ho gaya
boundGreet(); // "Hi, I'm Aditi" — chahe kaise bhi call karo, "this" ab kabhi change nahi hoga (bahut strong binding, rule 4 se bhi upar)
```

### Rule 4 — Arrow functions (apna khud ka `this` NAHI hota)

Arrow functions "own `this`" define nahi karte — wo lexically apne **enclosing scope** ka `this` capture kar lete hain, jaise koi normal variable ho closure se.

```javascript
const obj = {
  name: "Team",
  regularMethod() {
    console.log("regular:", this.name); // "this" yahan implicit binding se "obj" hai — normal method call

    const arrowInside = () => {
      // ye arrow function apna "this" NAHI banata — enclosing scope (regularMethod) ka "this" use karega
      console.log("arrow inside:", this.name); // "this" yahan bhi "obj" hai, kyunki regularMethod ka "this" obj tha, arrow ne wahi capture kiya
    };
    arrowInside(); // call karo — "this" abhi bhi obj hai
  },
};

obj.regularMethod(); // "regular: Team", "arrow inside: Team" — dono same "this" dikhate hain kyunki arrow ne parent scope se capture kiya
```

### Classic bug — "losing `this`" jab method callback ke roop mein pass karo

```javascript
class Timer {
  constructor() {
    this.seconds = 0; // instance property
  }

  // ye REGULAR method hai — jab standalone call hoga, "this" khatam ho jaayega (default binding lagega)
  incrementRegular() {
    this.seconds = this.seconds + 1; // "this.seconds" access kar raha hai — agar "this" undefined hai, ye CRASH karega
    console.log("regular tick:", this.seconds);
  }

  // ye ARROW method hai (class field syntax) — arrow function apna "this" nahi banata, class-instance-creation-time ke "this" ko lexically capture karta hai
  incrementArrow = () => {
    this.seconds = this.seconds + 1; // "this" hamesha wahi instance hoga jispe ye field create hua tha, call-site se independent
    console.log("arrow tick:", this.seconds);
  };
}

const timer = new Timer(); // instance banaya

setTimeout(timer.incrementRegular, 100); // BUG: method ko REFERENCE ke roop mein pass kiya — call-site pe "timer." context CHHUT gaya
// setTimeout andar se "incrementRegular()" ko standalone call karega (jaisa Rule 1 mein), "this" ab undefined/global hoga
// -> "Cannot read properties of undefined (reading 'seconds')" jaisa error aayega strict mode mein

setTimeout(timer.incrementArrow, 100); // FIX: arrow method hai, "this" lexically HAMESHA "timer" instance hai, call-site se koi farak nahi padta
// "arrow tick: 1" print hoga correctly

// Alternative fix bina arrow field ke — .bind() se explicitly this attach karna
setTimeout(timer.incrementRegular.bind(timer), 100); // .bind(timer) naya function return karta hai jiska "this" fix hai — ye bhi kaam karega
```

**React connection (jo prompt mein specifically pucha gaya)**: purane class-based React components mein ye EXACT bug bahut common tha — `<button onClick={this.handleClick}>` likhne pe `handleClick` andar `this` undefined ho jaata tha, kyunki React usse standalone callback ke roop mein invoke karta hai, `this.` context ke saath nahi. Isi wajah se `onClick={() => this.handleClick()}` (arrow function wrapper, jo call-time pe explicitly `this.handleClick()` bulaata hai method call ke roop mein — Rule 2 lagta hai) ya constructor mein `this.handleClick = this.handleClick.bind(this)` (Rule 3) — dono common patterns the. Class fields ke saath arrow method (`handleClick = () => {...}`) modern era mein most common fix ban gaya, kyunki wo automatically lexical `this` capture kar leta hai bina explicit bind ke.

---

## `async`/`await` — What It Actually Compiles To

`async function` **hamesha** ek Promise return karta hai — chahe tum khud explicitly Promise return karo ya nahi. Agar function `return 5` karta hai, caller ko `Promise<5>` milta hai (resolved value 5 ke saath). `await` syntactic sugar hai `.then()` ke upar — engine ke andar ye generator-function-jaisi mechanics use karta hai: function ka execution `await` point pe **pause** ho jaata hai (bina main thread block kiye — control event loop ko wapas mil jaata hai), aur jab awaited Promise settle hoti hai, function apna execution wahin se **resume** karta hai jahan ruka tha.

```javascript
// .then() CHAIN VERSION — manual promise chaining
function fetchUserDataThen(userId) {
  return fetch(`/api/users/${userId}`) // fetch call, Promise<Response> return karta hai
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`); // error check, .then() ke andar throw karna .catch() tak propagate hoga
      return response.json(); // JSON parse — ye khud bhi Promise hai, .then() chain automatically usse "unwrap" kar deta hai
    })
    .then((user) => {
      return fetch(`/api/users/${user.id}/orders`); // pehla result mila, ab dependent second call — NESTED/CHAINED
    })
    .then((ordersResponse) => {
      if (!ordersResponse.ok) throw new Error(`HTTP ${ordersResponse.status}`); // second error check
      return ordersResponse.json(); // second JSON parse
    })
    .catch((err) => {
      console.error("Failed:", err); // koi bhi step mein throw ho, yahan aa jaayega — ek hi centralized catch
      throw err; // re-throw kiya taaki caller ko bhi pata chale ki fail hua
    });
}

// ASYNC/AWAIT VERSION — bilkul same logic, lekin flat, synchronous-looking code
async function fetchUserDataAsync(userId) {
  // "async" keyword se ye function AUTOMATICALLY Promise return karega
  try {
    const response = await fetch(`/api/users/${userId}`); // execution YAHAN PAUSE hota hai jab tak fetch Promise settle na ho — thread block NAHI hota, event loop free hai
    if (!response.ok) throw new Error(`HTTP ${response.status}`); // error check, normal try/catch se catch hoga (unlike .then chain ka special .catch())

    const user = await response.json(); // dusra pause point — JSON parsing complete hone tak wait
    const ordersResponse = await fetch(`/api/users/${user.id}/orders`); // teesra pause point — dependent call, sequential
    if (!ordersResponse.ok) throw new Error(`HTTP ${ordersResponse.status}`); // second error check

    return await ordersResponse.json(); // final result — ye khud automatically wrap ho jaayega function ke returned Promise mein
  } catch (err) {
    console.error("Failed:", err); // .then chain ke .catch() jaisa hi, lekin normal try/catch syntax
    throw err; // re-throw, caller ko propagate
  }
}
```

**Key insight jo interview mein pucha jaata hai**: `await` khud koi naya concurrency model nahi laata — ye ek existing Promise ko "wait karo aur unwrap karo" karne ka **readable syntax** hai. Engine level pe, `async function` ek state machine ki tarah compile hoti hai (conceptually generator functions jaisi — `function*` aur `yield` — jinke upar `async`/`await` originally design hui thi): har `await` ek "yield point" hai jahan function apna control wapas event loop ko de deta hai, aur jab Promise resolve/reject hoti hai, engine function ko usi exact point se resume karta hai apna local state (variables) preserve karke — ye bilkul closures jaisi hi memory-retention mechanism hai (section 2).

```javascript
// Common mistake — sequential await jab parallel possible tha, unnecessarily slow
async function slowVersion() {
  const a = await fetchA(); // fetchA poora complete hone tak wait — agar 1 second leta hai
  const b = await fetchB(); // TAB fetchB shuru hota hai — agar ye bhi 1 second leta hai
  return [a, b]; // total time: ~2 seconds, chahe A aur B ek doosre pe depend nahi karte
}

// FIX — parallel execution jab calls independent hain
async function fastVersion() {
  const [a, b] = await Promise.all([fetchA(), fetchB()]); // DONO calls SIMULTANEOUSLY start ho jaate hain, dono Promises fire ho gayi turant
  return [a, b]; // total time: ~1 second (jo bhi slower hai unme se), kyunki dono parallel chal rahe the
}

function fetchA() {
  return new Promise((resolve) => setTimeout(() => resolve("A"), 1000)); // simulate 1s network call
}
function fetchB() {
  return new Promise((resolve) => setTimeout(() => resolve("B"), 1000)); // simulate 1s network call
}
```

---

## Promise Internals — States and Chaining

Ek Promise teen states mein se ek mein hota hai: **pending** (result abhi pata nahi), **fulfilled** (successfully resolve hua, value available), ya **rejected** (fail hua, reason available). Critical mental model: ek Promise **sirf ek baar** transition kar sakta hai pending se fulfilled/rejected mein — us transition ke baad Promise permanently **settled** hai, aur uski value/reason kabhi change nahi hogi, chahe tum `resolve()`/`reject()` ko dobara call karo (extra calls silently ignore ho jaate hain).

```javascript
const demoPromise = new Promise((resolve, reject) => {
  resolve("first value"); // Promise "fulfilled" ho gaya, value = "first value"
  resolve("second value"); // IGNORED — Promise already settled hai, ye call kuch nahi karta
  reject("some error"); // ye bhi IGNORED — settled Promise apni state kabhi badal nahi sakta
});

demoPromise.then((value) => console.log(value)); // "first value" — sirf pehla resolve() hi effective tha
```

### Kyun `.then()` hamesha ek NAYA Promise return karta hai

```javascript
const original = Promise.resolve(1); // ek fulfilled promise, value = 1

const chained = original.then((value) => {
  return value + 1; // 2 return kiya
}); // "chained" ek COMPLETELY NAYA Promise object hai, "original" se different — isi wajah se .then() ko CHAIN kar sakte ho

chained.then((value) => console.log(value)); // 2 — naye promise ki value

console.log(original === chained); // false — dono alag Promise objects hain, ye hi chaining ko possible banata hai
```

**Why this matters**: agar `.then()` same Promise return karta (naya nahi), toh chaining (`.then().then().then()`) kaam nahi kar sakti — har `.then()` ko apna khud ka fresh Promise chahiye taaki agla `.then()` uske upar attach ho sake, aur error propagation bhi automatically kaam kare (agar ek `.then()` mein throw ho, returned Promise **rejected** ban jaata hai, aur chain mein aage wala `.catch()` usse pick kar leta hai).

### `Promise.all` vs `allSettled` vs `race` vs `any`

```javascript
// helper functions — simulate karte hain success/failure Promises different timings ke saath
function delay(ms, value, shouldFail = false) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) reject(new Error(`failed: ${value}`)); // reject case simulate kiya
      else resolve(value); // resolve case
    }, ms);
  });
}

// Promise.all — SAB fulfill hone chahiye, agar EK BHI reject ho, poora Promise.all IMMEDIATELY reject ho jaata hai
async function demoAll() {
  try {
    const results = await Promise.all([
      delay(100, "A"), // 100ms baad resolve
      delay(200, "B"), // 200ms baad resolve
      delay(50, "C", true), // 50ms baad REJECT karega
    ]);
    console.log(results); // ye line kabhi nahi chalegi is example mein
  } catch (err) {
    console.log("all failed fast:", err.message); // "failed: C" — sirf 50ms mein hi poora Promise.all reject ho gaya, baaki 2 ka wait nahi kiya
  }
}
// USE CASE: jab tumhe SAB results chahiye ho aur ek bhi fail hone ka matlab hai poori operation invalid hai (jaise "save 3 related records atomically")

// Promise.allSettled — HAMESHA wait karta hai sab settle hone tak, kabhi reject NAHI hota, har result ka status/value/reason milta hai
async function demoAllSettled() {
  const results = await Promise.allSettled([
    delay(100, "A"), // resolve hoga
    delay(200, "B"), // resolve hoga
    delay(50, "C", true), // reject hoga
  ]);
  console.log(results);
  // [
  //   { status: "fulfilled", value: "A" },
  //   { status: "fulfilled", value: "B" },
  //   { status: "rejected", reason: Error("failed: C") }
  // ]
  // Poora array mila, chahe kuch fail hue — isse per-item handle kar sakte ho
}
// USE CASE: jab tumhe SAB results chahiye ho chahe kuch fail ho jaayein (jaise "5 independent API calls, jo bhi succeed karein unhe dikhao, fail wale skip")

// Promise.race — jo bhi PEHLE settle hota hai (fulfil ya reject, dono), wahi final result/reason ban jaata hai, baaki ignore
async function demoRace() {
  try {
    const winner = await Promise.race([
      delay(100, "fast"), // ye sabse pehle settle hoga
      delay(500, "slow"), // ye baad mein, lekin race already decide ho chuki hogi tab tak
    ]);
    console.log("race winner:", winner); // "fast" — sabse pehla settled promise jeeta
  } catch (err) {
    console.log("race lost to rejection:", err.message);
  }
}

// TIMEOUT PATTERN — Promise.race ka most common real-world use case
function withTimeout(promise, ms) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms); // timer, jo agar promise itni der mein resolve na ho toh reject kar dega
  });
  return Promise.race([promise, timeoutPromise]); // jo bhi pehle settle ho — actual result ya timeout error
}

async function demoTimeout() {
  try {
    const result = await withTimeout(delay(3000, "slow api result"), 1000); // API 3s leta hai, lekin humne 1s timeout laga diya
    console.log(result); // ye kabhi nahi chalega — timeout jeetega
  } catch (err) {
    console.log("timeout caught:", err.message); // "Timed out after 1000ms" — 1s pe race jeet gaya timeout promise
  }
}

// Promise.any — jo bhi PEHLE FULFILL hota hai (rejections ignore karta hai jab tak koi fulfill na ho), wahi result — SAB reject ho jaayein tabhi ye reject hota hai
async function demoAny() {
  try {
    const result = await Promise.any([
      delay(50, "fails-fast", true), // jaldi reject hoga, but any ise IGNORE karega aur aage wait karega
      delay(200, "succeeds"), // ye fulfill hoga — any ka result yahi banega
    ]);
    console.log("any result:", result); // "succeeds" — rejection ko ignore kiya kyunki koi fulfillment mil gaya
  } catch (err) {
    // ye tabhi chalega jab SAB promises reject ho jaayein — err ek AggregateError hoga jisme sab reasons hote hain
    console.log("all rejected:", err);
  }
}
```

---

## Debouncing and Throttling — Implemented From Scratch

Chapter 1 (`01-api-calling-best-practices.md`) mein humne debounce/throttle ko API call context mein use kiya tha. Yahan same utilities ko implement kar rahe hain, closure-based mechanics ko fully samajhne ke liye — **closure hi hai jo delay/interval state ko function calls ke beech persist karta hai**.

```javascript
// DEBOUNCE — timer reset hota hai har naye call pe, function sirf "pause" ke baad chalta hai
function debounce(fn, delayMs) {
  let timeoutId = null; // ye variable CLOSURE mein persist hoga — returned function ke har invocation ke beech yaad rahega

  return function debounced(...args) {
    // ye wrapper function hi caller ko milta hai, original "fn" nahi
    clearTimeout(timeoutId); // pehle se koi pending timer hai toh cancel kiya (agar null hai, clearTimeout silently no-op karta hai, safe hai)

    timeoutId = setTimeout(() => {
      // naya timer set kiya
      fn.apply(this, args); // delay complete hone pe original function call, correct "this" aur latest args ke saath
      timeoutId = null; // reset — taaki agla independent call fresh state se shuru ho
    }, delayMs); // delayMs milliseconds wait karega
  };
}

// THROTTLE — function ko max ek baar chalne dete hain per fixed interval, chahe calls kitni bhi frequent hoon
function throttle(fn, intervalMs) {
  let isWaiting = false; // flag — batata hai ki hum abhi "cooldown" period mein hain ya nahi
  let pendingArgs = null; // agar cooldown ke beech naya call aaya, uske args yahan store karte hain trailing-call ke liye

  return function throttled(...args) {
    if (!isWaiting) {
      // agar cooldown mein nahi hain, IMMEDIATELY call karo (leading-edge behavior)
      fn.apply(this, args); // turant execute
      isWaiting = true; // cooldown start kiya
      pendingArgs = null; // koi pending call nahi hai abhi

      setTimeout(() => {
        // cooldown timer
        isWaiting = false; // cooldown khatam
        if (pendingArgs !== null) {
          // cooldown ke beech koi call aaya tha jo drop hua — usse ek baar aakhri mein chalao (trailing-edge)
          fn.apply(this, pendingArgs); // trailing call execute
          pendingArgs = null; // reset
        }
      }, intervalMs);
    } else {
      // abhi cooldown chal raha hai — is call ko drop karo, lekin latest args yaad rakho trailing-call ke liye
      pendingArgs = args; // sirf LATEST args store hote hain, purane overwrite ho jaate hain
    }
  };
}
```

```javascript
// USAGE — scroll handler ko throttle karna, ek real scenario
const handleScroll = throttle(() => {
  console.log("scroll position:", window.scrollY); // ye max ek baar per 200ms chalega, chahe scroll event 60fps pe fire ho
}, 200); // 200ms cooldown

window.addEventListener("scroll", handleScroll); // scroll listener attach kiya, throttled handler ke saath
```

**Debounce vs throttle recap from closure lens**: dono utilities apna "state" (`timeoutId`, `isWaiting`, `pendingArgs`) closure ke through persist karte hain across multiple calls — ye exact wahi mechanism hai jo section 2 mein counter example mein dekha tha. Har `debounce()`/`throttle()` call apna khud ka independent closure banata hai, isliye alag-alag debounced/throttled functions ek doosre ka state kabhi share nahi karte.

---

## Memory Leaks in JS — Common Causes

JS mein garbage collector (GC) automatically unreachable memory clean karta hai — lekin agar tum **accidentally kisi bhi cheez ko reachable rakhte ho** jiski zaroorat nahi hai, GC usse collect nahi kar sakta. Yahi "memory leak" hai JS mein — technically GC kaam kar raha hai, lekin tumhara code usse mauka nahi de raha.

### 1. Forgotten event listeners / timers

```javascript
class LiveWidget {
  constructor() {
    this.data = new Array(1_000_000).fill("x"); // ek bada array — memory-heavy object, sirf demonstration ke liye

    // BUG: listener attach kiya, lekin kabhi remove nahi kiya
    this.handleResize = () => console.log(this.data.length); // ye closure "this" (poora LiveWidget instance, including bada array) ko capture kar leta hai
    window.addEventListener("resize", this.handleResize); // "window" (jo kabhi destroy nahi hota poore page lifetime mein) ab is instance ko reference kar raha hai
  }

  // FIX: destroy method banao aur usse component unmount/cleanup pe zaroor call karo
  destroy() {
    window.removeEventListener("resize", this.handleResize); // reference hata diya — ab LiveWidget instance (aur uska bada array) garbage collect ho sakta hai
  }
}

const widget = new LiveWidget(); // instance banaya, listener attached
// ... widget ki zaroorat khatam ho gayi, lekin agar destroy() call nahi kiya, "window" hamesha isse reference karta rahega — LEAK
widget.destroy(); // CORRECT cleanup — is call ke bina, widget aur uska 1M-item array poore page lifetime tak memory mein rahega
```

### 2. Closures unintentionally large objects ko alive rakhte hain

```javascript
function setupHandler() {
  const hugeDataset = fetchHugeDataset(); // socho ye kaafi bada dataset hai, memory mein
  const summary = computeSummary(hugeDataset); // sirf ek chhota summary chahiye tha aage ke liye

  // BUG: closure poore "hugeDataset" ko reference kar raha hai, chahe sirf "summary" use ho raha hai
  return function handler() {
    console.log(summary, hugeDataset.length); // "hugeDataset" ka koi bhi reference (chahe sirf ".length" ke liye) POORA object ko alive rakhta hai
  };
}

function setupHandlerFixed() {
  const hugeDataset = fetchHugeDataset(); // same bada dataset
  const summary = computeSummary(hugeDataset); // summary compute kiya
  const length = hugeDataset.length; // FIX: sirf zaroori primitive value nikal li, alag variable mein

  // ab closure sirf "summary" aur "length" (primitives/small object) ko capture karta hai, "hugeDataset" ka reference GONE hai
  return function handler() {
    console.log(summary, length); // "hugeDataset" ab kahin reference nahi hai — is function ke return hone ke baad GC ho sakta hai
  };
}

function fetchHugeDataset() {
  return new Array(1_000_000).fill(0); // simulate large data
}
function computeSummary(data) {
  return { count: data.length }; // chhota summary object
}
```

### 3. Detached DOM nodes still referenced from JS variables

```javascript
let cachedElement = null; // module-level variable, poore app lifetime mein alive rahega

function cacheAndRemove() {
  cachedElement = document.getElementById("big-list"); // DOM element ka reference JS variable mein le liya
  cachedElement.remove(); // DOM tree se element hata diya — ye ab "detached" hai (page pe visible nahi)

  // BUG: chahe DOM tree se hata diya, "cachedElement" JS variable abhi bhi isse REFERENCE kar raha hai
  // isliye browser is DOM node (aur uske saare children, event listeners, attached data) ko GC nahi kar sakta
  // ye ek CLASSIC memory leak pattern hai jo Chrome DevTools Memory tab mein "detached DOM tree" ke roop mein dikhta hai
}

function cacheAndRemoveFixed() {
  const element = document.getElementById("big-list"); // local variable — function return hone pe scope khatam
  element.remove(); // DOM se hataya
  // "element" koi longer-lived variable mein store nahi kiya — function return hone ke baad ye reference bhi khatam ho jaata hai
  // ab DOM node fully unreachable hai — GC eligible
}
```

---

## Real-World Gotchas

- **`==` vs `===` aur type coercion** — `==` operands ko compare karne se pehle **type coerce** karta hai, jo counter-intuitive results deta hai: `[] == false` → `true` (kyunki `[]` string mein convert hota hai `""`, phir `""` number mein convert hota hai `0`, aur `false` bhi `0` ban jaata hai — dono side `0 === 0`). `===` (strict equality) koi coercion nahi karta — types match nahi karte toh seedha `false`. **Rule**: hamesha `===` use karo by default; `==` sirf specific, deliberate cases mein (jaise `x == null` jo `null` aur `undefined` dono ko ek saath check karta hai) — memorize mat karo coercion table, samjho ki `==` "predictable nahi hai" isliye avoid karo.
- **`NaN !== NaN`** — `NaN` (Not a Number) JS mein ek weird property rakhta hai: khud ke barabar bhi nahi hota. `NaN === NaN` → `false`, `NaN == NaN` → `false` bhi. Isliye `if (value === NaN)` **kabhi kaam nahi karega**. Correct way: `Number.isNaN(value)` use karo (ye specifically NaN-check karta hai, koi coercion nahi karta — global `isNaN()` se bhi better hai kyunki `isNaN("hello")` bhi `true` deta hai coercion ki wajah se, jabki `Number.isNaN("hello")` `false` deta hai).
- **Array `sort()` original array ko MUTATE karta hai (in-place)** — ye React state bugs ka common source hai. `array.sort()` naya array return karta hai TRUE, lekin wo naya array **original ke same reference** hota hai — original bhi mutate ho jaata hai. Agar tum React state (ya Redux store) ka array directly `.sort()` karte ho, tum immutability contract todte ho — React ko change detect nahi hota (reference same hai), re-render skip ho sakta hai, ya agar detect ho bhi jaaye, debugging tools (time-travel debugging) confuse ho jaate hain kyunki "previous state" bhi accidentally mutate ho gaya. **Fix**: `[...array].sort()` ya `array.slice().sort()` — pehle copy banao, phir sort karo.
- **Floating point precision — `0.1 + 0.2 !== 0.3`** — JavaScript numbers IEEE 754 double-precision floating point standard use karte hain, jo kuch decimal fractions ko **exactly** represent nahi kar sakta (binary mein 0.1 ek repeating fraction hai, jaise decimal mein 1/3). `0.1 + 0.2` actually `0.30000000000000004` deta hai. **Fix for comparisons**: exact equality check mat karo floats pe — ek small epsilon tolerance use karo: `Math.abs(a - b) < Number.EPSILON` (ya apna chosen tolerance jaise `0.0001`). **Fix for money/currency**: floats mein currency store hi mat karo — cents/paise mein integers use karo, ya dedicated library (jaise `decimal.js`) use karo.

```javascript
// Gotchas ek saath demo karte hain
console.log([] == false); // true — [] -> "" -> 0, false -> 0, isliye 0 === 0
console.log([] === false); // false — strict equality mein type match nahi karta (array vs boolean), no coercion

console.log(NaN === NaN); // false — NaN kabhi khud ke barabar nahi hota
console.log(Number.isNaN(NaN)); // true — correct way NaN check karne ka

const original = [3, 1, 2]; // ek array
const sorted = original.sort(); // sort() IN-PLACE mutate karta hai
console.log(original); // [1, 2, 3] — original bhi badal gaya! sort() ne naya array nahi banaya
console.log(original === sorted); // true — same reference, proof ki mutation hui, copy nahi

const safeOriginal = [3, 1, 2]; // fresh array
const safeSorted = [...safeOriginal].sort(); // spread se copy banayi PEHLE, phir sort
console.log(safeOriginal); // [3, 1, 2] — original untouched
console.log(safeSorted); // [1, 2, 3] — naya sorted array, alag reference

console.log(0.1 + 0.2 === 0.3); // false — floating point precision issue
console.log(0.1 + 0.2); // 0.30000000000000004 — actual internal representation
console.log(Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON); // true — tolerance-based comparison, correct approach
```

---

## Key Takeaways

- JS language khud single-threaded hai — async capability runtime (browser/Node) se aati hai event loop ke through; microtasks (Promises) **hamesha** next macrotask (setTimeout) se pehle poori tarah drain hote hain.
- Closure ka matlab hai engine outer scope ko garbage collect nahi karta jab tak inner function usse reference karta hai — `var` (function-scoped, shared) vs `let` (block-scoped, per-iteration binding) ka farak isi closure mechanics se emerge hota hai loop bugs mein.
- Har JS object ka `[[Prototype]]` link hota hai — property lookup is chain ko follow karta hai; `class` syntax internally same prototype mechanism hai, methods `ClassName.prototype` pe shared hote hain (memory-efficient), instance data har object pe alag.
- `this` char rules se decide hota hai (default, implicit, explicit, arrow-lexical) priority order mein — arrow functions apna `this` nahi banate, enclosing scope se capture karte hain, isliye callbacks mein `this`-loss bugs se bachate hain.
- `async function` hamesha Promise return karta hai; `await` `.then()` chaining ka syntactic sugar hai jo generator-jaisi pause/resume mechanics use karta hai bina thread block kiye.
- Promise sirf ek baar settle hoti hai (pending → fulfilled/rejected, permanent); `.then()` naya Promise return karta hai jo chaining enable karta hai; `all`/`allSettled`/`race`/`any` alag-alag failure-tolerance semantics dete hain.
- Debounce (wait for pause) aur throttle (rate limit) dono closure-based state persistence pe depend karte hain across calls.
- Memory leaks tab hote hain jab code accidentally kisi cheez ko reachable rakhta hai jiski zaroorat nahi — listeners/timers cleanup na karna, closures mein bade objects unnecessarily capture karna, detached DOM nodes ko JS variables mein hold karna, teen common patterns hain.
- `==` coercion se unpredictable hai (use `===`), `NaN !== NaN` (use `Number.isNaN`), `sort()` mutates in-place (copy pehle banao), floating point exact equality unreliable hai (tolerance use karo) — ye sab "JavaScript is weird" moments hain jo samajhne se predictable ban jaate hain.

---

## 🎯 Interview Questions — Senior Frontend Developer

**Q1. JavaScript "single-threaded" hai, lekin async operations (setTimeout, fetch) kaise possible hain? Explain event loop ke context mein.**

JS engine (jaise V8) khud single call stack pe chalta hai — ek time pe ek statement. Async capability language se nahi, **runtime environment** (browser ke Web APIs, ya Node ka libuv) se aati hai. Jab tum `setTimeout` ya `fetch` call karte ho, actual timer/network operation runtime ke andar (JS engine se bahar) chalta hai. Jab wo complete hota hai, uska callback ek queue (macrotask ya microtask, type ke hisaab se) mein daal diya jaata hai. **Event loop** continuously check karta hai — call stack empty hai kya? Agar haan, queued callbacks ko chalata hai. Isliye JS "single-threaded" rehte hue bhi non-blocking async behavior deta hai — actual concurrency runtime provide karta hai, language nahi.

**Q2. Microtasks aur macrotasks mein priority difference kya hai? Code example do jahan yeh matter karta hai.**

Microtask queue (Promise `.then()`, `queueMicrotask`) ko event loop **poora drain** karta hai next macrotask (setTimeout, setInterval, I/O) chalane se pehle — chahe microtask queue mein kitne bhi items hoon. Example: `setTimeout(() => console.log("macro"), 0)` ke saath `Promise.resolve().then(() => console.log("micro"))` likho — "micro" hamesha "macro" se pehle print hoga, chahe setTimeout ka delay 0ms hi ho, kyunki event loop macrotask lene se pehle microtask queue empty hone ka wait karta hai.

**Q3. Closure kya hai — sirf definition nahi, engine internally kya karta hai jab ek closure create hoti hai?**

Jab ek inner function outer function ke variables reference karti hai, aur outer function return ho jaata hai, normally uska stack frame pop hona chahiye aur variables garbage collect hone chahiye. Lekin agar inner function still reachable hai (kisi variable mein return/store hui hai), JS engine outer scope ko memory mein **alive rakhta hai** — isliye ki inner function ka scope chain us outer scope ko reference karta hai. Ye "keeping alive via reference" hi closure ka actual mechanism hai — koi magic copy nahi hoti, engine literally us memory ko garbage collector se protect karta hai jab tak koi reachable path exist karta hai.

**Q4. `var` aur `let` ke saath `for` loop mein `setTimeout` use karne pe output different kyun aata hai?**

`var` function-scoped hai — poora loop sirf EK variable declaration share karta hai. Jab async callbacks baad mein chalte hain (macrotask queue mein wait karke), loop already poora synchronously complete ho chuka hota hai, isliye sab callbacks ek hi shared variable ki **final** value dekhte hain. `let` block-scoped hai, aur spec ke according, `for` loop ke saath `let` use karne pe engine **har iteration ke liye naya binding** create karta hai — isliye har closure apni khud ki, us specific iteration ki value capture kar leta hai independently.

**Q5. Prototype chain kya hai? `Object.create()` se explain karo, aur batao `class` methods actually kahan store hote hain.**

Har JS object ka ek internal `[[Prototype]]` link hota hai. Property lookup jab object pe khud property nahi milti, engine `[[Prototype]]` ko follow karke upar dekhta hai, jab tak property mile ya chain `null` pe khatam ho. `Object.create(proto)` explicitly ek naya object banata hai jiska `[[Prototype]]` `proto` set hota hai. `class` syntax ye exact mechanism use karta hai — jab tum class ke andar method define karte ho, wo method instance pe copy NAHI hota, balki `ClassName.prototype` pe stored hota hai, aur saare instances usi ek shared function object ko `[[Prototype]]` chain ke through access karte hain — ye memory-efficient hai kyunki N instances ke liye N alag function objects nahi banate.

**Q6. Arrow functions `this` ko differently kyun handle karte hain regular functions se? Kab use karna chahiye?**

Regular functions apna `this` call-time pe decide karte hain (kis object ke through call hua, ya `call`/`apply`/`bind` se explicit set hua). Arrow functions apna **khud ka `this` bind hi nahi karte** — ye lexically enclosing scope ka `this` capture karte hain, jaise koi normal closure variable. Isliye jab tumhe ek callback chahiye jo "current context ka `this`" retain kare (jaise class method ko event handler ke roop mein pass karna, ya array method callback ke andar `this` use karna), arrow function sahi choice hai. Regular function use karo jab tumhe genuinely dynamic `this` chahiye ho (jaise object method jo call-site pe depend karta hai).

**Q7. `async function` `await` ke bina bhi likhi ho toh kya return karta hai? `return 5` likhne pe caller ko kya milta hai?**

`async function` hamesha ek **Promise** return karta hai, chahe function body mein `await` ho ya na ho. Agar function `return 5` karta hai, JS engine automatically usse `Promise.resolve(5)` mein wrap kar deta hai — caller ko `Promise<number>` milta hai, raw `5` nahi. Isi tarah agar async function ke andar throw hota hai, wo returned Promise ko reject kar deta hai (caller `.catch()` ya `try/catch` + `await` se pick kar sakta hai) — koi bhi async function ka "exit" (return ya throw) automatically Promise settlement mein convert ho jaata hai.

**Q8. `Promise.all` aur `Promise.allSettled` mein kab kya use karoge — concrete scenario do.**

`Promise.all` use karo jab tumhe SAB operations successful chahiye ho, aur agar EK BHI fail ho jaaye, poori operation ko fail treat karna sahi ho — jaise "3 related database writes ek transaction ki tarah, agar ek fail, sab invalid maano". `Promise.all` first rejection pe IMMEDIATELY reject ho jaata hai, baaki promises ka wait nahi karta. `Promise.allSettled` use karo jab tumhe independent operations ka result chahiye ho chahe kuch fail ho jaayein — jaise "5 alag widgets ke liye 5 independent API calls dashboard pe, jo succeed karein unhe render karo, jo fail hue unke liye error state dikhao, ek ki failure baaki 4 ko block nahi karni chahiye". `allSettled` kabhi reject nahi hota, hamesha poora array deta hai per-item status ke saath.

**Q9. `Promise.race` ka ek practical real-world use case do jahan ye actually useful hai (sirf definition nahi).**

Timeout pattern — agar tumhe ek API call ko max N milliseconds tak hi wait karna hai (uske baad "timed out" treat karna hai, chahe underlying call abhi bhi pending ho), `Promise.race([actualApiCall(), timeoutPromise(N)])` use karo, jahan `timeoutPromise` `setTimeout` ke through N ms baad reject ho jaata hai. `race` jo bhi pehle settle ho (fulfil ya reject) usi ko final result banata hai — agar API N ms se pehle resolve ho gaya, wahi jeetega; agar N ms guzar gaye pehle, timeout promise jeetega aur caller ko "timed out" error milega, chahe original API call abhi bhi background mein chal rahi ho.

**Q10. Debugging scenario: `array.sort()` call karne ke baad, tumhara React component ka original state array bhi change ho gaya hai jo tumne expect nahi kiya tha. Kya ho raha hai, aur fix kya hai?**

`Array.prototype.sort()` naya array **return** karta hai, lekin ye sorting **in-place (mutating)** karta hai — returned array aur original array EXACT same reference hote hain. Agar tum React state ke array pe directly `.sort()` call karte ho (jaise `state.items.sort()`), original state array bhi mutate ho jaata hai — ye React ke immutability contract ko todta hai, kyunki reference same rehne ki wajah se React change detect nahi kar paata (shallow comparison reference check karta hai), re-render skip ho sakta hai, aur agar tum Redux jaisi time-travel-debugging tool use kar rahe ho, "previous state" bhi accidentally corrupt ho jaata hai. **Fix**: sort karne se pehle array ka copy banao — `[...state.items].sort()` ya `state.items.slice().sort()` — taaki original reference untouched rahe aur naya, alag array object sorted version ho.

**Q11. `NaN` ke saath equality check karne mein kya problem hai, aur correct approach kya hai?**

`NaN` IEEE 754 floating point spec ke according, khud ke barabar nahi hota — `NaN === NaN` aur `NaN == NaN` dono `false` return karte hain. Isliye `if (value === NaN)` ya `if (value == NaN)` **kabhi true nahi hoga**, chahe `value` actually `NaN` hi ho — ye ek silent, hard-to-catch bug hai. Correct approach `Number.isNaN(value)` hai, jo specifically NaN detection ke liye design kiya gaya hai bina koi coercion kiye. Global `isNaN()` avoid karo jab possible ho, kyunki wo pehle argument ko number mein coerce karta hai — `isNaN("hello")` bhi `true` deta hai (kyunki `"hello"` number mein convert nahi ho sakta, `NaN` ban jaata hai), jo misleading ho sakta hai; `Number.isNaN("hello")` correctly `false` deta hai kyunki wo coercion nahi karta.

**Q12. Memory leak ka ek example do jahan closures involved hain, aur explain karo GC actually kyun collect nahi kar paata.**

Socho ek function bada dataset fetch karta hai, usse ek chhota summary compute karta hai, aur ek callback return karta hai jo closure ke through poore `hugeDataset` ko reference karta hai (chahe callback sirf `hugeDataset.length` use kare). Garbage collector kisi object ko collect karta hai sirf jab wo **completely unreachable** ho — koi bhi live reference path uss object tak nahi hona chahiye. Yahan returned callback ka closure scope chain `hugeDataset` variable ko still reference karta hai, isliye GC ka mark-and-sweep algorithm usse "reachable" classify karega aur collect nahi karega — poora bada dataset memory mein rahega jab tak wo callback function khud reachable hai. Fix: closure ke andar sirf zaroori primitive values extract karo (jaise `const length = hugeDataset.length` closure banane se pehle), taaki closure poore bade object ko reference na kare, sirf jo chhota data actually zaroori hai use kare.
