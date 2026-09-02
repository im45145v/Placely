import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCtc, formatDate } from "@/lib/utils";
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
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-foreground">No roles found</p>
        <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1 p-3">
        {roles.map((role) => (
          <Link
            key={role.$id}
            href={buildRoleSelectionHref(role.$id, queryParams)}
            className={cn(
              "rounded-md border border-transparent p-3 text-left transition-colors",
              selectedRoleId === role.$id
                ? "border-primary bg-accent/20"
                : "hover:bg-accent/10"
            )}
          >
            <h3 className="text-xs font-semibold text-foreground line-clamp-2">
              {role.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {role.company.name}
            </p>
            <div className="mt-2 flex items-center justify-between">
              {role.ctc && (
                <span className="text-xs font-medium text-foreground">
                  {formatCtc(role.ctc)}
                </span>
              )}
              {role.applicationDeadline && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(role.applicationDeadline)}
                </span>
              )}
            </div>
          </Link>
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
