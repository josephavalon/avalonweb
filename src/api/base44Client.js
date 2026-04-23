// Presale phase: base44 client is stubbed. No live auth / data backend wired
// until post-launch. Methods throw if invoked so regressions surface loudly.
const notWired = (method) => () => {
  throw new Error(`base44.${method} is not available in the presale build.`);
};

export const base44 = {
  auth: {
    me: notWired('auth.me'),
    logout: notWired('auth.logout'),
    redirectToLogin: notWired('auth.redirectToLogin'),
  },
};
