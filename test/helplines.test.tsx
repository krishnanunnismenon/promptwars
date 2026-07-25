import React from "react";
import { render, screen } from "@testing-library/react";
import { HELPLINES, Helplines } from "@/components/Helplines";

describe("Helplines Component", () => {
  it("renders urgent helpline info accurately", () => {
    render(<Helplines />);
    expect(screen.getByText("If it's urgent")).toBeInTheDocument();
    expect(screen.getByText("Kiran")).toBeInTheDocument();
    expect(screen.getByText("1800-599-0019")).toBeInTheDocument();
  });

  it("has valid telephone link hrefs", () => {
    render(<Helplines />);
    const link = screen.getByRole("link", { name: /kiran/i });
    expect(link).toHaveAttribute("href", `tel:${HELPLINES[0].tel}`);
  });
});
