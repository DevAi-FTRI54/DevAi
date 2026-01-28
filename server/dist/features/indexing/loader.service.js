import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';
import { Project, } from 'ts-morph';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { logger } from '../../utils/logger.js';
/**
 * https://js.langchain.com/docs/tutorials/rag/
 * https://js.langchain.com/docs/tutorials/qa_chat_history/
 * https://www.npmjs.com/package/ts-morph
 */
/* Why we're using a class: https://v03.api.js.langchain.com/classes/langchain.document_loaders_base.BaseDocumentLoader.html
 * 1/ create a new instance of ts-morph (project)
 * 2/ grab the tsconfig file
 * 3/ create new empty doc
 * 4/ get all source files and loop through them
 * 5/ create function that will extract content and metadata and push it to our final array object docs
 * 6/ loop through each file
 * 7/ within each file loop through each function and each class
 */
export class TsmorphCodeLoader extends BaseDocumentLoader {
    repoPath;
    repoId;
    // super() initializes the parent BaseDocumentLoader
    constructor(repoPath, repoId) {
        super();
        this.repoPath = repoPath;
        this.repoId = repoId;
    }
    async load() {
        // STEP 1: Get the tsconfig.json file path
        //! Important: The alternative is to omit the config gile completely
        const tsConfigFilePath = await findTsConfigFile(this.repoPath);
        // STEP 2: Create new instance of ts-morh project
        const projectConfig = {
            skipFileDependencyResolution: true, // skips imports & exports
            skipAddingFilesFromTsConfig: true, // skips node modules
        };
        // Only add tsConfigFilePath if we found one
        if (tsConfigFilePath) {
            projectConfig.tsConfigFilePath = tsConfigFilePath;
            logger.debug(`🔧 Using TypeScript config: ${tsConfigFilePath}`);
        }
        else {
            logger.debug(`🔧 No tsconfig found - using default TypeScript settings`);
        }
        const project = new Project(projectConfig);
        const projectPath = this.repoPath;
        // Add all source files to the project; search recursively in all subdirectories
        // project.addSourceFilesAtPaths(`${projectPath}/**/*.{ts,tsx,js,jsx}`);
        // STEP 2.1: Use glob for better pattern matchin syntax
        // https://www.npmjs.com/package/glob
        const filePaths = glob.sync(`${projectPath}/**/*.{ts,tsx,js,jsx}`, {
            ignore: [
                `${projectPath}/**/node_modules/**`,
                `${projectPath}/**/dist/**`,
            ],
        });
        filePaths.map((file) => project.addSourceFileAtPath(file));
        const sourceFiles = project.getSourceFiles();
        // logger.debug('project file system', { fs: project.getFileSystem() });
        // STEP 3: Load the docs
        /* Document[] - langchain type
        
        {
            pageContent: string;   // the chunk text
            metadata: Record<string, any>; // arbitrary JSON
        }
    
        */
        const docs = [];
        sourceFiles.forEach((sourceFile) => {
            // STEP 3.1: First add ENTIRE file content
            docs.push(new Document({
                pageContent: sourceFile.getFullText(),
                metadata: {
                    repoId: this.repoId,
                    filePath: sourceFile.getFilePath(),
                    declarationName: path.basename(sourceFile.getFilePath()),
                    startLine: sourceFile.getStartLineNumber(true),
                    endLine: sourceFile.getEndLineNumber(),
                },
            }));
            // STEP 3.2: Second add individual functions and classes
            const addDoc = (node) => {
                // Grab start & end lines
                const start = node.getStartLineNumber(true);
                const end = node.getEndLineNumber();
                // For each source file, push new document containing both content and metadata.
                // Metatada format: filepath - declarationName - startLine - endLine
                docs.push(new Document({
                    pageContent: node.getFullText(),
                    metadata: {
                        repoId: this.repoId,
                        filePath: sourceFile.getFilePath(),
                        declarationName: node.getName() ?? '<anonymous>',
                        startLine: start,
                        endLine: end,
                    },
                }));
            };
            // For each source file, get all functions and classess
            // Pass both as "nodes" into the addDoc func
            sourceFile.getFunctions().forEach(addDoc);
            sourceFile.getClasses().forEach(addDoc);
        });
        return docs;
    }
}
// Identify the exact location of the tsconfig.json
async function findTsConfigFile(repoPath) {
    // Not exhaustive but should suffice is in 90%+ of the cases
    const possiblePaths = [
        path.join(repoPath, 'tsconfig.json'),
        path.join(repoPath, 'src', 'tsconfig.json'),
        path.join(repoPath, 'server', 'tsconfig.json'),
        path.join(repoPath, 'client', 'tsconfig.json'),
        path.join(repoPath, 'server', 'src', 'tsconfig.json'),
        path.join(repoPath, 'client', 'src', 'tsconfig.json'),
    ];
    for (const path of possiblePaths) {
        try {
            await fs.access(path);
            logger.debug(`Found tsconfig.json: ${path}`);
            return path;
        }
        catch (err) {
            continue;
        }
    }
    logger.debug(`⚠️  No tsconfig.json found in repository: ${repoPath}`);
    return null;
}
