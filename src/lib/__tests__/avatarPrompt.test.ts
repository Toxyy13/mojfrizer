import { describe, expect, it } from "vitest";
import { roleSeesAvatarPrompt } from "../avatarPrompt";

describe("roleSeesAvatarPrompt", () => {
  it("shows the reminder to customers only", () => {
    expect(roleSeesAvatarPrompt("CLIENT")).toBe(true);
    expect(roleSeesAvatarPrompt("ADMIN")).toBe(false);
    expect(roleSeesAvatarPrompt("WORKER")).toBe(false);
    expect(roleSeesAvatarPrompt("DEVELOPER")).toBe(false);
  });
});
