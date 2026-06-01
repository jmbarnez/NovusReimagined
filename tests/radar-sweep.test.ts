import { describe, expect, it } from "vitest";
import { radarPingOpacity, radarSignatureDecayExponent } from "../src/utils/radar-sweep.js";

describe("radar signature decay", () => {
  it("decays large signatures more slowly than small signatures", () => {
    const small = radarSignatureDecayExponent(20);
    const large = radarSignatureDecayExponent(3000);

    expect(large).toBeLessThan(small);

    const sweepAngle = 0;
    const smallOpacity = radarPingOpacity(0, -100, 0, 0, sweepAngle, small);
    const largeOpacity = radarPingOpacity(0, -100, 0, 0, sweepAngle, large);

    expect(largeOpacity).toBeGreaterThan(smallOpacity);
  });
});

