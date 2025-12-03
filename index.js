import OpenAI from "openai";
const client = new OpenAI();

const getResponse = async (text) => {
    const response = await client.responses.create({
    model: "gpt-5-nano",
    // reasoning: { effort: "low" },
    text: { format: { type: 'text' }, verbosity: 'high' },
    instructions: "You are a concise explainer for technical documentation explaining things to somebody with ADHD who has challenges processing information up front.",
    input: text,
    // max_output_tokens: 1024,
    });

    console.log(response.output_text);
}

// "Explain TypeScript to me. How it started, why it's useful, how to do it."
// "Explain to me how I can use GPT-5-Nano model to create a Chrome Browser Extension that summarizes web pages for me."
getResponse("Please list the entirety of FunkoPop items categorized by item (e.g., TV, Movie, Comic, etc.) in a markdown table.");
