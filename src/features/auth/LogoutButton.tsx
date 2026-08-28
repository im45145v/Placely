/**
 * LogoutButton — client component that triggers the logout server action.
 */
"use client";

import { useTransition } from "react";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/Button";

export function LogoutButton(): React.ReactElement {
  const [isPending, startTransition] = useTransition();

  function handleLogout(): void {
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={isPending}
      onClick={handleLogout}
    >
      Sign out
    </Button>
  );
}
