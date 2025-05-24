const MainContent = () => (
  <div className="min-h-screen w-full bg-gradient-to-br from-[#181828] via-[#351d48] to-[#121113] flex flex-col items-center">
    {/* Hero Section */}
    <section className="flex flex-col items-center justify-center text-center mt-16 mb-12">
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
