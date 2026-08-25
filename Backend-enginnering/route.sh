# Routing

# GET /api/books
# POST /api/books
# DELETE /api/books/:id




# types - 

# static 
# /api/books

# dynamic
# path parameters / route parameters
# /api/books/:id

# we also have query parameters
# route remains the same but query parameters can change
# get request dont have body but can have query parameters like pagination, filtering, sorting etc
# /api/books?id=123

# nested routes
# /api/books/:id/reviews/:reviewId




# versioning and deprecation
# making changes to the API without breaking existing clients
# /api/v1/books
# /app/v2/books

# @deprecated
# /api/v1/books


# general route
# /*
# handler which sends 404 not found for all other routes which are not defined in the application