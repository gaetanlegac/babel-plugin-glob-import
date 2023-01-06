import * as types from '@babel/types'

/*----------------------------------
- TYPES: MODULE
----------------------------------*/

export type TOptions = {
    debug?: boolean,
    removeAliases?: (source: string) => string
}

/*----------------------------------
- TYPES: REQUEST
----------------------------------*/

type TRequestBase = {
    source: string,
    from: string,
    withMetas: boolean
}

export type TImportRequest = TRequestBase & {
    type: 'import',
    all: boolean,
    default?: string,
    specifiers: string[]
}

export type TRequireRequest = TRequestBase & {
    type: 'require'
}

export type TRequest = TImportRequest | TRequireRequest

/*----------------------------------
- TYPES: TRANSFORMER
----------------------------------*/

export type ImportTransformer = {
    name?: string,
    test: (request: TRequest) => boolean,
    globOnly?: boolean,
    replace: TransformerFunc,
    debug?: boolean
}

export type TFoundFiles = { 
    transformer?: ImportTransformer,
    files: FileMatch[], 
    replace: TransformerFunc | undefined
}

export type TransformerFunc = (
    request: TRequest,
    matches: FileMatch[],
    t: typeof types
) => types.Statement[] | void

export type FileMatch = { 
    filename: string, 
    matches: (string | undefined)[] 
}

export type ImportedFile = FileMatch & {
    local: string,
    imported: string
}

export type GlobImportedWithMetas<TModuleExports extends any> = (
    FileMatch 
    & 
    {
        exports: TModuleExports
    }
)[]

export type GlobImported<TModuleExports extends any> = TModuleExports[]