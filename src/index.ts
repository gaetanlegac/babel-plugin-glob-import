/*----------------------------------
- DEPENDANCES
----------------------------------*/

// Node
import path from 'path';
import fs from 'fs';

// Npm
import { PluginObj } from '@babel/core';
import * as types from '@babel/types'
import generate from '@babel/generator';
import micromatch from 'micromatch';

/*----------------------------------
- TYPES: REQUEST
----------------------------------*/

type TRequestBase = {
    source: string,
    from: string
}

type TImportRequest = TRequestBase & {
    type: 'import',
    default?: string,
    specifiers: string[]
}

type TRequireRequest = TRequestBase & {
    type: 'require'
}

type TRequest = TImportRequest | TRequireRequest

/*----------------------------------
- TYPES: TRANSFORMER
----------------------------------*/

type TTransformRule = {
    test: (request: TRequest) => boolean,
    globOnly?: boolean,
    replace: TTransformerFunc,
    debug?: boolean
}

type TTransformerFunc = (
    request: TRequest,
    matches: FileMatch[],
    t: typeof types
) => types.Statement[] | void

type FileMatch = { filename: string, matches: string[] };

type TOptions = {
    debug?: boolean,
    removeAliases?: (source: string) => string
}

/*----------------------------------
- WEBPACK RULE
----------------------------------*/

const ruleBuilder = (options: TOptions, rules: TTransformRule[]) => [Plugin, { ...options, rules }];
export default ruleBuilder;

/*----------------------------------
- PLUGIN
----------------------------------*/

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

