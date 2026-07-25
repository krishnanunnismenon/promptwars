import React from "react";
import { render, screen } from "@testing-library/react";
import { HELPLINES, Helplines } from "@/components/Helplines";

describe("Helplines Component", () => {
  it("renders urgent helpline info accurately", () => {
    render(<Helplines />);
    expect(screen.getByText("If it's urgent")).toBeInTheDocument();
    expect(screen.getByText("Tele-MANAS")).toBeInTheDocument();
    expect(screen.getByText("1800-89-14416")).toBeInTheDocument();
  });

  it("has valid telephone link hrefs", () => {
    render(<Helplines />);
    const link = screen.getByRole("link", { name: /tele-manas/i });
    expect(link).toHaveAttribute("href", `tel:${HELPLINES[0].tel}`);
  });
});
