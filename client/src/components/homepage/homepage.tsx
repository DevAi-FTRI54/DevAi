const MainContent = () => (
  <div className="min-h-screen w-full bg-gradient-to-br from-[#181828] via-[#351d48] to-[#121113] flex flex-col items-center">
    {/* Hero Section */}
    <section className="flex flex-col items-center justify-center text-center mt-20 mb-12">
      <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">A Code Reader Built for Developers</h1>
      <p className="text-lg text-gray-300 max-w-xl mb-10">
        An AI assistant that instantly reads, understands, and explains your codebase—so you can spend less time digging
        and more time building.
      </p>
    </section>

    {/* Code Preview / Screenshot Area */}
    <div className="flex justify-center w-full">
      <div className="rounded-lg overflow-hidden shadow-lg bg-gradient-to-br from-[#1a1624] to-[#2d1c37] p-8 w-full max-w-4xl">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-56 bg-[#181828] rounded-l-lg py-4 px-3 text-gray-400">
            <div className="font-semibold mb-2">PROJECT_TITLE</div>
            <ul className="text-sm space-y-1">
              <li className="ml-2">client</li>
              <li className="ml-4">node_modules</li>
              <li className="ml-2">client</li>
              <li className="ml-4">node_modules</li>
            </ul>
          </div>
          {/* Main Code Area */}
          <div className="flex-1 bg-[#22212b] rounded-r-lg p-6 text-left text-gray-200">
            <div className="mb-4">
              <span className="font-bold">Repository:</span> facebook/react
              <br />
              <span className="font-bold">Language:</span> JavaScript
              <br />
              <span className="font-bold">Description:</span> <br />
              <span className="text-sm text-gray-300">
                A declarative, component-based UI library for building interactive web apps. React's virtual DOM and
                hooks API make it easy to manage state and side effects in complex applications.
              </span>
            </div>
            <div className="mb-4">
              <span className="font-bold">Key Features:</span>
              <ul className="list-disc list-inside text-sm text-gray-300 ml-3">
                <li>Virtual DOM diffing for high-performance updates</li>
                <li>Hooks (useState, useEffect, useContext) for stateful logic</li>
                <li>JSX syntax sugar for expressive UI definitions</li>
              </ul>
            </div>
            {/* Code Box */}
            <div className="bg-[#181828] rounded-lg p-4 text-xs font-mono text-gray-100 mb-2">
              <span className="text-gray-400">// pages/index.tsx</span>
              <pre>
                {`import { GetStaticProps } from 'next'
                    type Props = {
                      posts: { id: string; title: string }[]
                    }

                    export default function Home({ posts }: Props) {
                      // ...rest of code
                    }`}
              </pre>
            </div>
            <div className="text-gray-400 text-xs mt-1">
              This is when a user starts typing (the field is now in focus)
            </div>
            <div className="flex gap-2 mt-4">
              <button className="px-4 py-1 rounded bg-[#292940] text-white text-xs">Action</button>
              <button className="px-4 py-1 rounded bg-[#292940] text-white text-xs">Action</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default MainContent;

// import React from 'react';

// interface FrameProps {
//   className?: string;
//   children?: React.ReactNode;
// }

// export const Frame: React.FC<FrameProps> = ({ className, children }) => {
//   return <div className={className || ''}>{children}</div>;
// };
// // import { Frame } from '../Frame/Frame';

// interface Frame427319057Frame427319041FrameProps {
//   className?: string;
// }

// export const Frame427319057Frame427319041Frame: React.FC<Frame427319057Frame427319041FrameProps> = ({ className }) => {
//   return (
//     <div className={className || ''}>
//       {/* This appears to be an icon component */}
//       <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <circle cx="5" cy="5" r="5" fill="currentColor" />
//       </svg>
//     </div>
//   );
// };
// // import { Frame427319057Frame427319041Frame } from '../Frame427319057Frame427319041Frame/Frame427319057Frame427319041Frame';
// interface StateDefaultSelectWrapperProps {
//   className?: string;
//   hierarchy: 'outer' | 'inner';
//   select: boolean;
//   state: 'default' | 'selected';
//   text?: string;
// }

// export const StateDefaultSelectWrapper: React.FC<StateDefaultSelectWrapperProps> = ({
//   className,
//   hierarchy,
//   select,
//   state,
//   text,
// }) => {
//   return (
//     <div
//       className={`${className || ''} flex items-center px-2 py-1
//         ${select ? 'bg-background-3' : ''}
//         ${hierarchy === 'inner' ? 'ml-4' : ''}
//         ${state === 'selected' ? 'border-l-2 border-blue-500' : ''}`}
//     >
//       {select && <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />}
//       <span
//         className={`text-xs font-tt-hoves-pro-trial ${
//           state === 'selected' ? 'text-base-primary' : 'text-base-secondary'
//         }`}
//       >
//         {text || 'Item'}
//       </span>
//     </div>
//   );
// };
// // import { StateDefaultSelectWrapper } from '../StateDefaultSelectWrapper/StateDefaultSelectWrapper';
// interface StateSelectedWrapperProps {
//   className?: string;
//   state: 'default' | 'selected';
//   text?: string;
// }

// export const StateSelectedWrapper: React.FC<StateSelectedWrapperProps> = ({ className, state, text }) => {
//   return (
//     <div
//       className={`${className || ''} flex items-center px-3 py-2 ${
//         state === 'selected' ? 'border-b-2 border-blue-500' : ''
//       }`}
//     >
//       <span className="text-xs text-base-primary font-tt-hoves-pro-trial">
//         {text || (state === 'selected' ? 'Selected Tab' : 'Tab')}
//       </span>
//     </div>
//   );
// };
// // import { StateSelectedWrapper } from '../StateSelectedWrapper/StateSelectedWrapper';

// export const HomePage: React.FC = () => {
//   return (
//     <main className="flex flex-col items-center pt-8 bg-background">
//       {/* Header */}
//       <header className="flex w-[1224px] h-[72px] items-center justify-between px-8 py-6 bg-[#ffffff0d] rounded-3xl border border-solid border-[#40413d]">
//         <div className="flex items-center gap-2.5 flex-1">
//           <h1 className="text-lg font-normal text-base-primary font-tt-hoves-pro-trial">DevAI</h1>
//         </div>
//         <nav className="flex items-center justify-center gap-6 flex-1">
//           <a href="#" className="text-base font-normal text-base-primary font-tt-hoves-pro-trial">
//             About
//           </a>
//           <a href="#" className="text-base font-normal text-base-primary font-tt-hoves-pro-trial">
//             Solutions
//           </a>
//           <a href="#" className="text-base font-normal text-base-primary font-tt-hoves-pro-trial">
//             Pricing
//           </a>
//         </nav>
//         <div className="flex flex-1 justify-end">
//           <button className="px-6 py-2 bg-background-3 rounded-full border border-[#40413d] text-white font-desktop-body-18">
//             Sign up
//           </button>
//         </div>
//       </header>

//       {/* Hero Section */}
//       <section className="flex flex-col items-center justify-center w-full py-6">
//         <div className="flex flex-col items-start gap-24 w-full">
//           <div className="flex flex-col items-center justify-center gap-12 px-[100px] py-12 w-full">
//             <div className="flex flex-col w-[676px] items-end justify-center gap-10 z-10">
//               <h2 className="text-[64px] leading-[74px] text-center text-base-primary font-normal font-tt-hoves-pro-trial">
//                 A Code Reader Built for Developers
//               </h2>
//               <p className="text-lg leading-[18px] text-center text-base-secondary font-normal font-tt-hoves-pro-trial">
//                 An AI assistant that instantly reads, understands, and explains your codebase—so you can spend less time
//                 digging and more time building.
//               </p>
//             </div>

//             {/* Code Preview Section */}
//             <div className="relative w-[1243px] h-[533px]">
//               {/* Background Blurs */}
//               <div className="absolute w-[1302px] h-[807px] top-[-158px] left-[-58px]">
//                 <div className="absolute w-[522px] h-[522px] top-0 left-[780px] bg-[#7730b5] rounded-full blur-[600px]" />
//                 <div className="absolute w-[472px] h-[472px] top-[335px] left-0 bg-[#621ea9] rounded-full blur-[600px]" />
//               </div>

//               {/* Code Container */}
//               <div className="absolute w-[916px] h-[515px] top-[167px] left-[222px] bg-white shadow-[0px_0px_250px_-50px_#ffffff54] overflow-hidden">
//                 <div className="flex w-[917px] h-[652px] -left-px flex-col">
//                   <div className="flex h-[515px] w-full">
//                     {/* Sidebar */}
//                     <aside className="flex flex-col w-[161.57px] gap-[8.91px] py-[10.18px] bg-background">
//                       <div className="flex items-start gap-[2.54px] pl-[7.63px]">
//                         <Frame className="!h-[12.72px] !w-[12.72px]" />
//                         <span className="text-[8.9px] text-base-secondary font-normal font-tt-hoves-pro-trial">
//                           PROJECT_TITLE
//                         </span>
//                       </div>
//                       <StateDefaultSelectWrapper
//                         className="!w-[161.57px]"
//                         hierarchy="outer"
//                         select={false}
//                         state="default"
//                       />
//                       <StateDefaultSelectWrapper
//                         className="!w-[161.57px]"
//                         hierarchy="outer"
//                         select={false}
//                         state="default"
//                       />
//                       <StateDefaultSelectWrapper className="!w-[161.57px]" hierarchy="outer" select state="default" />
//                       <div className="flex items-center pl-[25.44px]">
//                         {/* <img className="w-px z-10" alt="Line" src={line3} /> */}
//                         <div className="flex flex-col z-0">
//                           <StateDefaultSelectWrapper
//                             className="!w-[136.13px]"
//                             hierarchy="inner"
//                             select={false}
//                             state="default"
//                           />
//                           <StateDefaultSelectWrapper
//                             className="!w-[136.13px]"
//                             hierarchy="inner"
//                             select={false}
//                             state="default"
//                             text="node_modules"
//                           />
//                           <StateDefaultSelectWrapper
//                             className="!w-[136.13px]"
//                             hierarchy="inner"
//                             select={false}
//                             state="default"
//                             text="client"
//                           />
//                           <StateDefaultSelectWrapper
//                             className="!w-[136.13px]"
//                             hierarchy="inner"
//                             select={false}
//                             state="default"
//                             text="node_modules"
//                           />
//                           <StateDefaultSelectWrapper
//                             className="!w-[136.13px]"
//                             hierarchy="inner"
//                             select={false}
//                             state="default"
//                             text="client"
//                           />
//                           <StateDefaultSelectWrapper
//                             className="!w-[136.13px]"
//                             hierarchy="inner"
//                             select={false}
//                             state="default"
//                             text="node_modules"
//                           />
//                         </div>
//                       </div>
//                     </aside>

//                     {/* Main Content */}
//                     <section className="flex flex-col flex-1">
//                       <div className="flex bg-background-3 border-b border-[#57677680]">
//                         <StateSelectedWrapper className="!flex-[0_0_auto]" state="selected" />
//                         <StateSelectedWrapper className="!flex-[0_0_auto]" state="default" />
//                       </div>

//                       <div className="flex bg-background-2">
//                         <div className="flex flex-col max-w-[445.28px] h-[331px] gap-[15.27px] p-[40.71px]">
//                           <div className="flex flex-col gap-[5.09px] text-[10.2px] text-base-primary font-tt-hoves-pro-trial">
//                             <p>Repository: facebook/react</p>
//                             <p>Language: JavaScript</p>
//                             <p>Description:</p>
//                             <p>
//                               A declarative, component-based UI library for building interactive web apps. React&apos;s
//                               virtual DOM and hooks API make it easy to manage state and side effects in complex
//                               applications.
//                             </p>
//                             <p>Key Features:</p>
//                             <p>Virtual DOM diffing for high-performance updates</p>
//                             <p>Hooks (useState, useEffect, useContext) for stateful logic</p>
//                             <p>JSX syntax sugar for expressive UI definitions</p>
//                           </div>

//                           {/* Code Block */}
//                           <div className="flex flex-col rounded-[7.63px] overflow-hidden">
//                             <div className="flex h-[25.44px] items-center justify-between bg-background-3 p-[10.18px]">
//                               <span className="text-[10.2px] text-base-primary font-tt-hoves-pro-trial">js</span>
//                               {/* <img className="w-[10.18px] h-[10.18px]" alt="Frame" src={frame} /> */}
//                             </div>
//                             <div className="flex justify-center bg-background p-[10.18px]">
//                               {/* <img className="w-full" alt="Code Example" src={postsThenRRJsonReturnPropsPosts} /> */}
//                             </div>
//                           </div>
//                         </div>

//                         {/* Footer Actions */}
//                         <div className="flex flex-col max-w-[445.28px] gap-[5.09px] p-[5.09px] bg-background-3 rounded-[10.18px]">
//                           <div className="flex h-[45.8px] items-center justify-center gap-[6.36px] p-[5.09px] border border-[#40413d] rounded-[7.63px]">
//                             <p className="text-[10.2px] text-base-primary font-tt-hoves-pro-trial">
//                               This is when a user starts typing (the field is now in focus)
//                             </p>
//                           </div>
//                           <div className="flex items-center gap-[15.27px] px-[5.09px] py-[2.54px]">
//                             <div className="flex gap-[10.18px]">
//                               <div className="flex items-center gap-[2.54px]">
//                                 <Frame427319057Frame427319041Frame className="!h-[10.18px] !w-[10.18px]" />
//                                 <span className="text-[8.9px] text-base-primary font-tt-hoves-pro-trial">Action</span>
//                               </div>
//                               <div className="flex items-center gap-[2.54px]">
//                                 <Frame427319057Frame427319041Frame className="!h-[10.18px] !w-[10.18px]" />
//                                 <span className="text-[8.9px] text-base-primary font-tt-hoves-pro-trial">Action</span>
//                               </div>
//                             </div>
//                             {/* <img className="w-[17.81px] h-[17.81px]" alt="Frame" src={frame427319068} /> */}
//                           </div>
//                         </div>

//                         {/* Scrollbar */}
//                         <div className="flex items-start px-[2.54px] py-[6.36px] bg-[#191d23]">
//                           <div className="w-[5.09px] h-[72.52px] bg-gray-2-srtoke rounded-[19.08px]" />
//                         </div>
//                       </div>
//                     </section>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>
//     </main>
//   );
// };
