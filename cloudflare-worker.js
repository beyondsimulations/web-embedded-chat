export default {
  async fetch(request, env) {
    // Configure your allowed domains (supports wildcards)
    const allowedOrigins = [
      "https://yourusername.github.io",
      "https://*.yourusername.github.io", // Allows subdomains
      "https://yourusername.github.io/*", // Allows subdirectories
      "http://localhost:4321",
      "http://127.0.0.1:4321",
    ];

    // Function to check if origin matches any allowed pattern
    const isOriginAllowed = (origin, allowedOrigins) => {
      return allowedOrigins.some((pattern) => {
        if (pattern === origin) return true; // Exact match

        // Handle subdomain wildcards (*.domain.com)
        if (pattern.includes("*.")) {
          const regex = new RegExp("^" + pattern.replace(/\*/g, "[^.]+") + "$");
          return regex.test(origin);
        }

        // Handle path wildcards (domain.com/*)
        if (pattern.endsWith("/*")) {
          const basePattern = pattern.slice(0, -2);
          return origin === basePattern || origin.startsWith(basePattern + "/");
        }

        return false;
      });
    };

    const origin = request.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin": isOriginAllowed(origin, allowedOrigins)
        ? origin
        : allowedOrigins[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const body = await request.json();

      if (!body.message || typeof body.message !== "string") {
        return new Response(
          JSON.stringify({
            error: "Invalid message format",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (body.message.length > 2000) {
        return new Response(
          JSON.stringify({
            error: "Message too long (max 2000 characters)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const messages = [
        {
          role: "system",
          content:
            env.SYSTEM_PROMPT ||
            "You are a helpful educational assistant. Be concise and clear. Guide students to understand concepts rather than just providing direct answers.",
        },
      ];

      if (body.history && Array.isArray(body.history)) {
        messages.push(...body.history.slice(-10));
      }

      messages.push({ role: "user", content: body.message });

      const response = await fetch(env.OPENWEBUI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENWEBUI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.OPENWEBUI_MODEL || "llama3.2:latest",
          messages: messages,
          stream: false,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage =
        data.choices?.[0]?.message?.content ||
        "Sorry, I could not generate a response.";

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
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable. Please try again.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
};
