# Babel Glob Import

Babel plugin to use glob patterns in import and require statements.

[![npm](https://img.shields.io/npm/v/babel-plugin-glob-import)](https://www.npmjs.com/package/babel-plugin-glob-import) [![npm](https://img.shields.io/npm/dw/babel-plugin-glob-import)](https://www.npmjs.com/package/babel-plugin-glob-import)

/!\ This module is still in testing and may be unstable in several scenarios.

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

## Usage by examples

Let consider that the folder `@server/routes` contains the following files:
- index.ts
- users/
    - index.ts
    - auth/
        google.ts

For this example, we assume that these three .ts files exports a function.

This plugin provides four different ways to import these files in one shot via glob patterns:

### 1. Import default

Import the default export of every module into one object.

```typescript
import routes from '@server/routes/**/*.ts';
```

```typescript
> console.log(routes)
{
    'index': Function,
    'users/index': Function,
    'users/auth/google': Function,
}
```

**With metadatas:**

In addition of the modules, you can get the metadata of each import by prefixing the glob expression by `metas:`:


```typescript
import routes from 'metas:@server/routes/**/*.ts';
```

```typescript
> console.log(routes)
{
    'index': {
        filename: '/root/server/routes/index.ts',
        matches: [undefined, 'index'],
        exports: Function
    },
    'users/index': {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: Function
    },,
    'users/auth/google': {
        filename: '/root/server/routes/users/auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: Function
    },
}
```

### 2. Import all (Typescript)

Import all exports of every module into one object.

```typescript
import * as routes from '@server/routes/**/*.ts';
```
```typescript
> console.log(routes)
{
    'index': { default: Function },
    'users/index': { default: Function },
    'users/auth/google': { default: Function },
}
```

**With metadatas:**

```typescript
import * as routes from 'metas:@server/routes/**/*.ts';
```
```typescript
> console.log(routes)
{
    'index': {
        filename: '/root/server/routes/index.ts',
        matches: [undefined, 'index'],
        exports: { default: Function }
    },
    'users/index': {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: { default: Function }
    },,
    'users/auth/google': {
        filename: '/root/server/routes/users/auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: { default: Function }
    },
}
```
      
### 3. Import with destructuration

Import the default export of every module separately.

```typescript
import { index, users_index, users_auth_google } from '@server/routes/**/*.ts';
```
```typescript
> console.log({ index, users_index, users_auth_google })
{
    'index': Function,
    'users_index': Function,
    'users_auth_google': Function,
}
```    

**With metadatas:**

```typescript
import { index, users_index, users_auth_google } from 'metas:@server/routes/**/*.ts';
```
```typescript
> console.log({ index, users_index, users_auth_google })
{
    'index': {
        filename: '/root/server/routes/index.ts',
        matches: [undefined, 'index'],
        exports: Function
    },
    'users_index': {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: Function
    },,
    'users_auth_google': {
        filename: '/root/server/routes/users, auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: Function
    },
}
``` 

### 4. Require

```typescript
const routes = require("@server/routes/**/*.ts");
```
```typescript
> console.log(routes)
[
    Function,
    Function,
    Function
]
```  

**With metadatas:**

```typescript
const routes = require("metas:@server/routes/**/*.ts");
```
```typescript
> console.log(routes)
[
    {
        filename: '/root/server/routes/index.ts',
        matches: [undefined, 'index'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: Function
    },
]
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
declare module "@server/routes/**/*.ts" {

    const Route: import("@server/services/router").Route;

    export = Route;
}
```

If you imports metadatas, you can use the `GlobImportedWithMetas` generic:

```typescript
declare module "metas:@server/routes/**/*.ts" {

    const Route: import("@server/services/router").Route;
    const GlobImportedWithMetas: import('babel-plugin-glob-import').GlobImportedWithMetas;

    export = GlobImportedWithMetas<Route>;
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

## Changelog

### 01/01/2023

- Export the plugin factory via module.exports
- Added possibility to get importation metadata (by prefixing the glob path by `metas:`)
- Code clearnup & restructuration
- Fix bad characters in importation names

## TODO

* Cleanup the code
* Improve debugging
* Improve the doc with more examples