// @ts-expect-error — React 19 act() environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress the React act() warning that leaks from async state updates in tests
const originalError = console.error;
console.error = (...args: unknown[]) => {
   if (typeof args[0] === "string" && args[0].includes("not configured to support act")) return;
   originalError(...args);
};
