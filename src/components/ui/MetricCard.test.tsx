import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { MetricCard } from "./MetricCard";

test("MetricCard has no axe violations", async () => {
  const { container } = render(
    <MetricCard label="Applications" value={42} trend="up" />
  );
  expect(await axe(container)).toHaveNoViolations();
});
