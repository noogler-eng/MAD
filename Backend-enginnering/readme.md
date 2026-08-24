# Backend Engineering — Full Roadmap (Zero to Production)

Yeh roadmap backend engineering ko end-to-end, **root-level depth** ke saath cover karta hai — ek HTTP request browser se nikal ke server ke andar kya-kya travel karti hai, wahan se DB/cache/queue tak kaise jaati hai, aur phir woh poora system production me kaise scale, secure aur observe hota hai.

**Padhne ka tareeka:** roadmap ko **Request Lifecycle ke order** me banaya gaya hai — matlab jis sequence me ek real request travel karti hai, usi sequence me topics aate hain. Isse mental model bikhrta nahi, ek hi thread me build hota hai.

**Status:** topic list ready hai. Har chapter ka detailed doc baad me likhenge (jaisa MAD ke baaki handbooks me hua — `concepts/`, `ai-engineering/`, `frontend/` folders dekho).

**Legend:** 🔴 must-know (interview + daily kaam) · 🟡 important (production me zarur milega) · 🟢 advanced / specialised

---

## Table of Contents

| Part | Topic | Chapters |
|---|---|---|
| **Part 0** | Foundations & Mental Model | 1–2 |
| **Part 1** | Request Lifecycle (server ke andar ka safar) | 3–9 |
| **Part 2** | Data Layer | 10–14 |
| **Part 3** | Security | 15–16 |
| **Part 4** | API Design & Communication Styles | 17–21 |
| **Part 5** | Async & Background Work | 22–25 |
| **Part 6** | Reliability & Operability | 26–30 |
| **Part 7** | Architecture & Scaling | 31–33 |
| **Part 8** | Quality, Delivery & DevOps | 34–36 |

---

# Part 0 — Foundations & Mental Model

## Chapter 1 — High Level Understanding 🔴
Big picture: browser me URL type karne se leke response render hone tak beech me kaun-kaun se boxes aate hain.

- [ ] Client ↔ Server model — kya hota hai "backend", frontend se boundary kahan hai
- [ ] DNS resolution — recursive resolver, root → TLD → authoritative, DNS caching, TTL
- [ ] TCP/IP stack basics — 3-way handshake, ports, sockets, keep-alive
- [ ] OSI vs TCP/IP model — kaunsa layer kya karta hai (L4 vs L7 ka farak samajhna zaruri hai)
- [ ] Network firewalls, security groups, NACLs — traffic kahan block hota hai
- [ ] Load balancer (L4 vs L7), reverse proxy (Nginx), API Gateway — teeno ka role alag kaise
- [ ] CDN — edge caching, origin server, cache invalidation
- [ ] Request/response ka anatomy — raw request aur raw response actually dikhta kaisa hai
- [ ] AWS ke context me flow: Route53 → ALB → EC2/ECS/Lambda → RDS/S3
- [ ] Server kya hai physically — process, thread, event loop, port binding
- [ ] Latency numbers every engineer should know (RAM vs SSD vs network vs cross-region)

## Chapter 2 — HTTP Protocol 🔴
Backend ka *lingua franca*. Yahan strong ho gaye to aadha backend samajh aa gaya.

- [ ] Connection establishment — TCP handshake, TLS handshake, connection reuse
- [ ] HTTP message structure — request line, status line, headers, body
- [ ] HTTP headers deep dive:
  - [ ] General headers, request headers, response headers, entity headers
  - [ ] Security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
  - [ ] Custom headers (`X-` prefix), header size limits
- [ ] HTTP methods — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
  - [ ] **Safe vs Idempotent vs Cacheable** — teeno alag properties hain
- [ ] Status codes — 1xx/2xx/3xx/4xx/5xx, aur kab kaunsa use karna (201 vs 200, 401 vs 403, 400 vs 422)
- [ ] CORS ka poora flow — origin, `Access-Control-*` headers, credentials mode
  - [ ] Simple request vs preflight request — preflight trigger kab hota hai
  - [ ] Common CORS errors aur unka actual root cause
- [ ] Content negotiation — `Accept`, `Content-Type`, charset, quality values (q-factor)
- [ ] HTTP caching — `Cache-Control` (max-age, s-maxage, no-store, no-cache, stale-while-revalidate)
  - [ ] Validation caching — `ETag`, `If-None-Match`, `Last-Modified`, `If-Modified-Since`, 304
- [ ] Cookies — attributes (`HttpOnly`, `Secure`, `SameSite`, `Domain`, `Path`, `Max-Age`)
- [ ] HTTP/1.0 vs 1.1 vs 2 vs 3
  - [ ] Persistent connections, pipelining, head-of-line blocking
  - [ ] HTTP/2 — multiplexing, server push, HPACK header compression
  - [ ] HTTP/3 / QUIC — UDP-based, 0-RTT, connection migration
