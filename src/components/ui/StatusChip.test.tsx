import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { StatusChip } from "./StatusChip";

test("StatusChip has no axe violations", async () => {
  const { container } = render(<StatusChip variant="eligible">Eligible</StatusChip>);
  expect(await axe(container)).toHaveNoViolations();
});

test("StatusChip exposes its status via aria-label (not color alone)", () => {
  const { getByText } = render(<StatusChip variant="rejected">Rejected</StatusChip>);
  const chip = getByText("Rejected");
  expect(chip.getAttribute("aria-label")).toBe("Rejected");
});
