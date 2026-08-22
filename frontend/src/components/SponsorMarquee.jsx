import React from 'react';

const SPONSORS = [
  { name: 'Devfolio', logo: '/logos/devfolio_logo.jpeg' },
  { name: 'Aptos Labs', logo: '/logos/aptoslabs_logo.jpeg' },
  { name: 'Polygon Labs', logo: '/logos/polygonlabs_logo.jpeg' },
  { name: 'ETHIndia', logo: '/logos/ethindia_logo.jpeg' },
  { name: 'Core DAO', logo: '/logos/core_dao_logo.jpeg' },
  { name: 'CoinEx', logo: '/logos/coinex.webp' },
  { name: 'Diamante', logo: '/logos/diamante_io_logo.jpeg' },
  { name: 'Nillion', logo: '/logos/nillion_logo.jpeg' },
  { name: 'The Graph', logo: '/logos/thegraph_logo.jpeg' },
];

export default function SponsorMarquee() {
  const doubleSponsors = [...SPONSORS, ...SPONSORS];

  return (
    <div className="sponsor-strip-fixed">
      <div className="sponsor-track">
        {doubleSponsors.map((sponsor, idx) => (
          <div key={idx} className="sponsor-pill">
            <img src={sponsor.logo} alt={sponsor.name} className="sponsor-logo-img" />
            <span>{sponsor.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