- [ ] HTTP compression — gzip, brotli, deflate, `Accept-Encoding` negotiation, trade-offs
- [ ] Chunked transfer encoding, streaming responses, range requests (partial content, 206)
- [ ] TLS/SSL — certificates, CA chain, handshake, mTLS, certificate pinning
- [ ] Common HTTP-level attacks — request smuggling, response splitting, header injection

---

# Part 1 — Request Lifecycle

## Chapter 3 — Routing 🔴
Request server pe aa gayi — ab kaunsa code chalega, yeh decide karna.

- [ ] HTTP request se server-side handler tak ka mapping
- [ ] Router ka internal working — trie / radix tree based matching, regex matching
- [ ] Route types — static, dynamic (`/user/:id`), wildcard, catch-all, optional params
- [ ] Path params vs query params vs body — kya kahan bhejna
- [ ] Route matching precedence aur conflicts (`/user/new` vs `/user/:id`)
- [ ] Route grouping / nesting, prefixing, modular routers
- [ ] API versioning — URL path, header-based, query param based; trade-offs
- [ ] Deprecation strategy — `Sunset` header, warning headers, migration timeline
- [ ] Route-level permissions aur guards
- [ ] Performance — route matching optimisation, route count ka impact
- [ ] Security — path traversal, open redirect, route enumeration

## Chapter 4 — Middlewares 🔴
Request aur handler ke beech ka pipeline.

- [ ] Middleware ka concept — chain of responsibility pattern
- [ ] Pre-request vs post-response middleware
- [ ] Execution order kyun matter karta hai (auth → validation → handler → logging)
- [ ] Global vs router-level vs route-level middleware
- [ ] Early exit / short-circuiting (auth fail pe aage mat jao)
- [ ] Error-handling middleware — normal middleware se signature alag kyun
- [ ] Common middlewares: CORS, body-parser, compression, rate limiter, request-id, helmet
- [ ] Performance — har middleware har request pe chalta hai, cost budget banao
- [ ] Middleware me async/await ke pitfalls, unhandled promise rejection

## Chapter 5 — Request Context 🟡
Ek request ke saath jo "invisible baggage" travel karta hai.

- [ ] Context object — middleware, controller, service sab tak metadata pahunchana
- [ ] Per-request state kaise store kare (aur global state kyun galat hai)
- [ ] Request ID / correlation ID / trace ID — distributed tracing ka foundation
- [ ] Context propagation across async boundaries (AsyncLocalStorage / thread-local / Go context)
- [ ] Timeouts — request timeout, handler timeout, downstream call timeout
- [ ] Cancellation propagation — client disconnect ho gaya to kaam rok do
- [ ] Auth/user info ko context me carry karna (aur usko type-safe rakhna)

## Chapter 6 — Serialization & Deserialization 🟡
Network pe data bhejne se pehle aur receive karne ke baad ka translation.

- [ ] Serialization kya hai — in-memory object ↔ wire format
- [ ] Text formats — JSON, XML, YAML, CSV; kab kaunsa
- [ ] Binary formats — Protobuf, MessagePack, Avro, Thrift; size + speed benchmark
- [ ] Schema-based vs schema-less serialization, schema evolution (forward/backward compatible)
- [ ] Deserialization into typed structures (DTOs, structs, dataclasses)
- [ ] Edge cases — null values, missing fields, unknown fields, extra fields, empty vs absent
- [ ] Number precision problems — big integers, floats, JS `Number` ki 53-bit limit
- [ ] Date/time serialization — ISO 8601, epoch, timezone handling (UTC hi store karo)
- [ ] Custom serializers / encoders, field renaming, field exclusion (password kabhi serialize na ho)
- [ ] Security — deserialization/injection attacks, prototype pollution, billion laughs (XML bomb)
- [ ] Performance — streaming parsers, large payload handling, memory blow-up avoid karna

## Chapter 7 — Validation & Transformation 🔴
Kabhi bhi client ko trust mat karo.

- [ ] Syntactic validation vs semantic validation — farak samjho
- [ ] Type validation, coercion vs strict mode
- [ ] Schema validation libraries (Zod / Joi / Pydantic / class-validator) ka mental model
- [ ] Client-side vs server-side validation — client sirf UX ke liye, server hi truth hai
- [ ] Type casting — string → number/boolean/date, aur uske silent failure cases
- [ ] String sanitization — trimming, normalisation (Unicode NFC), HTML escaping
- [ ] Cross-field / relational validation (`endDate > startDate`)
- [ ] Conditional validation (agar `type === "card"` to `cardNumber` required)
- [ ] Nested objects aur arrays ka validation, array size limits
- [ ] File upload validation — MIME type, magic bytes, size limit, extension spoofing
- [ ] Validation error format — field-wise errors, i18n-friendly error codes
- [ ] Transformation layer — DTO → domain model → persistence model
- [ ] Mass assignment vulnerability (whitelist fields, blindly spread mat karo)

