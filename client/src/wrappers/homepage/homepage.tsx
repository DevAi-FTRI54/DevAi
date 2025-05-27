const MainContent = () => (
  <div
    className="relative min-h-screen w-full flex flex-col items-center overflow-hidden"
    style={{
      background: 'linear-gradient(120deg, #473e63 0%, #18181b 40%, #9e6c39 100%)',
    }}
  >
    {/* Gradient Overlay */}
    <div
      className="absolute inset-0 z-0 pointer-events-none"
      style={{
        background: `
          radial-gradient(circle at 30% 30%, #66339988 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, #ff9f4380 0%, transparent 60%)
        `,
      }}
    />
    {/* Main Content */}
    <div className="relative z-10 w-full">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center mt-32 mb-12">
        <h1 className="font-tt-hoves text-5xl md:text-6xl font-bold mb-4">
          <span className="text-white">A </span>
          <span style={{ color: '#bb9af7' }}>Code </span>
          <span style={{ color: '#e0af68' }}>Reader </span>
          <span className="text-white">Built for</span>
          <br />
          <span className="text-white">Developers</span>
        </h1>
        <p className="font-tt-hoves text-lg text-gray-300 max-w-xl mb-10">
          An AI assistant that instantly reads, understands, and explains your codebase—so you can spend less time
          digging and more time building.
        </p>
        <button className="px-6 py-2 rounded-full bg-white/90 text-[#22212b] font-semibold shadow mt-2 hover:bg-white transition">
          Install GitHub App
        </button>
      </section>
      {/* Code Preview / Screenshot Area */}
      <div className="flex justify-center w-full">
        <div className="rounded-lg overflow-hidden shadow-lg bg-gradient-to-br from-[#232136] to-[#292940] p-8 w-full max-w-4xl">
          <div className="flex">
            {/* Sidebar */}
            <div className="w-56 bg-[#181828] rounded-l-lg py-4 px-3 text-[#d4d4d4]">
              <div className="font-semibold mb-2 text-[#bb9af7]">PROJECT_TITLE</div>
              <ul className="text-sm space-y-1">
                <li className="ml-2 text-[#82aaff]">client</li>
                <li className="ml-4 text-[#a6accd]">node_modules</li>
                <li className="ml-2 text-[#82aaff]">client</li>
                <li className="ml-4 text-[#a6accd]">node_modules</li>
              </ul>
            </div>
            {/* Main Code Area */}
            <div className="flex-1 bg-[#22212b] rounded-r-lg p-6 text-left text-[#cdd6f4]">
              <div className="mb-4">
                <span className="font-bold text-[#bb9af7]">Repository:</span> facebook/react
                <br />
                <span className="font-bold text-[#bb9af7]">Language:</span> JavaScript
                <br />
                <span className="font-bold text-[#bb9af7]">Description:</span> <br />
                <span className="text-sm text-[#d4d4d4]">
                  A declarative, component-based UI library for building interactive web apps. React's virtual DOM and
                  hooks API make it easy to manage state and side effects in complex applications.
                </span>
              </div>
              <div className="mb-4">
                <span className="font-bold text-[#bb9af7]">Key Features:</span>
                <ul className="list-disc list-inside text-sm text-[#d4d4d4] ml-3">
                  <li>Virtual DOM diffing for high-performance updates</li>
                  <li>Hooks (useState, useEffect, useContext) for stateful logic</li>
                  <li>JSX syntax sugar for expressive UI definitions</li>
                </ul>
              </div>
              {/* Code Box */}
              <div className="bg-[#181828] rounded-lg p-4 text-xs font-mono text-[#cdd6f4] mb-2">
                <span className="text-[#7f849c]">// pages/index.tsx</span>
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
              <div className="text-[#7f849c] text-xs mt-1">
                This is when a user starts typing (the field is now in focus)
              </div>
              <div className="flex gap-2 mt-4">
                <button className="px-4 py-1 rounded bg-[#252539] text-[#bb9af7] text-xs">Action</button>
                <button className="px-4 py-1 rounded bg-[#252539] text-[#bb9af7] text-xs">Action</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default MainContent;
