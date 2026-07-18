"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { postComment } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-full bg-gradient-to-r from-hot-pink to-ember px-4 py-2 text-sm font-bold text-white shadow-md shadow-hot-pink/30 transition-transform duration-150 hover:scale-105 active:scale-90 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-60"
    >
      {pending ? "등록 중..." : "등록"}
    </button>
  );
}

export default function CommentForm() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await postComment(formData);
        formRef.current?.reset();
      }}
      className="flex items-start gap-2"
    >
      <textarea
        name="body"
        required
        maxLength={200}
        rows={2}
        placeholder="솔직한 피드백 남겨주세요 (익명)"
        className="flex-1 resize-none rounded-xl border border-lilac/30 bg-ink-2 px-3 py-2 text-sm text-foreground placeholder-lilac/50 outline-none focus:border-hot-pink"
      />
      <SubmitButton />
    </form>
  );
}
