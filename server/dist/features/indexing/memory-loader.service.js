// In-memory code loader that works with GitHub API content
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';
import { Project, ScriptTarget, ClassDeclaration, } from 'ts-morph';
import path from 'path';
/**
 * Code loader that works with in-memory content from GitHub API
 * instead of cloned local files
 */
export class InMemoryCodeLoader extends BaseDocumentLoader {
    files;
    repoId;
    repoName;
    constructor(files, repoId, repoName) {
        super();
        this.files = files;
        this.repoId = repoId;
        this.repoName = repoName;
    }
    async load() {
        console.log(`🔄 Processing ${this.files.length} files in memory...`);
        // Create an in-memory ts-morph project
        const project = new Project({
            compilerOptions: {
                target: ScriptTarget.ES2020,
                allowJs: true,
                skipLibCheck: true,
            },
            useInMemoryFileSystem: true, // This is key for production!
            skipFileDependencyResolution: true,
            skipAddingFilesFromTsConfig: true,
        });
        // Add all files to the in-memory project
        this.files.forEach((file) => {
            try {
                project.createSourceFile(file.path, file.content, {
                    overwrite: true,
                });
            }
            catch (error) {
                console.warn(`⚠️ Failed to parse ${file.path}:`, error);
            }
        });
        const sourceFiles = project.getSourceFiles();
        console.log(`📝 Successfully parsed ${sourceFiles.length} files`);
        const docs = [];
        sourceFiles.forEach((sourceFile) => {
            try {
                // Add entire file content as a document
                const filePath = sourceFile.getFilePath();
                console.log('🔍 InMemoryCodeLoader adding file with path:', filePath);
                docs.push(new Document({
                    pageContent: sourceFile.getFullText(),
                    metadata: {
                        repoId: this.repoId,
                        repoName: this.repoName,
                        filePath: filePath,
                        declarationName: path.basename(filePath),
                        startLine: 1,
                        endLine: sourceFile.getEndLineNumber(),
                        fileSize: sourceFile.getFullText().length,
                    },
                }));
                // Add individual functions and classes
                const addDeclaration = (node) => {
                    try {
                        const start = node.getStartLineNumber(true);
                        const end = node.getEndLineNumber();
                        const name = node.getName() ?? '<anonymous>';
                        docs.push(new Document({
                            pageContent: node.getFullText(),
                            metadata: {
                                repoId: this.repoId,
                                repoName: this.repoName,
                                filePath: sourceFile.getFilePath(),
                                declarationName: name,
                                startLine: start,
                                endLine: end,
                                declarationType: node instanceof ClassDeclaration ? 'class' : 'function',
                            },
                        }));
                    }
                    catch (error) {
                        console.warn(`⚠️ Failed to process declaration in ${sourceFile.getFilePath()}:`, error);
                    }
                };
                // Extract functions and classes
                sourceFile.getFunctions().forEach(addDeclaration);
                sourceFile.getClasses().forEach(addDeclaration);
            }
            catch (error) {
                console.warn(`⚠️ Failed to process ${sourceFile.getFilePath()}:`, error);
            }
        });
        console.log(`✅ Generated ${docs.length} documents from ${this.files.length} files`);
        return docs;
    }
}
