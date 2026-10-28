"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one sheet every log uses (see docs/DESIGN.md, "Log sheet").
 *
 *   title    what is being logged
 *   when     the date control (WhenPicker), top right
 *   value    the big number, changing as you adjust
 *   aside    small text beside the value (day total, change since last)
 *   children usuals and the one control
 *   onSave   async; resolves when saved. The caller shows the Undo line.
 *
 * Slides up from the bottom on phones and sits in the centre on wider
 * screens. Built on Radix Dialog, so focus is trapped, Escape closes it,
 * and the page behind is hidden from screen readers.
 */
export default function LogSheet({
  open,
  onOpenChange,
  title,
  when,
  value,
  aside,
  saveLabel = "Save",
  canSave = true,
  onSave,
  note,
  onNoteChange,
  noteLabel = "Add a note",
  children,
}) {
  const [saving, setSaving] = useState(false);
  const [showNote, setShowNote] = useState(!!note);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#142B38]/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col border-t border-foreground bg-card text-foreground outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:border"
          )}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex min-h-0 flex-col"
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-4">
              <Dialog.Title className="font-display text-[26px] font-extrabold uppercase leading-none">{title}</Dialog.Title>
              <div className="flex items-center gap-1">
                {when}
                <Dialog.Close
                  aria-label="Close"
                  className="flex h-11 w-11 items-center justify-center text-foreground"
                >
                  <X className="h-5 w-5" aria-hidden />
                </Dialog.Close>
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-3">
              {value != null ? (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <output aria-live="polite" className="font-display text-[56px] font-extrabold leading-[0.95] sm:text-[64px]">
                    {value}
                  </output>
                  {aside ? <span className="text-sm text-muted-foreground">{aside}</span> : null}
                </div>
              ) : null}

              {children}

              {onNoteChange ? (
                showNote ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">Note</span>
                    <textarea
                      value={note ?? ""}
                      onChange={(e) => onNoteChange(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="resize-none border border-foreground bg-card px-3 py-2 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNote(true)}
                    className="h-11 border-b border-border text-left text-[15px] text-muted-foreground"
                  >
                    {noteLabel}
                  </button>
                )
              ) : null}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 border-t border-border px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              <Dialog.Close className="h-[52px] border border-foreground bg-card text-base font-semibold text-foreground">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={!canSave || saving}
                className="h-[52px] bg-foreground text-[17px] font-bold text-background disabled:opacity-50"
              >
                {saving ? "Saving" : saveLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
