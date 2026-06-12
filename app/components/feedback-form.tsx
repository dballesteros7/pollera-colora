"use client";

// Server-action form with the feedback plain <form action> lacks: a pending
// state on the submit button and a toast once the action lands.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { err?: boolean; copied?: number } | void;

export function FeedbackForm({
  action,
  doneMsg,
  copiedMsg,
  zeroMsg,
  errMsg,
  className,
  style,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  doneMsg: string;
  copiedMsg?: string; // "{n}" placeholder, used when the action reports a count
  zeroMsg?: string; // count of 0
  errMsg?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(
    async (prev: { tick: number; msg: string }, formData: FormData) => {
      const res = await action(formData);
      let msg = doneMsg;
      if (res?.err) {
        msg = errMsg ?? doneMsg;
      } else if (typeof res?.copied === "number") {
        msg =
          res.copied === 0
            ? (zeroMsg ?? doneMsg)
            : (copiedMsg ?? doneMsg).replaceAll("{n}", String(res.copied));
      }
      return { tick: prev.tick + 1, msg };
    },
    { tick: 0, msg: "" },
  );

  return (
    <form action={formAction} className={className} style={style}>
      {children}
      {state.tick > 0 && (
        // keyed per submit so the fade-out animation restarts
        <output key={state.tick} className="pc-toast" role="status">
          {state.msg}
        </output>
      )}
    </form>
  );
}

export function PendingButton({
  label,
  pendingLabel,
  className,
  style,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
