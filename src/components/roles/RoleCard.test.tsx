import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { RoleCard } from "./RoleCard";
import type { RoleDetail } from "@/lib/companies/service";

const baseRole = {
  $id: "role_1",
  title: "Frontend Engineer",
  company: { $id: "co_1", name: "Acme Corp" },
  location: "Bengaluru",
  ctc: "1200000",
  applicationDeadline: "2026-09-30T00:00:00.000Z",
} as unknown as RoleDetail;

test("RoleCard has no axe violations and shows keyboard focus ring", async () => {
  const { container, getByRole } = render(<RoleCard role={baseRole} href="/roles?roleId=role_1" />);
  expect(await axe(container)).toHaveNoViolations();
  const link = getByRole("link", { name: /Frontend Engineer/ });
  link.focus();
  expect(link.className).toContain("focus-visible:ring-2");
});

test("RoleCard shows deadline as date text, not only a countdown chip", () => {
  const { getByText } = render(<RoleCard role={baseRole} href="/roles?roleId=role_1" />);
  expect(getByText(/30 Sept 2026/)).toBeInTheDocument();
});
