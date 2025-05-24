import React from 'react';

const Header: React.FC = () => {
  return (
    <div className="flex flex-col items-center pt-8 bg-background">
      {/* Header */}
      <header className="flex w-[1224px] h-[72px] items-center justify-between px-8 py-6 bg-[#ffffff0d] rounded-3xl border border-solid border-[#40413d]">
        <div className="flex items-center gap-2.5 flex-1">
          <h1 className="text-lg font-normal text-base-primary font-tt-hoves-pro-trial">DevAI</h1>
        </div>
        <nav className="flex items-center justify-center gap-6 flex-1">
          <a href="#" className="text-base font-normal text-base-primary font-tt-hoves-pro-trial">
            About
          </a>
          <a href="#" className="text-base font-normal text-base-primary font-tt-hoves-pro-trial">
            Solutions
          </a>
          <a href="#" className="text-base font-normal text-base-primary font-tt-hoves-pro-trial">
            Pricing
          </a>
        </nav>
        <div className="flex flex-1 justify-end">
          <button className="px-6 py-2 bg-background-3 rounded-full border border-[#40413d] text-white font-desktop-body-18">
            Sign up
          </button>
        </div>
      </header>
    </div>
  );
};

export default Header;
