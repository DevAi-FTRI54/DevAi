import React from 'react';

const Hero: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full py-6">
      <div className="flex flex-col items-start gap-24 w-full">
        <div className="flex flex-col items-center justify-center gap-12 px-[100px] py-12 w-full">
          <div className="flex flex-col w-[676px] items-end justify-center gap-10 z-10">
            <h2 className="text-[64px] leading-[74px] text-center text-base-primary font-normal font-tt-hoves-pro-trial">
              A Code Reader Built for Developers
            </h2>
            <p className="text-lg leading-[18px] text-center text-base-secondary font-normal font-tt-hoves-pro-trial">
              An AI assistant that instantly reads, understands, and explains your codebase—so you can spend less time
              digging and more time building.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
