"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import Fuse from "fuse.js";
import { FileTextIcon } from "lucide-react";

interface Note {
  path: string;
  title: string;
}

interface MentionAutocompleteProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  cursorPosition: number;
}

export function MentionAutocomplete({
  notes,
  onSelect,
  inputRef,
  text,
  cursorPosition,
}: MentionAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Detect @ trigger
  useEffect(() => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([^\s@]*)$/);

    if (match) {
      setQuery(match[1]);
      setOpen(true);

      // Calculate popup position
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setPosition({ top: rect.bottom + 4, left: rect.left });
      }
    } else {
      setOpen(false);
    }
  }, [text, cursorPosition, inputRef]);

  // Fuzzy search
  const fuse = new Fuse(notes, {
    keys: ["title", "path"],
    threshold: 0.4,
    includeScore: true,
  });

  const results = query
    ? fuse
        .search(query)
        .slice(0, 8)
        .map((r) => r.item)
    : notes.slice(0, 8);

  const handleSelect = useCallback(
    (note: Note) => {
      onSelect(note);
      setOpen(false);
    },
    [onSelect]
  );

  if (!open) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            pointerEvents: "none",
          }}
        />
      </PopoverAnchor>
      <PopoverContent className="w-72 p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Search notes..." value={query} readOnly />
          <CommandList>
            <CommandEmpty>No notes found</CommandEmpty>
            <CommandGroup heading="Notes">
              {results.map((note) => (
                <CommandItem
                  key={note.path}
                  value={note.path}
                  onSelect={() => handleSelect(note)}
                >
                  <FileTextIcon className="mr-2 h-4 w-4" />
                  <span>{note.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate max-w-32">
                    {note.path}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
