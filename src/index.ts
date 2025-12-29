import Fastify from "fastify";
import cors from "@fastify/cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const fastify = Fastify({
  logger: true,
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// System prompt for code generation
const SYSTEM_PROMPT = `You are an expert React and shadcn/ui developer. Generate clean, modern, and functional React components that work in a browser environment.

Rules:
1. Generate PLAIN REACT components (not Next.js specific)
2. DO NOT use Next.js imports like 'next/link', 'next/image', 'next/router', etc.
3. Use standard React and HTML elements instead (use <a> instead of <Link>, <img> instead of <Image>)
4. Use Tailwind CSS for styling
5. Use lucide-react for icons when needed
6. Make components responsive and accessible
7. Use modern React patterns (hooks, functional components)
8. Generate complete, self-contained components
9. Export as default function

Return ONLY the code without explanations or markdown code blocks. The code should be ready to run in a browser sandbox.`;

interface GenerateRequest {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// Health check endpoint
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Code generation endpoint
fastify.post<{ Body: GenerateRequest }>(
  "/api/generate",
  async (request, reply) => {
    try {
      const { message, conversationHistory = [] } = request.body;

      if (!message) {
        return reply.code(400).send({ error: "Message is required" });
      }

      // Build the full prompt with conversation history
      let fullPrompt = SYSTEM_PROMPT + "\n\n";

      if (conversationHistory.length > 0) {
        fullPrompt += "Previous conversation:\n";
        conversationHistory.forEach((msg) => {
          fullPrompt += `${msg.role}: ${msg.content}\n`;
        });
        fullPrompt += "\n";
      }

      fullPrompt += `User request: ${message}\n\nGenerate the Next.js component code:`;

      // Generate code using Gemini
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      let generatedCode = response.text();

      // Clean up markdown code blocks if present
      generatedCode = generatedCode.replace(
        /```(?:typescript|tsx|jsx|javascript)?\n?/g,
        ""
      );
      generatedCode = generatedCode.replace(/```\n?$/g, "");
      generatedCode = generatedCode.trim();

      return {
        code: generatedCode,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: "Failed to generate code",
        details: error.message,
      });
    }
  }
);

// Start server
const start = async () => {
  try {
    // Configure CORS
    await fastify.register(cors, {
      origin: true,
    });

    const port = parseInt(process.env.PORT || "3001", 10);
    await fastify.listen({ port, host: "localhost" });
    console.log(`🚀 Server is running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
