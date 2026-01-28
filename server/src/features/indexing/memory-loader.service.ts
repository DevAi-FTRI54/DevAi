// In-memory code loader that works with GitHub API content
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';
import {
  Project,
  ScriptTarget,
  FunctionDeclaration,
  ClassDeclaration,
  SourceFile,
} from 'ts-morph';
import path from 'path';
import { logger } from '../../utils/logger.js';

interface GitHubFile {
  path: string;
  content: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

/**
 * Code loader that works with in-memory content from GitHub API
 * instead of cloned local files
 */
export class InMemoryCodeLoader extends BaseDocumentLoader {
  constructor(
    private files: GitHubFile[],
    private repoId: string,
    private repoName: string,
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    logger.info(`🔄 Processing ${this.files.length} files in memory...`);

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
      } catch (error) {
        logger.warn(`⚠️ Failed to parse ${file.path}`, { error });
      }
    });

    const sourceFiles = project.getSourceFiles();
    logger.info(`📝 Successfully parsed ${sourceFiles.length} files`);

    const docs: Document[] = [];

    sourceFiles.forEach((sourceFile: SourceFile) => {
      try {
        // Add entire file content as a document
        const filePath = sourceFile.getFilePath();
        logger.debug('🔍 InMemoryCodeLoader adding file', { filePath });

        docs.push(
          new Document({
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
          }),
        );

        // Add individual functions and classes
        const addDeclaration = (
          node: FunctionDeclaration | ClassDeclaration,
        ) => {
          try {
            const start = node.getStartLineNumber(true);
            const end = node.getEndLineNumber();
            const name = node.getName() ?? '<anonymous>';

            docs.push(
              new Document({
                pageContent: node.getFullText(),
                metadata: {
                  repoId: this.repoId,
                  repoName: this.repoName,
                  filePath: sourceFile.getFilePath(),
                  declarationName: name,
                  startLine: start,
                  endLine: end,
                  declarationType:
                    node instanceof ClassDeclaration ? 'class' : 'function',
                },
              }),
            );
          } catch (error) {
            logger.warn(
              `⚠️ Failed to process declaration in ${sourceFile.getFilePath()}`,
              { error },
            );
          }
        };

        // Extract functions and classes
        sourceFile.getFunctions().forEach(addDeclaration);
        sourceFile.getClasses().forEach(addDeclaration);
      } catch (error) {
        logger.warn(`⚠️ Failed to process ${sourceFile.getFilePath()}`, {
          error,
        });
      }
    });

    logger.info(
      `✅ Generated ${docs.length} documents from ${this.files.length} files`,
    );
    return docs;
  }
}
