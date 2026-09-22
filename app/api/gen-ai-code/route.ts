import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { Message, FileData } from "@/types/workspace";
import { aj } from "@/lib/arcjet";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({ type, ...(payload as object) })}\n\n`;
}

function extractThoughtLabel(text: string): string | null {
  const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  const sentence = text.split(/[.\n]/)[0].trim();
  if (sentence.length >= 8 && sentence.length <= 80) return sentence;

  return null;
}

// ─── npm validation ───────────────────────────────────────────────────────────

async function validateDependencies(
  deps: Record<string, string>
): Promise<Record<string, string>> {
  const valid: Record<string, string> = {};
  await Promise.all(
    Object.entries(deps).map(async ([pkg, version]) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) valid[pkg] = version;
      } catch {
        // silently skip hallucinated packages
      }
    })
  );
  return valid;
}

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}

const SYSTEM_PROMPT = `You are an expert React developer. Your job is to generate complete, working React applications based on user prompts.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief explanation of what you built/changed>",
  "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
  "files": {
    "/App.js": { "code": "<full file content>" },
    "/components/SomeComponent.js": { "code": "<full file content>" }
  },
  "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + hooks). Do NOT use TypeScript in generated files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The entry point must always be /App.js and must export a default component.
6. All imports must reference files you include in "files" or packages in "dependencies".
7. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always available.
8. When modifying existing code, include ALL files (both changed and unchanged) in "files".
9. Keep code clean, readable, and production-quality.
10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.`;

function buildContents(messages: Message[], fileData: FileData | null) {
  const trimmed = trimHistory(messages);

  return trimmed.map((msg, idx) => {
    const role = msg.role === "assistant" ? "model" : "user";

    if (msg.role === "user") {
      const parts: object[] = [];
      let text = msg.content;

      if (msg.imageUrl) {
        text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background-image, etc.): ${msg.imageUrl}]\n\n${text}`;
      }

      const isLast = idx === trimmed.length - 1;
      if (isLast && fileData) {
        text +=
          "\n\nCurrent project files for context:\n" +
          JSON.stringify(fileData, null, 2);
      }

      parts.push({ text });
      return { role, parts };
    }

    return { role, parts: [{ text: msg.content }] };
  });
}

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspaceId, userId, messages, fileData } = body as {
    workspaceId: string | null;
    userId: string;
    messages: Message[];
    fileData: FileData | null;
  };

  if (!messages?.length) {
    return Response.json({ message: "No messages provided" }, { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find((m)=>m.role === "user")?.content ?? "";
  const decision = await aj.protect(request, {
    requested: 1,
    userId: clerkId,
    detectPromptInjectionMessage: lastUserMessage,
  });
  
  const user = await db.user.findUnique({
    where: { id: userId }, 
  });

  if (!user) return Response.json({ message: "User not found" }, { status: 404 });
  if (user.credits < CREDIT_COST_PER_GENERATION) {
    return Response.json({ message: "Insufficient credits" }, { status: 402 });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        const contents = buildContents(messages, fileData);

        enqueue(sseEvent("status", { message: "Thinking..." }));
        console.log("[gen-ai-code] Connecting to Google Gemini API...");

        // Connect directly to the required model without fallback loops
        const geminiStream = await ai.models.generateContentStream({
          model: "gemini-3.6-flash",
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        });

        console.log("[gen-ai-code] Successfully connected. Receiving stream...");
        enqueue(sseEvent("status", { message: "Generating code..." }));

        let accumulated = ""; 
        let lastEmitTime = 0; 

        for await (const chunk of geminiStream) {
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];

          for (const part of parts) {
            if (!part.text) continue;

            if (part.thought) {
              const now = Date.now();
              if (now - lastEmitTime > 600) {
                const label = extractThoughtLabel(part.text);
                if (label) {
                  enqueue(sseEvent("status", { message: label }));
                  lastEmitTime = now;
                }
              }
            } else {
              accumulated += part.text;
            }
          }
        }

        console.log(`[gen-ai-code] Stream complete. Length: ${accumulated.length}`);

        // ── Fix 1: Markdown Sanitization ──────────────────────────────────────
        // Models often return JSON wrapped in ```json fences despite instructions.
        // This strips the fences so JSON.parse doesn't crash the server.
        const cleanJson = accumulated.replace(/^```json\n?/, "").replace(/```$/, "").trim();

        let parsed: {
          assistantMessage: string;
          title?: string;
          files: Record<string, { code: string }>;
          dependencies: Record<string, string>;
        };

        try {
          parsed = JSON.parse(cleanJson);
        } catch {
          enqueue(sseEvent("error", { message: "AI returned invalid JSON format. Please try again." }));
          controller.close();
          return;
        }

        const { assistantMessage, title: aiTitle, files, dependencies } = parsed;

        if (!files || typeof files !== "object") {
          enqueue(sseEvent("error", { message: "AI response missing files. Please try again." }));
          controller.close();
          return;
        }

        enqueue(sseEvent("status", { message: "Validating packages…" }));
        const validatedDeps = await validateDependencies(dependencies ?? {});
        const newFileData: FileData = {
          files,
          dependencies: validatedDeps,
          title: aiTitle,
        };

        enqueue(sseEvent("status", { message: "Saving…" }));

        const lastUserMessage = messages[messages.length - 1];
        const updatedMessages: Message[] = [
          ...messages,
          { role: "assistant", content: assistantMessage },
        ];

        // ── Fix 2: Prisma Unique Identifier ────────────────────────────────────
        // Removed `userId` from the `where` clause. Prisma throws a runtime error 
        // if you query a non-unique compound index, which silently kills the stream.
        const workspace = workspaceId
          ? await db.workspace.update({
              where: { id: workspaceId },
              data: {
                messages: updatedMessages as never,
                fileData: newFileData as never,
              },
            })
          : await db.workspace.create({
              data: {
                userId,
                title: aiTitle ?? lastUserMessage.content.slice(0, 80),
                messages: updatedMessages as never,
                fileData: newFileData as never,
              },
            });

        const updatedUser = await db.user.update({
          where: { id: userId },
          data: { credits: { decrement: CREDIT_COST_PER_GENERATION } },
          select: { credits: true },
        });

        enqueue(
          sseEvent("done", {
            workspaceId: workspace.id,
            assistantMessage,
            fileData: newFileData,
            creditsRemaining: updatedUser.credits,
          })
        );
      } catch (err: any) {
        console.error("[gen-ai-code] Error during generation:", err);
        
        // ── Fix 3: Proper Capacity Error Propagation ───────────────────────────
        // If Google 503s again, it will tell you in the frontend UI immediately 
        // instead of getting stuck on "Thinking..." forever.
        if (err?.status === 503) {
           enqueue(sseEvent("error", { message: "Google API is experiencing high demand (503). Please wait a moment and try again." }));
        } else {
           enqueue(sseEvent("error", { message: err?.message || "Something went wrong. Please try again." }));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ── Next.js Configurations ────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;