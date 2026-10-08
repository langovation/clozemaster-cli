import { useState } from "react";

export function useSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error>();

  async function submit(action: () => Promise<void>) {
    setIsSubmitting(true);
    try {
      await action();
    } catch (caught) {
      setError(caught as Error);
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, submit };
}
