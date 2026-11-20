"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adjustCredits, setRole, type AdminActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/profile/getProfile";

const initial: AdminActionState = {};

function Submit({ children, variant }: { children: React.ReactNode; variant?: "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? "..." : children}
    </Button>
  );
}

function Status({ state }: { state: AdminActionState }) {
  if (state.error) return <p className="text-xs text-destructive">{state.error}</p>;
  if (state.success) return <p className="text-xs text-emerald-600">{state.success}</p>;
  return null;
}

export function RoleForm({ userId, role, isSelf }: { userId: string; role: Role; isSelf: boolean }) {
  const [state, action] = useActionState(setRole, initial);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-2">
        <select
          name="role"
          defaultValue={role}
          disabled={isSelf}
          className="h-8 rounded-md border bg-background px-2 text-sm disabled:opacity-60"
        >
          <option value="user">Client</option>
          <option value="friend">Friend (10,000 free credits)</option>
          <option value="family">Family (unlimited)</option>
          <option value="owner">Owner (unlimited + admin)</option>
        </select>
        {!isSelf && <Submit variant="outline">Save</Submit>}
      </div>
      <Status state={state} />
    </form>
  );
}

export function CreditsForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(adjustCredits, initial);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-2">
        <Input name="amount" inputMode="numeric" placeholder="Amount" className="h-8 w-28" required />
        <Button type="submit" name="mode" value="add" size="sm">
          Add
        </Button>
        <Button type="submit" name="mode" value="remove" size="sm" variant="outline">
          Remove
        </Button>
      </div>
      <Status state={state} />
    </form>
  );
}
