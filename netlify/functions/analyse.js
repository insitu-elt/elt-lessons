exports.handler = async (event) => {
  // 1. Only allow POST requests (the 'Analyse' button sends a POST)
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    // 2. Grab the sentence sent from your HTML
    const { sentence } = JSON.parse(event.body);
    
    // 3. Get your API Key (which you saved in Netlify Environment Variables)
    const API_KEY = process.env.ANTHROPIC_API_KEY;

    // 4. Talk to Claude (Anthropic)
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
        system: "You are a syntax analyser for English language students. Analyse the input and return ONLY valid JSON. Do not include any conversational text or markdown blocks.",
        messages: [{ role: "user", content: sentence }]
      })
    });

    // 5. Check if Anthropic actually answered
    if (!response.ok) {
      const errorData = await response.text();
      return { 
        statusCode: response.status, 
        body: JSON.stringify({ error: "Anthropic API Error", details: errorData }) 
      };
    }

    const data = await response.json();

    // 6. Send the answer back to your website
    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // Allows your site to talk to the function
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    // 7. Handle any unexpected crashes
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error", details: error.message })
    };
  }
};