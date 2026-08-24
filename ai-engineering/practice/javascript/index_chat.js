import OpenAI from 'openai';
dotenv.config();

const client = new OpenAI({
  apiKey: process.env['AI_API_KEY'], 
  baseUrl: process.env['AI_URL'],
  dangerouslyAllowBrowser: true,
});

const prompt = `You are a coding assistant that talks like a pirate. 
Answer the following question in a pirate-like manner: Are semicolons 
optional in JavaScript?`;

try {
    const response = await client.chat.completions.create({
        model: process.env['AI_MODEL'],
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'what is the capital of France?' }
        ],
    });

    console.log(response.choices[0].message.content);
}catch(error){
    if(error.status === 401){
        console.error("Unauthorized: Please check your API key and URL.");
    } else if(error.status === 404){
        console.error("Not Found: The requested resource could not be found.");
    } else if(error.status === 500){
        console.error("Internal Server Error: Something went wrong on the server.");
    } else {
        console.error(`Error ${error?.status}: ${error?.message}`);
    }
}