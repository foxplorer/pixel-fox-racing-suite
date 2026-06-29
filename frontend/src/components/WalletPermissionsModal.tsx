import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalletInterface } from '@bsv/sdk';
import { ThreeCircles } from 'react-loader-spinner';
import {
  derivePixelRacingAddresses,
  loadPixelRacingOrdinals,
  loadMetanetPixelFoxes,
  verifyMetanetPixelFoxAccess,
} from '../wallet/oneSatWallet';

export type WalletPermissionsModalProps = {
  isOpen: boolean;
  walletKind: 'onesat' | 'metanet';
  wallet: WalletInterface | null;
  identityKey?: string;
  onAddressesResolved?: (addrs: { ordAddress: string; bsvAddress: string }) => void;
  onProceed: () => void;
  onClose: () => void;
  // Label for the green confirm button. Defaults to the racing/courier flow's
  // "Continue to Choose Player"; the Foxplorer home route overrides it since it
  // displays foxes directly instead of opening a Choose Player modal.
  proceedLabel?: string;
};

type CheckStatus = 'pending' | 'running' | 'success' | 'error';

type PermissionCheck = {
  id: string;
  label: string;
  description: string;
  // Required checks must pass before Continue is enabled. Informational
  // checks (info: true) are displayed but never run or block.
  info?: boolean;
  run?: (wallet: WalletInterface) => Promise<void>;
};

