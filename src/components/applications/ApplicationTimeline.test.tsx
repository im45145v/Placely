import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { ApplicationTimeline } from "./ApplicationTimeline";
import type { ApplicationDetail } from "@/lib/applications/types";

const workflow = [
  {
    round: { $id: "r1", sequence: 1, name: "Resume Screening", type: "screening" },
    state: "completed",
  },
  {
    round: { $id: "r2", sequence: 2, name: "Technical Interview", type: "technical_interview" },
    state: "active",
  },
  {
    round: { $id: "r3", sequence: 3, name: "HR Round", type: "interview" },
    state: "pending",
  },
] as unknown as ApplicationDetail["workflow"];

test("ApplicationTimeline has no axe violations", async () => {
  const { container } = render(<ApplicationTimeline workflow={workflow} />);
  expect(await axe(container)).toHaveNoViolations();
});

test("marks the active round with aria-current=step and states each round in words", () => {
  const { getAllByRole, getByText } = render(<ApplicationTimeline workflow={workflow} />);
  const items = getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(items[1].getAttribute("aria-current")).toBe("step");
  expect(getByText(/Technical Interview/)).toBeTruthy();
  expect(getByText("active")).toBeTruthy();
});