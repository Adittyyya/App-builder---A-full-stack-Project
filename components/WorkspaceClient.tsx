"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { CodePanel } from "./CodePanel";
import ChatPanel from "./ChatPanel";

import {
  FileData,
  Message,
  StatusStep,
  WorkspaceData,
} from "@/types/workspace";

import { MIN_CREDITS_TO_GENERATE } from "@/lib/constants";
import { toast } from "sonner";

interface WorkspaceClientProps {
  initialPrompt: string | null;
  userCredits: number;
  userId: string;
  userPlan: string;
  workspace: WorkspaceData | null;
}

function parseMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter(
    (m): m is Message =>
      typeof m === "object" &&
      m !== null &&
      "role" in m &&
      "content" in m
  );
}

function parseFileData(raw: unknown): FileData | null {
  if (!raw || typeof raw !== "object") return null;

  const f = raw as Record<string, unknown>;

  if (!f.files || !f.dependencies) return null;

  return raw as FileData;
}

const WorkspaceClient = ({
  initialPrompt,
  userCredits,
  workspace,
  userId,
}: WorkspaceClientProps) => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    workspace?.id ?? null
  );

  const [messages, setMessages] = useState<Message[]>(
    parseMessages(workspace?.messages)
  );

  const [credits, setCredits] = useState(userCredits);

  const [fileData, setFileData] = useState<FileData | null>(
    parseFileData(workspace?.fileData)
  );

  const [isGenerating, setIsGenerating] = useState(false);

  const [statusLog, setStatusLog] = useState<StatusStep[]>([]);

  // --------------------------------------------------
  // REFS
  // --------------------------------------------------

  const messagesRef = useRef<Message[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fileDataRef = useRef<FileData | null>(fileData);

  useEffect(() => {
    fileDataRef.current = fileData;
  }, [fileData]);

  const workspaceIdRef = useRef<string | null>(workspaceId);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  // --------------------------------------------------
  // FILE PATCH
  // --------------------------------------------------

  const handleFilePatch = useCallback((patches: FileData) => {
    fileDataRef.current = patches;
    setFileData(patches);
  }, []);

  // --------------------------------------------------
  // STATUS STEPS
  // --------------------------------------------------

  const pushStep = useCallback((label: string) => {
    setStatusLog((prev) => [
      ...prev.map((step, index) =>
        index === prev.length - 1
          ? { ...step, status: "done" as const }
          : step
      ),
      {
        label,
        status: "running" as const,
      },
    ]);
  }, []);

  const completeSteps = useCallback(() => {
    setStatusLog((prev) =>
      prev.map((step, index) =>
        index === prev.length - 1
          ? { ...step, status: "done" as const }
          : step
      )
    );
  }, []);

  // --------------------------------------------------
  // GENERATE
  // --------------------------------------------------

  const handleGenerate = useCallback(
    async (prompt: string, imageUrl?: string) => {
      if (isGenerating) return;

      if (credits < MIN_CREDITS_TO_GENERATE) {
        toast.error("Not enough credits.");
        return;
      }

      const userMessage: Message = {
        role: "user",
        content: prompt,
        ...(imageUrl ? { imageUrl } : {}),
      };

      const currentMessages = messagesRef.current;
      const currentWorkspaceId = workspaceIdRef.current;

      const updatedMessages = [...currentMessages, userMessage];

      // Update ref immediately to prevent stale messages
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);

      setIsGenerating(true);

      setStatusLog([
        {
          label: "Thinking…",
          status: "running",
        },
      ]);

      try {
        const res = await fetch("/api/gen-ai-code", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            userId,
            messages: updatedMessages,
            fileData: fileDataRef.current,
          }),
        });

        // ----------------------------------------------
        // HTTP ERRORS
        // ----------------------------------------------

        if (res.status === 402) {
          toast.error("Not enough credits.");

          const rolledBackMessages = currentMessages;

          messagesRef.current = rolledBackMessages;
          setMessages(rolledBackMessages);

          return;
        }

        if (res.status === 429) {
          toast.error("Too many requests. Please slow down.");

          const rolledBackMessages = currentMessages;

          messagesRef.current = rolledBackMessages;
          setMessages(rolledBackMessages);

          return;
        }

        if (!res.ok || !res.body) {
          throw new Error("Generation failed");
        }

        // ----------------------------------------------
        // READ SSE STREAM
        // ----------------------------------------------

        const reader = res.body.getReader();

        const decoder = new TextDecoder();

        let buffer = "";

        let streamError: Error | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            buffer += decoder.decode();
            break;
          }

          buffer += decoder.decode(value, {
            stream: true,
          });

          const lines = buffer.split("\n\n");

          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              continue;
            }

            let event;

            try {
              event = JSON.parse(line.slice(6));
            } catch {
              // Only ignore malformed JSON/SSE.
              continue;
            }

            // ------------------------------------------
            // STATUS
            // ------------------------------------------

            if (event.type === "status") {
              pushStep(event.message);
            }

            // ------------------------------------------
            // DONE
            // ------------------------------------------

            else if (event.type === "done") {
              completeSteps();

              workspaceIdRef.current = event.workspaceId;
              setWorkspaceId(event.workspaceId);

              fileDataRef.current = event.fileData;
              setFileData(event.fileData);

              setCredits(event.creditsRemaining);

              const assistantMessage: Message = {
                role: "assistant",
                content: event.assistantMessage,
              };

              const finalMessages = [
                ...messagesRef.current,
                assistantMessage,
              ];

              messagesRef.current = finalMessages;
              setMessages(finalMessages);

              window.history.replaceState(
                null,
                "",
                `/workspace?id=${event.workspaceId}`
              );
            }

            // ------------------------------------------
            // API STREAM ERROR
            // ------------------------------------------

            else if (event.type === "error") {
              streamError = new Error(
                event.message || "Generation failed"
              );

              break;
            }
          }

          if (streamError) {
            break;
          }
        }

        if (streamError) {
          throw streamError;
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong.";

        toast.error(message);

        // Remove failed user message
        messagesRef.current = currentMessages;
        setMessages(currentMessages);
      } finally {
        setIsGenerating(false);
        setStatusLog([]);
      }
    },
    [
      credits,
      isGenerating,
      userId,
      pushStep,
      completeSteps,
    ]
  );

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a]">
      {/* Chat panel - left */}

      <ChatPanel
        messages={messages}
        isGenerating={isGenerating}
        isImproving={false}
        statusLog={statusLog}
        credits={credits}
        initialPrompt={initialPrompt}
        onGenerate={handleGenerate}
        userId={userId}
        workspaceId={workspaceId}
        appTitle={fileData?.title ?? workspace?.title ?? null}
      />

      {/* Code panel - right */}

      <CodePanel
        fileData={fileData}
        isGenerating={isGenerating}
        statusLog={statusLog}
        onFilePatch={handleFilePatch}
      />
    </div>
  );
};

export default WorkspaceClient;