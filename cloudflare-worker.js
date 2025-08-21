// Controlled logging helper to prevent information disclosure
function secureLog(message, sensitiveData = null, env = null) {
  const isDevelopment =
    env?.ENVIRONMENT === "development" || env?.NODE_ENV === "development";

  if (isDevelopment && sensitiveData) {
    console.log(message, sensitiveData);
  } else {
    console.log(message);
  }
}

export default {
  async fetch(request, env) {
    // Add comprehensive logging for debugging
    secureLog("Worker started, method:", request.method, env);

    // Initialize rate limit headers (will be populated later)
    let rateLimitHeaders = {};

    // Simplified CORS: restrict to allowed origins
    const origin = request.headers.get("Origin") || "";
    secureLog("Origin received:", origin, env);

    // Define allowed paths
    const allowedPaths = ["/api"];
    const url = new URL(request.url);
    if (!allowedPaths.includes(url.pathname)) {
      return new Response(
        JSON.stringify({ error: "Path not allowed. Only /api is accessible." }),
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    // Define your exact allowed domains (no subdomains allowed)
    const allowedDomains = (env.ALLOWED_DOMAINS || "")
      .split(",")
      .map((domain) => domain.trim());

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
      // Check if origin matches any allowed domain (exact domain match, no subdomains)
      let isAllowed = false;
      try {
        const originUrl = new URL(origin);
        const originHostname = originUrl.hostname;
        const originProtocol = originUrl.protocol;
        secureLog("Origin validation in progress");

        // In production, only allow HTTPS origins
        const isHttpsValid = isDevelopment || originProtocol === "https:";

        // Check configured domains first
        const isDomainAllowed = allowedDomains.includes(originHostname);
        isAllowed = isDomainAllowed && isHttpsValid;

        // In development, also allow common development origins
        if (!isAllowed && isDevelopment) {
          const devAllowedHosts = ["localhost", "127.0.0.1", "0.0.0.0"];
          const isDevHost =
            devAllowedHosts.includes(originHostname) ||
            originHostname.endsWith(".local") ||
            originHostname.endsWith(".localhost");
          if (isDevHost) {
            isAllowed = true;
            secureLog("Development host allowed:", originHostname, env);
          }
        }
      } catch (e) {
        // Invalid URL format
        secureLog("Invalid origin URL format:", origin, env);
        isAllowed = false;
      }

      if (isAllowed) {
        allowedOrigin = origin;
        secureLog("Origin validation passed for:", allowedOrigin, env);
      } else {
        secureLog(
          "Origin validation failed, using fallback:",
          allowedOrigin,
          env,
        );
      }
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400", // Cache preflight response for 24 hours
    };

    const securityHeaders = {
      "Content-Security-Policy": "default-src 'none';",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security":
        "max-age=31536000; includeSubDomains; preload",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { ...corsHeaders, ...rateLimitHeaders },
      });
    }

    // Only accept POST and OPTIONS
    if (!["POST", "OPTIONS"].includes(request.method)) {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Rate limiting check
    const clientIP =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      "unknown";
    secureLog("Rate limiting check for IP:", clientIP, env);

    // Rate limiting check and header preparation
    try {
      // Get rate limiting configuration from environment variables
      const rateLimitConfig = {
        requests: parseInt(env.RATE_LIMIT_REQUESTS) || 10,
        window: parseInt(env.RATE_LIMIT_WINDOW) || 60,
        burst: parseInt(env.RATE_LIMIT_BURST) || 3,
      };

      const rateLimitResult = await checkRateLimit(clientIP, rateLimitConfig);

      // Prepare rate limit headers for all responses
      if (rateLimitResult.allowed) {
        rateLimitHeaders = {
          "X-RateLimit-Limit": (
            rateLimitConfig.requests + rateLimitConfig.burst
          ).toString(),
          "X-RateLimit-Remaining": (rateLimitResult.remaining || 0).toString(),
          "X-RateLimit-Reset": (
            Math.floor(Date.now() / 1000) + rateLimitConfig.window
          ).toString(),
        };
      }

      if (!rateLimitResult.allowed) {
        console.log("Rate limit exceeded");
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
            retryAfter: rateLimitResult.retryAfter,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              ...rateLimitHeaders,
              "Content-Type": "application/json",
              "Retry-After": rateLimitResult.retryAfter.toString(),
              "X-RateLimit-Limit": (
                rateLimitConfig.requests + rateLimitConfig.burst
              ).toString(),
              "X-RateLimit-Remaining": "0",
            },
          },
        );
      }
    } catch (rateLimitError) {
      console.error("Rate limiting error:", rateLimitError);
      // Continue without rate limiting if there's an error
      // This ensures the service remains available even if rate limiting fails
    }

    try {
      // Validate environment variables first
      if (!env.API_ENDPOINT) {
        console.error("Missing API_ENDPOINT configuration");
        return new Response(
          JSON.stringify({ error: "Service configuration error" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              ...rateLimitHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (!env.API_KEY) {
        console.error("Missing API_KEY configuration");
        return new Response(
          JSON.stringify({ error: "Service configuration error" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              ...rateLimitHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const body = await request.json();
      secureLog(
        "Request body parsed, message length:",
        body.message?.length,
        env,
      );

      // Basic validation
      if (!body || typeof body !== "object") {
        console.error("Invalid request body received");
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      if (!body.message || typeof body.message !== "string") {
        console.error("Missing or invalid message");
        return new Response(JSON.stringify({ error: "Invalid message" }), {
          status: 400,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // Validate model
      if (!body.model || typeof body.model !== "string") {
        console.error("Missing or invalid model");
        return new Response(JSON.stringify({ error: "Invalid model" }), {
          status: 400,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // Sanitize model name (same validation as frontend)
      if (!/^[a-zA-Z0-9\-_.]+$/.test(body.model)) {
        console.error("Invalid model format");
        return new Response(JSON.stringify({ error: "Invalid model format" }), {
          status: 400,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      const sanitizedModel = body.model.substring(0, 50); // Limit length

      if (body.message.length > 2000) {
        console.error("Message too long");
        return new Response(
          JSON.stringify({ error: "Message too long (max 2000 characters)" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              ...rateLimitHeaders,
              "Content-Type": "application/json",
            },
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
        model: sanitizedModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
        stream: false,
      };

      secureLog("API Endpoint:", env.API_ENDPOINT, env);
      secureLog("API Request prepared with messages:", messages.length);
      secureLog("Using model:", sanitizedModel);

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
        secureLog(`API response failed with status: ${response.status}`);
        throw new Error(`API request failed`);
      }

      const data = await response.json();

      // Standard OpenAI response format
      const assistantMessage =
        data.choices?.[0]?.message?.content ||
        data.response ||
        "Sorry, no response generated.";

      // Prepare response with source data
      const responseData = {
        response: assistantMessage,
      };

      // Include source data if present in the API response
      if (data.source) {
        responseData.source = data.source;
      } else if (data.sources) {
        responseData.sources = data.sources;
      }

      // Include any other relevant fields that might contain citation data
      if (data.choices?.[0]?.message?.sources) {
        responseData.sources = data.choices[0].message.sources;
      }

      return new Response(JSON.stringify(responseData), {
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
          ...securityHeaders,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      secureLog("Worker error occurred:", error.message, env);

      // Determine appropriate error message without exposing details
      let errorMessage = "Service temporarily unavailable";
      let statusCode = 500;

      if (error.message.includes("API request failed")) {
        errorMessage = "Unable to process request at this time";
        statusCode = 502;
      } else if (error.message.includes("JSON")) {
        errorMessage = "Invalid response format";
        statusCode = 502;
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
        }),
        {
          status: statusCode,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            ...securityHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};

// Simple in-memory rate limiting (resets on worker restart)
const rateLimitStore = new Map();

async function checkRateLimit(clientIP, config) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;
  const key = `rate_limit:${clientIP}`;

  try {
    // Clean up old entries periodically
    if (Math.random() < 0.1) {
      // 10% chance to clean up
      for (const [storeKey, data] of rateLimitStore.entries()) {
        if (data.lastUpdated < windowStart) {
          rateLimitStore.delete(storeKey);
        }
      }
    }

    // Get existing rate limit data
    let requests = [];
    const existingData = rateLimitStore.get(key);

    if (existingData && existingData.requests) {
      // Filter out requests outside the current window
      requests = existingData.requests.filter(
        (timestamp) => timestamp > windowStart,
      );
    }

    // Check if rate limit is exceeded
    const currentRequests = requests.length;
    const allowedRequests = config.requests + config.burst;

    if (currentRequests >= allowedRequests) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...requests);
      const retryAfter = oldestRequest + config.window - now;

      return {
        allowed: false,
        retryAfter: Math.max(retryAfter, 1), // At least 1 second
      };
    }

    // Add current request timestamp
    requests.push(now);

    // Store updated data in memory
    rateLimitStore.set(key, { requests, lastUpdated: now });

    return {
      allowed: true,
      remaining: allowedRequests - requests.length,
    };
  } catch (error) {
    console.error("Rate limiting operation failed:", error);
    // On error, allow the request to maintain service availability
    return { allowed: true };
  }
}
