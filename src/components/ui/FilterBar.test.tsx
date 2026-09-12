import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { FilterBar, FilterInput, FilterSelect, FilterButton } from "./FilterBar";

test("FilterBar has no axe violations", async () => {
  const { container } = render(
    <FilterBar>
      <FilterInput aria-label="Search roles" placeholder="Search" />
      <FilterSelect aria-label="Status">
        <option>All</option>
      </FilterSelect>
      <FilterButton aria-label="Clear filters">Clear</FilterButton>
    </FilterBar>
  );
  expect(await axe(container)).toHaveNoViolations();
});
