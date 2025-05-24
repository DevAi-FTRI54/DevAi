// // import React from 'react';
// // import { ReactMarkdownProps } from 'react-markdown/lib/ast-to-react';
// // import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // Prism-based syntax highlighter for code blocks
// // import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Dark theme for Prism code highlighting
// // import styles from './chatmessages.module.css';
// // import type { Literal } from 'unist';

// // // Message type: represents one chat message from user or assistant
// // type Message = { role: 'user' | 'assistant'; content: string };

// // // Props type for code renderer override (used by react-markdown below)
// // type CodeProps = {
// //   node?: Literal; // Internal tree node, not used here
// //   inline?: boolean; // True for inline code (`like this`), false for code blocks (```code```)
// //   className?: string; // May include language info (e.g., 'language-js')
// //   children?: React.ReactNode | React.ReactNode[]; // The actual code content
// // };

// /*
// [0] --- response ------------
// [0] {
// [0]   answer: 'The application contains six main components: NavBar, Flash, FileUpload, Login, QueryWrapper, and QueryHistory. These components are defined in the App function, which sets up the routing for the application using React Router. Each component serves a specific purpose, such as user authentication or file handling.',
// [0]   citations: [
// [0]     {
// [0]       file: '/Users/eshank/Documents/Cohort54/Projects/project-phase/osp/osp54/server/.cache/repos/github_com_Team_Taz_FTRI_54_AI_ML_Project/HEAD/client/src/App.tsx',
// [0]       startLine: 9,
// [0]       endLine: 40,
// [0]       snippet: 'function App() {\n' +
// [0]         '  return (\n' +
// [0]         '    <>\n' +
// [0]         '      <NavBar />\n' +
// [0]         '      <Routes>\n' +
// [0]         '        <Route path="/" element={<><Flash /><FileUpload /></>} />\n' +
// [0]         `        <Route path="/login" element={<><Flash /><Login />{' '}</>} />\n` +
// [0]         '        <Route path="/signup" element={<><Flash /><Login /></>} />\n' +
// [0]         '        <Route path="/query" element={<QueryWrapper />} />\n' +
// [0]         '        <Route path="/flash" element={<Flash />} />\n' +
// [0]         '        <Route path="/history" element={<QueryHistory />} />\n' +
// [0]         '      </Routes>\n' +
// [0]         '    </>\n' +
// [0]         '  );\n' +
// [0]         '}'
// [0]     }
// [0]   ]
// [0] }
//  */

// // const ChatMessage: React.FC<{ message: Message }> = ({ message }) => (
// //   <div className={message.role === 'user' ? styles.userBubble : styles.aiBubble}>
// //     {/* Render markdown content; override code blocks for syntax highlighting */}
// //     <ReactMarkdown
// //       components={{
// //         // Custom code block renderer for react-markdown

// //         code({ inline, className, children, ...props }: ReactMarkdownProps) {
// //           // Extract language if specified (e.g., ```js)
// //           const match = /language-(\w+)/.exec(className || '');
// //           // If this is a code block and language specified, use SyntaxHighlighter
// //           return !inline && match ? (
// //             <SyntaxHighlighter style={oneDark} language={match[1]}>
// //               {/* Remove trailing newlines for cleaner formatting */}
// //               {String(children).replace(/\n$/, '')}
// //             </SyntaxHighlighter>
// //           ) : (
// //             // Otherwise, render inline code normally
// //             <code className={className} {...props}>
// //               {children}
// //             </code>
// //           );
// //         },
// //       }}
// //     >
// //       {message.content}
// //     </ReactMarkdown>
// //   </div>
// // );

// // export default ChatMessage;

// /*
//    code({ inline, className, children, ...props }: CodeProps) {
//           // Extract language if specified (e.g., ```js)
//           const match = /language-(\w+)/.exec(className || '');
//           // If this is a code block and language specified, use SyntaxHighlighter
//           return !inline && match ? (
//             <SyntaxHighlighter style={oneDark} language={match[1]}></SyntaxHighlighter>
//               {String(children).replace(/\n$/, '')}
//             </SyntaxHighlighter>
//           ) : (
//             // Otherwise, render inline code normally
//             <code className={className} {...props}>
//               {children}
//             </code>
//           );
//         },
//       }}
//     >
//       {message.content}
//     </ReactMarkdown>
//   </div>
// );
// */

// // code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
// //   // Extract language if specified (e.g., ```js)
// //   const match = /language-(\w+)/.exec(className || '');
// //   // If this is a code block and language specified, use SyntaxHighlighter
// //   return !inline && match ? (
// //     <SyntaxHighlighter style={oneDark} language={match[1]}>
// //       {String(children).replace(/\n$/, '')}
// //     </SyntaxHighlighter>
// //   ) : (
// //     // Otherwise, render inline code normally
// //     <code className={className} {...props}>
// //       {children}
// //     </code>
// //   );
// // },

// import React from 'react';
// // import ReactMarkdown from 'react-markdown';
// // import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// // import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
// // import styles from './chatmessage.module.css'; // assuming you have styling per role

// interface Message {
//   role: 'user' | 'assistant';
//   content: string;
//   snippet?: string;
// }

// const ChatMessage: React.FC<{ message: Message }> = ({ message }) => (
//   <div className={message.role === 'user' ? 'userBubble' : 'aiBubble'}>
//     {/* <ReactMarkdown
//       components={{
//         code({ inline, className, children, ...props }) {
//           const match = /language-(\\w+)/.exec(className || '');
//           const codeString = Array.isArray(children) ? children.join('') : String(children);

//           return !inline && match ? (
//             <SyntaxHighlighter style={oneDark as any} language={match[1]} PreTag="div" {...props}>
//               {codeString.replace(/\\n$/, '')}
//             </SyntaxHighlighter>
//           ) : (
//             <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...(props as React.HTMLAttributes<HTMLElement>)}>
//               {codeString}
//             </code>
//           );
//         },
//       }}
//     > */}
//     {message.content}
//     {message.snippet}
//     {/* </ReactMarkdown> */}
//   </div>
// );

// export default ChatMessage;

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
// import type { Literal } from 'unist';
// import type { ReactMarkdownProps } from 'react-markdown';
// import './chatmessage.module.css'; // Optional: replace with your actual styles

interface Message {
  role: 'user' | 'assistant';
  content: string;
  snippet?: string;
}

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  return (
    <div
      className={`p-3 my-2 max-w-[80%] text-sm rounded-lg ${
        message.role === 'user'
          ? 'bg-blue-500 text-white self-end ml-auto'
          : 'bg-gray-200 text-black self-start mr-auto'
      }`}
    >
      <ReactMarkdown
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = Array.isArray(children) ? children.join('') : String(children);

            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{ overflowX: 'auto', borderRadius: '0.5rem', padding: '1rem' }}
                {...props}
              >
                {codeString.replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                {codeString}
              </code>
            );
          },
        }}
      >
        {message.content}
      </ReactMarkdown>
      {message.snippet && <pre className="mt-2 bg-gray-100 text-sm p-2 rounded overflow-x-auto">{message.snippet}</pre>}
    </div>
  );
};

export default ChatMessage;
