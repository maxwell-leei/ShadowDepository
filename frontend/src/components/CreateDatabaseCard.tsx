import { useState } from 'react';
import { Contract, ethers } from 'ethers';
import type { JsonRpcSigner } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

type CreateDatabaseCardProps = {
  account?: string;
  signer?: Promise<JsonRpcSigner>;
  instance: any | null;
  zamaLoading: boolean;
  contractReady: boolean;
  onCreated: () => void;
};

export function CreateDatabaseCard({
  account,
  signer,
  instance,
  zamaLoading,
  contractReady,
  onCreated,
}: CreateDatabaseCardProps) {
  const [databaseName, setDatabaseName] = useState('');
  const [generatedAddress, setGeneratedAddress] = useState(() => ethers.Wallet.createRandom().address);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const regenerateAddress = () => {
    setGeneratedAddress(ethers.Wallet.createRandom().address);
    setStatus(null);
  };

  const createDatabase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instance || !account || !signer) {
      setStatus('Connect your wallet and wait for the encryption service.');
      return;
    }
    if (!databaseName) {
      setStatus('Please enter a database name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus('Encrypting the database key...');

      const encryptedKey = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, account)
        .addAddress(generatedAddress)
        .encrypt();

      const commitment = ethers.keccak256(
        abiCoder.encode(['address'], [ethers.getAddress(generatedAddress)]),
      );

      const resolvedSigner = await signer;
      if (!resolvedSigner) {
        throw new Error('Unable to access signer');
      }

      const registry = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      setStatus('Submitting transaction...');
      const tx = await registry.createDatabase(
        databaseName.trim(),
        commitment,
        encryptedKey.handles[0],
        encryptedKey.inputProof,
      );
      await tx.wait();

      setStatus('Database registered successfully.');
      setDatabaseName('');
      regenerateAddress();
      onCreated();
    } catch (error) {
      console.error('Failed to create database', error);
      setStatus(
        error instanceof Error ? `Failed: ${error.message}` : 'Failed to create database.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card create-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Create database</p>
          <h2>Encrypted data vault</h2>
        </div>
        <button className="ghost-button" type="button" onClick={regenerateAddress}>
          Generate new key
        </button>
      </div>
      <p className="muted">
        Each database receives a unique random EVM address that acts as its encryption identity. Keep
        it safe—only users who can decrypt it will be able to store or read numbers.
      </p>

      <div className="generated-key">
        <span className="label">Current database key</span>
        <p className="code">{generatedAddress}</p>
      </div>

      <form onSubmit={createDatabase} className="form-grid">
        <label>
          Database name
          <input
            type="text"
            placeholder="e.g. Research Vault"
            value={databaseName}
            onChange={(event) => setDatabaseName(event.target.value)}
          />
        </label>

        <button
          type="submit"
          className="primary"
          disabled={!account || !instance || zamaLoading || !contractReady || isSubmitting}
        >
          {zamaLoading
            ? 'Connecting to Zama...'
            : isSubmitting
              ? 'Creating database...'
              : 'Register database'}
        </button>
      </form>

      <p className="muted">
        Status:{' '}
        <span>
          {status ||
            (account
              ? contractReady
                ? 'Ready to create a database.'
                : 'Deploy the contract to Sepolia before creating databases.'
              : 'Connect your wallet to get started.')}
        </span>
      </p>
    </div>
  );
}
