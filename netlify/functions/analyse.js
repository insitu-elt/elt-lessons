exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { sentence } = JSON.parse(event.body);
    const API_KEY = process.env.ANTHROPIC_API_KEY;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01", // Strict versioning requirement
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        system: "You are a syntax analyser. Return ONLY valid JSON with 'sentences', 'tokens', and 'clauses' keys.",
        messages: [{ role: "user", content: sentence }]
      })
    });

    const data = await response.json();
    
    // Ensure the function sends a clear 200 OK back to your HTML
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (error) {
    // This logs the specific error in your Netlify dashboard
    console.error("Function Crash:", error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Internal Server Error", details: error.message }) 
    };
  }
};