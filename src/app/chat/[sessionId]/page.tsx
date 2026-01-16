"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  CopyIcon,
  Loader2Icon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  RefreshCcwIcon,
  XCircleIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task";
import { ThinkingIndicator } from "@/components/ai-elements/thinking-indicator";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { NoteMentionPopup } from "@/components/note-mention-popup";
import { SessionSidebar } from "@/components/session-sidebar";
import { Button } from "@/components/ui/button";
import { VaultMarkdown } from "@/components/vault-markdown";
import {
  createSession,
  saveMessage,
  useMessages,
  useSessions,
} from "@/lib/db/hooks";

interface Note {
  path: string;
  title: string;
}

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [input, setInput] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastLoadedSessionRef = useRef<string | null>(null);

  const sessions = useSessions();
  const savedMessages = useMessages(sessionId);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  useEffect(() => {
    fetch("/api/vault/files")
      .then((r) => r.json())
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  }, []);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, regenerate, setMessages } = useChat({
    transport,
    onFinish: async ({ message }) => {
      if (sessionId && message) {
        await saveMessage(sessionId, {
          role: message.role as "user" | "assistant",
          content: getMessageContent(message),
          parts: message.parts,
        });
      }
    },
  });

  useEffect(() => {
    if (!sessionId || savedMessages === undefined) return;

    const isNewSession = sessionId !== lastLoadedSessionRef.current;
    if (!isNewSession) return;

    const messagesMatchSession = savedMessages.every(
      (msg) => msg.sessionId === sessionId,
    );
    if (savedMessages.length > 0 && !messagesMatchSession) return;

    const uiMessages = savedMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: (msg.parts as Array<{ type: "text"; text: string }>) || [
        { type: "text" as const, text: msg.content },
      ],
    }));
    setMessages(uiMessages);
    lastLoadedSessionRef.current = sessionId;
  }, [sessionId, savedMessages, setMessages]);

  function getMessageContent(message: (typeof messages)[0]): string {
    const textPart = message.parts?.find((p) => p.type === "text");
    return textPart && "text" in textPart ? textPart.text : "";
  }

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;

    if (sessionId) {
      await saveMessage(sessionId, {
        role: "user",
        content: message.text,
      });
    }

    sendMessage({ text: message.text });
    setInput("");
  };

  const handleMentionSelect = (note: Note) => {
    const beforeCursor = input.slice(0, cursorPosition);
    const afterCursor = input.slice(cursorPosition);
    const match = beforeCursor.match(/@([^\s@]*)$/);

    if (match) {
      const newBefore =
        beforeCursor.slice(0, -match[0].length) + `[[${note.title}]]`;
      setInput(newBefore + afterCursor);
    }
  };

  const handleMentionBackspaceEmpty = () => {
    const beforeCursor = input.slice(0, cursorPosition);
    const afterCursor = input.slice(cursorPosition);
    const match = beforeCursor.match(/@([^\s@]*)$/);

    if (match) {
      const newText = beforeCursor.slice(0, -match[0].length) + afterCursor;
      setInput(newText);
      setCursorPosition(cursorPosition - match[0].length);
    }
    textareaRef.current?.focus();
  };

  const handleNewSession = async () => {
    const id = await createSession();
    router.push(`/chat/${id}`);
  };

  const handleSelectSession = (id: string) => {
    router.push(`/chat/${id}`);
  };

  return (
    <div className="flex h-dvh">
      <SessionSidebar
        sessions={sessions || []}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <header className="flex items-center gap-2 p-4 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <img src="/logo.png" alt="Pensieve" className="h-9 w-9" />
            <h1 className="text-lg font-semibold">Pensieve</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleNewSession}>
            <PlusIcon className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOutIcon className="h-5 w-5" />
          </Button>
        </header>

        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" &&
                  message.parts?.filter((p) => p.type === "source-url").length >
                    0 && (
                    <Sources>
                      <SourcesTrigger
                        count={
                          message.parts.filter((p) => p.type === "source-url")
                            .length
                        }
                      />
                      <SourcesContent>
                        {message.parts
                          .filter((p) => p.type === "source-url")
                          .map((part, i) => (
                            <Source
                              key={`${message.id}-source-${i}`}
                              href={"url" in part ? part.url : ""}
                              title={"title" in part ? (part.title ?? "") : ""}
                            />
                          ))}
                      </SourcesContent>
                    </Sources>
                  )}

                {message.parts?.length > 0 ? (
                  <>
                    {(() => {
                      const toolParts = message.parts
                        .map((p, i) => ({ part: p, index: i }))
                        .filter(({ part }) => part.type.startsWith("tool-"));
                      const nonToolParts = message.parts.filter(
                        (p) => !p.type.startsWith("tool-"),
                      );
                      const isLastMessage = message.id === messages.at(-1)?.id;
                      const hasRunningTools =
                        status === "streaming" &&
                        isLastMessage &&
                        toolParts.some(({ part }) => {
                          const tp = part as ToolUIPart;
                          return (
                            tp.state !== "output-available" &&
                            tp.state !== "output-error"
                          );
                        });
                      const allCompleted = toolParts.every(({ part }) => {
                        const tp = part as ToolUIPart;
                        return tp.state === "output-available";
                      });
                      const hasError = toolParts.some(({ part }) => {
                        const tp = part as ToolUIPart;
                        return tp.state === "output-error";
                      });

                      return (
                        <>
                          {toolParts.length > 0 && (
                            <Task defaultOpen={hasRunningTools || hasError}>
                              <TaskTrigger
                                title={
                                  hasRunningTools
                                    ? "Searching vault..."
                                    : hasError
                                      ? "Encountered an error"
                                      : `Completed ${toolParts.length} step${toolParts.length > 1 ? "s" : ""}`
                                }
                              />
                              <TaskContent>
                                {toolParts.map(({ part, index }) => {
                                  const toolPart = part as ToolUIPart;
                                  const toolName = toolPart.type
                                    .split("-")
                                    .slice(1)
                                    .join("-");
                                  const isComplete =
                                    toolPart.state === "output-available";
                                  const isError =
                                    toolPart.state === "output-error";
                                  const isRunning =
                                    !isComplete &&
                                    !isError &&
                                    status === "streaming" &&
                                    isLastMessage;

                                  return (
                                    <TaskItem
                                      key={`${message.id}-task-${index}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {isComplete && (
                                          <CheckCircleIcon className="size-4 text-green-500" />
                                        )}
                                        {isError && (
                                          <XCircleIcon className="size-4 text-red-500" />
                                        )}
                                        {isRunning && (
                                          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                                        )}
                                        {!isComplete &&
                                          !isError &&
                                          !isRunning && (
                                            <CheckCircleIcon className="size-4 text-muted-foreground" />
                                          )}
                                        <span
                                          className={
                                            isComplete
                                              ? "text-foreground"
                                              : isError
                                                ? "text-red-500"
                                                : "text-muted-foreground"
                                          }
                                        >
                                          {toolName}
                                        </span>
                                      </div>
                                    </TaskItem>
                                  );
                                })}

                                <div className="mt-4 space-y-2">
                                  {toolParts.map(({ part, index }) => {
                                    const toolPart = part as ToolUIPart;
                                    return (
                                      <Tool
                                        key={`${message.id}-tool-${index}`}
                                        defaultOpen={
                                          toolPart.state === "output-error"
                                        }
                                      >
                                        <ToolHeader
                                          type={toolPart.type}
                                          state={toolPart.state}
                                        />
                                        <ToolContent>
                                          <ToolInput input={toolPart.input} />
                                          <ToolOutput
                                            output={toolPart.output}
                                            errorText={toolPart.errorText}
                                          />
                                        </ToolContent>
                                      </Tool>
                                    );
                                  })}
                                </div>
                              </TaskContent>
                            </Task>
                          )}

                          {nonToolParts.map((part, i) => {
                            switch (part.type) {
                              case "text":
                                return (
                                  <Message
                                    key={`${message.id}-${i}`}
                                    from={message.role}
                                  >
                                    <MessageContent>
                                      <VaultMarkdown notes={notes}>
                                        {part.text}
                                      </VaultMarkdown>
                                    </MessageContent>
                                  </Message>
                                );
                              case "reasoning":
                                return (
                                  <Reasoning
                                    key={`${message.id}-${i}`}
                                    isStreaming={status === "streaming"}
                                  >
                                    <ReasoningTrigger />
                                    <ReasoningContent>
                                      {part.text}
                                    </ReasoningContent>
                                  </Reasoning>
                                );
                              default:
                                return null;
                            }
                          })}
                        </>
                      );
                    })()}
                    {message.role === "assistant" && (
                      <MessageActions className="ml-0 mt-1">
                        <MessageAction
                          onClick={() => {
                            regenerate();
                            toast.success("Regenerating response...");
                          }}
                          tooltip="Retry"
                        >
                          <RefreshCcwIcon className="size-3" />
                        </MessageAction>
                        <MessageAction
                          onClick={() => {
                            const fullText = message.parts
                              ?.filter((p) => p.type === "text")
                              .map((p) => ("text" in p ? p.text : ""))
                              .join("\n\n");
                            navigator.clipboard.writeText(fullText || "");
                            toast.success("Copied to clipboard");
                          }}
                          tooltip="Copy"
                        >
                          <CopyIcon className="size-3" />
                        </MessageAction>
                      </MessageActions>
                    )}
                  </>
                ) : (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      <VaultMarkdown notes={notes}>
                        {getMessageContent(message)}
                      </VaultMarkdown>
                    </MessageContent>
                  </Message>
                )}
              </div>
            ))}
            {status === "submitted" && <ThinkingIndicator />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="relative shrink-0 p-4">
          <NoteMentionPopup
            notes={notes}
            onSelect={handleMentionSelect}
            onClose={() => {}}
            onBackspaceEmpty={handleMentionBackspaceEmpty}
            inputRef={textareaRef}
            text={input}
            cursorPosition={cursorPosition}
          />

          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                ref={textareaRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setInput(e.target.value);
                  setCursorPosition(e.target.selectionStart);
                }}
                onSelect={(e: React.SyntheticEvent<HTMLTextAreaElement>) =>
                  setCursorPosition(e.currentTarget.selectionStart)
                }
                placeholder="Ask about your vault... (@ to search notes)"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <span className="text-xs text-muted-foreground">
                  Type @ to search notes
                </span>
              </PromptInputTools>
              <PromptInputSubmit disabled={!input.trim()} status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
