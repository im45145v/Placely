import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { SectionTabs } from "./SectionTabs";

const tabs = [
  { id: "all", label: "All", count: 3 },
  { id: "open", label: "Open", count: 2 },
];

test("SectionTabs has no axe violations", async () => {
  const { container } = render(
    <SectionTabs tabs={tabs} activeTab="all" onTabChange={() => {}} />
  );
  expect(await axe(container)).toHaveNoViolations();
});

test("SectionTabs reflects aria-selected state", () => {
  const { getAllByRole } = render(
    <SectionTabs tabs={tabs} activeTab="all" onTabChange={() => {}} />
  );
  const tabButtons = getAllByRole("tab") as HTMLButtonElement[];
  expect(tabButtons[0].getAttribute("aria-selected")).toBe("true");
  expect(tabButtons[1].getAttribute("aria-selected")).toBe("false");
});