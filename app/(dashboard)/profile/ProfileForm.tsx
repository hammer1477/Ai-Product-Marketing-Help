"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile, type UpdateProfileState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UpdateProfileState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}

export function ProfileForm({
  username,
  displayName,
  gender,
}: {
  username: string;
  displayName: string;
  /** Set only for the owner, who picks how the studio addresses them. */
  gender: "male" | "female" | null;
}) {
  const [state, formAction] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          defaultValue={username}
          placeholder="e.g. nadim_studio"
          pattern="[A-Za-z0-9_]{3,20}"
          title="3–20 characters: letters, numbers or underscores"
          autoComplete="username"
        />
        <p className="text-xs text-muted-foreground">Shown in the header and on your dashboard.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Full name</Label>
        <Input id="displayName" name="displayName" defaultValue={displayName} autoComplete="name" />
      </div>
      {gender && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">How the studio addresses you</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: "male", label: "Master", note: "“Welcome back, Master.” · “Daddy”" },
              { value: "female", label: "Mistress", note: "“Welcome back, Mistress.” · “Mommy”" },
            ].map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/10"
              >
                <input type="radio" name="gender" value={o.value} defaultChecked={gender === o.value} className="mt-0.5 accent-amber-500" />
                <span>
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Profile saved.</p>}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
