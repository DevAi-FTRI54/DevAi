// import React, { useState, useEffect } from 'react';
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
// import DynamicBreadcrumbs from '../../components/viewer/breadcrumbs/breadcrumbs';
// import type { GithubFile, RepoViewerProps } from '../../types';

// const RepoViewer: React.FC<RepoViewerProps> = ({ repoUrl, selectedPath, setSelectedPath }) => {
//   const [fileData, setFileData] = useState<GithubFile[] | null>(null);
//   const [fileContent, setFileContent] = useState<string | null>(null);

//   useEffect(() => {
//     async function fetchRepoData() {
//       try {
//         const response = await fetch(`https://api.github.com/repos/${repoUrl}/contents/${selectedPath}`);
//         const data = await response.json();

//         if (Array.isArray(data)) {
//           setFileData(data);
//           setFileContent(null);
//         } else if (data.type === 'file' && data.download_url) {
//           const contentRes = await fetch(data.download_url);
//           const content = await contentRes.text();
//           setFileContent(content);
//           setFileData(null);
//         }
//       } catch (error) {
//         console.error('Error fetching repo data:', error);
//       }
//     }

//     if (selectedPath) {
//       fetchRepoData();
//     }
//   }, [repoUrl, selectedPath]);

//   async function fetchFileContent(fileUrl: string) {
//     try {
//       const response = await fetch(fileUrl);
//       const content = await response.text();
//       setFileContent(content);
//     } catch (error) {
//       console.error('Error fetching file content:', error);
//     }
//   }

//   function renderDirectory(items: GithubFile[]) {
//     return (
//       <ul className="pl-4 space-y-1">
//         {items.map((item) => (
//           <li key={item.sha}>
//             {item.type === 'dir' ? (
//               <strong className="text-blue-400">{item.name} (dir)</strong>
//             ) : (
//               <span
//                 className="cursor-pointer text-blue-500 hover:underline"
//                 onClick={() => item.download_url && fetchFileContent(item.download_url)}
//               >
//                 {item.name}
//               </span>
//             )}
//           </li>
//         ))}
//       </ul>
//     );
//   }

//   function getLanguage(filename: string): string {
//     if (filename.endsWith('.js')) return 'javascript';
//     if (filename.endsWith('.jsx')) return 'jsx';
//     if (filename.endsWith('.ts')) return 'typescript';
//     if (filename.endsWith('.tsx')) return 'tsx';
//     if (filename.endsWith('.json')) return 'json';
//     if (filename.endsWith('.css')) return 'css';
//     if (filename.endsWith('.md')) return 'markdown';
//     if (filename.endsWith('.py')) return 'python';
//     return 'text';
//   }

//   function getBreadcrumbParts(path: string): string[] {
//     const segments = path.split('/');
//     const hashIndex = segments.findIndex((s) => /^[a-f0-9]{40}$/.test(s));
//     return hashIndex >= 0 ? segments.slice(hashIndex + 1) : segments;
//   }

//   function handleBreadcrumbClick(index: number) {
//     const parts = getBreadcrumbParts(selectedPath);
//     const newPath = parts.slice(0, index + 1).join('/');
//     setSelectedPath(newPath);
//     setFileContent(null);
//   }

//   return (
//     <div className="w-full">
//       {selectedPath && (
//         <div className="mb-3">
//           <div className="text-xs font-bold text-gray-400 mb-1">Path:</div>
//           <DynamicBreadcrumbs path={getBreadcrumbParts(selectedPath)} onClick={handleBreadcrumbClick} />
//         </div>
//       )}

//       {fileData && renderDirectory(fileData)}

//       {fileContent && (
//         <div className="mt-4">
//           <div className="rounded-lg overflow-hidden border border-[#39415a] bg-[#161b2a]">
//             <SyntaxHighlighter
//               language={getLanguage(selectedPath)}
//               style={coy}
//               customStyle={{ margin: 0, background: 'transparent', fontSize: 14 }}
//               wrapLongLines
//               showLineNumbers
//             >
//               {fileContent}
//             </SyntaxHighlighter>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default RepoViewer;

import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DynamicBreadcrumbs from '../../components/viewer/breadcrumbs/breadcrumbs';
import ChatMarkdown from '../../components/chat/chatmarkdown';

import type { GithubFile, RepoViewerProps } from '../../types';

const FilePreview: React.FC<RepoViewerProps> = ({ repoUrl, selectedPath, setSelectedPath }) => {
  const [fileData, setFileData] = useState<GithubFile[] | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRepoData() {
      try {
        const response = await fetch(`https://api.github.com/repos/${repoUrl}/contents/${selectedPath}`);
        const data = await response.json();

        if (Array.isArray(data)) {
          setFileData(data);
          setFileContent(null);
        } else if (data.type === 'file' && data.download_url) {
          const contentRes = await fetch(data.download_url);
          const content = await contentRes.text();
          setFileContent(content);
          setFileData(null);
        }
      } catch (error) {
        console.error('Error fetching repo data:', error);
      }
    }

    if (selectedPath) {
      fetchRepoData();
    }
  }, [repoUrl, selectedPath]);

  async function fetchFileContent(fileUrl: string) {
    try {
      const response = await fetch(fileUrl);
      const content = await response.text();
      setFileContent(content);
    } catch (error) {
      console.error('Error fetching file content:', error);
    }
  }

  function renderDirectory(items: GithubFile[]) {
    return (
      <ul className="pl-4 space-y-1">
        {items.map((item) => (
          <li key={item.sha}>
            {item.type === 'dir' ? (
              <strong className="text-blue-400">{item.name} (dir)</strong>
            ) : (
              <span
                className="cursor-pointer text-blue-500 hover:underline"
                onClick={() => item.download_url && fetchFileContent(item.download_url)}
              >
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  function getLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: { [key: string]: string } = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      json: 'json',
      css: 'css',
      md: 'markdown',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      sql: 'sql',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      scss: 'scss',
    };
    return langMap[ext || ''] || 'text';
  }

  function getBreadcrumbParts(path: string): string[] {
    const segments = path.split('/');
    const hashIndex = segments.findIndex((s) => /^[a-f0-9]{40}$/.test(s));
    return hashIndex >= 0 ? segments.slice(hashIndex + 1) : segments;
  }

  function handleBreadcrumbClick(index: number) {
    const parts = getBreadcrumbParts(selectedPath);
    const newPath = parts.slice(0, index + 1).join('/');
    setSelectedPath(newPath);
    setFileContent(null);
  }

  return (
    <div className="w-full">
      {selectedPath && (
        <div className="mb-3">
          <div className="text-xs font-bold text-gray-400 mb-1">Path:</div>
          <DynamicBreadcrumbs path={getBreadcrumbParts(selectedPath)} onClick={handleBreadcrumbClick} />
        </div>
      )}

      {fileData && renderDirectory(fileData)}

      {fileContent && (
        <div className="mt-4">
          {getLanguage(selectedPath) === 'markdown' ? (
            <ChatMarkdown content={fileContent} />
          ) : (
            <div className="rounded-lg overflow-hidden border border-[#39415a] bg-[#161b2a]">
              <SyntaxHighlighter
                language={getLanguage(selectedPath)}
                style={vscDarkPlus}
                customStyle={{ margin: 0, background: 'transparent', fontSize: 14 }}
                wrapLongLines
                showLineNumbers
              >
                {fileContent}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilePreview;
