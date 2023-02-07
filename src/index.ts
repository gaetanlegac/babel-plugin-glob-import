/*----------------------------------
- DEPENDANCES
----------------------------------*/

// Node
import path from 'path';
import fs from 'fs';

// Npm
import { PluginObj, NodePath } from '@babel/core';
import * as types from '@babel/types'
import generate from '@babel/generator';
import micromatch from 'micromatch';

// Internal
import type {

    TOptions,
    ImportTransformer,

    TRequest,
    TImportRequest,
    TImportedElements,
    TRequireRequest, 
    TFoundFiles,

    FileMatch,
    ImportedFile,
    
} from './types';

/*----------------------------------
- TYPES
----------------------------------*/

export type {
    GlobImported,
    GlobImportedWithMetas,
    ImportTransformer
} from './types';

/*----------------------------------
- WEBPACK RULE
----------------------------------*/

const ruleBuilder = (options: TOptions, rules: ImportTransformer[]) => [Plugin, { ...options, rules }];
module.exports = ruleBuilder;
export default ruleBuilder;

/*----------------------------------
- CONST
----------------------------------*/

const LogPrefix = '[babel][glob-imports]';
const MetasPrefix = 'metas:';

export const filenameToImportName = (filename: string) => filename.replace(/[^a-z0-9]/gi, '_') || 'index';
module.exports.filenameToImportName = filenameToImportName;

