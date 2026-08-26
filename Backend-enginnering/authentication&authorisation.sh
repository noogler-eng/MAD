# Authentication and Authorization

# Authentication: is we able to verify the identity of the user. It is the process of verifying who the user is. 
# Authorization: is the process of verifying what the user has access to. It is the process of verifying what the user is allowed to do.


# Sessions
# when user logged in, server created a unique sessionId with relevant user data
# this data stored in persistent storage (database, redis, etc) and sessionId is sent to the client as a cookie
# stored sessionId is used to identify the user in subsequent requests
# revoked after logout or after a certain time period

# JWT
# json web token is a compact, URL-safe means of representing claims to be transferred between two parties.
# session drawbacks (memory, latency, scalability) can be solved by using JWTs.
# base64 encoded JSON object with a header, payload, and signature.
# stateless, scalable, and can be used across different domains and services.
# secret key is used to sign the token and verify its authenticity. present in middleware to verify the token in subsequent requests.
# drawback: tokens accessible to client, so if compromised, it can be used to access the server until it expires.
# drawback: cannot revoke a token before it expires, so if a user logs out, the token is still valid until it expires.
# drawback: if the token is too large, it can cause performance issues and increase latency.

# solutions: we can maintain blacklist of revoked tokens in the server, and check against it in the middleware. 
# But this can cause performance issues and increase latency.

# Cookies
# storing a piece of data on the client side, which is sent to the server with every request.
# Cookies can be used to store sessionId or JWTs, and can be configured with various 
# attributes such as expiration time, secure flag, httpOnly flag, etc.

# Modern authentication
# 1. Oauth 2.0
# 2. OpenID Connect
# 3. API keys
# 4. Stateless authentication (JWT, etc)
# 5. stateful authentication (sessions, etc)
