// Work around an intermittent ESLint 9 CJS load-order issue on the local
// Node 22 runtime by forcing @eslint/object-schema into the require cache first.
require('@eslint/object-schema');
