"use client";

import { useFormStatus } from "react-dom";
import { castVote } from "./actions";

function Button() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-full bg-gradient-to-r from-hot-pink to-ember px-4 py-2 text-sm font-bold text-white shadow-lg shadow-hot-pink/30 transition-transform duration-150 hover:scale-110 hover:shadow-hot-pink/50 active:scale-90 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-60"
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
