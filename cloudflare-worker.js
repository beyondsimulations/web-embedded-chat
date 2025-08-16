export default {
  async fetch(request, env) {
    // Add comprehensive logging for debugging
    console.log("Worker started, method:", request.method);

    // Smart CORS: automatically allow subdomains and paths
    const origin = request.headers.get("Origin") || "";
    console.log("Origin:", origin);

    // Define your base domains (worker will allow all subdomains/paths)
    const allowedDomains = [
      "beyondsimulations.github.io", // Allows beyondsimulations.github.io/*
      // Add your custom domain if you have one:
      // 'yourdomain.com'  // Allows *.yourdomain.com/*
    ];

    // Determine allowed origin based on environment and origin
    let allowedOrigin = "https://localhost:3000"; // Default fallback

    // Check for development environment (you can set this as an env variable)
    const isDevelopment =
      env.ENVIRONMENT === "development" || env.NODE_ENV === "development";

    if (!origin || origin === "null") {
      // Handle null origin (local files, some dev tools)
      // Allow in development, restrict in production
      allowedOrigin = isDevelopment ? "*" : "https://localhost:3000";
    } else {
      // Check if origin matches any allowed domain
      const isAllowed = allowedDomains.some((domain) =>
        origin.includes(domain),
      );
      if (isAllowed) {
        allowedOrigin = origin;
      } else if (isDevelopment) {
        // In development, be more permissive
        allowedOrigin = origin;
      }
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
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
      // Validate environment variables first
      if (!env.API_ENDPOINT) {
        console.error("Missing API_ENDPOINT environment variable");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!env.API_KEY) {
        console.error("Missing API_KEY environment variable");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log("Parsing request body...");
      const body = await request.json();
      console.log("Request body:", JSON.stringify(body));

      // Basic validation
      if (!body || typeof body !== "object") {
        console.error("Invalid request body:", body);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!body.message || typeof body.message !== "string") {
        console.error("Missing or invalid message:", body.message);
        return new Response(JSON.stringify({ error: "Invalid message" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.message.length > 2000) {
        console.error("Message too long:", body.message.length);
        return new Response(
          JSON.stringify({ error: "Message too long (max 2000 characters)" }),
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
        console.log("Adding history messages:", body.history.length);
        messages.push(...body.history.slice(-10));
      }

      // Add current message
      messages.push({
        role: "user",
        content: body.message,
      });

      // Prepare API request
      const apiRequestBody = {
        model: env.MODEL || "mistral-medium-latest",
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
        stream: false,
      };

      console.log("API Endpoint:", env.API_ENDPOINT);
      console.log("API Request Body:", JSON.stringify(apiRequestBody));
      console.log("Messages array:", JSON.stringify(messages));

      // Also log the Authorization header (first 20 chars only for security)
      const authHeader = `Bearer ${env.API_KEY}`;
      console.log(
        "Auth header (first 20 chars):",
        authHeader.substring(0, 20) + "...",
      );

      // Call OpenAI-compatible API
      const response = await fetch(env.API_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiRequestBody),
      });

      if (!response.ok) {
        console.error(`API response status: ${response.status}`);
        console.error(
          `API response headers:`,
          Object.fromEntries(response.headers.entries()),
        );
        const errorText = await response.text();
        console.error(`API response body:`, errorText);
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
      console.error("Worker error:", error);
      console.error("Error stack:", error.stack);

      // More specific error messages
      let errorMessage = "Service temporarily unavailable";
      let statusCode = 500;

      if (error.message.includes("API error:")) {
        errorMessage = "External API error";
        statusCode = 502;
      } else if (error.message.includes("JSON")) {
        errorMessage = "Invalid response format";
        statusCode = 502;
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          debug: error.message, // Remove this in production
        }),
        {
          status: statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
};
