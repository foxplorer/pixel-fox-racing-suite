import { useState } from 'react';
import { useWallet } from '@1sat/react';
import pandaIcon from "../assets/yours-icon.png";
import metanetIcon from "../assets/metanet.png";
import { ThreeCircles } from 'react-loader-spinner';
import {
  METANET_WALLET_PROVIDER,
  YOURS_WALLET_PROVIDER
} from '../wallet/walletProviders';

export type FaucetPandaConnectButtonProps = {
  onClick?: () => void | Promise<void>;
  loading?: boolean;
};

export const FaucetPandaConnectButton = (props: FaucetPandaConnectButtonProps) => {
  const { onClick, loading = false } = props;
  const { status, connect, error } = useWallet();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const buttonStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: "1rem",
    paddingLeft: "1rem",
    width: "220px",
    boxSizing: "border-box",
    height: "40px",
    borderRadius: "0.5rem",
    border: "2px solid #ffffff",
    cursor: loading || isConnecting ? "wait" : "pointer",
    fontSize: "1rem",
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#000000",
    zIndex: "10",
    marginTop: "5px",
  } as const;
  const yoursLabel = (
    <>
      <img
        src={pandaIcon}
        alt=""
        style={{ marginRight: ".5rem", width: "1.7rem", height: "1.7rem", objectFit: "contain" }}
      />
      Connect Yours
    </>
  );
  const metanetLabel = (
    <>
      <img
        src={metanetIcon}
        alt=""
        style={{ marginRight: ".5rem", width: "1.7rem", height: "1.7rem", objectFit: "contain" }}
      />
      Connect Metanet
    </>
  );
  const handleProviderConnect = async (provider: string) => {
    setSelectedProvider(provider);
    await connect(provider);
  };

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: '10px' }}>
      {isConnected ? (
        <button
          className="FaucetButtonHover"
          disabled={loading}
          onClick={() => void onClick?.()}
          style={buttonStyle}
        >
          Choose Pixel Fox
        </button>
      ) : (
        <>
          <button
            type="button"
            className="FaucetButtonHover"
            style={buttonStyle}
            disabled={loading || isConnecting}
            onClick={() => void handleProviderConnect(YOURS_WALLET_PROVIDER)}
          >
            {isConnecting && selectedProvider === YOURS_WALLET_PROVIDER
              ? <ThreeCircles color="#ffffff" height="24" width="24" />
              : yoursLabel}
          </button>
          <button
            type="button"
            className="FaucetButtonHover"
            style={buttonStyle}
            disabled={loading || isConnecting}
            onClick={() => void handleProviderConnect(METANET_WALLET_PROVIDER)}
          >
            {isConnecting && selectedProvider === METANET_WALLET_PROVIDER
              ? <ThreeCircles color="#ffffff" height="24" width="24" />
              : metanetLabel}
          </button>
        </>
      )}
      {error && (
        <div
          style={{
            color: '#ffffff',
            fontFamily: 'PublicPixel, monospace',
            fontSize: '11px',
            maxWidth: '360px',
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          {selectedProvider === METANET_WALLET_PROVIDER
            ? 'Metanet could not be reached at localhost:3321. Open and unlock Metanet Client, then retry.'
            : 'Yours Wallet could not be reached. Enable and unlock the Yours browser extension, then retry.'}
        </div>
      )}
    </div>
  );
};
