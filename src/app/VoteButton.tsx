"use client";

import { useFormStatus } from "react-dom";
import { castVote } from "./actions";

function Button() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-300/50 transition hover:scale-105 hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-60"
    >
      {pending ? "투표 중..." : "투표하기"}
    </button>
  );
}

export default function VoteButton({ siteId }: { siteId: string }) {
  return (
    <form action={castVote.bind(null, siteId)}>
      <Button />
    </form>
  );
}