## Chapter 8 — Handlers / Controllers 🔴
Thin layer jo request ko business logic se joda hai.

- [ ] Controller ki responsibility — parse, delegate, respond. Bas.
- [ ] "Fat controller" anti-pattern aur usko refactor kaise kare
- [ ] Response shaping — consistent envelope, pagination metadata, error format
- [ ] Status code + response body ka correct pairing
- [ ] Async handlers, error propagation, try/catch boilerplate hatana
- [ ] Dependency injection — controller me services kaise inject ho
- [ ] Controller-level testing (mocked services ke saath)

## Chapter 9 — Business Logic Layer 🔴
Application ka actual dimaag.

- [ ] Layered architecture — controller → service → repository → DB
- [ ] Domain model vs anemic model, entities vs value objects
- [ ] Service layer patterns, use-case / interactor pattern
- [ ] Business rules ko framework se decouple karna (framework ek detail hai)
- [ ] Domain events aur unka propagation
- [ ] Pure functions vs side effects — testability ka core
- [ ] Transaction boundaries kahan draw kare (service layer, repository nahi)
- [ ] Idempotency ko business logic me build karna (idempotency keys)

---

# Part 2 — Data Layer

## Chapter 10 — Databases 🔴
Backend ka sabse bada trade-off zone.

- [ ] Relational vs Non-relational — kab kaunsa, aur "NoSQL is faster" wala myth
- [ ] SQL fundamentals — joins, subqueries, aggregations, window functions, CTEs
- [ ] Schema design — normalisation (1NF–3NF), denormalisation kab justified hai
- [ ] Keys — primary, foreign, composite, natural vs surrogate, UUID vs auto-increment vs ULID
- [ ] Constraints — NOT NULL, UNIQUE, CHECK, FK cascade behaviour
- [ ] Indexing deep dive — B-tree, hash, GIN/GiST, composite index, covering index
  - [ ] Index selectivity, cardinality, kab index *ulta* nuksan karta hai
  - [ ] `EXPLAIN` / `EXPLAIN ANALYZE` padhna seekhna
- [ ] Query optimisation — N+1 problem, SELECT *, pagination (offset vs cursor/keyset)
- [ ] Transactions — ACID, isolation levels (read uncommitted → serializable)
  - [ ] Dirty read, non-repeatable read, phantom read
  - [ ] Locking — optimistic vs pessimistic, row vs table lock, deadlocks
  - [ ] MVCC kaise kaam karta hai (Postgres ka model)
- [ ] Connection pooling — pool size math, PgBouncer, connection leak debug karna
- [ ] ORM — kaise kaam karta hai (identity map, unit of work, lazy loading), trade-offs, kab raw SQL
- [ ] Migrations — versioned migrations, up/down, zero-downtime migration strategy
  - [ ] Expand-migrate-contract pattern
- [ ] Replication — primary/replica, read replicas, replication lag ka impact
- [ ] Sharding & partitioning — horizontal vs vertical, partition key selection
- [ ] NoSQL family: document (MongoDB), key-value (Redis/DynamoDB), wide-column (Cassandra), graph (Neo4j)
- [ ] CAP theorem, PACELC, eventual consistency — practical implications
- [ ] Backups, PITR (point-in-time recovery), disaster recovery drill
- [ ] Soft delete vs hard delete, audit tables, temporal data

## Chapter 11 — CRUD Deep Dive 🔴
Sunne me trivial, production me subtle.

- [ ] Create — idempotency, duplicate prevention, unique constraint race conditions
- [ ] Read — filtering, sorting, searching, field selection (sparse fieldsets)
- [ ] Pagination — offset vs cursor, total count ka cost, deep pagination problem
- [ ] Update — full replace (PUT) vs partial (PATCH), JSON Patch / Merge Patch
- [ ] Concurrent update handling — optimistic locking with version field / ETag
- [ ] Delete — soft delete, cascade, orphan records, GDPR "right to be forgotten"
- [ ] Bulk operations — batch insert/update, chunking, partial failure handling
- [ ] Race conditions — read-modify-write, lost update, atomic DB operations use karna

## Chapter 12 — Caching 🔴
Sabse bada performance lever, aur sabse bada bug source.

