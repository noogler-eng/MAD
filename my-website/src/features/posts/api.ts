import { apiClient } from "@/lib/api-client";
import { z } from "zod";

export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export type Post = z.infer<typeof postSchema>;

export async function getPosts(): Promise<Post[]> {
  //   return postSchema.array().parse(await apiClient.get<Post[]>("/posts"));
  return await apiClient.get<Post[]>("/posts");
}

export async function getPostById(id: string): Promise<Post> {
  return postSchema.parse(await apiClient.get<Post>(`/posts/${id}`));
}

// Omit<Post, "id">, sending a post payload without id
export async function createPost(post: Omit<Post, "id">): Promise<Post> {
  return postSchema.parse(
    await apiClient.post<Post>("/posts", {
      body: JSON.stringify(post),
    }),
  );
}
