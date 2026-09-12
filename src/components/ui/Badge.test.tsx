import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Badge } from "./Badge";

test("Badge has no axe violations", async () => {
  const { container } = render(<Badge variant="success">Active</Badge>);
  expect(await axe(container)).toHaveNoViolations();
});
