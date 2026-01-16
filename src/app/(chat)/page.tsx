"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  CopyIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
// AI Elements
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
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
// Custom components
import { MentionAutocomplete } from "@/components/mention-autocomplete";
import { SessionSidebar } from "@/components/session-sidebar";
import { Button } from "@/components/ui/button";
// Dexie
import { createSession, saveMessage, useSessions } from "@/lib/db/hooks";

interface Note {
  path: string;
  title: string;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sessions = useSessions();

  // Fetch note list for @autocomplete
  useEffect(() => {
    fetch("/api/vault/files")
      .then((r) => r.json())
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  }, []);

  // Create new session on mount if none
  useEffect(() => {
    if (!sessionId && sessions !== undefined) {
      if (sessions.length > 0) {
        setSessionId(sessions[0].id);
      } else {
        createSession().then((id) => setSessionId(id));
      }
    }
  }, [sessionId, sessions]);

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

  // Helper to extract text content from message
  function getMessageContent(message: (typeof messages)[0]): string {
    const textPart = message.parts?.find((p) => p.type === "text");
    return textPart && "text" in textPart ? textPart.text : "";
  }

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;

    // Save user message
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
    // Replace @query with [[Note Name]]
    const beforeCursor = input.slice(0, cursorPosition);
    const afterCursor = input.slice(cursorPosition);
    const match = beforeCursor.match(/@([^\s@]*)$/);

    if (match) {
      const newBefore =
        beforeCursor.slice(0, -match[0].length) + `[[${note.title}]]`;
      setInput(newBefore + afterCursor);
    }
  };

  const handleNewSession = async () => {
    const id = await createSession();
    setSessionId(id);
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex h-dvh">
      {/* Sidebar */}
      <SessionSidebar
        sessions={sessions || []}
        currentSessionId={sessionId}
        onSelectSession={(id) => {
          setSessionId(id);
          setMessages([]);
        }}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-2 p-4 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">Pensieve</h1>
          <Button variant="ghost" size="icon" onClick={handleNewSession}>
            <PlusIcon className="h-5 w-5" />
          </Button>
        </header>

        {/* Conversation */}
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {/* Sources */}
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

                {/* Message parts */}
                {message.parts?.length > 0 ? (
                  message.parts.map((part, i) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <Message
                            key={`${message.id}-${i}`}
                            from={message.role}
                          >
                            <MessageContent>
                              <MessageResponse>{part.text}</MessageResponse>
                            </MessageContent>
                            {message.role === "assistant" && (
                              <MessageActions>
                                <MessageAction
                                  onClick={() => regenerate()}
                                  label="Retry"
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </MessageAction>
                                <MessageAction
                                  onClick={() =>
                                    navigator.clipboard.writeText(part.text)
                                  }
                                  label="Copy"
                                >
                                  <CopyIcon className="size-3" />
                                </MessageAction>
                              </MessageActions>
                            )}
                          </Message>
                        );
                      case "reasoning":
                        return (
                          <Reasoning
                            key={`${message.id}-${i}`}
                            isStreaming={status === "streaming"}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      default:
                        return null;
                    }
                  })
                ) : (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      <MessageResponse>
                        {getMessageContent(message)}
                      </MessageResponse>
                    </MessageContent>
                  </Message>
                )}
              </div>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input with @mention */}
        <div className="relative shrink-0 p-4">
          <MentionAutocomplete
            notes={notes}
            onSelect={handleMentionSelect}
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
