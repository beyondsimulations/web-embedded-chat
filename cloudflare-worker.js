export default {
  async fetch(request, env) {
    // Smart CORS: automatically allow subdomains and paths
    const origin = request.headers.get("Origin") || "";

    // Define your base domains (worker will allow all subdomains/paths)
    const allowedDomains = [
      "github.io", // Allows *.github.io/*
      "localhost", // Allows localhost with any port
      // Add your custom domain if you have one:
      // 'yourdomain.com'  // Allows *.yourdomain.com/*
    ];

    // Check if origin matches any allowed domain
    const isAllowed = allowedDomains.some((domain) => origin.includes(domain));

    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowed
        ? origin
        : "https://localhost:3000",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();

      // Basic validation
      if (!body.message || body.message.length > 2000) {
        return new Response(
          JSON.stringify({
            error: "Invalid message",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Build messages array
      const messages = [];

      // Add system prompt if configured
      if (env.SYSTEM_PROMPT) {
        messages.push({
          role: "system",
          content: env.SYSTEM_PROMPT,
        });
      }

      // Add conversation history (last 10 messages)
      if (body.history && Array.isArray(body.history)) {
        messages.push(...body.history.slice(-10));
      }

      // Add current message
      messages.push({
        role: "user",
        content: body.message,
      });

      // Call OpenAI-compatible API
      const response = await fetch(env.API_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.MODEL || "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Standard OpenAI response format
      const assistantMessage =
        data.choices?.[0]?.message?.content || "Sorry, no response generated.";

      return new Response(
        JSON.stringify({
          response: assistantMessage,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error:", error);
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
};
