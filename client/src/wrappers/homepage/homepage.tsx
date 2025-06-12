import { useNavigate } from 'react-router-dom';

const MainContent = () => {
  const navigate = useNavigate();

  return (
    <div className="relative h-screen w-full flex flex-col items-center overflow-hidden bg-[#18181b]">
      {/* Blurred Purple Glow as background */}
      <div
        className="
    absolute
    left-1/2
    top-[322px]    // Use figma's top coordinate if you want
    -translate-x-1/2
    w-[800px]
    h-[800px]
    rounded-full
    bg-[#7730B5]
    blur-[350px]
    z-0
    pointer-events-none
  "
      />

      {/* Main Content sits above the glow */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center flex-1 px-4 mt-14">
        {/* HERO SECTION */}
        <section className="flex flex-col items-center justify-center text-center mt-14 mb-10 max-w-3xl">
          <h1
            className="
    text-center
    font-['TT Hoves Pro Trial']
    font-normal
    text-[64px]
    leading-[74px]
    tracking-[-1.28px]
    text-[#FAFAFA]
  "
          >
            <span>A </span>
            <span
              className="
      bg-gradient-to-r
      from-[#B866FF]
      to-[#4BB1ED]
      bg-clip-text
      text-transparent
    "
            >
              Code Reader
            </span>
            <span> Built for</span>
            <br />
            <span>Developers</span>
          </h1>

          <p
            className="
              font-['TT Hoves Pro Trial']
              text-[18px]
              font-normal
              leading-[26px]
              text-[#C7C8C3]
              text-center
              w-full
              mb-6
              max-w-[676px]
              mx-auto
            "
          >
            An AI assistant that instantly reads, understands, and explains your codebase
            <br /> – so you can spend less time digging and more time building.
          </p>

          <button
            onClick={() => navigate('/install-github-app')}
            className="
                flex
                h-10
                py-2
                px-6
                justify-center
                items-center
                gap-4
                rounded-full
                bg-[#DEE1FC]
                text-[#22212b]
                font-semibold
                shadow
                hover:bg-[#E2E5FF]
                transition
              "
          >
            Install GitHub App
          </button>
        </section>

        {/* CODE PREVIEW SECTION */}
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
                  <span className="font-bold text-[#bb9af7]">Repository:</span> devai/react
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
