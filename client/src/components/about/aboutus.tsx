'use client';
import { Link } from 'react-router-dom';
import Eric_Shankman from '../../assets/Eric_Shankman.jpeg';
import Kyle_Headley from '../../assets/kyle_Headley.jpeg';
import Marek_Bednar from '../../assets/marek_bednar.png';
import type { TeamProps } from '../../types';
<Link to="/about">About</Link>;

import { FaLinkedin, FaGithub } from 'react-icons/fa';

const AboutUs = () => {
  const teamList: TeamProps[] = [
    {
      imageUrl: Eric_Shankman,
      firstName: 'Eric',
      lastName: 'Shankman',
      positions: ['Frontend Developer', 'Creator Of This Website'],
      socialNetworks: [
        { name: 'LinkedIn', url: 'https://www.linkedin.com/in/ershankman/' },
        { name: 'Github', url: 'https://github.com/eshankman' },
      ],
    },
    {
      imageUrl: Kyle_Headley,
      firstName: 'Kyle',
      lastName: 'Headley',
      positions: ['Backend Developer', 'Creator Of This Website'],
      socialNetworks: [
        { name: 'LinkedIn', url: 'https://www.linkedin.com/in/kyleheadley/' },
        { name: 'Github', url: 'https://github.com/kyleheadley1' },
      ],
    },
    {
      imageUrl: Marek_Bednar,
      firstName: 'Marek',
      lastName: 'Bednar',
      positions: ['AI and Integration Developer', 'Creator Of This Website'],
      socialNetworks: [
        { name: 'LinkedIn', url: 'https://www.linkedin.com/in/marek-bednar-b46824145/' },
        { name: 'Github', url: 'https://github.com/marekbednar007' },
      ],
    },
  ];

  const socialIcon = (socialName: string) => {
    //Switch - case used to display which icon will be displayed for each case.
    switch (socialName) {
      case 'LinkedIn':
        return <FaLinkedin className="w-5 h-5 inline-block" />;
      case 'Github':
        return <FaGithub className="w-5 h-5 inline-block" />;
      default:
        return null;
    }
  };

  return (
    //min-h-screen determines screen height and is at least as tall as the browser window.
    <div className="bg-[#171717]  min-h-screen">
      {/* mx-auto centers element left and right (margin x access) py- & px are padding on x axis and y axis*/}
      <section className="container mx-auto py-20 px-4 bg-[#171717]">
        <div className="text-center space-y-4 mb-12">
          <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium mt-20 px-3 py-1 rounded-full">
            TEAM
          </span>
          <h2 className="text-4xl font-bold tracking-tight text-white">Meet the best team of AI</h2>
          <p className="text-lg text-gray-500">
            In a realm where imagination meets technology, our platform fosters innovation, inspires creativity
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {teamList.map((member, index) => (
            <div
              key={index}
              className="bg-white shadow rounded-lg overflow-hidden flex flex-col group hover:shadow-lg transition"
            >
              <img
                src={member.imageUrl}
                alt={`${member.firstName} ${member.lastName}`}
                className="w-full h-64 object-contain grayscale group-hover:grayscale-0 transition bg-gray-100"
              />

              <div className="p-6 flex-grow">
                <h3 className="text-xl font-semibold">
                  {member.firstName} <span className="text-blue-600">{member.lastName}</span>
                </h3>
                <div className="text-gray-600 mt-2 space-y-1">
                  {member.positions.map((position, i) => (
                    <p key={i}>{position}</p>
                  ))}
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-4 mt-auto">
                {member.socialNetworks.map((network, i) => (
                  <a
                    key={i}
                    href={network.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:opacity-80"
                  >
                    {socialIcon(network.name)}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
