# Babel Glob Import

Babel plugin to import multiple files from one import statement using [glob patterns](https://github.com/micromatch/micromatch?tab=readme-ov-file#matching-features).

[![npm](https://img.shields.io/npm/v/babel-plugin-glob-import)](https://www.npmjs.com/package/babel-plugin-glob-import) [![npm](https://img.shields.io/npm/dw/babel-plugin-glob-import)](https://www.npmjs.com/package/babel-plugin-glob-import)

## Installation

```bash
npm i --save-dev babel-plugin-glob-import
```

## Setup

```typescript
// Import the plugin
import BabelGlobImport from 'babel-plugin-glob-import';

// Initialize the glob import Babel plugin
const babelGlobImport = BabelGlobImport({ 
    // (Optional): You can set it to true if you need debugging
    //  It will help you to better understand the different transformation steps, 
    //      and will print the output code in the logs
    debug: boolean,
})
```

## Usage by examples

Let consider that the folder `@server/routes` contains the following files:
- `index.ts`
- `file1.ts`
- `file2.ts`
- `users/`
  - `index.ts`
  - `user1.ts`
  - `auth/`
    - `google.ts`
    - `facebook.ts`
    - `file-a1.ts`
    - `file-a2.ts`
- `admin/`
  - `index.ts`
  - `settings.ts`

For all the examples below, we assume that these files export a `Function`.

### How to use glob patterns

Glob patterns are used to match multiple files based on specific rules. Here are the key features and their uses, adapted to the example folder structure:

- **Wildcards**:
  - `*.ts` matches all `.ts` files in the `@server/routes` directory.
    ```typescript
    import routes from '@server/routes/*.ts';
    // Matches: index.ts, file1.ts, file2.ts
    ```
  - `**/*.ts` matches all `.ts` files in `@server/routes` and its subdirectories.
    ```typescript
    import routes from '@server/routes/**/*.ts';
    // Matches: index.ts, file1.ts, file2.ts, users/index.ts, users/user1.ts, users/auth/google.ts, users/auth/facebook.ts, users/auth/file-a1.ts, users/auth/file-a2.ts, admin/index.ts, admin/settings.ts
    ```

- **Negation**:
  - `!users/*.ts` matches all `.ts` files except those in the `users` directory.
    ```typescript
    import routes from '@server/routes/!users/*.ts';
    // Matches: index.ts, file1.ts, file2.ts, admin/index.ts, admin/settings.ts
    ```
  - `*!(index).ts` matches all `.ts` files except `index.ts`.
    ```typescript
    import routes from '@server/routes/*!(index).ts';
    // Matches: file1.ts, file2.ts
    ```

- **Extglobs** (extended globbing):
  - `+(users|admin)` matches the `users` and `admin` directories.
    ```typescript
    import routes from '@server/routes/+(users|admin)/**/*.ts';
    // Matches: users/index.ts, users/user1.ts, users/auth/google.ts, users/auth/facebook.ts, users/auth/file-a1.ts, users/auth/file-a2.ts, admin/index.ts, admin/settings.ts
    ```
  - `!(auth)` matches everything except the `auth` directory.
    ```typescript
    import routes from '@server/routes/users/!(auth)/**/*.ts';
    // Matches: users/index.ts, users/user1.ts
    ```

- **POSIX character classes**:
  - `[[:alpha:][:digit:]]` matches any alphabetic or numeric character. For example, to match files with alphabetic or numeric names.
    ```typescript
    import routes from '@server/routes/[[:alpha:][:digit:]]/**/*.ts';
    // Matches: index.ts, file1.ts, file2.ts, users/index.ts, users/user1.ts, admin/index.ts, admin/settings.ts
    ```

- **Brace expansion**:
  - Example: `foo/{1..5}.ts` matches `foo/1.ts`, `foo/2.ts`, `foo/3.ts`, `foo/4.ts`, and `foo/5.ts`.
  - Example: `bar/{a,b,c}.ts` matches `bar/a.ts`, `bar/b.ts`, and `bar/c.ts`.
    ```typescript
    import routes from '@server/routes/{index,users/auth/google}.ts';
    // Matches: index.ts, users/auth/google.ts
    ```

- **Regex character classes**:
  - Example: `foo-[1-5].ts` matches `foo-1.ts`, `foo-2.ts`, `foo-3.ts`, `foo-4.ts`, and `foo-5.ts`.
    ```typescript
    import routes from '@server/routes/users/auth/file-[a1-a2].ts';
    // Matches: users/auth/file-a1.ts, users/auth/file-a2.ts
    ```

- **Regex logical "or"**:
  - Example: `foo/(abc|xyz).ts` matches `foo/abc.ts` and `foo/xyz.ts`.
    ```typescript
    import routes from '@server/routes/users/auth/(google|facebook).ts';
    // Matches: users/auth/google.ts, users/auth/facebook.ts
    ```

These patterns can be combined and used to create powerful matching rules for your file import statements, allowing for flexible and efficient module imports.

### The different ways to import modules

This plugin provides four different ways to import these files in one shot via glob patterns:

#### 1. Import default

Import the default export of every file into one object.

```typescript
import routes from '@server/routes/**/*.ts';
```

```typescript
> console.log(routes)
{
    'index': Function,
    'file1': Function,
    'file2': Function,
    'users/index': Function,
    'users/user1': Function,
    'users/auth/google': Function,
    'users/auth/facebook': Function,
    'users/auth/file-a1': Function,
    'users/auth/file-a2': Function,
    'admin/index': Function,
    'admin/settings': Function
}
```

**With metadatas:**

In addition of the modules, you can get the metadata of each import by prefixing the glob expression by `metas:`.

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
    'file1': {
        filename: '/root/server/routes/file1.ts',
        matches: [undefined, 'file1'],
        exports: Function
    },
    'file2': {
        filename: '/root/server/routes/file2.ts',
        matches: [undefined, 'file2'],
        exports: Function
    },
    'users/index': {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: Function
    },
    'users/user1': {
        filename: '/root/server/routes/users/user1.ts',
        matches: ['users', 'user1'],
        exports: Function
    },
    'users/auth/google': {
        filename: '/root/server/routes/users/auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: Function
    },
    'users/auth/facebook': {
        filename: '/root/server/routes/users/auth/facebook.ts',
        matches: ['users', 'auth', 'facebook'],
        exports: Function
    },
    'users/auth/file-a1': {
        filename: '/root/server/routes/users/auth/file-a1.ts',
        matches: ['users', 'auth', 'file-a1'],
        exports: Function
    },
    'users/auth/file-a2': {
        filename: '/root/server/routes/users/auth/file-a2.ts',
        matches: ['users', 'auth', 'file-a2'],
        exports: Function
    },
    'admin/index': {
        filename: '/root/server/routes/admin/index.ts',
        matches: ['admin', 'index'],
        exports: Function
    },
    'admin/settings': {
        filename: '/root/server/routes/admin/settings.ts',
        matches: ['admin', 'settings'],
        exports: Function
    }
}
```

#### 2. Import all (Typescript)

Import all exports of every module into one object.

```typescript
import * as routes from '@server/routes/**/*.ts';
```
```typescript
> console.log(routes)
{
    'index': { default: Function },
    'file1': { default: Function },
    'file2': { default: Function },
    'users/index': { default: Function },
    'users/user1': { default: Function },
    'users/auth/google': { default: Function },
    'users/auth/facebook': { default: Function },
    'users/auth/file-a1': { default: Function },
    'users/auth/file-a2': { default: Function },
    'admin/index': { default: Function },
    'admin/settings': { default: Function }
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
        filename: '/root/server/routes/index

.ts',
        matches: [undefined, 'index'],
        exports: { default: Function }
    },
    'file1': {
        filename: '/root/server/routes/file1.ts',
        matches: [undefined, 'file1'],
        exports: { default: Function }
    },
    'file2': {
        filename: '/root/server/routes/file2.ts',
        matches: [undefined, 'file2'],
        exports: { default: Function }
    },
    'users/index': {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: { default: Function }
    },
    'users/user1': {
        filename: '/root/server/routes/users/user1.ts',
        matches: ['users', 'user1'],
        exports: { default: Function }
    },
    'users/auth/google': {
        filename: '/root/server/routes/users/auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: { default: Function }
    },
    'users/auth/facebook': {
        filename: '/root/server/routes/users/auth/facebook.ts',
        matches: ['users', 'auth', 'facebook'],
        exports: { default: Function }
    },
    'users/auth/file-a1': {
        filename: '/root/server/routes/users/auth/file-a1.ts',
        matches: ['users', 'auth', 'file-a1'],
        exports: { default: Function }
    },
    'users/auth/file-a2': {
        filename: '/root/server/routes/users/auth/file-a2.ts',
        matches: ['users', 'auth', 'file-a2'],
        exports: { default: Function }
    },
    'admin/index': {
        filename: '/root/server/routes/admin/index.ts',
        matches: ['admin', 'index'],
        exports: { default: Function }
    },
    'admin/settings': {
        filename: '/root/server/routes/admin/settings.ts',
        matches: ['admin', 'settings'],
        exports: { default: Function }
    }
}
```
      
#### 3. Import with destructuration

Import the default export of every module separately.

```typescript
import { index, file1, file2, users_index, users_user1, users_auth_google, users_auth_facebook, users_auth_file_a1, users_auth_file_a2, admin_index, admin_settings } from '@server/routes/**/*.ts';
```
```typescript
> console.log({ index, file1, file2, users_index, users_user1, users_auth_google, users_auth_facebook, users_auth_file_a1, users_auth_file_a2, admin_index, admin_settings })
{
    'index': Function,
    'file1': Function,
    'file2': Function,
    'users_index': Function,
    'users_user1': Function,
    'users_auth_google': Function,
    'users_auth_facebook': Function,
    'users_auth_file_a1': Function,
    'users_auth_file_a2': Function,
    'admin_index': Function,
    'admin_settings': Function
}
```    

**With metadatas:**

```typescript
import { index, file1, file2, users_index, users_user1, users_auth_google, users_auth_facebook, users_auth_file_a1, users_auth_file_a2, admin_index, admin_settings } from 'metas:@server/routes/**/*.ts';
```
```typescript
> console.log({ index, file1, file2, users_index, users_user1, users_auth_google, users_auth_facebook, users_auth_file_a1, users_auth_file_a2, admin_index, admin_settings })
{
    'index': {
        filename: '/root/server/routes/index.ts',
        matches: [undefined, 'index'],
        exports: Function
    },
    'file1': {
        filename: '/root/server/routes/file1.ts',
        matches: [undefined, 'file1'],
        exports: Function
    },
    'file2': {
        filename: '/root/server/routes/file2.ts',
        matches: [undefined, 'file2'],
        exports: Function
    },
    'users_index': {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: Function
    },
    'users_user1': {
        filename: '/root/server/routes/users/user1.ts',
        matches: ['users', 'user1'],
        exports: Function
    },
    'users_auth_google': {
        filename: '/root/server/routes/users/auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: Function
    },
    'users_auth_facebook': {
        filename: '/root/server/routes/users/auth/facebook.ts',
        matches: ['users', 'auth', 'facebook'],
        exports: Function
    },
    'users_auth_file_a1': {
        filename: '/root/server/routes/users/auth/file-a1.ts',
        matches: ['users', 'auth', 'file-a1'],
        exports: Function
    },
    'users_auth_file_a2': {
        filename: '/root/server/routes/users/auth/file-a2.ts',
        matches: ['users', 'auth', 'file-a2'],
        exports: Function
    },
    'admin_index': {
        filename: '/root/server/routes/admin/index.ts',
        matches: ['admin', 'index'],
        exports: Function
    },
    'admin_settings': {
        filename: '/root/server/routes/admin/settings.ts',
        matches: ['admin', 'settings'],
        exports: Function
    }
}
``` 

#### 4. Require

```typescript
const routes = require("@server/routes/**/*.ts");
```
```typescript
> console.log(routes)
[
    Function,
    Function,
    Function,
    Function,
    Function,
    Function,
    Function,
    Function,
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
        filename: '/root/server/routes/file1.ts',
        matches: [undefined, 'file1'],
        exports: Function
    },
    {
        filename: '/root/server/routes/file2.ts',
        matches: [undefined, 'file2'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/index.ts',
        matches: ['users', 'index'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/user1.ts',
        matches: ['users', 'user1'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/auth/google.ts',
        matches: ['users', 'auth', 'google'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/auth/facebook.ts',
        matches: ['users', 'auth', 'facebook'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/auth/file-a1.ts',
        matches: ['users', 'auth', 'file-a1'],
        exports: Function
    },
    {
        filename: '/root/server/routes/users/auth/file-a2.ts',
        matches: ['users', 'auth', 'file-a2'],
        exports: Function
    },
    {
        filename: '/root/server/routes/admin/index.ts',
        matches: ['admin', 'index'],
        exports: Function
    },
    {
        filename: '/root/server/routes/admin/settings.ts',
        matches: ['admin', 'settings'],
        exports: Function
    }
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
        // The files

 that were matched by the importation request
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

    // (Optional) Giving a name to your transformer will make debugging easier
    name: 'Models import shortcut',

    // Match the import we want to replace 
    test: (request) => (
        // import
        request.type === 'import' 
        && 
        // models
        request.imported.type === 'default'
        && 
        // from '@models';
        request.source === '@models' 
    ),

    // If matched, replace it
    replace: (request, matches, t) => {
        // import
        return t.importDeclaration(
            // models
            [t.importDefaultSpecifier( t.identifier( request.imported.name ))],
            // from "@server/models/index.ts";
            t.stringLiteral("@server/models/index.ts")
        )
    }
}])
```

## Changelog

### 15/07/2024

- Added support for using regex and other shortcuts in glob patterns

### 28/06/2024

- Fixed potential naming conflict between two imports. An error was triggered when you import two different folders having the same structure.

### 13/07/2023

- Fixed issue with simple imports without specifiers
`import 'my/glob/path/*.ts` was crashing

### 07/02/2023

- Fixed issue where generated importation statement was invalid (the imported name was empty)

### 06/01/2023

- Add a comment before an import to debug it. Ex:
```typescript
// @babel-debug
import * from 'metas:./**/*.ts';
```
- Possibility to add a name to each transformer to improve debugging

### 01/01/2023

- Export the plugin factory via module.exports
- Added possibility to get importation metadata (by prefixing the glob path by `metas:`)
- Code cleanup & restructuration
- Fix bad characters in importation names

## TODO

* Cleanup the code
* Improve debugging
* Improve the doc with more examples