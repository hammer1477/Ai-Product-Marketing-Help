"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { changePassword, type ChangePasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Updating..." : "Change password"}
    </Button>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<ChangePasswordState, FormData>(changePassword, {});
  const [show, setShow] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  // Clear the fields once it's changed, so passwords don't linger on screen.
  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  const type = show ? "text" : "password";
  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input id="current-password" name="current" type={type} autoComplete="current-password" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" name="next" type={type} autoComplete="new-password" minLength={6} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" name="confirm" type={type} autoComplete="new-password" minLength={6} required />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {show ? "Hide passwords" : "Show passwords"}
      </button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Password changed. Use it next time you log in.</p>}
      <div>
        <Submit />
      </div>
    </form>
  );
}
