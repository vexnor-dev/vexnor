import { vi } from "vitest";
import * as valnor from "valnor";

vi.spyOn(valnor, "randomName").mockImplementation((text: string) => {
   return `${text}_1`;
});
