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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Gender</legend>
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          {[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ].map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" name="gender" value={o.value} defaultChecked={gender === o.value} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Profile saved.</p>}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