- [ ] Caching ki zarurat, aur persistence layer se fundamental farak
- [ ] Cache levels — CPU L1/L2/L3 → app memory → distributed cache → DB cache → CDN → browser
- [ ] Client-side vs server-side caching
- [ ] In-memory (local) vs distributed (Redis/Memcached) — trade-offs, cache coherence
- [ ] Caching strategies — cache-aside (lazy), read-through, write-through, write-behind, refresh-ahead
- [ ] Eviction policies — LRU, LFU, FIFO, TTL-based, random
- [ ] Cache key design — namespacing, versioning, tenant isolation
- [ ] Invalidation — TTL, explicit invalidation, event-driven invalidation, tag-based
- [ ] Classic problems: **cache stampede/thundering herd**, cache penetration, cache avalanche
  - [ ] Solutions — locking, jittered TTL, negative caching, probabilistic early expiry
- [ ] Kya cache karna hai: static assets, query results, API responses, computed values, sessions
- [ ] Hit/miss ratio measure karna, aur usko optimise karna
- [ ] Stale data ka business impact — kab acceptable hai kab nahi
- [ ] Redis deep dive — data structures, persistence (RDB/AOF), pipelining, Lua scripts, cluster mode

## Chapter 13 — Object Storage & Large Files 🟡

- [ ] Object storage vs block storage vs file storage
- [ ] S3 mental model — buckets, keys, metadata, storage classes, lifecycle policies
- [ ] File upload patterns — direct upload vs **presigned URLs** (server ka bandwidth bachao)
- [ ] Multipart / chunked upload, resumable uploads
- [ ] Streaming files (upload aur download dono) — memory me poori file mat load karo
- [ ] Image/video processing pipeline — async worker, thumbnails, transcoding
- [ ] Access control — private buckets, signed URLs with expiry, CDN + origin access
- [ ] Virus scanning, content-type verification, upload abuse prevention
- [ ] Cost model — storage vs egress vs request cost

## Chapter 14 — Search & Elasticsearch 🟢

- [ ] Kab DB `LIKE` kaafi nahi hai — full-text search ki zarurat
- [ ] Inverted index kaise kaam karta hai, tokenization, analyzers, stemming, stop words
- [ ] Index creation & mapping, dynamic vs explicit mapping, reindexing strategy
- [ ] Query DSL — match, term, bool, range, aggregation
- [ ] Relevance scoring — TF-IDF, BM25, boosting
- [ ] Advanced patterns — fuzzy search, autocomplete, faceted filtering, highlighting, synonyms
- [ ] Pagination — from/size limits, `search_after`, scroll API
- [ ] Shards, replicas, cluster health, node roles
- [ ] Logging & alerting use-case — ELK / EFK stack, Kibana dashboards
- [ ] Data sync — DB se ES tak (CDC, dual write, outbox pattern) aur consistency issues
- [ ] Alternatives — Postgres full-text, Meilisearch, Typesense, vector search

---

# Part 3 — Security

## Chapter 15 — Authentication & Authorization 🔴
"Tum kaun ho" vs "tum kya kar sakte ho".

- [ ] Authentication vs Authorization — clearly alag concepts
- [ ] Stateful (session) vs stateless (token) auth — trade-offs
- [ ] Sessions — server-side session store, session ID rotation, fixation attack
- [ ] Cookies-based auth — `HttpOnly` + `Secure` + `SameSite`, CSRF ke saath relation
- [ ] JWT deep dive — header/payload/signature, HS256 vs RS256, claims (exp, iat, aud, iss)
  - [ ] JWT ke problems — revocation nahi hota, size, `alg: none` attack
  - [ ] Access token + refresh token flow, rotation, reuse detection
- [ ] Token storage — localStorage vs cookie, XSS vs CSRF ka trade-off
- [ ] Password handling — bcrypt/argon2/scrypt, salting, peppering, cost factor tuning
  - [ ] Kabhi bhi MD5/SHA1 se password hash mat karo — kyun
- [ ] OAuth 2.0 — grant types (authorization code + PKCE, client credentials), roles, flows
- [ ] OpenID Connect — OAuth ke upar identity layer, ID token vs access token
- [ ] SSO, SAML, social login integration
- [ ] MFA / 2FA — TOTP, SMS ki weakness, WebAuthn/passkeys
- [ ] Authorization models — RBAC, ABAC, ReBAC, policy engines (OPA, Casbin)
- [ ] Multi-tenancy authorization — tenant isolation, row-level security
- [ ] API keys, service-to-service auth, mTLS
- [ ] Attacks — XSS, CSRF, session hijacking, MITM, replay attacks, credential stuffing
- [ ] Timing attacks aur constant-time comparison
- [ ] Rate limiting on auth endpoints, account lockout, brute-force protection
- [ ] Audit logging — kaun, kab, kya kiya; tamper-evident logs
- [ ] Information leakage prevention — "invalid email or password" (kaunsa galat hai mat batao)
- [ ] Password reset flow ko securely design karna (token expiry, single use)

## Chapter 16 — Security (Broader) 🔴

- [ ] OWASP Top 10 — har item ka backend context
- [ ] Injection — SQL injection, NoSQL injection, command injection, LDAP injection
  - [ ] Parameterised queries hi asli fix hai, escaping nahi
