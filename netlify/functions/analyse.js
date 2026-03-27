exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const { sentence } = JSON.parse(event.body);
    const API_KEY = process.env.ANTHROPIC_API_KEY;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 2000,
        system: "You are a syntax analyser for English language students. Analyse the input and return ONLY valid JSON. No conversational text.",
        messages: [{ role: "user", content: sentence }]
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error", details: error.message })
    };
  }
};