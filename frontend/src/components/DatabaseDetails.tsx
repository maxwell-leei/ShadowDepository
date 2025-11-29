import { useMemo, useState } from 'react';
import type { DatabaseSummary } from './DataVaultApp';

type DatabaseDetailsProps = {
  database?: DatabaseSummary;
  decryptors: string[];
  encryptedValues: string[];
  decryptedAddress?: string;
  decryptedValues?: number[];
  isDecryptingAddress: boolean;
  isDecryptingValues: boolean;
  isStoringValue: boolean;
  isGrantingAccess: boolean;
  zamaReady: boolean;
  onDecryptAddress: () => Promise<void>;
  onDecryptValues: () => Promise<void>;
  onStoreValue: (value: number) => Promise<void>;
  onGrantAccess: (target: string) => Promise<void>;
};

export function DatabaseDetails({
  database,
  decryptors,
  encryptedValues,
  decryptedAddress,
  decryptedValues,
  isDecryptingAddress,
  isDecryptingValues,
  isStoringValue,
  isGrantingAccess,
  zamaReady,
  onDecryptAddress,
  onDecryptValues,
  onStoreValue,
  onGrantAccess,
}: DatabaseDetailsProps) {
  const [valueInput, setValueInput] = useState('');
  const [shareAddress, setShareAddress] = useState('');

  const commitmentPreview = useMemo(
    () =>
      database
        ? `${database.addressCommitment.slice(0, 8)}...${database.addressCommitment.slice(-6)}`
        : '',
    [database],
  );

  if (!database) {
    return (
      <div className="card details-card">
        <h3>Select a database</h3>
        <p className="muted">
          Choose a database from the list to decrypt its key, store encrypted numbers, and manage
          access permissions.
        </p>
      </div>
    );
  }

  const handleStore = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valueInput) return;
    await onStoreValue(Number(valueInput));
    setValueInput('');
  };

  const handleGrant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shareAddress) return;
    await onGrantAccess(shareAddress);
    setShareAddress('');
  };

  return (
    <div className="card details-card">
      <div className="details-header">
        <div>
          <p className="eyebrow">Active database #{database.id}</p>
          <h3>{database.name}</h3>
        </div>
        <div className="commitment">
          <span>Commitment</span>
          <code>{commitmentPreview}</code>
        </div>
      </div>

      <section className="section">
        <div className="section-header">
          <h4>Database address</h4>
          <button
            className="secondary"
            type="button"
            onClick={onDecryptAddress}
            disabled={isDecryptingAddress || !zamaReady}
          >
            {isDecryptingAddress
              ? 'Decrypting...'
              : decryptedAddress
                ? 'Refresh decryption'
                : 'Decrypt database key'}
          </button>
        </div>
        <p className="muted">
          The encrypted address is stored on-chain. Decrypt it before writing or reading data. Only
          addresses that the owner shares access with can complete this step.
        </p>
        {decryptedAddress ? (
          <div className="generated-key">
            <span className="label">Decrypted key</span>
            <p className="code">{decryptedAddress}</p>
          </div>
        ) : (
          <div className="placeholder">
            <p>Key locked. Click &ldquo;Decrypt database key&rdquo; to reveal it.</p>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h4>Encrypted values</h4>
          <button
            className="ghost-button"
            type="button"
            onClick={onDecryptValues}
            disabled={!encryptedValues.length || isDecryptingValues || !zamaReady}
          >
            {isDecryptingValues ? 'Decrypting values...' : 'Decrypt stored values'}
          </button>
        </div>
        <p className="muted">
          Values are stored fully encrypted with Zama FHE. You can decrypt them locally once access
          is granted.
        </p>
        {encryptedValues.length === 0 ? (
          <div className="placeholder">
            <p>No encrypted numbers stored yet.</p>
          </div>
        ) : (
          <div className="values-list">
            {encryptedValues.map((value, index) => (
              <div key={value} className="value-row">
                <span>Record #{index + 1}</span>
                <code className="code">{value.slice(0, 12)}...</code>
                <span className="badge small">
                  {decryptedValues ? decryptedValues[index] ?? '***' : '***'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h4>Store new number</h4>
        <p className="muted">
          Decrypt the database key first. The clear number will be encrypted client-side before
          hitting the blockchain.
        </p>
        <form onSubmit={handleStore} className="form-inline">
          <input
            type="number"
            value={valueInput}
            onChange={(event) => setValueInput(event.target.value)}
            placeholder="Enter numeric value"
            min="0"
          />
          <button
            type="submit"
            className="primary"
            disabled={!decryptedAddress || isStoringValue || !valueInput}
          >
            {isStoringValue ? 'Encrypting...' : 'Store value'}
          </button>
        </form>
      </section>

      <section className="section">
        <div className="section-header">
          <h4>Decrypt permissions</h4>
          <span className="muted">{decryptors.length} wallets</span>
        </div>
        <div className="roles-list">
          {decryptors.map((addr) => (
            <div key={addr} className="role-row">
              <code className="code">{addr}</code>
              <span className="badge small">{addr === database.owner ? 'owner' : 'shared'}</span>
            </div>
          ))}
        </div>
        <form onSubmit={handleGrant} className="form-inline">
          <input
            type="text"
            value={shareAddress}
            onChange={(event) => setShareAddress(event.target.value)}
            placeholder="0x collaborator address"
          />
          <button type="submit" className="secondary" disabled={!shareAddress || isGrantingAccess}>
            {isGrantingAccess ? 'Sharing access...' : 'Share address key'}
          </button>
        </form>
      </section>
    </div>
  );
}
