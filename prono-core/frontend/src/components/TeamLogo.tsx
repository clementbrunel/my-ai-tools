import { getFlagUrl } from '@/utils/countryFlags';

interface TeamLogoProps {
  name: string;
  iso2?: string | null;
  crestUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Renders a team's logo: national flag (iso2) when available, otherwise the club
 * crest imported from football-data.org, otherwise a generic flag emoji.
 */
const TeamLogo: React.FC<TeamLogoProps> = ({
  name,
  iso2,
  crestUrl,
  className = 'w-5 h-4 object-contain rounded-sm shadow-sm',
  fallbackClassName,
}) => {
  const flagUrl = getFlagUrl(iso2);
  if (flagUrl) {
    return <img src={flagUrl} alt={name} className={className} />;
  }
  if (crestUrl) {
    return <img src={crestUrl} alt={name} className={className} />;
  }
  return <span className={fallbackClassName}>🏳️</span>;
};

export default TeamLogo;
