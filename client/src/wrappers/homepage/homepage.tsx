import { useNavigate } from 'react-router-dom';

const MainContent = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative h-screen w-full flex flex-col items-center overflow-hidden"
      style={
        {
          // background: 'linear-gradient(120deg, #18181b 0%, #473e63 60%, #9e6c39 100%)',
          // background: 'linear-gradient(120deg, #18181b 0%, #473e63 60%, #121629)',
        }
      }
    >
      {/* Gradient Overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          //   background: `
          //   radial-gradient(circle at 25% 75%, #66339988 0%, transparent 50%),
          //   radial-gradient(circle at 85% 85%, #ff9f4380 0%, transparent 65%),
          //   radial-gradient(ellipse at 50% 0%, #18181b 60%, transparent 100%)
          // `,
          background: `
          radial-gradient(circle at 25% 75%, #39415a 0%, transparent 50%),
          radial-gradient(circle at 85% 85%, #121629 0%, transparent 65%),
          radial-gradient(ellipse at 50% 0%, #18181b 60%, transparent 100%)
        `,
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center flex-1 px-4 mt-14">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center mt-14 mb-6 max-w-3xl">
          <h1 className="font-tt-hoves text-3xl md:text-5xl  mb-4 leading-tight">
            <span className="text-white">A </span>
            <span style={{ color: '#bb9af7' }}>Code </span>
            <span style={{ color: '#869ed7' }}>Reader </span>
            <span className="text-white">Built for</span>
            <br />
            <span className="text-white">Developers</span>
          </h1>
          <p className="font-tt-hoves text-base text-gray-300 mb-6 max-w-lg mx-auto">
            An AI assistant that instantly reads, understands, and explains your codebase - so you can spend less time
            digging and more time building.
          </p>
          <button
            onClick={() => navigate('/install-github-app')}
            className="px-6 py-2 rounded-full bg-white/90 text-[#22212b] font-semibold shadow hover:bg-white transition"
          >
            Install GitHub App
          </button>
        </section>

        {/* Code Preview / Screenshot Area */}
        <div className="flex justify-center w-full overflow-auto max-h-[55vh]">
          <div className="rounded-lg overflow-hidden shadow-lg bg-gradient-to-br from-[#232136] to-[#292940] p-4 w-full max-w-4xl">
            <div className="flex">
              {/* Sidebar */}
              <div className="w-40 bg-[#181828] rounded-l-lg py-2 px-2 text-[#d4d4d4]">
                <div className="font-semibold mb-2 text-[#bb9af7] text-sm">PROJECT_TITLE</div>
                <ul className="text-xs space-y-1">
                  <li className="ml-2 text-[#82aaff]">client</li>
                  <li className="ml-4 text-[#a6accd]">node_modules</li>
                  <li className="ml-2 text-[#82aaff]">client</li>
                  <li className="ml-4 text-[#a6accd]">node_modules</li>
                </ul>
              </div>

              {/* Main Code Area */}
              <div className="flex-1 bg-[#22212b] rounded-r-lg p-4 text-left text-[#cdd6f4] overflow-auto">
                <div className="mb-2 text-sm">
                  <span className="font-bold text-[#bb9af7]">Repository:</span> facebook/react
                  <br />
                  <span className="font-bold text-[#bb9af7]">Language:</span> JavaScript
                  <br />
                  <span className="font-bold text-[#bb9af7]">Description:</span>
                  <p className="text-xs text-[#d4d4d4]">
                    A declarative, component-based UI library for building interactive web apps. React's virtual DOM and
                    hooks API make it easy to manage state and side effects in complex applications.
                  </p>
                </div>
                <div className="mb-3 text-sm">
                  <span className="font-bold text-[#bb9af7]">Key Features:</span>
                  <ul className="list-disc list-inside text-xs text-[#d4d4d4] ml-3">
                    <li>Virtual DOM diffing for high-performance updates</li>
                    <li>Hooks (useState, useEffect, useContext) for stateful logic</li>
                    <li>JSX syntax sugar for expressive UI definitions</li>
                  </ul>
                </div>

                {/* Code Box */}
                <div className="bg-[#181828] rounded-lg p-3 text-xs font-mono text-[#cdd6f4]">
                  <span className="text-[#7f849c]">// pages/index.tsx</span>
                  <pre className="whitespace-pre-wrap">
                    {`import { GetStaticProps } from 'next'
type Props = {
  posts: { id: string; title: string }[]
}

export default function Home({ posts }: Props) {
  // ...rest of code
}`}
                  </pre>
                </div>
                <div className="text-[#7f849c] text-xs mt-2">
                  This is when a user starts typing (the field is now in focus)
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1 rounded bg-[#252539] text-[#bb9af7] text-xs">Action</button>
                  <button className="px-3 py-1 rounded bg-[#252539] text-[#bb9af7] text-xs">Action</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainContent;