function Plugin (babel, { rules, debug, removeAliases }: TOptions & { rules: TTransformRule[] }) {

    const t = babel.types as typeof types;

    const findFiles = (request: TRequest): { 
        transformer?: TTransformRule,
        files: FileMatch[], 
        replace: TTransformerFunc | undefined
    } | null => {

        const containsGlob = request.source.includes('*');

        const matchingRule = rules.find(({ test, globOnly }) => (
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

        const debugRule = debug || matchingRule?.debug;
        let cheminGlob: string = request.source;

        // Chemin relatif => Transformation en absolu
        if (cheminGlob[0] === '.')
            cheminGlob = path.resolve( path.dirname(request.from), request.source );
        // Chemin absolu => Remplacement alias
        else if (removeAliases !== undefined)
            cheminGlob = removeAliases(request.source);

        // If glob, list files in the search directory
        const matchedFiles: FileMatch[] = [];
        const wildcardPos = cheminGlob.indexOf('*');
        if (wildcardPos !== -1) {

            const rootDir = cheminGlob.substring(0, wildcardPos);
            const allfiles = getFiles(rootDir);

            // Find matches + keep captured groups
            debugRule && console.log(`Searching for files matching ${request.source} in directory ${rootDir}`);
            const regex = micromatch.makeRe(cheminGlob, { capture: true });
            for (const file of allfiles) {
                const matches = file.match(regex);
                if (matches) 
                    matchedFiles.push({ filename: file, matches: matches.slice(1) });
            }
            debugRule && console.log('IMPORT GLOB', request.source, '=>', cheminGlob, matchingRule ? 'from rule' : '', matchedFiles)
        }

        return { 
            transformer: matchingRule,
            files: matchedFiles, 
            replace: matchingRule?.replace 
        };
     }

    const plugin: PluginObj<{ fichier: string }> = {
        pre(state) {
            this.fichier = state.opts.filename as string;
        },
        visitor: {

            // require("path")
            CallExpression(instruction) {

                const { callee, arguments: args } = instruction.node;
                if (!(
                    callee.type === "Identifier" && callee.name === 'require' 
                    && 
                    args.length === 1 && args[0].type === "StringLiteral"
                ))
                    return;

                const chemin = args[0].value;

                // Glob
                const unresolvedRequest: TRequireRequest = {
                    type: 'require',
                    source: chemin,
                    from: this.fichier
                };
                const result = findFiles(unresolvedRequest);
                if (result === null) return;
                const { replace, files } = result

                let replacement: types.Node[] | void;
                if (replace !== undefined)
                    replacement = replace(unresolvedRequest, files, t);

                if (replacement === undefined) {

                    replacement = files.map(fichier => t.callExpression(
                        t.identifier('require'),
                        [t.stringLiteral(fichier.filename)]
                    ))

                }

                const debugRule = debug || result.transformer?.debug;
                (debugRule && replacement) && console.log(
                    generate(instruction.node).code,
                    '=>',
                    // @ts-ignore (TODO: to solve)
                    generate( t.program(replacement) ).code,
                );

                instruction.replaceWithMultiple(replacement);

            },

            ImportDeclaration(instruction) {

                const chemin = instruction.node.source.value;

                // Référe,ncement des noms à importer
                let importDefault: string | undefined = undefined;
                let importClassique: string[] = []
                let importAll: boolean = false;
                for (const specifier of instruction.node.specifiers) {

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

                        importDefault = specifier.local.name;

                    /*
                        import { notifications, inscription } from '@/earn/serveur/emails/*.hbs';
                        =>
                        import notifications from '@/earn/serveur/emails/notifications.hbs';
                        import inscription from '@/earn/serveur/emails/inscription.hbs';
                    */
                    } else if (specifier.type === 'ImportSpecifier') {

                        importClassique.push( specifier.local.name );

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

                        importDefault = specifier.local.name;
                        importAll = true;

                    }

                }
                const request: TImportRequest = {
                    type: 'import',
                    source: chemin,
                    from: this.fichier,
                    default: importDefault,
                    specifiers: importClassique
                };

                const result = findFiles(request);
                if (result === null) return;
                const { replace, files } = result

                let replacement: types.Statement[] | void;
                if (replace !== undefined)
                    replacement = replace(request, files, t);

                if (replacement === undefined) {

                    // Recup liste files disponibles et création des importations
                    let nomImports: [string, string][] = []
                    replacement = [];
                    
                    for (const fichier of files) {

                        /// Exclusion du fichier actuel
                        if (fichier.filename === this.fichier)
                            continue;

                        // import <chemin>
                        if (instruction.node.specifiers.length === 0) {

                            replacement.push(
                                t.importDeclaration(
                                    [],
                                    t.stringLiteral(fichier.filename)
                                )
                            );

                        } else {

                            // Création nom d'importation via le nom du fichier
                            const posSlash = fichier.filename.lastIndexOf('/') + 1;
                            const posExt = fichier.filename.lastIndexOf('.');
                            const nomFichier = fichier.filename.substring(
                                posSlash,
                                posExt > posSlash ? posExt : undefined
                            )
                            const nomFichierPourImport = fichier.matches.join('_')

                            //console.log({ posSlash, posExt, length: fichier.length, nomFichier });
                            
                            let nomImport: string;
                            // import <nom> from <chemin>
                            if (importClassique.includes( nomFichier ))
                                nomImport = nomFichierPourImport;
                            // import <prefixe>_<nom> from <chemin>
                            else if (importDefault !== undefined) {
                                nomImport = importDefault + '_' + nomFichierPourImport.replace(
                                    /[ \/]/g, '_'
                                );
                                nomImports.push([nomImport, nomFichierPourImport])
                            } else
                                continue;

                            // Création de l'importation
                            replacement.push(
                                t.importDeclaration(
                                    [ importAll
                                        ? t.importNamespaceSpecifier( t.identifier(nomImport) )
                                        : t.importDefaultSpecifier( t.identifier(nomImport) )
                                    ],
                                    t.stringLiteral(fichier.filename)
                                )
                            );

                        }

                    }

                    // Import default
                    if (importDefault !== undefined)
                        replacement.push(
                            t.variableDeclaration('const', [
                                t.variableDeclarator(
                                    t.identifier(importDefault),
                                    t.objectExpression(
                                        nomImports.map(([nomImport, nomFichier]) => t.objectProperty(
                                            t.stringLiteral(nomFichier),
                                            t.identifier(nomImport),
                                        ))
                                    )
                                )
                            ])
                        )
                }

                (debug || result.transformer?.debug) && console.log(
                    generate(instruction.node).code,
                    '=>',
                    replacement ? generate( t.program(replacement) ).code : 'void',
                );
                
                instruction.replaceWithMultiple(replacement);
            }
        }
    };

    return plugin;
}
