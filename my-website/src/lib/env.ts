import { z } from 'zod';

// making an object to validate
// enviroment variables using zod
const envSchema = z.object({
    NEXT_PUBLIC_API_URL: z.string().url(),
})

// parsing the enviroment variable
// and validating it
export const env = envSchema.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});