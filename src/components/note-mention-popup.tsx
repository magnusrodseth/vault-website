"use client";

import Fuse from "fuse.js";
import { FileTextIcon, SearchIcon } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface Note {
  path: string;
  title: string;
}

interface NoteMentionPopupProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  onClose: () => void;
  onBackspaceEmpty: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  cursorPosition: number;
}

const TEXT_STYLE_PROPERTIES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "textTransform",
  "wordSpacing",
  "textIndent",
  "whiteSpace",
  "wordWrap",
  "lineHeight",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "borderLeftWidth",
  "borderRightWidth",
  "borderTopWidth",
  "borderBottomWidth",
  "boxSizing",
] as const;

function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number,
): { top: number; left: number } {
  const div = document.createElement("div");
  const style = getComputedStyle(element);

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.width = `${element.offsetWidth}px`;

  for (const prop of TEXT_STYLE_PROPERTIES) {
    const cssProperty = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    div.style.setProperty(cssProperty, style.getPropertyValue(cssProperty));
  }

  const textContent = element.value.substring(0, position);
  div.textContent = textContent;

  const span = document.createElement("span");
  span.textContent = element.value.substring(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);

  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();

  document.body.removeChild(div);

  return {
    top: spanRect.top - divRect.top,
    left: spanRect.left - divRect.left,
  };
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

interface NoteListProps {
  notes: Note[];
  query: string;
  selectedIndex: number;
  onSelect: (note: Note) => void;
  onHover: (index: number) => void;
  fuse: Fuse<Note>;
}

function NoteList({
  notes,
  query,
  selectedIndex,
  onSelect,
  onHover,
  fuse,
}: NoteListProps) {
  const results = useMemo(() => {
    if (!query) return notes.slice(0, 12);
    return fuse
      .search(query)
      .slice(0, 12)
      .map((r) => r.item);
  }, [query, notes, fuse]);

  if (results.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
        No notes found
      </div>
    );
  }

  return (
    <>
      {results.map((note, index) => (
        <button
          key={note.path}
          type="button"
          onClick={() => onSelect(note)}
          onMouseEnter={() => onHover(index)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
            index === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50",
          )}
        >
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{note.title}</span>
          <span className="truncate text-xs text-muted-foreground max-w-24">
            {note.path.split("/").slice(0, -1).join("/")}
          </span>
        </button>
      ))}
    </>
  );
}

export function NoteMentionPopup({
  notes,
  onSelect,
  onClose,
  onBackspaceEmpty,
  inputRef,
  text,
  cursorPosition,
}: NoteMentionPopupProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const drawerSearchInputRef = useRef<HTMLInputElement>(null);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const fuse = useMemo(
    () =>
      new Fuse(notes, {
        keys: ["title", "path"],
        threshold: 0.4,
        includeScore: true,
      }),
    [notes],
  );

  const results = useMemo(() => {
    if (!query) return notes.slice(0, 12);
    return fuse
      .search(query)
      .slice(0, 12)
      .map((r) => r.item);
  }, [query, notes, fuse]);

  useEffect(() => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([^\s@]*)$/);

    if (match) {
      setQuery(match[1]);
      setOpen(true);
      setSelectedIndex(0);

      if (inputRef.current) {
        const textarea = inputRef.current;
        const textareaRect = textarea.getBoundingClientRect();
        const atPosition = cursorPosition - match[0].length;
        const caretPos = getCaretCoordinates(textarea, atPosition);

        setPosition({
          top: textareaRect.top + caretPos.top - textarea.scrollTop,
          left: textareaRect.left + caretPos.left,
        });
      }
    } else {
      setOpen(false);
      setQuery("");
    }
  }, [text, cursorPosition, inputRef]);

  useEffect(() => {
    if (open) {
      const inputToFocus = isDesktop
        ? searchInputRef.current
        : drawerSearchInputRef.current;
      setTimeout(() => inputToFocus?.focus(), 10);
    }
  }, [open, isDesktop]);

  const handleSelect = useCallback(
    (note: Note) => {
      onSelect(note);
      setOpen(false);
      setQuery("");
      inputRef.current?.focus();
    },
    [onSelect, inputRef],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    onClose();
    inputRef.current?.focus();
  }, [onClose, inputRef]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(
            (prev) => (prev - 1 + results.length) % results.length,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          handleClose();
          break;
        case "Tab":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, handleSelect, handleClose]);

  useEffect(() => {
    if (!open || !isDesktop) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClose, isDesktop]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query === "") {
      e.preventDefault();
      setOpen(false);
      onBackspaceEmpty();
    }
  };

  if (!open) return null;

  if (!isDesktop) {
    return (
      <Drawer
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose();
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base">Search Notes</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <SearchIcon className="size-4 text-muted-foreground" />
              <input
                ref={drawerSearchInputRef}
                type="text"
                value={query}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search notes..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4">
            <NoteList
              notes={notes}
              query={query}
              selectedIndex={selectedIndex}
              onSelect={handleSelect}
              onHover={setSelectedIndex}
              fuse={fuse}
            />
          </div>

          <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
            Tap a note to insert
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 w-80 rounded-lg border bg-popover shadow-lg"
      style={{
        bottom: `calc(100vh - ${position.top}px + 8px)`,
        left: position.left,
        maxHeight: "320px",
      }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <SearchIcon className="size-4 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search notes..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="max-h-64 overflow-y-auto p-1">
        <NoteList
          notes={notes}
          query={query}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          onHover={setSelectedIndex}
          fuse={fuse}
        />
      </div>

      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        <kbd className="rounded bg-muted px-1">↑↓</kbd> navigate{" "}
        <kbd className="rounded bg-muted px-1">↵</kbd> select{" "}
        <kbd className="rounded bg-muted px-1">esc</kbd> close
      </div>
    </div>
  );
}
