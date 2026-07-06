import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@1sat/react';
import pandaIcon from "../assets/yours-icon.png";
import metanetIcon from "../assets/metanet.png";
import { ThreeCircles } from 'react-loader-spinner';
import {
  METANET_WALLET_PROVIDER,
  SHUALLET_WALLET_PROVIDER,
  YOURS_WALLET_PROVIDER
} from '../wallet/walletProviders';
import {
  backupShualletWallet,
  createShualletWallet,
  emitShualletConnected,
  getExistingShualletSession,
  isShualletLoaded,
  logoutShualletWallet,
  restoreShualletBackup,
  type ShualletSession,
} from '../wallet/shuallet';

// Which wallet the user chose, so the page can route to that wallet's flow and
// never reuse another wallet's (e.g. stale SHUAllet) session.
export type WalletConnectSource = 'onesat' | 'metanet' | 'shuallet';

export type FaucetPandaConnectButtonProps = {
  onClick?: (source?: WalletConnectSource) => void | Promise<void>;
  loading?: boolean;
};

export const FaucetPandaConnectButton = (props: FaucetPandaConnectButtonProps) => {
  const { onClick, loading = false } = props;
  const { status, connect, error, providerType } = useWallet();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [shualletSession, setShualletSession] = useState<ShualletSession | null>(null);
  const [shualletLoading, setShualletLoading] = useState(false);
  const [shualletError, setShualletError] = useState<string | null>(null);
  const [shualletModalOpen, setShualletModalOpen] = useState(false);
  const [shualletNotice, setShualletNotice] = useState<string | null>(null);
  const [sessionIsNew, setSessionIsNew] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
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
  const shualletButtonStyle = {
    ...buttonStyle,
    cursor: loading || shualletLoading ? "wait" : "pointer",
  } as const;
  const primaryActionButtonStyle = {
    ...buttonStyle,
    width: '100%',
    borderColor: '#22c55e',
    backgroundColor: '#15803d',
    color: '#ffffff',
    boxShadow: '0 0 18px rgba(34, 197, 94, 0.32)',
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
  const shualletLabel = (
    <>
      <img
        src="/SHUAllet.js/assets/shuacoin.png"
        alt=""
        style={{ marginRight: ".5rem", width: "1.7rem", height: "1.7rem", objectFit: "contain" }}
      />
      Connect SHUAllet
    </>
  );
  useEffect(() => {
    setShualletSession(getExistingShualletSession());
    setSessionIsNew(false);
    setBackupDownloaded(false);
  }, []);

  // Newly created wallets must download a backup before continuing.
  const continueGated = sessionIsNew && !backupDownloaded;

  const handleProviderConnect = async (provider: string) => {
    if (status === 'connected' && providerType === provider) {
      void onClick?.(provider === METANET_WALLET_PROVIDER ? 'metanet' : 'onesat');
      return;
    }

    setSelectedProvider(provider);
    await connect(provider);
  };

  const completeShualletConnection = (session: ShualletSession) => {
    setShualletSession(session);
    setShualletError(null);
    setShualletNotice(null);
    emitShualletConnected();
    void onClick?.('shuallet');
  };

  const openShualletModal = () => {
    setSelectedProvider(SHUALLET_WALLET_PROVIDER);
    setShualletError(null);
    setShualletNotice(null);
    setShualletSession(getExistingShualletSession());
    setShualletModalOpen(true);
  };

  const handleShualletCreate = () => {
    setShualletLoading(true);
    setShualletError(null);
    setShualletNotice(null);
    try {
      if (!isShualletLoaded()) {
        throw new Error('SHUAllet is still loading. Refresh the page if this continues.')
      }

      const session = createShualletWallet();
      setShualletSession(session);
      setSessionIsNew(true);
      setBackupDownloaded(false);
      setShualletNotice('Wallet created. Download your backup before continuing.');
    } catch (error) {
      setShualletError(error instanceof Error ? error.message : 'SHUAllet connection failed');
    } finally {
      setShualletLoading(false);
    }
  };

  const handleShualletRestore = async (file?: File | null) => {
    if (!file) return;

    setSelectedProvider(SHUALLET_WALLET_PROVIDER);
    setShualletLoading(true);
    setShualletError(null);

    try {
      const session = await restoreShualletBackup(file);
      setShualletSession(session);
      setSessionIsNew(false);
      setBackupDownloaded(false);
      setShualletNotice('Wallet restored.');
    } catch (error) {
      setShualletError(error instanceof Error ? error.message : 'SHUAllet restore failed');
    } finally {
      setShualletLoading(false);
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
    }
  };

  const handleShualletLogout = () => {
    logoutShualletWallet();
    setShualletSession(null);
    setShualletError(null);
    setShualletNotice(null);
    setSessionIsNew(false);
    setBackupDownloaded(false);
    emitShualletConnected();
  };

  const handleShualletDownloadBackup = () => {
    try {
      backupShualletWallet();
      setBackupDownloaded(true);
      setShualletError(null);
    } catch (error) {
      setShualletError(error instanceof Error ? error.message : 'SHUAllet backup failed');
    }
  };

  const handleShualletChoose = () => {
    const session = getExistingShualletSession();
    if (!session) {
      setShualletError('Create or restore a SHUAllet wallet first.');
      return;
    }
    completeShualletConnection(session);
    setShualletModalOpen(false);
  };

  const shualletModal = shualletModalOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SHUAllet wallet"
      onClick={() => setShualletModalOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.72)',
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          border: '2px solid #36bffa',
          borderRadius: '8px',
          background: '#050505',
          color: '#ffffff',
          fontFamily: 'PublicPixel, monospace',
          padding: '18px',
          boxShadow: '0 0 24px rgba(54, 191, 250, 0.28)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'grid', justifyItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <img src="/SHUAllet.js/assets/shuacoin.png" alt="" style={{ width: '48px', height: '48px' }} />
          <div style={{ color: '#36bffa', fontSize: '16px' }}>SHUAllet</div>
        </div>

        {shualletSession ? (
          <div style={{ display: 'grid', gap: '10px', fontSize: '11px', lineHeight: 1.5 }}>
            <div style={{ color: '#36bffa' }}>Wallet Connected</div>
            <div style={{ wordBreak: 'break-all' }}>Ord: {shualletSession.ordinalAddress}</div>
            <div style={{ wordBreak: 'break-all', color: '#aaa' }}>Pay: {shualletSession.paymentAddress}</div>
            <button
              type="button"
              className="FaucetButtonHover"
              onClick={handleShualletChoose}
              disabled={continueGated}
              style={continueGated
                ? { ...buttonStyle, width: '100%', opacity: 0.45, cursor: 'not-allowed' }
                : primaryActionButtonStyle}
            >
              Continue to Choose Player
            </button>
            {continueGated && (
              <div style={{ color: '#facc15', fontSize: '10px', lineHeight: 1.5 }}>
                Download your backup to enable Continue.
              </div>
            )}
            <button
              type="button"
              className="FaucetButtonHover"
              onClick={handleShualletDownloadBackup}
              style={continueGated
                ? { ...primaryActionButtonStyle }
                : { ...buttonStyle, width: '100%' }}
            >
              Download Backup
            </button>
            {backupDownloaded && (
              <div style={{ color: '#4ade80', fontSize: '10px', lineHeight: 1.5 }}>
                Backup downloaded ✓
              </div>
            )}
            <button type="button" className="FaucetButtonHover" onClick={handleShualletLogout} style={{ ...buttonStyle, width: '100%', borderColor: '#f87171', color: '#f87171' }}>
              Sign Out
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px', fontSize: '11px', lineHeight: 1.6 }}>
            <div>Create a new SHUAllet or restore an existing backup.</div>
            <button type="button" className="FaucetButtonHover" disabled={shualletLoading} onClick={handleShualletCreate} style={{ ...buttonStyle, width: '100%' }}>
              {shualletLoading ? <ThreeCircles color="#ffffff" height="24" width="24" /> : 'Create New Wallet'}
            </button>
            <button type="button" className="FaucetButtonHover" disabled={shualletLoading} onClick={() => restoreInputRef.current?.click()} style={{ ...buttonStyle, width: '100%' }}>
              Upload Existing Backup
            </button>
          </div>
        )}

        {shualletNotice && (
          <div style={{ marginTop: '12px', color: '#4ade80', fontSize: '10px', lineHeight: 1.5 }}>
            {shualletNotice}
          </div>
        )}
        {shualletError && (
          <div style={{ marginTop: '12px', color: '#f87171', fontSize: '10px', lineHeight: 1.5 }}>
            {shualletError}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShualletModalOpen(false)}
          style={{
            marginTop: '14px',
            background: 'transparent',
            color: '#aaa',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'PublicPixel, monospace',
            fontSize: '10px',
          }}
        >
          Close
        </button>
      </div>
    </div>
  ) : null;

  return (
    // justifyItems must stay 'start': the error text block below is wider than
    // the 220px buttons, and centering would shift the buttons right whenever
    // an error message appears.
    <div style={{ display: 'grid', justifyItems: 'start', gap: '10px' }}>
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
      <button
        type="button"
        className="FaucetButtonHover"
        style={shualletButtonStyle}
        disabled={loading || shualletLoading}
        onClick={openShualletModal}
      >
        {shualletLoading && selectedProvider === SHUALLET_WALLET_PROVIDER
          ? <ThreeCircles color="#ffffff" height="24" width="24" />
          : shualletLabel}
      </button>
      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={event => void handleShualletRestore(event.currentTarget.files?.[0])}
      />
      {shualletModal}
      {(error || shualletError) && (
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
          {shualletError
            ? shualletError
            : selectedProvider === METANET_WALLET_PROVIDER
            ? 'Metanet needs another step. Make sure Metanet Client is open and unlocked at localhost:3321, then click "Connect Metanet" again to finish granting permissions.'
            : (
              <>
                Almost there — make sure the{' '}
                <a
                  href="https://github.com/yours-org/yours-wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#ffffff', textDecoration: 'underline' }}
                >
                  Yours extension
                </a>
                {' '}is enabled and unlocked, then click "Connect Yours" again to finish granting permissions.
              </>
            )}
        </div>
      )}
    </div>
  );
};