/*----------------------------------
- PLUGIN
----------------------------------*/
function Plugin (babel, options: TOptions & { rules: ImportTransformer[] }) {

    /*----------------------------------
    - DEFINITION
    ----------------------------------*/
    const t = babel.types as typeof types;
    let currentFile: string;

    const plugin: PluginObj = {
        pre(state) {
            currentFile = state.opts.filename as string;
        },
        visitor: {

            // require("@/server/routes/**/*.ts");
            CallExpression(instruction) {

                return replaceRequire(instruction);

            },

            // import templates from '@/earn/serveur/emails/*.hbs';
            // import { notifications, inscription } from '@/earn/serveur/emails/*.hbs';
            // import * as templates from '@/earn/serveur/emails/*.hbs';
            ImportDeclaration(instruction) {

                return replaceImport(instruction);
            }
        }
    };

    /*----------------------------------
    - REPLACEMENT
    ----------------------------------*/
    function replaceRequire( instruction: NodePath<types.CallExpression> ) {

        const { callee, arguments: args } = instruction.node;

        if (!(
            callee.type === "Identifier" && callee.name === 'require' 
            && 
            args.length === 1 && args[0].type === "StringLiteral"
        ))
            return;

        // Glob
        const request: TRequireRequest = {
            type: 'require',
            source: args[0].value,
            from: currentFile,
            withMetas: false
        };

        // Determine if we have to return metas
        if (request.source.startsWith( MetasPrefix )) {
            request.source = request.source.slice(6);
            request.withMetas = true;
        }

        // Find files matched b the glob expression
        const found = findFiles(request);
        if (found === null) return;
        const { replace, files } = found
        let replacement: types.Statement[] | void;

        // Custom rule
        if (replace !== undefined)
            replacement = replace(request, files, t);

        // Default behavior
        if (replacement === undefined) {
            /* Replace with Metas:
                [
                    {
                        filename: "/server/routes/users/index.ts",
                        matches: ["users", "auth"],
                        exports: require("/server/routes/users/auth.ts")
                    }
                ]
            */
            if (request.withMetas) {
                replacement = [
                    t.expressionStatement( t.arrayExpression(
                        files.map( file => fileMetasObject( file ))
                    ))
                ]
            /*
                Replace without Metas:
                [
                    require("/server/routes/users/auth.ts")
                ]
            */
            } else {
                replacement = [
                    t.expressionStatement( t.arrayExpression(
                        files.map( file => 
                            // require("/server/routes/users/auth.ts"
                            t.callExpression( 
                                t.identifier('require'), 
                                [t.stringLiteral(file.filename)]
                            )
                        )
                    ))
                ]
            }
        }
        
        debugReplacement(instruction, request, found, replacement);

        instruction.replaceWithMultiple(replacement);
    }

    function replaceImport( instruction: NodePath<types.ImportDeclaration> ) {

        // Import request metadata
        const request = getImportRequest(instruction.node);

        // Find files matched b the glob expression
        const found = findFiles(request);
        if (found === null) return;
        const { replace, files } = found
        let replacement: types.Statement[] | void;

        // Custom replacement rule (defined in the plugin options)
        if (replace !== undefined)
            replacement = replace(request, files, t);

        // Default replacement rule
        if (replacement === undefined) {
            
            // Import all the files
            const importations = importfiles(files, request);

            // Combine the imported files in one object
            if (request.imported.type === 'default' || request.imported.type === 'all') {

                const importedfiles = request.withMetas
                    ? importations.files.map( file => t.objectProperty(
                        t.stringLiteral(file.local),
                        fileMetasObject( file, t.identifier(file.local ))
                    ))
                    : importations.files.map( file => t.objectProperty(
                        t.stringLiteral(file.local),
                        t.identifier(file.local),
                    ))

                replacement = [
                    ...importations.declarations,
                    t.variableDeclaration('const', [
                        t.variableDeclarator(
                            t.identifier(request.imported.name),
                            t.objectExpression(importedfiles)
                        )
                    ])
                ]
            }
                
        }

        debugReplacement(instruction, request, found, replacement);
        
        instruction.replaceWithMultiple(replacement);
    }

    function debugReplacement(
        instruction: NodePath<types.CallExpression> | NodePath<types.ImportDeclaration>,
        request: TImportRequest | TRequireRequest,
        found: TFoundFiles,
        replacement: types.Statement[] | void
    ) {

        const hasDebugComment = instruction.node.leadingComments?.find(
            comment => comment.value === ' @babel-debug'
        );

        let debugWhat: string;
        if (hasDebugComment)
            debugWhat = 'import instruction';
        else if (found.transformer?.debug)
            debugWhat = 'transformer' + (found.transformer.name ? ' ' + found.transformer.name : '');
        else if (options.debug)
            debugWhat = 'glob import plugin';
        else return;

        console.log( LogPrefix,
            "Debug " + debugWhat + " in file " + currentFile + '.',

            dbgTitle('Original import:'),
            generate(instruction.node).code,

            dbgTitle('Parsed import:'),
            request,

            dbgTitle('Generated import:'),
            replacement ? generate( t.program(replacement) ).code : 'nothing',
        );
    }

    function dbgTitle( title: string ) {
        return '\n------- ' + title + ' ----------------------\n';
    }

    function getImportRequest( node: types.ImportDeclaration ): TImportRequest {

        let imported: TImportedElements | undefined = undefined;
        for (const specifier of node.specifiers) {

            /*
                import templates from '@/earn/serveur/emails/*.hbs';
                =>
                import templates_notifications from '@/earn/serveur/emails/notifications.hbs';
                import templates_inscription from '@/earn/serveur/emails/inscription.hbs';
                const templates = {
                    notifications: templates_notifications,
                    inscription: templates_inscription,
                }
            */
            if (specifier.type === 'ImportDefaultSpecifier') {

                imported = {
                    type: 'default',
                    name: specifier.local.name
                }

            /*
                import { notifications, inscription } from '@/earn/serveur/emails/*.hbs';
                =>
                import notifications from '@/earn/serveur/emails/notifications.hbs';
                import inscription from '@/earn/serveur/emails/inscription.hbs';
            */
            } else if (specifier.type === 'ImportSpecifier') {

                imported = {
                    type: 'destructuration',
                    names: [specifier.local.name]
                }

            /*
                import * as templates from '@/earn/serveur/emails/*.hbs';
                =>
                import * as templates_notifications from '@/earn/serveur/emails/notifications.hbs';
                import * as templates_inscription from '@/earn/serveur/emails/inscription.hbs';
                const templates = {
                    notifications: templates_notifications,
                    inscription: templates_inscription,
                }
            */
            } else if (specifier.type === 'ImportNamespaceSpecifier') {

                imported = {
                    type: 'all',
                    name: specifier.local.name
                }

            } else {

                console.warn(LogPrefix, `Unsupported import specifier type:`, specifier["type"]);
            }
        }

        // Create import request
        const request: TImportRequest = {
            type: 'import',
            imported: imported,
            source: node.source.value,
            from: currentFile,
            withMetas: false
        }

        // Determine if we have to return metas
        if (request.source.startsWith( MetasPrefix )) {
            request.source = request.source.slice(6);
            request.withMetas = true;
        }

        return request
    }

    function importfiles( files: FileMatch[], request: TImportRequest ) {

        let importedFiles: ImportedFile[] = []
        let importDeclarations: types.Statement[] | void = [];

        for (const file of files) {

            /// Exclusion du file actuel
            if (file.filename === currentFile)
                continue;

            // Import specifiers
            let importSpecifier: types.ImportDeclaration["specifiers"][number];
            const imported = request.imported;
            if (imported !== undefined) {

                // Création nom d'importation via le nom du file
                const posSlash = file.filename.lastIndexOf('/') + 1;
                const posExt = file.filename.lastIndexOf('.');
                const nomFichier = file.filename.substring(
                    posSlash,
                    posExt > posSlash ? posExt : undefined
                )
                const nomFichierPourImport = file.matches.join('_')
                
                // import templates from '@/earn/serveur/emails/*.hbs';
                if (imported.type === 'default') {

                    const importName = /*imported.name + '_' + */filenameToImportName(nomFichierPourImport);

                    importedFiles.push({ 
                        ...file, 
                        imported: nomFichierPourImport, 
                        local: importName
                    })

                    importSpecifier = t.importDefaultSpecifier( 
                        t.identifier(importName) 
                    )
                
                // import * as templates from '@/earn/serveur/emails/*.hbs';
                } else if (imported.type === 'all') {

                    const importName = filenameToImportName(nomFichierPourImport);

                    importedFiles.push({ 
                        ...file, 
                        imported: nomFichierPourImport, 
                        local: importName
                    })

                    importSpecifier = t.importNamespaceSpecifier(
                        t.identifier(importName) 
                    )

                // import { notifications, inscription } from '@/earn/serveur/emails/*.hbs';
                } else if (imported.type === 'destructuration' && imported.names.includes( nomFichier )) {

                    importSpecifier = t.importDefaultSpecifier( 
                        t.identifier(nomFichierPourImport) 
                    );

                } else
                    continue;
            }

            // Création de l'importation
            importDeclarations.push(
                t.importDeclaration(
                    [importSpecifier],
                    t.stringLiteral(file.filename)
                )
            );
        }

        return { files: importedFiles, declarations: importDeclarations }
    }

    /*----------------------------------
    - FILES
    ----------------------------------*/
    function findFiles(request: TRequest): TFoundFiles | null {

        const containsGlob = request.source.includes('*');

        const matchingRule = options.rules.find(({ test, globOnly }) => (
            test(request) 
            && 
            (
                globOnly === false 
                || 
                containsGlob
            )
        ));

        // Nothing to process here
        if (!matchingRule && !containsGlob)
            return null;

        const debugRule = options.debug || matchingRule?.debug;
        let cheminGlob: string = request.source;

        // Chemin relatif => Transformation en absolu
        if (cheminGlob[0] === '.')
            cheminGlob = path.resolve( path.dirname(request.from), request.source );
        // Chemin absolu => Remplacement alias
        else if (options.removeAliases !== undefined)
            cheminGlob = options.removeAliases(request.source);

        // If glob, list files in the search directory
        const matchedFiles: FileMatch[] = [];
        const wildcardPos = cheminGlob.indexOf('*');
        if (wildcardPos !== -1) {

            const rootDir = cheminGlob.substring(0, wildcardPos);
            const allfiles = getFiles(rootDir);

            // Find matches + keep captured groups
            debugRule && console.log(LogPrefix, `Searching for files matching ${request.source} in directory ${rootDir}`);
            const regex = micromatch.makeRe(cheminGlob, { capture: true });
            for (const file of allfiles) {
                const matches = file.match(regex);
                if (matches) 
                    matchedFiles.push({ filename: file, matches: matches.slice(1) });
            }
            debugRule && console.log(LogPrefix, 'IMPORT GLOB', request.source, '=>', cheminGlob, matchingRule ? 'from rule' : '', matchedFiles)
        }

        return { 
            transformer: matchingRule,
            files: matchedFiles, 
            replace: matchingRule?.replace 
        };
    }

    function getFiles( dir: string ) {
        const files: string[] = [];
        const dirents = fs.readdirSync(dir, { withFileTypes: true });
        for (const dirent of dirents) {
            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                files.push(...getFiles(res));
            } else {
                files.push(res);
            }
        }
        return files;
    }

    function fileMetasObject( file: FileMatch, importedIdentifier?: types.Identifier ) {
        return t.objectExpression([

            // filename: "/server/routes/users/auth.ts",
            t.objectProperty(
                t.identifier('filename'), 
                t.stringLiteral( file.filename )
            ),

            // matches: ["users", "auth"],
            t.objectProperty( 
                t.identifier('matches'), 
                t.arrayExpression( file.matches.map( match => match === undefined
                    ? t.identifier('undefined')
                    : t.stringLiteral(match)
                ))
            ),

            // importedIdentifier === undefined
            // exports: require("/server/routes/users/auth.ts")

            // importedIdentifier !== undefined
            // exports: headhunter_auth
            t.objectProperty( 
                t.identifier('exports'), 
                importedIdentifier === undefined
                    ? t.callExpression( 
                        t.identifier('require'), 
                        [t.stringLiteral(file.filename)]
                    )
                    : importedIdentifier
            ),
        ])
    }

    return plugin;
}
