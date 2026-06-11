
import wocSvg from "../assets/woc.svg";
import oneSatLogo from "../assets/oneSatLogoDark.svg";

const PROJECT_GITHUB_URL = import.meta.env.VITE_PIXELRACING_GITHUB_URL || 'https://github.com/foxplorer/pixel-fox-racing-suite';

const FooterHome = ({ textColor, smallLogos }: { textColor?: string; smallLogos?: boolean }) => {


  return (
    <div className="Footer" style={{ color: textColor || undefined }}>
      <br />
        <br />
        {/* Partner Logos */}
        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
          {/* Whatsonchain Logo */}
          <a
            href="https://whatsonchain.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              transition: 'transform 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <img
              src={wocSvg}
              alt="Whatsonchain"
              style={{
                width: smallLogos ? '80px' : '120px',
                height: 'auto',
                filter: 'brightness(0.9)',
                transition: 'filter 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.filter = 'brightness(0.9)';
              }}
            />
          </a>

          {/* 1Sat Ordinals Logo */}
          <a
            href="https://1satordinals.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              transition: 'transform 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <img
              src={oneSatLogo}
              alt="1Sat Ordinals"
              style={{
                width: smallLogos ? '40px' : '60px',
                height: 'auto',
                filter: 'brightness(0.9)',
                transition: 'filter 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.filter = 'brightness(0.9)';
              }}
            />
          </a>
        </div>
        
        <a className="FooterLink" target="blank" href="https://github.com/yours-org/yours-wallet" style={{ color: textColor || undefined }}>Yours Wallet GitHub</a><br />
        <a className="FooterLink" target="blank" href={PROJECT_GITHUB_URL} style={{ color: textColor || undefined }}>Pixel Fox Racing Suite GitHub</a> 
        <br />
        <br />
    </div>
   
  )
};

export default FooterHome;
