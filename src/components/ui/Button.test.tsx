import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Button } from "./Button";

test("Button has no axe violations and shows focus ring on keyboard focus", async () => {
  const { container, getByRole } = render(<Button>Save</Button>);
  expect(await axe(container)).toHaveNoViolations();
  const btn = getByRole("button", { name: "Save" });
  btn.focus();
  expect(btn.className).toContain("focus-visible:ring-2");
});
