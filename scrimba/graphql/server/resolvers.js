const resolvers = {
  Query: {
    user: (parent, args, context, info) => {
      return db.users.findById(args.id);
    },
  },

  // describe the relationship between the User and Post types
  // when a user is queried, the posts field will be resolved by this function  
  // parent is the user object that was returned from the user query 
  User: {
    posts: (parent, args, context, info) => {
      return db.posts.findByUserId(parent.id);
    },
  },
};
