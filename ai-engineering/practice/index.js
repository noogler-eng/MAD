import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env['AI_API_KEY'], 
  baseUrl: process.env['AI_URL'],
  dangerouslyAllowBrowser: true,
});

const response = await client.responses.create({
  model: process.env['AI_MODEL'],
  instructions: 'You are a coding assistant that talks like a pirate',
  input: 'Are semicolons optional in JavaScript?',
});

console.log(response.output_text);