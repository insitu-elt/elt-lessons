exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Please use POST" })
    };
  }

  try {
    const { sentence } = JSON.parse(event.body);
    const API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API key not configured" })
      };
    }

    const SYSTEM_PROMPT = `You are a syntax analyser for English language learners. Analyse the input text and return ONLY valid JSON — no preamble, no markdown, no code fences.

Return this structure:
{
  "sentences": [
    {
      "tokens": [
        { "word": string, "class": string, "whitespace": boolean }
      ],
      "clauses": [
        { "type": string, "startIndex": number, "endIndex": number }
      ]
    }
  ]
}

Token "class" values (use exactly these strings): noun, verb, adjective, adverb, preposition, determiner, pronoun, conjunction, punctuation

Clause "type" values (use exactly these strings): main, relative, adverbial, noun

"startIndex" and "endIndex" refer to token array indices (inclusive). "whitespace" is true if a space follows the word, false for punctuation with no space.

Analyse every sentence in the input separately. Be precise and consistent.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: sentence }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Anthropic API error: ${errText}` })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
