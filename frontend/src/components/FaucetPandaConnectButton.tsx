import pandaIcon from "../assets/yours-icon.png";
import { ThreeCircles } from 'react-loader-spinner';

export type FaucetPandaConnectButtonProps = {
  onClick?: () => void;
  loading?: boolean;
};

// NOTE: Using inline styling demo but prefer styled-components or CSS classes in real app
export const FaucetPandaConnectButton = (props: FaucetPandaConnectButtonProps) => {
  const { onClick, loading = false } = props;
  return (
    <button
      className="FaucetButtonHover"
      onClick={loading ? undefined : onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingRight: loading ? "1rem" : "1rem",
        paddingLeft: loading ? "1rem" : undefined,
        minWidth: "125px",
        height: "40px",
        borderRadius: "0.5rem",
        border: "2px solid #ffffff",
        cursor: loading ? "default" : "pointer",
        fontSize: "1rem",
        fontWeight: 700,
        color: "#ffffff",
        backgroundColor: "#000000",
        zIndex: "10",
        marginTop: "5px",
      }}
    >
      {loading ? (
        <ThreeCircles color="#ffffff" height="24" width="24" />
      ) : (
        <>
          <img
            src={pandaIcon}
            alt="icon"
            style={{ marginRight: ".5rem", width: "1.7rem", height: "1.7rem"}}
          />
          Connect
        </>
      )}
    </button>
  );
};
