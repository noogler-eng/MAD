import { getPosts } from "@/features/posts/api";

export default async function Home() {
  const posts: any = await getPosts();

  return <main className="min-h-screen">
    <div className="max-w-4xl mx-auto p-4">
      {posts.posts.length === 0 ? <p>No posts found.</p> :
        posts?.posts?.map((post: any) => (
          <div key={post.id} className="border p-4 mb-4 rounded-md">
            <h2 className="font-extrabold">{post.title}</h2>
            <p>{post.body}</p>
          </div>
        ))
      }
    </div>
  </main>
}
