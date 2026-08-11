# GraphQL — Senior Developer Depth

Ye chapter GraphQL ko ekdum root-level se explain karta hai — REST kyun kabhi kabhi kaafi nahi hota, schema/resolver internals actually kaise chalte hain, N+1 problem jo har GraphQL server production mein face karta hai, aur client-side normalized caching jo Apollo/urql jaisi libraries ko REST caching se fundamentally different banata hai. Goal ye hai ki tum sirf syntax na yaad karo — balki samjho ki har design decision *kyun* liya gaya, aur senior interview mein trade-offs ke saath defend kar sako.

## Is chapter mein

1. [Why GraphQL Exists — The Over-fetching/Under-fetching Problem](#why-graphql-exists)
2. [Schema, Types, and Resolvers — How a GraphQL Server Actually Works Internally](#schema-types-resolvers)
3. [Queries vs Mutations vs Subscriptions](#queries-mutations-subscriptions)
4. [The N+1 Problem and DataLoader](#n-plus-1-dataloader)
5. [Client-Side GraphQL — Apollo Client / urql and Normalized Caching](#client-side-graphql)
6. [Fragments and Variables](#fragments-variables)
7. [GraphQL vs REST — Senior Decision Framework](#graphql-vs-rest)
8. [Real-World Gotchas](#real-world-gotchas)
9. [Key Takeaways](#key-takeaways)
10. [🎯 Interview Questions — Senior Frontend Developer](#interview-questions)

---

## 1. Why GraphQL Exists — The Over-fetching/Under-fetching Problem {#why-graphql-exists}

Chalo ek real scenario se start karte hain. Tumhare paas ek mobile app hai jiska ek screen dikhata hai: user ka naam, aur uske last 3 posts ke titles. Simple sa requirement lagta hai, lekin REST ke saath ye surprisingly awkward ho jaata hai.

### REST approach #1 — Multiple round-trips (Under-fetching)

REST mein typically har resource ka apna endpoint hota hai — `/users/:id` aur `/users/:id/posts`. Isliye client ko do separate calls karni padegi:

```javascript
// Step 1: user ka basic data fetch karo — ye call sirf name, email, avatar deta hai
const userRes = await fetch(`/api/users/${userId}`);
// Response ko JSON mein parse karo — ye ek network round-trip complete hone ke baad hi resolve hoga
const user = await userRes.json();

// Step 2: ab user ke posts fetch karne ke liye DOOSRA network call karna padega
const postsRes = await fetch(`/api/users/${userId}/posts?limit=3`);
// Ye bhi apna alag JSON parse round-trip hai — total 2 requests, 2 waterfalls
const posts = await postsRes.json();

// Ab dono ko manually merge karo screen ke liye — client ko ye orchestration khud likhni padi
const screenData = { name: user.name, postTitles: posts.map((p) => p.title) };
```

Ye "under-fetching" hai — ek endpoint kaafi data nahi deta, isliye client ko N alag calls chain karni padti hain. Mobile network pe har round-trip 100-300ms latency add karta hai, aur agar posts ke andar bhi comments chahiye ho, ye chain aur lambi ho jaati hai — isko hi log **client-side N+1 problem** kehte hain (server-side N+1 alag hai, wo section 4 mein aayega).

### REST approach #2 — Ek bloated endpoint (Over-fetching)

Team decide karti hai: "chalo ek `/api/user-profile-screen/:id` endpoint bana dete hain jo sab kuch ek saath de de." Backend developer ye likhta hai:

```javascript
// Ek "kitchen sink" endpoint jo screen ke liye sab kuch return karta hai
app.get('/api/user-profile-screen/:id', async (req, res) => {
  // User ka poora record fetch kiya — including fields jo screen ko chahiye nahi
  const user = await db.users.findById(req.params.id);
  // Posts bhi poore fetch kiye — content, tags, metadata — sab kuch
  const posts = await db.posts.findByUser(req.params.id, { limit: 3 });
  // Comments count bhi joda gaya — kyunki "shayad kabhi kisi client ko chahiye"
  const commentCounts = await db.comments.countByPosts(posts.map((p) => p.id));
  // Poora bloated object client ko bhej diya — jisme 80% fields unused hain
  res.json({ user, posts, commentCounts, followersCount: user.followers.length });
});
```

Ye "over-fetching" hai — mobile screen ko sirf `name` aur 3 post `title`s chahiye the, lekin response mein full user object, full post objects, comment counts, follower counts — sab aa gaya. Payload size unnecessarily bada hai, aur agar kal koi **web dashboard** bhi isi endpoint ko hit karta hai jise `email` aur `bio` chahiye but posts nahi chahiye — tumhe ya to naya endpoint banana padega, ya isi endpoint mein query params add karte jaana padega jo ek din unmanageable ho jaate hain.

### GraphQL ka solution

GraphQL ka core idea simple hai: **client exactly bataata hai use kaunse fields chahiye, ek hi request mein, ek hi round-trip mein.**

```graphql
# Client ye exact query bhejta hai server ko — ek single POST request mein
query UserProfileScreen($userId: ID!) {
  # user field ko userId argument diya — server jaanta hai isse kaunsa user fetch karna hai
  user(id: $userId) {
    # sirf name chahiye — email, bio, followers kuch nahi maanga
    name
    # posts field ke andar nested selection — ye "sub-query" jaisa lagta hai lekin ek hi request hai
    posts(limit: 3) {
      # sirf title chahiye har post ka — content, tags kuch nahi
      title
    }
  }
}
```

Response bhi exactly usi shape mein aata hai jo query mein maanga gaya:

```json
{
  "data": {
    "user": {
      "name": "Sharad Poddar",
      "posts": [
        { "title": "Understanding React Fiber" },
        { "title": "Why RLS Matters" },
        { "title": "GraphQL N+1 Deep Dive" }
      ]
    }
  }
}
```

Ye ek hi HTTP request hai (network round-trip: 1, REST ke 2 ke jagah), aur payload sirf wahi hai jo screen ko chahiye (over-fetching nahi). Agar smartwatch app ko sirf `name` chahiye without posts, wo apni khud ki query likh sakta hai — same server, same schema, alag shape. **Yehi core value proposition hai: data-fetching ka control server se client ki taraf shift ho gaya.**

---

## 2. Schema, Types, and Resolvers — How a GraphQL Server Actually Works Internally {#schema-types-resolvers}

Ye section sabse important hai kyunki yahan tak logon ko lagta hai GraphQL "magic" hai. Actually mein ye ek bahut simple tree-walking algorithm hai.

### Schema — type graph ka blueprint

Schema define karta hai kaunse types exist karte hain, unke fields kya hain, aur root pe `Query`/`Mutation`/`Subscription` types kya expose karte hain.

```graphql
# User type define kar rahe hain — ye graph ka ek "node type" hai
type User {
  # id field — GraphQL ka built-in ID scalar, unique identifier ke liye
  id: ID!
  # name field — String scalar, "!" matlab non-nullable, ye field kabhi null nahi hoga
  name: String!
  # email field — nullable String, matlab null aa sakta hai response mein
  email: String
  # posts field — ye ek "edge" hai User se Post type tak, array return karta hai
  posts(limit: Int): [Post!]!
}

# Post type — dusra node type, jiska ek field User ko back-reference karta hai
type Post {
  # id field — har post ka unique identifier
  id: ID!
  # title field — non-nullable String
  title: String!
  # content field — poora body text, nullable rakha kyunki drafts mein empty ho sakta hai
  content: String
  # author field — ye Post se User tak wapas edge hai, "graph" wali baat yahi hai
  author: User!
}

# Query type — ye schema ka "entry point" hai, root level readable fields yahan define hote hain
type Query {
  # user field — ek argument leta hai (id), aur User type return karta hai (nullable, kyunki na mile toh null)
  user(id: ID!): User
  # posts field — sabhi posts ki list return karta hai, koi argument nahi
  posts: [Post!]!
}
```

Notice karo — `User` ke andar `posts` field hai, aur `Post` ke andar `author` field hai jo wapas `User` deta hai. Yehi "graph" hai — types ek dusre ko point kar sakte hain, aur client kisi bhi depth tak traverse kar sakta hai (jaise `user.posts.author.posts.author...` — theoretically infinite, jo section 8 mein DoS risk ban jaata hai).

### Resolver — har field ka "fetcher function"

Schema sirf shape define karta hai — **resolvers** actually data laate hain. Har field ka apna resolver function ho sakta hai (ya default resolver, jo parent object se same-named property utha leta hai).

```javascript
// resolvers object — schema ke har type/field ke against ek function mapping hai
const resolvers = {
  // Query type ke resolvers — ye root-level entry points handle karte hain
  Query: {
    // user resolver — args mein query ke arguments aate hain, jaise { id: "5" }
    user: async (parent, args, context) => {
      // parent yahan undefined hoga kyunki Query root hai, iska koi "upar wala" node nahi
      // args.id wahi id hai jo client ne query mein diya tha
      // context mein request-scoped cheezein hoti hain, jaise db connection ya authenticated user
      return await context.db.users.findById(args.id);
      // ye ek plain JS object return karta hai — GraphQL engine isse aage "User" type maanta hai
    },
    // posts resolver — koi args nahi, seedha saari posts fetch kar leta hai
    posts: async (parent, args, context) => {
      // db se sab posts nikal ke return kar diya, array of plain objects
      return await context.db.posts.findAll();
    },
  },

  // User type ke resolvers — ye tab chalte hain jab query User type ke fields maange
  User: {
    // posts field ka resolver — yahan "parent" actually us User object ko refer karta hai
    posts: async (parent, args, context) => {
      // parent.id wahi User hai jiske posts chahiye — parent Query.user resolver se aaya tha
      // args.limit optional argument hai jo query mein diya gaya, jaise posts(limit: 3)
      return await context.db.posts.findByUserId(parent.id, args.limit);
    },
    // name, email fields ke liye humne koi custom resolver nahi likha —
    // GraphQL default resolver use karta hai jo parent.name aur parent.email seedha uthata hai
  },

  // Post type ke resolvers
  Post: {
    // author field ka resolver — parent yahan ek Post object hai
    author: async (parent, args, context) => {
      // parent.authorId Post table mein stored foreign key hai
      // isse User fetch kiya jaa raha hai — dhyaan do, ye har post ke liye alag call hai (N+1 ka seed yahi hai)
      return await context.db.users.findById(parent.authorId);
    },
  },
};
```

### Resolver execution model — query ek tree hai

Jab client ye query bhejta hai:

```graphql
# Ek query jo user ke saath uske posts aur har post ke author bhi maang rahi hai
query {
  user(id: "1") {
    name
    posts {
      title
      author {
        name
      }
    }
  }
}
```

GraphQL engine internally is query ko ek **tree** ki tarah treat karta hai, aur **depth-first** traverse karta hai:

1. Root pe `Query.user` resolver chalta hai — `{ id: "1" }` ka user object return hota hai. Ye ban gaya "parent" agle level ke liye.
2. `user` object pe `name` field ke liye default resolver chalta hai — `parent.name` seedha return.
3. `user` object pe `posts` field ke liye `User.posts` resolver chalta hai, `parent` = user object. Ye posts ka array return karta hai.
4. Har post object pe (array ka har element alag se) `title` field ke liye default resolver chalta hai.
5. Har post object pe `author` field ke liye `Post.author` resolver chalta hai, `parent` = wo specific post. Agar 3 posts hain, ye resolver **3 alag baar** chalta hai — teen alag database calls.
6. Har author object pe `name` field ke liye default resolver.

Yehi "parent passing down" model hai — **har field apne parent object ko dekh ke decide karta hai use kya fetch karna hai.** Isi execution model ki wajah se step 5 mein N+1 problem create hota hai, jo section 4 ka topic hai.

---

## 3. Queries vs Mutations vs Subscriptions {#queries-mutations-subscriptions}

GraphQL operations teen types ke hote hain, aur inka distinction sirf naming convention nahi hai — ye actual semantic difference batata hai.

### Query — read, convention se side-effect-free

Query data padhne ke liye hai. GraphQL spec technically enforce nahi karta ki Query resolvers side-effect-free hon, lekin convention (aur tooling jaise caching layers) ye assume karti hai — isliye Query resolvers mein writes avoid karo.

```graphql
# Query — sirf data read kar rahe hain, koi state change nahi honi chahiye
query GetUserPosts($userId: ID!) {
  # user field ko variable pass kiya
  user(id: $userId) {
    # name field maanga
    name
    # posts field, jisme title aur createdAt dono maange
    posts {
      title
      createdAt
    }
  }
}
```

### Mutation — write, jisme side effects expected hain

Mutation naam se hi clear hai — ye server-side state change karta hai (create/update/delete). Convention ye hai ki Mutation ka result usually wo entity return kare jo change hui.

```graphql
# Mutation — naya post create kar rahe hain, ye ek write operation hai
mutation CreatePost($title: String!, $content: String!, $authorId: ID!) {
  # createPost field — arguments input ke roop mein bhej rahe hain
  createPost(title: $title, content: $content, authorId: $authorId) {
    # jo post create hui uska id wapas maanga — client ko confirmation chahiye
    id
    # title bhi wapas maanga — server-generated defaults check karne ke liye (jaise slug)
    title
    # createdAt bhi maanga — server ne timestamp set kiya, client ko pata chalna chahiye
    createdAt
  }
}
```

Server-side, mutation resolver kuch aise dikhta hai:

```javascript
// Mutation resolvers — har field ek write operation represent karta hai
const resolvers = {
  Mutation: {
    // createPost resolver — args mein input fields aate hain
    createPost: async (parent, args, context) => {
      // authentication check — mutation mein ye zaroori hai kyunki state change ho raha hai
      if (!context.currentUser) throw new Error('Unauthorized');
      // database mein naya row insert kiya, args se title/content/authorId liya
      const post = await context.db.posts.create({
        title: args.title,
        content: args.content,
        authorId: args.authorId,
      });
      // newly created post object return kiya — GraphQL engine ise Post type maan ke fields resolve karega
      return post;
    },
  },
};
```

### Subscription — long-lived, server-pushed real-time updates

Subscription ek alag transport use karta hai — typically WebSocket — kyunki HTTP request/response model mein server khud se client ko baar-baar push nahi kar sakta. Ye chat apps, live scores, live notifications jaise use cases ke liye hai.

```graphql
# Subscription — client ek baar subscribe karta hai, phir server jab bhi event hota hai push karta hai
subscription OnNewComment($postId: ID!) {
  # commentAdded field — ye ek "event stream" hai, normal field nahi
  commentAdded(postId: $postId) {
    # naye comment ka text
    text
    # comment kisne kiya uska naam
    author {
      name
    }
  }
}
```

Server-side, subscription resolver ek `AsyncIterator` return karta hai (typically PubSub pattern ke through):

```javascript
// Subscription resolvers — inka shape thoda alag hota hai Query/Mutation se
const resolvers = {
  Subscription: {
    commentAdded: {
      // subscribe function — ek async iterator return karta hai jo events emit karta hai
      subscribe: (parent, args, context) => {
        // pubsub.asyncIterator ek specific "topic" (event name) sunta hai
        // topic string mein postId include kiya gaya taaki sirf relevant post ke comments aayen
        return context.pubsub.asyncIterator(`COMMENT_ADDED_${args.postId}`);
      },
    },
  },
  Mutation: {
    // jab koi naya comment add hota hai, us mutation ke andar hi event publish karte hain
    addComment: async (parent, args, context) => {
      // pehle comment ko database mein save karo
      const comment = await context.db.comments.create(args);
      // phir pubsub ke through us topic pe event publish karo — jo bhi subscribed hai usko milega
      context.pubsub.publish(`COMMENT_ADDED_${args.postId}`, { commentAdded: comment });
      // mutation apna normal response bhi return karta hai
      return comment;
    },
  },
};
```

Practical note: production mein raw in-memory PubSub scale nahi karta multiple server instances ke across — usually Redis-backed PubSub (jaise `graphql-redis-subscriptions`) use hota hai taaki alag-alag server pods ke beech events propagate ho sakein.

---

## 4. The N+1 Problem and DataLoader {#n-plus-1-dataloader}

Section 2 mein humne dekha ki resolver execution tree-based hai, aur har node apna resolver independently chalata hai. Isi se ek classic performance trap create hota hai.

### Problem samjho concrete numbers se

Ye query lo:

```graphql
# 10 users maange, har user ke 5 posts, aur har post ke author ka naam
query {
  users {
    posts {
      author {
        name
      }
    }
  }
}
```

Agar 10 users hain aur har user ke 5 posts hain (total 50 posts), toh naive resolver implementation mein:

- `users` resolver: **1 query** (sab users ek saath)
- `posts` resolver har user ke liye alag chalta hai: **10 queries** (ek per user)
- `author` resolver har post ke liye alag chalta hai: **50 queries** (ek per post!)

Total: 1 + 10 + 50 = **61 database round-trips** ek single GraphQL request ke liye. Isi ko **N+1 problem** kehte hain — asal mein ye "N+1" se zyada worse hai (multi-level N+1), lekin naam wahi convention se chal gaya hai. Production mein ye latency ko seconds tak le ja sakta hai jab data thoda bhi bada ho.

### DataLoader ka solution — batching + caching

Facebook ne `DataLoader` library banayi thi exactly is problem ke liye. Core idea: **ek single event-loop tick ke andar jitne bhi ID requests aayen, unhe collect karo, aur phir ek hi batched query database ko bhejo.**

```javascript
// DataLoader import kiya — ye batching aur per-request caching dono handle karta hai
const DataLoader = require('dataloader');

// User loader banaya — iska ek "batch function" hota hai jo array of IDs leta hai
const createUserLoader = () =>
  new DataLoader(async (userIds) => {
    // ye function tab chalega jab DataLoader ne saare pending IDs ek tick mein collect kar liye
    // userIds ek array hai — jaise saare posts ke authorId ek saath yahan aa jaayenge, duplicate-free nahi hote by default
    console.log('Batch fetching users for IDs:', userIds);
    // ek SINGLE database query jo "WHERE id IN (...)" jaisi hoti hai, N alag queries ke jagah
    const users = await db.users.findByIds(userIds);
    // DataLoader ko exactly wahi order mein result chahiye jis order mein IDs diye gaye the
    const userMap = new Map(users.map((u) => [u.id, u]));
    // isliye map karke original order preserve kar rahe hain, missing ke liye null
    return userIds.map((id) => userMap.get(id) || null);
  });

// Resolver ab DataLoader use karta hai seedha db call ke jagah
const resolvers = {
  Post: {
    author: async (parent, args, context) => {
      // ye load() call IMMEDIATELY database nahi hit karta —
      // ye pehle DataLoader ki internal queue mein authorId daal deta hai
      // aur ek Promise return karta hai jo tick ke end mein resolve hoga
      return context.userLoader.load(parent.authorId);
    },
  },
};

// Har incoming GraphQL request ke liye NAYA loader banate hain (per-request scope zaroori hai)
// warna ek user ka cached data doosre request mein leak ho sakta hai
app.use('/graphql', (req, res, next) => {
  // context ke andar fresh loader daala — isse request-level caching milti hai, cross-request nahi
  req.context = { userLoader: createUserLoader(), db };
  next();
});
```

### Ye kaam kaise karta hai — event loop ki mechanics

Jab GraphQL engine tree ke ek level ke saare `author` resolvers chalata hai (jaise saare 50 posts ke liye), har resolver `userLoader.load(authorId)` call karta hai. DataLoader **synchronously** ye IDs ek internal array mein collect karta hai aur turant koi query nahi bhejta — wo `Promise.resolve().then()` (ya `process.nextTick`) use karke apne "batch dispatch" ko event loop ke current tick ke **end tak** deferred karta hai. Jab tak saare resolvers apna `load()` call kar chuke hote hain (chahe 50 alag calls ho), tab tak DataLoader ke paas saare unique IDs collected ho jaate hain, aur phir ek hi batch function call chalta hai — matlab **50 authorId requests → sirf 1 database query** (ya kam, agar duplicate authorIds hain kyunki multiple posts same author ke ho sakte hain).

Isse pehla wala 61-query scenario ban jaata hai roughly: 1 (users) + 1 (posts batched per user, agar wahan bhi loader use ho) + 1 (authors batched) = **3-4 queries total**, chahe data kitna bhi bada ho.

Extra bonus: DataLoader same request ke andar same ID dobara maangne pe **cache** bhi kar deta hai — agar 2 posts ka same author hai, `load(authorId)` dusri baar call hone pe database hit nahi hoga, cached Promise seedha return hoga.

---

## 5. Client-Side GraphQL — Apollo Client / urql and Normalized Caching {#client-side-graphql}

Ye wo part hai jahan GraphQL clients REST caching se **fundamentally** alag ho jaate hain, aur ye samajhna senior-level differentiation hai.

### REST caching vs GraphQL normalized caching

REST mein browser/HTTP cache **URL ke against** cache karta hai — `GET /api/users/5` ek cache entry hai, `GET /api/users/5/posts` doosri. Agar user ka naam update hota hai, tumhe manually invalidate karna padta hai har URL jahan wo data dikh raha tha.

GraphQL clients (Apollo Client, urql, Relay) ek **normalized store** maintain karte hain — response ko query-shape mein cache nahi karte, balki **flatten karke type+id ke against** store karte hain.

```javascript
// Jab ye query response aata hai:
// { user: { __typename: "User", id: "5", name: "Sharad", posts: [{ __typename: "Post", id: "9", title: "..." }] } }

// Apollo Client isse INTERNALLY is tarah normalize karta hai:
const normalizedStore = {
  // Har entity apne "__typename:id" key ke against store hoti hai, query se independent
  'User:5': { id: '5', name: 'Sharad', posts: [{ __ref: 'Post:9' }] },
  // Post entity bhi apni alag key pe, "__ref" ek pointer hai wapas User se
  'Post:9': { id: '9', title: '...' },
  // ROOT_QUERY apna alag entry hai jo batata hai kaunse root fields kis entity ko point karte hain
  ROOT_QUERY: { 'user({"id":"5"})': { __ref: 'User:5' } },
};
```

Iska practical fayda ye hai: agar ek dusri query/mutation `Post:9`.title ko update kar de, **koi bhi aur query jo Post:9 ko reference karti thi, automatically re-render ho jaati hai naye data ke saath** — bina tumhe manually cache invalidate kiye, bina refetch kiye. Ye REST mein possible nahi hai kyunki REST cache "shape-aware" nahi hoti, sirf "URL-aware" hoti hai.

### Query hook — Apollo Client example

```javascript
// useQuery hook Apollo Client se import kiya
import { useQuery, gql } from '@apollo/client';

// GraphQL query ko gql template literal mein likha — ye parse-time pe AST ban jaata hai
const GET_USER_POSTS = gql`
  # named query, variable ke saath
  query GetUserPosts($userId: ID!) {
    # user field, id variable pass kiya
    user(id: $userId) {
      # id maanga hai — Apollo Client ko normalization ke liye id chahiye hota hai (cache key banane ke liye)
      id
      # name field
      name
      # posts field, nested selection
      posts {
        # posts ka id bhi zaroor maango — warna Apollo isse normalize nahi kar payega
        id
        # title field
        title
      }
    }
  }
`;

// Component ke andar hook use kiya
function UserProfile({ userId }) {
  // useQuery variables pass karta hai, aur loading/error/data teen states deta hai
  const { loading, error, data } = useQuery(GET_USER_POSTS, {
    // variables object — GraphQL query ke $userId ko actual value diya
    variables: { userId },
  });

  // loading state handle kiya — pehli baar fetch ho raha hai jab tak cache mein data nahi hai
  if (loading) return <p>Loading...</p>;
  // error state handle kiya — network ya GraphQL-level errors dono yahan aate hain
  if (error) return <p>Error: {error.message}</p>;

  // data ab exactly query ke shape mein available hai — destructure karke render karo
  return (
    <div>
      {/* data.user.name seedha access ho raha hai, query shape se match karta hai */}
      <h1>{data.user.name}</h1>
      <ul>
        {/* posts array map karke render kiya */}
        {data.user.posts.map((post) => (
          // key prop React ke liye zaroori hai, post.id use kiya
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

Ye same query dobara kisi doosre component mein `user(id: "5")` maange, toh Apollo Client **cache-first** policy ke saath seedha normalized store se instantly return kar dega bina network call ke — jab tak data stale na maana jaaye.

---

## 6. Fragments and Variables {#fragments-variables}

### Fragments — reusable field selections

Jaise-jaise queries badi hoti hain, same field selections repeat hone lagte hain (jaise UserCard component ke liye same fields multiple screens pe chahiye). Fragments isko DRY banate hain.

```graphql
# Fragment define kiya — "UserBasicInfo" naam diya, ye User type pe defined hai
fragment UserBasicInfo on User {
  # id field — fragment ke andar bhi id include karna zaroori hai normalization ke liye
  id
  # name field
  name
  # avatarUrl field
  avatarUrl
}

# Ab is fragment ko multiple queries mein reuse kar sakte hain
query GetPostWithAuthor($postId: ID!) {
  # post field
  post(id: $postId) {
    # title field seedha
    title
    # author field ke andar fragment spread kiya "..." syntax se
    author {
      ...UserBasicInfo
    }
  }
}

# Same fragment doosri query mein bhi reuse ho sakta hai
query GetCommentsWithAuthors($postId: ID!) {
  # comments field
  comments(postId: $postId) {
    # text field
    text
    # author field mein wahi fragment dobara spread kiya — consistency guaranteed
    author {
      ...UserBasicInfo
    }
  }
}
```

### Variables — parameterized queries

Variables ka use humne upar bhi kiya hai, lekin explicitly samajhte hain — ye query string ko static rakhte hain (jo caching aur query-plan reuse ke liye important hai) aur sirf values inject karte hain.

```graphql
# $limit ek Int variable hai, default value 10 diya gaya hai "= 10" syntax se
query GetRecentPosts($userId: ID!, $limit: Int = 10) {
  # user field, non-optional ID variable pass kiya
  user(id: $userId) {
    # posts field, limit variable pass kiya jo default ya caller-specified ho sakta hai
    posts(limit: $limit) {
      title
    }
  }
}
```

```javascript
// Client-side variables object pass karte hain, query string reuse hoti hai — ye caching-friendly hai
const variables = {
  // userId directly diya
  userId: '5',
  // limit override kiya default 10 se 3 — sirf 3 recent posts chahiye
  limit: 3,
};
```

Variables ka bada fayda ye hai ki query **string identical rehti hai** har call mein (sirf values badalti hain) — isliye server-side query parsing/validation ko cache kiya jaa sakta hai (persisted queries pattern), aur string concatenation se SQL-injection-jaisi galtiyan (GraphQL query injection) avoid hoti hain.

---

## 7. GraphQL vs REST — Senior Decision Framework {#graphql-vs-rest}

Ye interview mein sabse zyada poocha jaata hai — "GraphQL better hai ya REST?" — aur sahi answer hamesha "depends on context" hai. Concrete framework:

| Dimension | REST wins jab... | GraphQL wins jab... |
|---|---|---|
| **Client diversity** | Ek hi client type hai (jaise sirf web) jiski fixed data needs hain | Multiple clients (web + mobile + smartwatch + third-party) jinki alag-alag data shapes chahiye, same backend se |
| **HTTP/CDN caching** | GET requests URL ke against CDN/browser cache mein directly cache ho jaate hain — bahut cheap, bahut fast | Single POST endpoint pattern generally CDN-cacheable nahi hai (persisted queries + GET workaround exist karta hai, lekin extra setup hai) |
| **Simplicity/onboarding** | Naya developer ek endpoint dekh ke samajh jaata hai kya hota hai — mental model simple hai | Schema + resolvers + client caching layer — steeper learning curve, zyada moving parts |
| **Over/under-fetching** | Data needs stable aur predictable hain, endpoint shape sabko fit karta hai | Data needs frequently change (product iteration fast hai) — client-driven queries iterate karna easy banate hain bina backend redeploy ke |
| **File uploads/binary data** | REST natively multipart form-data handle karta hai easily | GraphQL mein file upload ek retrofit feature hai (multipart spec extension), thoda awkward |
| **Rate limiting/monitoring** | Per-endpoint metrics/rate-limits set karna trivial hai (URL-based) | Single endpoint pe query complexity-based limiting chahiye — zyada engineering effort |
| **Real-time needs** | REST ke saath polling ya separate WebSocket layer manually banani padti hai | Subscriptions built-in hain schema ke andar, consistent mental model |
| **Aggregating microservices** | Client ko multiple services se manually data stitch karna padta hai | GraphQL gateway/federation ek single graph mein multiple services ko compose kar sakta hai |

**Senior take:** Agar tumhare paas ek single web app hai jo apna hi backend consume karta hai, REST + well-designed endpoints usually simpler aur sufficient hote hain. GraphQL apna cost justify karta hai jab (a) multiple diverse clients ho, (b) product iteration bahut fast ho aur backend redeploy bottleneck ban raha ho, ya (c) tum multiple microservices ko ek unified graph mein expose karna chahte ho (jaise Apollo Federation).

---

## 8. Real-World Gotchas {#real-world-gotchas}

- **CDN/HTTP caching almost impossible by default** — GraphQL queries usually `POST /graphql` requests hote hain jinka body mein query hoti hai. Browsers aur CDNs GET requests ko URL ke against cache karte hain, POST bodies ko nahi. Isse fix karne ke liye **persisted queries** (query ko server pe ek hash ke against store karo, client sirf hash bheje GET request mein) ya GET-based GraphQL calls use karni padti hain — dono extra engineering hain jo REST mein free milta hai.

- **Query complexity/depth DoS vector** — kyunki schema ek graph hai, attacker ek deeply nested query bhej sakta hai jaise `user { posts { author { posts { author { posts { ... } } } } } }` — agar ye allowed raha, server exponentially resolver calls kar sakta hai aur database/CPU ko overload kar sakta hai. Production mein **query complexity analysis** (har field ko ek "cost" assign karo, total cost ek limit se upar reject karo) aur **max depth limiting** zaroori hote hain — ye REST mein by-design nahi hota kyunki har endpoint already bounded hota hai.

- **Schema versioning REST se fundamentally different hai** — REST mein `/v1/users` → `/v2/users` seedha URL versioning hoti hai, dono simultaneously live rakh sakte ho. GraphQL mein typically **ek hi schema version** hoti hai, aur evolution `@deprecated` directive se hoti hai:
  ```graphql
  type User {
    # purana field, deprecated marked kiya gaya lekin abhi bhi kaam karta hai backward-compat ke liye
    fullName: String @deprecated(reason: "Use firstName and lastName instead")
    # naya recommended field
    firstName: String
    lastName: String
  }
  ```
  Breaking changes (field type change, field remove karna) ke liye tumhe careful migration + client-usage-analytics chahiye hoti hai ye confirm karne ke liye ki koi bhi client purana field use nahi kar raha, phir hi remove karo.

- **N+1 problem hamesha lurk karta hai** — naye developers jo GraphQL server likhte hain wo aksar bhool jaate hain DataLoader lagana, aur production mein slow response times dekh ke hairan hote hain. Ye by-default problem hai, opt-out nahi — resolver likhte waqt hi socho "ye field kitni baar call hoga tree ke across?"

- **Error handling ambiguous ho sakta hai** — GraphQL responses **HTTP 200** return kar sakte hain even jab kuch fields error ho gaye ho (`data` mein partial result, `errors` array mein failures). Ye REST ke clean HTTP status code model (404, 500, etc.) se different mental model hai — client code ko dono `data` aur `errors` dono check karne padte hain, sirf HTTP status pe rely nahi kar sakte.

- **Overfetching client-side bhi ho sakta hai** — sirf server-side over-fetching solve hone se automatically sab optimal nahi ho jaata; agar developer copy-paste karke query mein extra fields chhod deta hai jo component actually use nahi karta, wahi purani problem GraphQL ke andar bhi wapas aa sakti hai. Discipline abhi bhi chahiye.

---

## Key Takeaways {#key-takeaways}

- GraphQL client ko exact fields specify karne deta hai ek single request mein — isse REST ki classic over-fetching (bloated shared endpoint) aur under-fetching (multiple round-trips) dono problems solve hoti hain.
- Schema sirf type-graph ka blueprint hai; **resolvers** actual data-fetching logic hain, aur GraphQL engine query ko tree ki tarah depth-first traverse karta hai, har field ka resolver parent object ke saath call karta hai.
- Query = read (convention se side-effect-free), Mutation = write (side effects expected), Subscription = long-lived real-time push over WebSocket.
- **N+1 problem** resolver tree ki naive execution se aata hai — DataLoader isse fix karta hai ek event-loop tick ke andar saare IDs batch karke ek single database query bhej ke, plus per-request caching.
- Client-side caching (Apollo/urql) **normalized** hoti hai — responses ko `type:id` ke against flatten karke store karte hain, na ki query-shape ke against — isliye ek entity update automatically saari queries mein reflect hoti hai jo use reference karti thi.
- Fragments repeat hone wale field-selections ko DRY banate hain; variables query strings ko static rakhte hain (caching-friendly) jabki values parameterize karte hain.
- REST vs GraphQL ek trade-off hai, "always better" wala answer nahi — client diversity, caching needs, aur iteration speed decide karte hain.
- GraphQL ka single-endpoint POST pattern HTTP/CDN caching ko harder banata hai, deep queries ek DoS vector ho sakte hain agar complexity-limiting na ho, aur schema evolution deprecation-based hai na ki URL-versioning-based.

---

## 🎯 Interview Questions — Senior Frontend Developer {#interview-questions}

**Q1. GraphQL REST ke over-fetching/under-fetching problem ko exactly kaise solve karta hai? Concrete example do.**

A: REST mein ek fixed-shape endpoint hota hai, isliye alag clients ki alag data needs ko satisfy karne ke liye ya to multiple round-trips chahiye padte hain (under-fetching, jaise pehle `/users/:id` phir `/users/:id/posts` alag calls) ya ek bloated shared endpoint banana padta hai jo sabki needs cover karne ki koshish mein extra unused data bhejta hai (over-fetching). GraphQL mein client apni query khud likhta hai — sirf jo fields chahiye unhi ko select karta hai, ek single POST request mein, aur server exactly usi shape mein data return karta hai. Isse dono problems eliminate ho jaati hain kyunki data-fetching ka control client ke haath mein aa jaata hai, server ke fixed endpoint shape pe dependent nahi rehta.

**Q2. Resolver execution model kaise kaam karta hai? "Parent" argument ka role kya hai?**

A: GraphQL engine incoming query ko ek tree ki tarah parse karta hai, aur har field ke against uska resolver call karta hai depth-first order mein. Root level pe (Query/Mutation type ke fields) resolver ka `parent` argument `undefined`/`null` hota hai. Jab wo resolver ek object return karta hai, wahi object agle level ke (us type ke) field resolvers ko `parent` ke roop mein pass hota hai. Isliye jaise `User.posts` resolver ke `parent` mein wo specific `User` object hota hai jiske posts fetch karne hain — resolver `parent.id` use karke apna data fetch karta hai. Ye chaining hi define karta hai ki data kaise "flow" karta hai tree ke through.

**Q3. N+1 problem kya hai aur DataLoader ise exactly kaise fix karta hai? Batching internally kaise implement hoti hai?**

A: Jab ek nested query (jaise `posts { author { name } }`) resolve hoti hai, `author` resolver har post ke liye independently call hota hai — agar 50 posts hain toh 50 alag database calls, chahe unke authors overlap kar rahe hon. DataLoader iska fix ye deta hai ki `load(id)` call turant database query nahi bhejta — wo sirf ID ko ek internal queue mein daal deta hai aur ek Promise return kar deta hai. DataLoader internally `process.nextTick`/microtask scheduling use karta hai apna "dispatch" ek current event-loop tick ke end tak defer karne ke liye. Jab tak saare resolvers apna `load()` call complete kar chuke hote hain (same tick ke andar), DataLoader ke paas saare unique pending IDs collect ho jaate hain, aur tab ek single batch function chalta hai jo ek `WHERE id IN (...)`-jaisi query bhejta hai. Isse N calls → 1 call ban jaate hain. Bonus: same request ke andar duplicate ID ke liye cached Promise return hota hai, dobara fetch nahi hota.

**Q4. GraphQL client-side caching REST caching se kaise different hai?**

A: REST caching typically URL-keyed hoti hai — `GET /users/5` ek cache entry hai. Agar `user.name` kahin update ho, tumhe manually invalidate/refetch karna padta hai har jagah jahan ye data dikha tha. GraphQL clients (Apollo, urql, Relay) responses ko **normalize** karte hain — server se aaya nested JSON flatten karke `Type:id` (jaise `User:5`) ke against store hota hai, aur queries in entities ko references (pointers) ke through link karti hain. Isse jab bhi koi mutation ya query `User:5` ko update karti hai, **har jagah** jahan `User:5` reference hota hai, wo automatically fresh data reflect kar deta hai — bina manual invalidation ke. Yehi wajah hai ki GraphQL clients ko IDs query mein include karna almost mandatory hota hai — normalization ke liye chahiye.

**Q5. Query, Mutation, aur Subscription mein kya difference hai, aur Subscription implementation mein WebSocket kyun zaroori hai?**

A: Query read operations hain, convention se side-effect-free honi chahiye. Mutation write operations hain, side effects expected hain (create/update/delete), aur usually wo entity return karte hain jo change hui. Subscription long-lived real-time updates ke liye hai — jaise chat messages ya live scores. Normal HTTP request/response model mein server client ko unprompted push nahi kar sakta (client ko har baar poll karna padega), isliye Subscriptions typically WebSocket (ya Server-Sent Events) use karte hain jisme connection persistently open rehta hai aur server jab bhi event ho, directly push kar sakta hai. Server-side ye usually PubSub pattern se implement hota hai — mutation event publish karti hai ek topic pe, subscription resolver us topic ka async iterator return karta hai.

**Q6. GraphQL ka single POST endpoint HTTP/CDN caching ko kyun harder banata hai, aur iska koi workaround hai?**

A: CDNs aur browser HTTP caches typically GET requests ko unke URL ke against cache karte hain — same URL = same cached response serve kar sakte hain. GraphQL queries usually `POST /graphql` ke through jaati hain jisme query poore body mein hoti hai — POST requests by-default cacheable nahi mane jaate HTTP spec mein, aur body-based caching CDNs ke liye non-trivial hai. Workaround hai **persisted queries** — client query ko pehle se server pe register kara deta hai aur usse ek hash/ID milta hai; runtime pe client sirf `GET /graphql?queryId=abc123&variables=...` bhejta hai, jo URL-based hai aur cacheable ban jaata hai. Ye extra infrastructure hai jo REST mein by-default milta hai.

**Q7. Query complexity/depth limiting production mein kyun zaroori hai?**

A: Kyunki GraphQL schema ek graph hai jisme types ek dusre ko reference kar sakte hain (jaise `User.posts.author.posts.author...`), koi attacker ya even accidentally koi client ek bahut deeply nested query bhej sakta hai jo resolver tree ko exponentially bada bana deta hai. Ye database aur server CPU pe massive load daal sakta hai ek single request se — ek classic DoS vector. Production servers isliye **query complexity analysis** (har field ko cost assign karo, jaise list fields ko higher cost, total query cost ek threshold se upar reject karo) aur **max query depth** limits enforce karte hain. Ye REST mein largely irrelevant hai kyunki har REST endpoint already bounded/fixed shape ka hota hai.

**Q8. GraphQL fragments ka purpose kya hai, aur normalization ke context mein `id` field include karna kyun important hai fragments ke andar?**

A: Fragments reusable field-selection blocks hote hain — jab same set of fields multiple queries mein baar-baar chahiye (jaise `UserBasicInfo` — id, name, avatar), fragment define karke `...FragmentName` se spread kar sakte ho, jisse duplication kam hoti hai aur consistency guarantee hoti hai (sab jagah same fields select ho rahe hain). Fragment ke andar `id` include karna critical hai kyunki client-side normalized caches (Apollo/urql) entities ko unke `id` (typically `__typename + id`) ke through identify karte hain — agar `id` missing hai, cache us entity ko properly normalize/dedupe nahi kar payega, aur automatic cache-updates (Q4 wala behavior) break ho jaayega.

**Q9. Schema evolution/versioning GraphQL mein REST se kaise different approach leta hai?**

A: REST typically URL-based versioning use karta hai — `/v1/users`, `/v2/users` — jisme dono versions simultaneously live rakhe jaa sakte hain, clients apni marzi se migrate karte hain. GraphQL mein conventionally **ek hi live schema** hoti hai (multiple schema versions maintain karna anti-pattern maana jaata hai kyunki iska poora point ek unified graph hona hai). Evolution `@deprecated` directive se hoti hai — purana field deprecated mark karo lekin functional rakho, naya field add karo, phir usage analytics (server-side tracking ki kaunse clients kaunse fields query kar rahe hain) dekh ke confirm karo ki purana field safely remove ho sakta hai. Ye ek slower, more gradual migration model hai jo breaking changes ko avoid karne pe focus karta hai bajaye parallel-version-maintain karne ke.

**Q10. Kab tum GraphQL choose karoge over REST for a new project, aur kab REST better choice hoga? Real trade-off do.**

A: GraphQL choose karunga jab multiple diverse clients (web, mobile, smartwatch, third-party integrations) same backend consume kar rahe hon with genuinely different data needs, ya jab product fast-iterating hai aur frontend ko baar-baar backend redeploy ka wait nahi karna chahiye naye data shapes ke liye, ya jab multiple microservices ko ek unified graph mein compose karna ho (federation). REST choose karunga jab client base single/stable hai, HTTP-level/CDN caching genuinely important hai (jaise public content-heavy API), team ki familiarity/onboarding speed matter karti hai, ya jab file uploads/binary data heavy operations hain jahan REST natively better fit hai. Senior-level red flag ye hai jab koi bina in trade-offs ko weigh kiye "GraphQL hamesha better hai" bol de — reality mein ye extra infrastructure (DataLoader, complexity limiting, normalized cache client) ka cost aata hai jo har project ko justify nahi karta.
