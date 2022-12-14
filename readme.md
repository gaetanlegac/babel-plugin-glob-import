# Babel Glob Import

Babel plugin to import multiple modules with one import statement thanks to glob patterns.

[![npm](https://img.shields.io/npm/v/babel-plugin-glob-import)](https://www.npmjs.com/package/babel-plugin-glob-import)

## Installation

```bash
npm i --save-dev babel-plugin-glob-import
```

## Setup

```typescript
// Import the plugin
import BabelGlobImport from 'babel-plugin-glob-import';

// Iitialize the glob import Babel plugin
const babelGlobImport = BabelGlobImport({ 
    // (Optional): You can set it to true if you need debugging
    //  It will help you to better understand the different transformation steps, 
    //      and will print the output code in the logs
    debug: boolean,
})
```

## Types of importation

### 1. Import the default export of every module into one object

Input:
```typescript
import services from '@server/services/**.ts';
```
Output:
```typescript
import services_onboarding from '@server/services/onboarding.ts';
import services_notifications from '@server/services/notifications.ts';
const services = {
    onboarding: services_onboarding,
    notifications: services_notifications,
}
```

### 2. Import all exports of every module into one object

Input:
```typescript
import * as templates from '@/earn/serveur/emails/*.hbs';
```
Output:
```typescript
import * as templates_notifications from '@/earn/serveur/emails/notifications.hbs';
import * as templates_inscription from '@/earn/serveur/emails/inscription.hbs';
const templates = {
    notifications: templates_notifications,
    inscription: templates_inscription,
}
```
      

### 3. Import the default export of every module separately

Input:
```typescript
import { onboarding, notifications } from '@server/services/**.ts';
```
Output:
```typescript
import onboarding from '@server/services/onboarding.ts';
import notifications from '@server/services/notifications.ts';
```                  

## Setup example with Webpack

```typescript
// Import the plugin
import BabelGlobImport from 'babel-plugin-glob-import';

// Define rules for Javascript files
const JavascriptRules = {
    test: /\.(ts|tsx|js|jsx)$/,
    rules: [{
        // Configure Babel
        loader: 'babel-loader',
        options: { 
            plugins: [
                
                // Add the glob import Babel plugin
                BabelGlobImport({ 
                    debug: true,
                })
            ]
        }
    }]
}

// Export Webpack compilation configuration
module.exports = {

    name: 'server',
    target: 'node',
    entry: './src/server/index.ts',

    ...

    module: {
        rules: [JavascriptRules]
    }
}
```

## Fix Typescript errors

Typescript will not recognize your glob importations statements, and will show show you errors about missing files.
To fix that, you have to create a type definitions file (ex: `global.d.ts`) and to manually define typings for the imported glob into this file:

```typescript
declare module "@client/pages/\*.tsx" {
    const value: import("../client/router/page").Page;
    export = value;
}
```

## Importation transformers

This plugin also allows you to transform importation statements.

You can define a list of custom transformation rules while initializing the plugin:

```typescript
BabelGlobImport({ 
    debug: boolean,
}, [{
    // A function where you put the conditions to test for matching the 
    test: (request: TUnresolvedRequest) => boolean,
    // A function where you return by which statements 
    replace: (
        // The importation request (ex: ./src/server/models/**.ts)
        request: TRequest,
        // The files that were matched by the importation request
        matches: FileMatch[],
        // Access to babel's methods to create new statements
        t: typeof types
    ) => types.Statement[] | void
}])
```

### Example

This example replaces `import models from "@models"` by `import models from "@server/models/index.ts";`

```typescript
BabelGlobImport({ }, [{
    // import 
    test: (request) => (
        // import
        request.type === 'import' 
        && 
        // models
        request.default !== undefined
        && 
        // from '@models';
        request.source === '@models' 
    ),
    // We replace 
    replace: (request, matches, t) => {
        // import
        return t.importDeclaration(
            // models
            [t.importDefaultSpecifier( t.identifier(request.default) )],
            // from "@server/models/index.ts";
            t.stringLiteral("@server/models/index.ts")
        )
    }
}])
```