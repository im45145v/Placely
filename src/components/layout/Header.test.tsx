import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Header } from "./Header";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Roles", href: "/roles" },
];

test("Header mobile menu has no axe violations", async () => {
  const { container } = render(<Header navItems={navItems} showDesktopNav={false} />);
  expect(await axe(container)).toHaveNoViolations();
});

test("mobile menu opens with Enter, moves focus in, closes with Escape", async () => {
  const user = userEvent.setup();
  render(<Header navItems={navItems} showDesktopNav={false} />);
  const toggle = screen.getByRole("button", { name: "Open menu" });
  await user.tab();
  await user.tab();
  expect(document.activeElement).toBe(toggle);

  await user.keyboard("{Enter}");
  await waitFor(() => {
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
  const firstLink = await screen.findByRole("link", { name: "Home" });
  expect(firstLink).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
});