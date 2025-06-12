import { useNavigate } from 'react-router-dom';

const MainContent = () => {
  const navigate = useNavigate();

  return (
    <div className='relative h-screen w-full flex flex-col items-center overflow-hidden bg-[#18181b]'>
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
      <div className='relative z-10 w-full flex flex-col items-center justify-center flex-1 px-4 mt-14'>
        {/* HERO SECTION */}
        <section className='flex flex-col items-center justify-center text-center mt-14 mb-10 max-w-3xl'>
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
              className='
      bg-gradient-to-r
      from-[#B866FF]
      to-[#4BB1ED]
      bg-clip-text
      text-transparent
    '
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
            An AI assistant that instantly reads, understands, and explains your
            codebase
            <br /> – so you can spend less time digging and more time building.
          </p>

          <button
            onClick={() => navigate('/install-github-app')}
            className='
                flex
                h-12
                py-3
                px-8
                justify-center
                items-center
                gap-3
                rounded-full
                bg-[#5ea9ea]
                hover:bg-[#4a9ae0]
                text-white
                font-semibold
                shadow-lg
                hover:shadow-xl
                hover:shadow-[#5ea9ea]/20
                transition-all
                duration-200
                transform
                hover:scale-105
              '
          >
            <svg className='w-5 h-5' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z'
                clipRule='evenodd'
              />
            </svg>
            Install GitHub App
          </button>
        </section>

        {/* CODE PREVIEW SECTION */}
        <div className='flex justify-center w-full overflow-auto max-h-[55vh]'>
          <div className='rounded-lg overflow-hidden shadow-lg bg-gradient-to-br from-[#232136] to-[#292940] p-4 w-full max-w-4xl'>
            <div className='flex'>
              {/* Sidebar */}
              <div className='w-40 bg-[#181828] rounded-l-lg py-2 px-2 text-[#d4d4d4]'>
                <div className='font-semibold mb-2 text-[#bb9af7] text-sm'>
                  PROJECT_TITLE
                </div>
                <ul className='text-xs space-y-1'>
                  <li className='ml-2 text-[#82aaff]'>client</li>
                  <li className='ml-4 text-[#a6accd]'>node_modules</li>
                  <li className='ml-2 text-[#82aaff]'>client</li>
                  <li className='ml-4 text-[#a6accd]'>node_modules</li>
                </ul>
              </div>
              {/* Main Code Area */}
              <div className='flex-1 bg-[#22212b] rounded-r-lg p-4 text-left text-[#cdd6f4] overflow-auto'>
                <div className='mb-2 text-sm'>
                  <span className='font-bold text-[#bb9af7]'>Repository:</span>{' '}
                  facebook/react
                  <br />
                  <span className='font-bold text-[#bb9af7]'>
                    Language:
                  </span>{' '}
                  JavaScript
                  <br />
                  <span className='font-bold text-[#bb9af7]'>Description:</span>
                  <p className='text-xs text-[#d4d4d4]'>
                    A declarative, component-based UI library for building
                    interactive web apps. React's virtual DOM and hooks API make
                    it easy to manage state and side effects in complex
                    applications.
                  </p>
                </div>
                <div className='mb-3 text-sm'>
                  <span className='font-bold text-[#bb9af7]'>
                    Key Features:
                  </span>
                  <ul className='list-disc list-inside text-xs text-[#d4d4d4] ml-3'>
                    <li>Virtual DOM diffing for high-performance updates</li>
                    <li>
                      Hooks (useState, useEffect, useContext) for stateful logic
                    </li>
                    <li>JSX syntax sugar for expressive UI definitions</li>
                  </ul>
                </div>
                {/* Code Box */}
                <div className='bg-[#181828] rounded-lg p-3 text-xs font-mono text-[#cdd6f4]'>
                  <span className='text-[#7f849c]'>// pages/index.tsx</span>
                  <pre className='whitespace-pre-wrap'>
                    {`import { GetStaticProps } from 'next'
type Props = {
  posts: { id: string; title: string }[]
}

export default function Home({ posts }: Props) {
  // ...rest of code
}`}
                  </pre>
                </div>
                <div className='text-[#7f849c] text-xs mt-2'>
                  This is when a user starts typing (the field is now in focus)
                </div>
                <div className='flex gap-2 mt-3'>
                  <button className='px-3 py-1 rounded bg-[#252539] text-[#bb9af7] text-xs'>
                    Action
                  </button>
                  <button className='px-3 py-1 rounded bg-[#252539] text-[#bb9af7] text-xs'>
                    Action
                  </button>
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