- [ ] SSRF — internal network se data leak, metadata endpoint attack
- [ ] IDOR / broken object-level authorization — sabse common real-world bug
- [ ] Rate limiting & throttling — token bucket, leaky bucket, sliding window, fixed window
- [ ] DDoS mitigation basics, WAF, bot protection
- [ ] Secrets management — env vars, Vault, AWS Secrets Manager, KMS, secret rotation
- [ ] Encryption — at rest vs in transit, symmetric vs asymmetric, key management
- [ ] PII handling, data masking, tokenisation, compliance (GDPR, PCI-DSS ka basic idea)
- [ ] Dependency security — SCA, `npm audit`, lockfiles, supply-chain attacks
- [ ] Security headers ka poora set (Chapter 2 se link)
- [ ] Principle of least privilege — DB users, IAM roles, container capabilities
- [ ] Threat modelling basics, security review checklist

---

# Part 4 — API Design & Communication Styles

## Chapter 17 — REST Best Practices 🔴

- [ ] REST constraints — client-server, stateless, cacheable, uniform interface, layered
- [ ] Resource modelling — nouns not verbs, nesting kitna deep (2 levels se zyada mat)
- [ ] HTTP methods ka correct semantic use, idempotency guarantees
- [ ] Consistent naming — plural, kebab/snake case, casing convention
- [ ] Filtering, sorting, searching, pagination ka standard query-param design
- [ ] Error response standard — RFC 7807 Problem Details, error codes vs messages
- [ ] Versioning strategy aur backward compatibility rules
- [ ] HATEOAS — theory, aur practically kyun kam use hota hai
- [ ] Bulk endpoints, action endpoints (jab pure REST fit nahi hota)
- [ ] API design review checklist
- [ ] Richardson Maturity Model

## Chapter 18 — OpenAPI Standard 🟡

- [ ] OpenAPI (Swagger) spec structure — paths, operations, components, schemas
- [ ] Parameters, request bodies, responses, examples, metadata
- [ ] Security definitions / security schemes
- [ ] Design-first vs code-first approach
- [ ] Code generation — server stubs, typed clients (swagger-codegen / openapi-generator)
- [ ] Swagger UI / Redoc se live documentation
- [ ] Postman / Insomnia collections, environments, automated collection runs
- [ ] Contract testing, spec ko CI me validate karna
- [ ] Spec se mock server banana (frontend parallel me kaam kar sake)

## Chapter 19 — Webhooks 🟡

- [ ] Webhooks vs polling vs long-polling — push model ka fayda
- [ ] Outgoing webhooks (hum bhejte hain) vs incoming webhooks (hum receive karte hain)
- [ ] Event design — event types, payload versioning, thin vs fat payload
- [ ] **Signature verification** — HMAC signing, timestamp check, replay attack prevention
- [ ] Fast acknowledgement pattern — 2xx turant do, kaam queue me daalo
- [ ] Retry policy — exponential backoff, max attempts, dead letter queue
- [ ] Idempotency — same webhook do baar aayega, handle karo
- [ ] Ordering guarantees (mostly nahi hoti) — event ID + timestamp se handle
- [ ] Local testing — ngrok, webhook.site, provider ke test events
- [ ] Real integrations — Stripe/Razorpay payments, GitHub, Slack, Discord, deploy previews

## Chapter 20 — Real-Time Backend Systems 🟡

- [ ] Real-time ke options — short polling, long polling, SSE, WebSockets, WebRTC
- [ ] WebSocket protocol — upgrade handshake, frames, ping/pong heartbeat
- [ ] Connection lifecycle — reconnection, backoff, state resync after reconnect
- [ ] Scaling WebSockets — sticky sessions, connection state, Redis pub/sub adapter
- [ ] Pub/Sub architecture — topics, channels, fan-out
- [ ] Server-Sent Events — kab WebSocket se better hai (one-way, simple, auto-reconnect)
- [ ] Presence, typing indicators, delivery/read receipts
- [ ] Backpressure aur slow consumers handle karna
- [ ] Real-time use-cases — chat, live dashboards, notifications, collaborative editing (CRDT/OT ka intro)

## Chapter 21 — Other API Styles: GraphQL & gRPC 🟢

- [ ] GraphQL — schema, resolvers, queries/mutations/subscriptions
  - [ ] N+1 problem aur DataLoader batching
  - [ ] Query complexity/depth limiting, persisted queries
  - [ ] Caching GraphQL kyun mushkil hai
  - [ ] Federation / schema stitching ka basic idea
- [ ] gRPC — Protobuf contracts, unary + streaming (server/client/bidi)
  - [ ] HTTP/2 pe kaise chalta hai, gRPC-Web ki zarurat
  - [ ] Service-to-service communication me kyun popular hai