export const WalletPermissionsModal = ({
  isOpen,
  walletKind,
  wallet,
  identityKey,
  onAddressesResolved,
  onProceed,
  onClose,
  proceedLabel = 'Continue to Choose Player',
}: WalletPermissionsModalProps) => {
  const [statuses, setStatuses] = useState<Record<string, CheckStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Resolved ordinal address from the Yours derive step, shared with the
  // subsequent "view ordinals" check.
  const ordAddressRef = useRef<string>('');

  const buildChecks = useCallback((): PermissionCheck[] => {
    if (walletKind === 'metanet') {
      return [
        {
          id: 'identity',
          label: 'Identity key',
          description: 'Read your Metanet public identity key.',
          run: async w => {
            await w.getPublicKey({ identityKey: true });
          },
        },
        {
          id: 'basket',
          label: 'Pixel Foxes basket access',
          description: 'Grant access to your "pixel foxes" basket protocol key.',
          run: async w => {
            await verifyMetanetPixelFoxAccess(w);
          },
        },
        {
          id: 'view-foxes',
          label: 'View Pixel Foxes',
          description: 'List the foxes held in your "pixel foxes" basket.',
          run: async w => {
            await loadMetanetPixelFoxes(w, identityKey ?? '', 1);
          },
        },
        {
          id: 'internalize',
          label: 'Receive collectibles',
          description: 'Collectibles internalize into "pixel foxes" — covered by basket access above.',
          info: true,
        },
      ];
    }

    return [
      {
        id: 'identity',
        label: 'Identity key',
        description: 'Read your wallet public identity key.',
        run: async w => {
          await w.getPublicKey({ identityKey: true });
        },
      },
      {
        id: 'address',
        label: 'Ordinal receive address',
        description: 'Derive your ordinal + payment addresses for rewards.',
        run: async w => {
          const addrs = await derivePixelRacingAddresses(w);
          ordAddressRef.current = addrs.ordAddress;
          onAddressesResolved?.({ ordAddress: addrs.ordAddress, bsvAddress: addrs.bsvAddress });
        },
      },
      {
        id: 'view-ordinals',
        label: 'View ordinals',
        description: 'List your ordinals to find your Pixel Foxes.',
        run: async w => {
          await loadPixelRacingOrdinals(w, ordAddressRef.current, 1);
        },
      },
    ];
  }, [walletKind, identityKey, onAddressesResolved]);

  const checks = buildChecks();
  const requiredChecks = checks.filter(check => !check.info);
  const allGranted = requiredChecks.every(check => statuses[check.id] === 'success');

  // Run required checks sequentially starting at startIndex (within the
  // required-checks list). Stops on the first failure so the user can retry it.
  const runFrom = useCallback(async (startIndex: number) => {
    if (!wallet) return;
    const ordered = buildChecks().filter(check => !check.info);

    for (let i = startIndex; i < ordered.length; i += 1) {
      const check = ordered[i];
      setStatuses(prev => ({ ...prev, [check.id]: 'running' }));
      setErrors(prev => {
        const next = { ...prev };
        delete next[check.id];
        return next;
      });
      try {
        await check.run?.(wallet);
        setStatuses(prev => ({ ...prev, [check.id]: 'success' }));
      } catch (error) {
        setStatuses(prev => ({ ...prev, [check.id]: 'error' }));
        setErrors(prev => ({
          ...prev,
          [check.id]: error instanceof Error ? error.message : 'Permission was not granted.',
        }));
        return;
      }
    }
  }, [wallet, buildChecks]);

  useEffect(() => {
    if (!isOpen || !wallet) return;
    ordAddressRef.current = '';
    setStatuses({});
    setErrors({});
    void runFrom(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, wallet, walletKind]);

  if (!isOpen) return null;

  const retry = (checkId: string) => {
    const ordered = checks.filter(check => !check.info);
    const index = ordered.findIndex(check => check.id === checkId);
    if (index >= 0) void runFrom(index);
  };

  const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box',
    height: '40px',
    borderRadius: '0.5rem',
    border: '2px solid #ffffff',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
    backgroundColor: '#000000',
    fontFamily: 'PublicPixel, monospace',
  } as const;

  const renderStatusIcon = (status: CheckStatus | undefined, info?: boolean) => {
    if (info) return <span style={{ color: '#36bffa', fontSize: '14px' }}>ℹ︎</span>;
    if (status === 'success') return <span style={{ color: '#4ade80', fontSize: '14px' }}>✓</span>;
    if (status === 'error') return <span style={{ color: '#f87171', fontSize: '14px' }}>✕</span>;
    if (status === 'running') return <ThreeCircles color="#36bffa" height="18" width="18" />;
    return <span style={{ color: '#666', fontSize: '14px' }}>•</span>;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wallet permissions"
      onClick={onClose}
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
          width: 'min(460px, 100%)',
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
        <div style={{ color: '#36bffa', fontSize: '16px', marginBottom: '6px' }}>
          {walletKind === 'metanet' ? 'Metanet Permissions' : 'Yours Permissions'}
        </div>
        <div style={{ color: '#aaa', fontSize: '10px', lineHeight: 1.6, marginBottom: '16px' }}>
          Approve each request in your wallet. Each turns green once verified.
        </div>

        <div style={{ display: 'grid', gap: '10px', textAlign: 'left' }}>
          {checks.map(check => {
            const status = statuses[check.id];
            return (
              <div
                key={check.id}
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '10px',
                  display: 'grid',
                  gridTemplateColumns: '22px 1fr',
                  gap: '8px',
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', paddingTop: '2px' }}>
                  {renderStatusIcon(status, check.info)}
                </div>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#ffffff' }}>{check.label}</div>
                  <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.5 }}>{check.description}</div>
                  {status === 'error' && (
                    <div style={{ display: 'grid', gap: '6px', marginTop: '4px' }}>
                      <div style={{ fontSize: '9px', color: '#f87171', lineHeight: 1.5 }}>
                        {errors[check.id]}
                      </div>
                      <button
                        type="button"
                        className="FaucetButtonHover"
                        onClick={() => retry(check.id)}
                        style={{ ...buttonStyle, height: '30px', fontSize: '10px', borderColor: '#f87171' }}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="FaucetButtonHover"
          onClick={onProceed}
          disabled={!allGranted}
          style={allGranted
            ? {
                ...buttonStyle,
                marginTop: '16px',
                borderColor: '#22c55e',
                backgroundColor: '#15803d',
                boxShadow: '0 0 18px rgba(34, 197, 94, 0.32)',
              }
            : { ...buttonStyle, marginTop: '16px', opacity: 0.45, cursor: 'not-allowed' }}
        >
          {proceedLabel}
        </button>

        <button
          type="button"
          onClick={onClose}
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
  );
};
