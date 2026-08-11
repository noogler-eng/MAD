import { env } from "./env";

// making an general error class to handle API errors
class ApiError extends Error {
    constructor(public status: number, public message: string) {
        super(message);
    }
}

// making an general fetch request function that can be used 
// for all the API requests
async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...init?.headers,
        },
        // including credentials in the request to 
        // allow cookies to be sent with the request
        credentials: "include",
    })

    if(!res.ok){
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, body?.statusText || res.statusText);
    }

    return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST" }),
};