- [ ] REST vs GraphQL vs gRPC — decision framework, kab kya chunna

---

# Part 5 — Async & Background Work

## Chapter 22 — Task Queuing & Scheduling 🔴

- [ ] Sync vs async processing — request ke andar kya nahi karna chahiye
- [ ] Producer → Queue → Consumer model
- [ ] Message brokers — Redis (BullMQ), RabbitMQ, SQS, Kafka; kab kaunsa
- [ ] Queue semantics — at-most-once, at-least-once, exactly-once (aur exactly-once ka jhoot)
- [ ] Idempotent consumers likhna (at-least-once ki wajah se zaruri)
- [ ] Job priority, concurrency control, rate limiting per queue
- [ ] Retry with exponential backoff + jitter, max retries, **dead letter queue**
- [ ] Visibility timeout, message acknowledgement, poison messages
- [ ] Scheduled & recurring jobs — cron, delayed jobs, distributed cron ka duplicate-run problem
- [ ] Long-running jobs — progress tracking, chunking, resumability
- [ ] Worker deployment — scaling workers, graceful worker shutdown
- [ ] Monitoring queues — queue depth, processing lag, failure rate
- [ ] Use-cases: emails, payment reconciliation, report generation, data sync, backups, notifications
- [ ] Outbox pattern — DB write aur message publish ko atomically karna

## Chapter 23 — Transactional Emails & Notifications 🟡

- [ ] Transactional vs marketing email — infra aur compliance dono alag
- [ ] Email providers — SES, SendGrid, Postmark, Resend; sending domain setup
- [ ] Deliverability — SPF, DKIM, DMARC, dedicated IP, warm-up, spam score
- [ ] Templating — MJML/Handlebars, i18n, plain-text fallback
- [ ] Bounce, complaint, unsubscribe handling (webhooks se)
- [ ] Retry aur idempotency — same email do baar mat bhejo
- [ ] Multi-channel notifications — email, SMS, push (FCM/APNs), in-app, WhatsApp
- [ ] Notification preferences, quiet hours, digest/batching
- [ ] Testing emails — Mailhog, Mailtrap, preview environments

## Chapter 24 — Concurrency & Parallelism 🟡

- [ ] Concurrency vs parallelism — definition level pe clear ho jao
- [ ] Process vs thread vs coroutine/green thread
- [ ] Event loop model (Node.js) — call stack, task queue, microtasks, libuv thread pool
- [ ] Thread-per-request model (Java/Go) vs event-driven model — trade-offs
- [ ] Blocking vs non-blocking I/O, CPU-bound vs I/O-bound workload
- [ ] Race conditions, critical sections, mutex, semaphore, atomic operations
- [ ] Deadlock, livelock, starvation
- [ ] Distributed locks — Redis Redlock, DB advisory locks, aur unke caveats
- [ ] Worker threads / child processes / clustering — CPU-bound kaam offload karna
- [ ] Async patterns — promise concurrency limits, `Promise.all` vs `allSettled`, batching
- [ ] Backpressure aur flow control

## Chapter 25 — Event-Driven Architecture 🟢

- [ ] Event-driven vs request-driven thinking
- [ ] Events vs commands vs messages
- [ ] Event sourcing ka basic idea, event store, replay
- [ ] CQRS — read aur write model alag karna, kab justified hai
- [ ] Saga pattern — distributed transactions without 2PC (choreography vs orchestration)
- [ ] Kafka fundamentals — topics, partitions, offsets, consumer groups, ordering guarantee
- [ ] Schema registry, event versioning, backward compatibility
- [ ] Eventual consistency ko UI/product level pe handle karna

---

# Part 6 — Reliability & Operability

## Chapter 26 — Error Handling 🔴

- [ ] Error taxonomy — syntax, runtime, logical, validation, integration, infra errors
- [ ] Operational errors vs programmer errors — dono ka treatment alag
- [ ] Custom error classes / error hierarchy, error codes
- [ ] Errors ko kabhi swallow mat karo (`catch {}` ka paap)
- [ ] Error wrapping aur context add karna (stack trace preserve karte hue)
- [ ] Stack traces padhna aur source maps
- [ ] Global error handler, uncaught exception & unhandled rejection handling
- [ ] Async error propagation ki gotchas
- [ ] User-facing error messages vs internal error details (leak mat karo)
- [ ] Error response contract — consistent shape across poora API
- [ ] Fail-fast vs fail-safe — kab kaunsa
- [ ] Resilience patterns — retries, circuit breaker, bulkhead, timeout, fallback
- [ ] Error tracking tools — Sentry, error grouping, alert fatigue avoid karna

## Chapter 27 — Config Management 🟡

