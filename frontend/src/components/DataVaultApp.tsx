import { useEffect, useMemo, useState } from 'react';
import { Contract, ethers } from 'ethers';
import type { JsonRpcSigner } from 'ethers';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CreateDatabaseCard } from './CreateDatabaseCard';
import { DatabaseList } from './DatabaseList';
import { DatabaseDetails } from './DatabaseDetails';
import '../styles/DataVaultApp.css';

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

export type DatabaseSummary = {
  id: number;
  name: string;
  owner: string;
  createdAt: number;
  encryptedDatabaseAddress: string;
  addressCommitment: string;
  encryptedValueCount: number;
};

const computeCommitment = (address: string) =>
  ethers.keccak256(abiCoder.encode(['address'], [ethers.getAddress(address)]));

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function DataVaultApp() {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signer = useEthersSigner();
  const contractConfigured = CONTRACT_ADDRESS !== ZERO_ADDRESS;

  const {
    data: ownedResponse,
    refetch: refetchOwnedIds,
    isLoading: loadingOwned,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getOwnedDatabases',
    args: address ? [address] : undefined,
    query: {
      enabled: contractConfigured && Boolean(address),
    },
  });

  const ownedIds = useMemo(
    () => ((ownedResponse as bigint[] | undefined) ?? []).map((id) => Number(id)),
    [ownedResponse],
  );

  const {
    data: summaryResults,
    refetch: refetchSummaries,
    isFetching: fetchingSummaries,
  } = useReadContracts({
    contracts: ownedIds.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getDatabase',
      args: [BigInt(id)],
    })),
    query: {
      enabled: contractConfigured && ownedIds.length > 0,
    },
  });

  const databaseSummaries = useMemo<DatabaseSummary[]>(() => {
    if (!summaryResults) {
      return [];
    }
    const toSafeNumber = (value: unknown): number => {
      if (typeof value === 'bigint') return Number(value);
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };
    const toSafeHex = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (typeof value === 'bigint') {
        try {
          return ethers.hexlify(value);
        } catch {
          return '';
        }
      }
      if (value && typeof (value as { ciphertext?: unknown; handle?: unknown; value?: unknown }) === 'object') {
        const inner = (value as { ciphertext?: unknown; handle?: unknown; value?: unknown }).ciphertext
          ?? (value as { ciphertext?: unknown; handle?: unknown; value?: unknown }).handle
          ?? (value as { ciphertext?: unknown; handle?: unknown; value?: unknown }).value;
        if (inner) {
          const converted = toSafeHex(inner);
          if (converted) return converted;
        }
      }
      if (value && typeof (value as { toHexString?: () => string }).toHexString === 'function') {
        try {
          return (value as { toHexString: () => string }).toHexString();
        } catch {
          return '';
        }
      }
      if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
        try {
          return ethers.hexlify(value as Uint8Array);
        } catch {
          return '';
        }
      }
      if (Array.isArray(value)) {
        try {
          return ethers.hexlify(Uint8Array.from(value as number[]));
        } catch {
          return '';
        }
      }
      return '';
    };
    const toSafeString = (value: unknown): string => (typeof value === 'string' ? value : '');

    return ownedIds
      .map((id, index) => {
        const rawResult = summaryResults[index]?.result;

        const fromArray = (tuple: readonly unknown[]) => {
          const name = toSafeString(tuple[0]);
          const owner = toSafeString(tuple[1]);
          const createdAt = toSafeNumber(tuple[2]);
          const encryptedDatabaseAddress = toSafeHex(tuple[3]);
          const addressCommitment = toSafeHex(tuple[4]);
          const encryptedValueCount = toSafeNumber(tuple[5]);
          if (!encryptedDatabaseAddress || !addressCommitment) return undefined;
          return {
            id,
            name,
            owner,
            createdAt,
            encryptedDatabaseAddress,
            addressCommitment,
            encryptedValueCount,
          };
        };

        const fromObject = (obj: Record<string, unknown>) => {
          const name = toSafeString(obj.name);
          const owner = toSafeString(obj.owner);
          const createdAt = toSafeNumber(obj.createdAt);
          const encryptedDatabaseAddress = toSafeHex(obj.encryptedDatabaseAddress);
          const addressCommitment = toSafeHex(obj.addressCommitment);
          const encryptedValueCount = toSafeNumber(obj.encryptedValueCount);
          if (!encryptedDatabaseAddress || !addressCommitment) return undefined;
          return {
            id,
            name,
            owner,
            createdAt,
            encryptedDatabaseAddress,
            addressCommitment,
            encryptedValueCount,
          };
        };

        if (Array.isArray(rawResult)) {
          return fromArray(rawResult);
        }
        if (rawResult && typeof rawResult === 'object') {
          return fromObject(rawResult as Record<string, unknown>);
        }
        return undefined;
      })
      .filter(Boolean) as DatabaseSummary[];
  }, [summaryResults, ownedIds]);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!ownedIds.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !ownedIds.includes(selectedId)) {
      setSelectedId(ownedIds[0]);
    }
  }, [ownedIds, selectedId]);

  const selectedDatabase = databaseSummaries.find((db) => db.id === selectedId);

  const {
    data: decryptorResponse,
    refetch: refetchDecryptors,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getDatabaseDecryptors',
    args: selectedId !== null ? [BigInt(selectedId)] : undefined,
    query: {
      enabled: contractConfigured && selectedId !== null,
    },
  });

  const {
    data: valuesResponse,
    refetch: refetchValues,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getDatabaseValues',
    args: selectedId !== null ? [BigInt(selectedId)] : undefined,
    query: {
      enabled: contractConfigured && selectedId !== null,
    },
  });

  const decryptors = useMemo(() => (decryptorResponse as string[] | undefined) ?? [], [decryptorResponse]);
  const encryptedValues = useMemo(
    () => (valuesResponse as string[] | undefined) ?? [],
    [valuesResponse],
  );

  const [decryptedAddresses, setDecryptedAddresses] = useState<Record<number, string>>({});
  const [decryptedNumbers, setDecryptedNumbers] = useState<Record<number, (number | null)[]>>({});

  const [isDecryptingAddress, setIsDecryptingAddress] = useState(false);
  const [isDecryptingValues, setIsDecryptingValues] = useState(false);
  const [isStoringValue, setIsStoringValue] = useState(false);
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);

  const zamaReady = Boolean(instance) && !zamaLoading;

  const refreshAll = async () => {
    await Promise.all([refetchOwnedIds(), refetchSummaries()]);
  };

  const refreshSelectedDatabase = async () => {
    await Promise.all([refetchSummaries(), refetchValues(), refetchDecryptors()]);
  };

  const resolveSigner = async (): Promise<JsonRpcSigner> => {
    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      throw new Error('Please connect your wallet.');
    }
    return resolvedSigner;
  };

  const decryptDatabaseAddress = async () => {
    if (!selectedDatabase || !instance) {
      return;
    }
    if (CONTRACT_ADDRESS === ZERO_ADDRESS) {
      alert('Deploy the contract and set CONTRACT_ADDRESS before decrypting.');
      return;
    }
    setIsDecryptingAddress(true);
    try {
      const handle = selectedDatabase.encryptedDatabaseAddress;
      if (!handle || typeof handle !== 'string') {
        await refetchSummaries();
        throw new Error('Encrypted database handle is missing. Re-select the database after refresh and try again.');
      }
      const normalizedHandle = handle.toLowerCase();
      const keypair = instance.generateKeypair();
      const handlePairs = [{ handle: normalizedHandle, contractAddress: CONTRACT_ADDRESS }];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays,
      );

      const resolvedSigner = await resolveSigner();

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handlePairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        resolvedSigner.address,
        startTimeStamp,
        durationDays,
      );

      const decryptedPayload =
        result[normalizedHandle] ?? result[handle] ?? result[normalizedHandle.toLowerCase()];
      if (!decryptedPayload) {
        throw new Error('Unable to decrypt the database key.');
      }

      const formattedAddress = ethers.getAddress(
        `0x${BigInt(decryptedPayload).toString(16).padStart(40, '0')}`,
      );
      const derivedCommitment = computeCommitment(formattedAddress);
      if (
        derivedCommitment.toLowerCase() !== selectedDatabase.addressCommitment.toLowerCase()
      ) {
        throw new Error('Commitment mismatch. Please try decrypting again.');
      }

      setDecryptedAddresses((prev) => ({ ...prev, [selectedDatabase.id]: formattedAddress }));
    } catch (error) {
      console.error('Failed to decrypt address', error);
      alert(error instanceof Error ? error.message : 'Failed to decrypt the database key.');
    } finally {
      setIsDecryptingAddress(false);
    }
  };

  const storeEncryptedValue = async (value: number) => {
    if (!selectedDatabase || !instance) {
      return;
    }
    const unlockedAddress = decryptedAddresses[selectedDatabase.id];
    if (!unlockedAddress) {
      alert('Decrypt the database key before storing values.');
      return;
    }
    setIsStoringValue(true);
    try {
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, unlockedAddress)
        .add32(value)
        .encrypt();

      const registry = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, await resolveSigner());
      const tx = await registry.storeEncryptedValue(
        BigInt(selectedDatabase.id),
        computeCommitment(unlockedAddress),
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );
      await tx.wait();

      await refreshSelectedDatabase();
      setDecryptedNumbers((prev) => {
        const clone = { ...prev };
        delete clone[selectedDatabase.id];
        return clone;
      });
    } catch (error) {
      console.error('Failed to store value', error);
      alert(error instanceof Error ? error.message : 'Unable to store encrypted value.');
    } finally {
      setIsStoringValue(false);
    }
  };

  const shareDecryptAccess = async (target: string) => {
    if (!selectedDatabase) return;
    setIsGrantingAccess(true);
    try {
      const registry = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, await resolveSigner());
      const normalized = ethers.getAddress(target);
      const tx = await registry.grantDecryptPermission(BigInt(selectedDatabase.id), normalized);
      await tx.wait();
      await refetchDecryptors();
    } catch (error) {
      console.error('Failed to grant access', error);
      alert(error instanceof Error ? error.message : 'Unable to share decrypt permissions.');
    } finally {
      setIsGrantingAccess(false);
    }
  };

  const decryptStoredValues = async () => {
    if (!selectedDatabase || !instance) {
      return;
    }
    if (CONTRACT_ADDRESS === ZERO_ADDRESS) {
      alert('Deploy the contract and set CONTRACT_ADDRESS before decrypting values.');
      return;
    }
    if (!encryptedValues.length) {
      alert('No encrypted values to decrypt yet.');
      return;
    }
    setIsDecryptingValues(true);
    try {
      const keypair = instance.generateKeypair();
      const normalizedHandles = encryptedValues.map((handle) =>
        typeof handle === 'string' ? handle.toLowerCase() : null,
      );
      const handlePairs = normalizedHandles
        .map((handle) => (handle ? { handle, contractAddress: CONTRACT_ADDRESS } : null))
        .filter(Boolean) as { handle: string; contractAddress: `0x${string}` }[];

      if (!handlePairs.length) {
        throw new Error('No valid encrypted handles to decrypt.');
      }
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays,
      );
      const resolvedSigner = await resolveSigner();

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handlePairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        resolvedSigner.address,
        startTimeStamp,
        durationDays,
      );

      const decodedValues = encryptedValues.map((handle, index) => {
        const normalized = normalizedHandles[index];
        const raw = normalized ? result[normalized] ?? result[handle] : undefined;
        if (raw === undefined) return null;
        const numeric = Number(raw);
        return Number.isNaN(numeric) ? null : numeric;
      });

      setDecryptedNumbers((prev) => ({ ...prev, [selectedDatabase.id]: decodedValues }));
    } catch (error) {
      console.error('Failed to decrypt values', error);
      alert(error instanceof Error ? error.message : 'Unable to decrypt values.');
    } finally {
      setIsDecryptingValues(false);
    }
  };

  return (
    <div className="vault-app">
      {!contractConfigured ? (
        <div className="alert error">
          Deploy EncryptedDatabaseRegistry to Sepolia and update CONTRACT_ADDRESS in
          frontend/src/config/contracts.ts.
        </div>
      ) : null}
      {zamaError ? <div className="alert error">{zamaError}</div> : null}
      {!zamaReady ? (
        <div className="alert info">Initializing Zama Relayer...</div>
      ) : null}
      <div className="vault-grid">
        <CreateDatabaseCard
          account={address}
          signer={signer}
          instance={instance}
          zamaLoading={zamaLoading}
          contractReady={contractConfigured}
          onCreated={refreshAll}
        />
        <DatabaseList databases={databaseSummaries} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <DatabaseDetails
        database={selectedDatabase}
        decryptors={decryptors}
        encryptedValues={encryptedValues}
        decryptedAddress={selectedDatabase ? decryptedAddresses[selectedDatabase.id] : undefined}
        decryptedValues={selectedDatabase ? decryptedNumbers[selectedDatabase.id] : undefined}
        isDecryptingAddress={isDecryptingAddress}
        isDecryptingValues={isDecryptingValues}
        isStoringValue={isStoringValue}
        isGrantingAccess={isGrantingAccess}
        zamaReady={zamaReady}
        onDecryptAddress={decryptDatabaseAddress}
        onDecryptValues={decryptStoredValues}
        onStoreValue={storeEncryptedValue}
        onGrantAccess={shareDecryptAccess}
      />
      {contractConfigured && (loadingOwned || fetchingSummaries) ? (
        <p className="muted" style={{ textAlign: 'center' }}>
          Loading encrypted databases...
        </p>
      ) : null}
    </div>
  );
}
