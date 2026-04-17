"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ToolUIPart,
} from "ai";
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  Loader2Icon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  RefreshCcwIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
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
import {
  BatchDiffApprovalPreview,
  DiffApprovalPreview,
} from "@/components/diff-approval-preview";
import { NoteMentionPopup } from "@/components/note-mention-popup";
import { SessionSidebar } from "@/components/session-sidebar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VaultMarkdown } from "@/components/vault-markdown";
import {
  createSession,
  deleteSession,
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

  const {
    messages,
    sendMessage,
    status,
    regenerate,
    setMessages,
    addToolApprovalResponse,
  } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
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

  const handleDeleteSession = async (deletedSessionId: string) => {
    await deleteSession(deletedSessionId);

    if (deletedSessionId === sessionId) {
      const remainingSessions = (sessions || []).filter(
        (s) => s.id !== deletedSessionId,
      );

      if (remainingSessions.length > 0) {
        router.push(`/chat/${remainingSessions[0].id}`);
      } else {
        const newId = await createSession();
        router.push(`/chat/${newId}`);
      }
    }
  };

  return (
    <div className="flex h-dvh">
      <SessionSidebar
        sessions={sessions || []}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
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
            aria-label="Open conversations menu"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <img src="/logo.png" alt="" className="h-9 w-9" />
            <h1 className="text-lg font-semibold">Pensieve</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewSession}
            aria-label="New conversation"
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Log out"
          >
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

                                <div className="mt-3 space-y-2">
                                  {toolParts.map(({ part, index }) => {
                                    const toolPart = part as ToolUIPart;
                                    const toolName = toolPart.type
                                      .split("-")
                                      .slice(1)
                                      .join("-");
                                    const needsApprovalTools = [
                                      "createNote",
                                      "createNotes",
                                      "updateNote",
                                      "updateNotes",
                                      "deleteNote",
                                      "deleteNotes",
                                    ];
                                    const requiresApproval =
                                      needsApprovalTools.includes(toolName);

                                    return (
                                      <div key={`${message.id}-tool-${index}`}>
                                        <Tool
                                          defaultOpen={
                                            toolPart.state === "output-error" ||
                                            toolPart.state ===
                                              "approval-requested"
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

                                        {requiresApproval &&
                                          toolPart.approval && (
                                            <Confirmation
                                              approval={toolPart.approval}
                                              state={toolPart.state}
                                              className="mt-2"
                                            >
                                              <ConfirmationTitle>
                                                <ConfirmationRequest>
                                                  {toolName === "deleteNote" ? (
                                                    <>
                                                      Delete{" "}
                                                      <code className="inline rounded bg-muted px-1.5 py-0.5 text-sm">
                                                        {(
                                                          toolPart.input as {
                                                            path?: string;
                                                          }
                                                        )?.path || "note"}
                                                      </code>
                                                      ? This cannot be undone.
                                                    </>
                                                  ) : toolName ===
                                                    "deleteNotes" ? (
                                                    (() => {
                                                      const input =
                                                        toolPart.input as {
                                                          paths?: string[];
                                                        };
                                                      const pathsArray =
                                                        input?.paths || [];
                                                      return (
                                                        <div className="space-y-2">
                                                          <div>
                                                            Delete{" "}
                                                            <strong className="text-destructive">
                                                              {
                                                                pathsArray.length
                                                              }
                                                            </strong>{" "}
                                                            notes? This cannot
                                                            be undone.
                                                          </div>
                                                          <Collapsible>
                                                            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                                                              <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                                                              View notes to
                                                              delete
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent>
                                                              <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                                                                {pathsArray.map(
                                                                  (path) => (
                                                                    <div
                                                                      key={path}
                                                                      className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
                                                                    >
                                                                      <code className="text-xs">
                                                                        {path}
                                                                      </code>
                                                                    </div>
                                                                  ),
                                                                )}
                                                              </div>
                                                            </CollapsibleContent>
                                                          </Collapsible>
                                                        </div>
                                                      );
                                                    })()
                                                  ) : toolName ===
                                                    "updateNote" ? (
                                                    (() => {
                                                      const input =
                                                        toolPart.input as {
                                                          path?: string;
                                                          content?: string;
                                                        };
                                                      return (
                                                        <div className="space-y-2">
                                                          <div>
                                                            Update{" "}
                                                            <code className="inline rounded bg-muted px-1.5 py-0.5 text-sm">
                                                              {input?.path ||
                                                                "note"}
                                                            </code>
                                                            ?
                                                          </div>
                                                          <DiffApprovalPreview
                                                            path={
                                                              input?.path || ""
                                                            }
                                                            newContent={
                                                              input?.content ||
                                                              ""
                                                            }
                                                          />
                                                        </div>
                                                      );
                                                    })()
                                                  ) : toolName ===
                                                    "updateNotes" ? (
                                                    (() => {
                                                      const input =
                                                        toolPart.input as {
                                                          notes?: Array<{
                                                            path?: string;
                                                            content?: string;
                                                          }>;
                                                        };
                                                      const notesArray =
                                                        input?.notes || [];
                                                      return (
                                                        <div className="space-y-2">
                                                          <div>
                                                            Update{" "}
                                                            <strong>
                                                              {
                                                                notesArray.length
                                                              }
                                                            </strong>{" "}
                                                            notes?
                                                          </div>
                                                          <BatchDiffApprovalPreview
                                                            notes={notesArray.map(
                                                              (n) => ({
                                                                path:
                                                                  n.path || "",
                                                                content:
                                                                  n.content ||
                                                                  "",
                                                              }),
                                                            )}
                                                          />
                                                        </div>
                                                      );
                                                    })()
                                                  ) : toolName ===
                                                    "createNotes" ? (
                                                    (() => {
                                                      const input =
                                                        toolPart.input as {
                                                          notes?: Array<{
                                                            path?: string;
                                                            title?: string;
                                                            content?: string;
                                                            type?: string;
                                                            tags?: string[];
                                                          }>;
                                                        };
                                                      const notesArray =
                                                        input?.notes || [];
                                                      const date = new Date()
                                                        .toLocaleDateString(
                                                          "en-GB",
                                                        )
                                                        .replace(/\//g, ".");
                                                      const notesWithContent =
                                                        notesArray.map(
                                                          (note) => ({
                                                            path:
                                                              note.path || "",
                                                            content: `---\ntype: ${note.type || "note"}\ncreated: ${date}\ntags: [${(note.tags || []).join(", ")}]\n---\n\n# ${note.title || "Untitled"}\n\n${note.content || ""}`,
                                                          }),
                                                        );
                                                      return (
                                                        <div className="space-y-2">
                                                          <div>
                                                            Create{" "}
                                                            <strong>
                                                              {
                                                                notesArray.length
                                                              }
                                                            </strong>{" "}
                                                            notes?
                                                          </div>
                                                          <BatchDiffApprovalPreview
                                                            notes={
                                                              notesWithContent
                                                            }
                                                          />
                                                        </div>
                                                      );
                                                    })()
                                                  ) : (
                                                    (() => {
                                                      const input =
                                                        toolPart.input as {
                                                          path?: string;
                                                          title?: string;
                                                          content?: string;
                                                          type?: string;
                                                          tags?: string[];
                                                        };
                                                      const date = new Date()
                                                        .toLocaleDateString(
                                                          "en-GB",
                                                        )
                                                        .replace(/\//g, ".");
                                                      const fullContent = `---\ntype: ${input?.type || "note"}\ncreated: ${date}\ntags: [${(input?.tags || []).join(", ")}]\n---\n\n# ${input?.title || "Untitled"}\n\n${input?.content || ""}`;
                                                      return (
                                                        <div className="space-y-2">
                                                          <div>
                                                            Create note at{" "}
                                                            <code className="inline rounded bg-muted px-1.5 py-0.5 text-sm">
                                                              {input?.path ||
                                                                "path"}
                                                            </code>
                                                            ?
                                                          </div>
                                                          <DiffApprovalPreview
                                                            path={
                                                              input?.path || ""
                                                            }
                                                            newContent={
                                                              fullContent
                                                            }
                                                          />
                                                        </div>
                                                      );
                                                    })()
                                                  )}
                                                </ConfirmationRequest>
                                                <ConfirmationAccepted>
                                                  <CheckIcon className="size-4 text-green-600 dark:text-green-400" />
                                                  <span>
                                                    {toolName === "deleteNote"
                                                      ? "You approved the deletion"
                                                      : toolName ===
                                                          "deleteNotes"
                                                        ? "You approved the batch deletion"
                                                        : toolName ===
                                                            "updateNote"
                                                          ? "You approved the update"
                                                          : toolName ===
                                                              "updateNotes"
                                                            ? "You approved the batch update"
                                                            : toolName ===
                                                                "createNotes"
                                                              ? "You approved the batch creation"
                                                              : "You approved the creation"}
                                                  </span>
                                                </ConfirmationAccepted>
                                                <ConfirmationRejected>
                                                  <XIcon className="size-4 text-destructive" />
                                                  <span>
                                                    {toolName === "deleteNote"
                                                      ? "You rejected the deletion"
                                                      : toolName ===
                                                          "deleteNotes"
                                                        ? "You rejected the batch deletion"
                                                        : toolName ===
                                                            "updateNote"
                                                          ? "You rejected the update"
                                                          : toolName ===
                                                              "updateNotes"
                                                            ? "You rejected the batch update"
                                                            : toolName ===
                                                                "createNotes"
                                                              ? "You rejected the batch creation"
                                                              : "You rejected the creation"}
                                                  </span>
                                                </ConfirmationRejected>
                                              </ConfirmationTitle>
                                              <ConfirmationActions>
                                                <ConfirmationAction
                                                  onClick={() =>
                                                    addToolApprovalResponse({
                                                      id: toolPart.approval!.id,
                                                      approved: false,
                                                    })
                                                  }
                                                  variant="outline"
                                                >
                                                  Reject
                                                </ConfirmationAction>
                                                <ConfirmationAction
                                                  onClick={() =>
                                                    addToolApprovalResponse({
                                                      id: toolPart.approval!.id,
                                                      approved: true,
                                                    })
                                                  }
                                                  variant={
                                                    toolName === "deleteNote" ||
                                                    toolName === "deleteNotes"
                                                      ? "destructive"
                                                      : "default"
                                                  }
                                                >
                                                  {toolName === "deleteNote"
                                                    ? "Delete"
                                                    : toolName === "deleteNotes"
                                                      ? "Delete All"
                                                      : toolName ===
                                                          "updateNote"
                                                        ? "Update"
                                                        : toolName ===
                                                            "updateNotes"
                                                          ? "Update All"
                                                          : toolName ===
                                                              "createNotes"
                                                            ? "Create All"
                                                            : "Create"}
                                                </ConfirmationAction>
                                              </ConfirmationActions>
                                            </Confirmation>
                                          )}
                                      </div>
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
                          aria-label="Retry response"
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
                          aria-label="Copy message"
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
                aria-label="Ask about your vault"
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