- [ ] Config ko code se decouple karna (12-factor ka Config principle)
- [ ] Config types — static, dynamic (runtime-changeable), secret
- [ ] Sources — env vars, `.env` files, YAML/JSON, config service, CLI flags; precedence order
- [ ] Environment separation — local, dev, staging, prod
- [ ] Config validation at boot — invalid config pe app start hi mat hone do
- [ ] Typed config objects, single config module (env var poore codebase me mat bikher)
- [ ] Secrets — Vault / AWS Secrets Manager / SOPS, rotation, `.env` kabhi commit mat karo
- [ ] Feature flags — rollout, kill switch, A/B testing, flag debt cleanup
- [ ] Config drift detection, config as code

## Chapter 28 — Logging, Monitoring & Observability 🔴

- [ ] Monitoring vs observability — known unknowns vs unknown unknowns
- [ ] **Three pillars** — logs, metrics, traces
- [ ] Structured logging (JSON), log levels, kab kaunsa level
- [ ] Kya log karo aur kya *bilkul* nahi (passwords, tokens, PII, card numbers)
- [ ] Correlation ID se ek request ka poora journey trace karna
- [ ] Log aggregation — ELK, Loki, CloudWatch; retention aur cost
- [ ] Metrics — counter, gauge, histogram, summary; RED aur USE method
- [ ] Prometheus + Grafana, dashboards jo actually decision me help kare
- [ ] Distributed tracing — OpenTelemetry, spans, context propagation
- [ ] Alerting — actionable alerts, SLI/SLO/SLA, error budget, alert fatigue
- [ ] Health checks — liveness vs readiness vs startup probe
- [ ] APM tools, profiling in production, flame graphs
- [ ] Incident response basics — on-call, runbooks, postmortem culture

## Chapter 29 — Graceful Shutdown 🟡

- [ ] Zarurat — deploys, autoscaling scale-in, node drain, restarts
- [ ] Signals — SIGTERM, SIGINT, SIGKILL; kaun trap ho sakta hai kaun nahi
- [ ] Shutdown sequence: stop accepting new → drain in-flight → close DB/queue → exit
- [ ] Readiness probe ko pehle fail karna (load balancer traffic bhejna band kare)
- [ ] In-flight request drain timeout, forced kill fallback
- [ ] Long-running background jobs ko safely checkpoint/requeue karna
- [ ] Kubernetes context — `preStop` hook, `terminationGracePeriodSeconds`
- [ ] Connection cleanup — DB pool, Redis, WebSocket clients, file handles
- [ ] Zero-downtime deployment ke saath rishta

## Chapter 30 — Scaling & Performance 🔴

- [ ] Performance metrics — latency (p50/p95/p99), throughput, error rate, saturation
- [ ] Average latency ka jhoot — hamesha percentiles dekho
- [ ] Bottleneck identification — CPU, memory, disk I/O, network, DB, locks
- [ ] Profiling aur benchmarking — measure first, optimise later
- [ ] Vertical vs horizontal scaling, stateless services ki importance
- [ ] Load balancing algorithms — round robin, least connections, consistent hashing
- [ ] Database scaling — read replicas, caching, sharding, connection pooling
- [ ] N+1 query problem, eager vs lazy loading, batching (DataLoader pattern)
- [ ] Indexing ka performance impact (write cost bhi hota hai)
- [ ] Batch processing, streaming, chunking bade datasets ke liye
- [ ] Payload size — compression, field selection, pagination, image optimisation
- [ ] Memory management — leaks, GC pressure, heap snapshots, object pooling
- [ ] Throttling & rate limiting scaling ke tool ke roop me
- [ ] Async offloading — response time se kaam hatao
- [ ] Auto-scaling policies, capacity planning, load testing (k6, Locust, JMeter)
- [ ] Cost vs performance trade-off

---

# Part 7 — Architecture & Scaling

## Chapter 31 — Architecture Patterns 🟡

- [ ] Monolith vs modular monolith vs microservices — real trade-offs, hype ke bina
- [ ] Layered, hexagonal (ports & adapters), clean architecture
- [ ] Domain-Driven Design basics — bounded context, aggregates, ubiquitous language
- [ ] Service decomposition — kis boundary pe todna
- [ ] Inter-service communication — sync (HTTP/gRPC) vs async (events)
- [ ] API gateway, BFF (backend for frontend), service mesh ka intro
- [ ] Service discovery, health checking, retries + circuit breakers between services
- [ ] Distributed system fallacies (network reliable hai — nahi hai)
- [ ] Data ownership per service, distributed data ka problem
- [ ] Multi-tenancy patterns — shared DB, schema-per-tenant, DB-per-tenant

## Chapter 32 — 12-Factor App Principles 🟡

