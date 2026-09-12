import React from "react";
import Link from "next/link";
import { RoleCard } from "@/components/roles/RoleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RoleDetail } from "@/lib/companies/service";

interface StudentRolesListProps {
  roles: RoleDetail[];
  selectedRoleId?: string;
  page: number;
  totalPages: number;
  queryParams: {
    search: string;
    companyId: string;
    workMode: string;
    employmentType: string;
    sortBy: string;
    sortDirection: string;
  };
}

export function StudentRolesList({
  roles,
  selectedRoleId,
  page,
  totalPages,
  queryParams,
}: StudentRolesListProps): React.ReactElement {
  if (roles.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No roles found"
          description="Try adjusting your filters — or make sure your profile is complete so you are eligible for more roles."
          action={
            <Link
              href="/profile"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Complete your profile
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="animate-fade-in-up flex flex-col gap-1 p-3">
        {roles.map((role) => (
          <RoleCard
            key={role.$id}
            role={role}
            href={buildRoleSelectionHref(role.$id, queryParams)}
            selected={selectedRoleId === role.$id}
          />
        ))}
      </div>
      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </div>
    </>
  );
}

function buildRoleSelectionHref(
  roleId: string,
  queryParams: StudentRolesListProps["queryParams"]
): string {
  const params = new URLSearchParams();
  params.set("roleId", roleId);
  if (queryParams.search) params.set("search", queryParams.search);
  if (queryParams.companyId) params.set("companyId", queryParams.companyId);
  if (queryParams.workMode) params.set("workMode", queryParams.workMode);
  if (queryParams.employmentType) params.set("employmentType", queryParams.employmentType);
  if (queryParams.sortBy) params.set("sortBy", queryParams.sortBy);
  if (queryParams.sortDirection) params.set("sortDirection", queryParams.sortDirection);
  return `/roles?${params.toString()}`;
}