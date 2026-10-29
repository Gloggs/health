"use client";

import FamilyTabs from "../_components/FamilyTabs";
import { FamilyChatView } from "../_components/ChatViews";

// Family > Chat: the shared family room.
export default function FamilyChatPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none">Family</h1>
      <FamilyTabs active="chat" />
      <FamilyChatView />
    </div>
  );
}