- [ ] Codebase, Dependencies, Config
- [ ] Backing services, Build/Release/Run, Processes
- [ ] Port binding, Concurrency, Disposability
- [ ] Dev/prod parity, Logs, Admin processes
- [ ] Har factor ka concrete backend example
- [ ] Kya aaj bhi relevant hai — modern (container/serverless) context me critique

## Chapter 33 — System Design for Backend 🟢

- [ ] Requirement gathering — functional, non-functional, scale estimation
- [ ] Back-of-envelope calculations — QPS, storage, bandwidth
- [ ] High-level design → component design → data model → API design
- [ ] Trade-off articulation (consistency vs availability vs latency vs cost)
- [ ] Common designs practice: URL shortener, rate limiter, news feed, chat, notification service, payment system, file storage

---

# Part 8 — Quality, Delivery & DevOps

## Chapter 34 — Testing & Code Quality 🔴

- [ ] Testing pyramid — unit, integration, e2e (aur kyun pyramid, ice-cream cone nahi)
- [ ] Unit testing — mocking, stubbing, fakes, spies; kya mock karna hai kya nahi
- [ ] Integration testing — real DB with testcontainers, transactional rollback per test
- [ ] API/e2e testing — supertest, Postman/Newman
- [ ] Contract testing (Pact) — microservices ke liye
- [ ] Test data management — factories, fixtures, seeding
- [ ] Snapshot testing, property-based testing, mutation testing
- [ ] Load testing, stress testing, soak testing, spike testing
- [ ] Regression testing aur flaky tests ko fix karna
- [ ] Code coverage — useful metric, but goal nahi
- [ ] Linting & formatting — ESLint/Prettier/Ruff, pre-commit hooks
- [ ] Static analysis, type checking, complexity metrics
- [ ] Code review culture aur checklist
- [ ] CI me test automation, parallel test execution

## Chapter 35 — DevOps for Backend Engineers 🔴

- [ ] Version control workflow — trunk-based vs git flow, PR hygiene, conventional commits
- [ ] Containers — Docker fundamentals, layers, multi-stage builds, image size optimisation
  - [ ] Dockerfile best practices, non-root user, `.dockerignore`
  - [ ] Docker Compose local dev setup
- [ ] Container orchestration — Kubernetes basics (pod, deployment, service, ingress, configmap, secret)
  - [ ] Resource requests/limits, HPA, rolling updates
- [ ] CI/CD pipelines — build, test, scan, deploy stages; GitHub Actions / GitLab CI
- [ ] Artifact registry, image tagging & immutability
- [ ] Deployment strategies — rolling, blue-green, canary, feature-flag driven
- [ ] Zero-downtime deployment + DB migration ordering
- [ ] Rollback strategy, and "roll forward" kab better hai
- [ ] Infrastructure as Code — Terraform basics, state management
- [ ] Environment provisioning, ephemeral/preview environments
- [ ] Serverless — Lambda, cold starts, kab suitable hai kab nahi
- [ ] Cost awareness — cloud bill kaise banta hai

## Chapter 36 — Capstone Projects 🟢
Sab kuch jodne ke liye — theory tab tak theory hai jab tak build na karo.

- [ ] **P1 — Production-grade REST API:** auth (JWT + refresh), RBAC, validation, pagination, error contract, OpenAPI docs, tests
- [ ] **P2 — Async pipeline:** file upload → S3 presigned → queue → worker processing → webhook callback → email notification
- [ ] **P3 — Cache + search layer:** Redis caching with proper invalidation + Elasticsearch sync via outbox pattern
- [ ] **P4 — Real-time service:** WebSocket chat with presence, Redis pub/sub, horizontal scaling
- [ ] **P5 — Observability retrofit:** kisi bhi upar wale project me structured logs + metrics + traces + alerts add karo
- [ ] **P6 — Full deploy:** Dockerise → CI/CD → K8s/ECS deploy → zero-downtime migration → load test → tune

---

## How to Use This Roadmap

1. **Part 0 → Part 1 sequentially padho.** Yeh foundation hai, skip mat karo.
2. Part 2 onwards **need-based** ho sakta hai, lekin Chapters 10, 12, 15, 26, 28, 30 kisi bhi backend role me non-negotiable hain.
3. Har chapter ke baad ek **chhota experiment** likho — blog post nahi, code. Concept tab tak samjha nahi jab tak tod ke dekha na ho.
4. 🔴 wale chapters pehle finish karo, 🟢 wale tab jab actual use-case mile.

## Related MAD Handbooks

- `concepts/` — backend fundamentals (21 chapters, done)
- `ai-engineering/` — agents, RAG, MCP, system design (13 chapters, done)
- `frontend/javascript-info/` — JS deep dive (34 chapters, done)
- `frontend/optimizations/` — web performance (13 chapters, done)
- `flutter/` — Flutter roadmap




dns (domain name server)
record types (A name record, C name record)
a name record ---- aws public ip (there is middle aws firewall provided)