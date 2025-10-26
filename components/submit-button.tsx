"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

type Props = ComponentProps<'button'> & {
  pendingText?: string;
};

export function SubmitButton({ children, pendingText = "Submitting...", className = '', ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-disabled={pending} className={className} {...props}>
      {pending ? pendingText : children}
    </button>
  );
}




