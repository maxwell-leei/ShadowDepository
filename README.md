# Shadow Depository

Shadow Depository is an end-to-end encrypted data vault built on Zama FHEVM. Users mint databases whose keys are encrypted EVM addresses, store fully homomorphic encrypted numbers on-chain, and selectively share decryption rights with collaborators. Everything that matters - database identity, stored values, and access control - is anchored on-chain while cleartext never leaves the client.

## What this project solves
- Confidential data on public chains: numerical records stay encrypted at rest and in use, backed by Zama FHEVM.
- Verifiable ownership: each database stores a commitment of its decrypted address so clients can detect tampering before writing.
- Collaborative access: owners can add multiple decryptors; all permissions are enforced by the smart contract ACL.
- Full transparency without leaks: metadata (names, counts, timestamps) is queryable while payloads remain opaque.
- Smooth developer ergonomics: Hardhat tasks, TypeChain typings, and a React + Vite dapp using RainbowKit make the flow repeatable.

## Key advantages
- End-to-end encryption: Zama relayer encrypts inputs client-side; the registry only ever sees encrypted handles.
- Deterministic safety checks: commitments derived from decrypted addresses prevent misrouted writes.
- Multi-user sharing: ACL grants propagate to previously stored ciphertexts, avoiding manual re-encryption.
- Clear separation of reads/writes: viem handles reads, ethers handles writes, matching best practices for wallet UX.
- Ready-to-ship artifacts: ABI and addresses live under `deployments/`, keeping frontend and contracts in sync.

## Tech stack
- Smart contracts: Solidity 0.8.27, Hardhat, `@fhevm/hardhat-plugin`, Hardhat Deploy, TypeChain, Ethers v6, TypeScript tests.
- FHE & relayer: `@fhevm/solidity` and `@zama-fhe/relayer-sdk` for encryption, proof handling, and user decryption.
- Frontend: React 19, Vite, RainbowKit + wagmi + viem, ethers (writes), CSS modules (no Tailwind).
- Tooling: npm, ESLint, Prettier, solidity-coverage, hardhat-gas-reporter.

## How it works
1. Database creation: the dapp generates a random EVM address, encrypts it with Zama relayer, computes a commitment, and calls `createDatabase`. The contract stores metadata, ownership, and ACL seed.
2. Decrypt before use: authorized users decrypt the stored encrypted address, validate the commitment, and cache it client-side.
3. Store encrypted numbers: numbers are encrypted client-side using the decrypted address as context, then sent through `storeEncryptedValue`. The contract validates the commitment and extends ACL to all decryptors.
4. Read flow: ciphertext handles are fetched on-chain; authorized users perform client-side user decryption through the relayer to reveal clear values locally.
5. Sharing: owners call `grantDecryptPermission` to let more wallets decrypt both the database key and all previously stored ciphertexts.

## Repository layout
```
contracts/                 EncryptedDatabaseRegistry.sol
deploy/                    Hardhat deploy script
deployments/               Network artifacts and ABIs (use for the frontend)
tasks/                     Hardhat tasks for registry interactions
test/                      TypeScript tests for the registry
frontend/                  React + Vite dapp (reads via viem, writes via ethers)
docs/                      Zama FHEVM and relayer reference notes
hardhat.config.ts          Network and plugin configuration
```

## Smart contract overview
- `EncryptedDatabaseRegistry.sol`
  - `createDatabase(name, commitment, encryptedAddress, proof)`: registers a database with encrypted address, commitment, and owner ACL seeding.
  - `storeEncryptedValue(databaseId, commitment, encryptedValue, proof)`: appends encrypted `euint32` values after verifying the commitment.
  - `grantDecryptPermission(databaseId, account)`: owner-only ACL extension for the database key and all stored values.
  - `getDatabase`, `getDatabaseValues`, `getDatabaseDecryptors`, `getOwnedDatabases`, `totalDatabases`: view surfaces for metadata and ciphertext handles (never exposing plaintext).
  - Events: `DatabaseCreated`, `EncryptedValueStored`, `DecryptorGranted` for auditability.

## Prerequisites
- Node.js 20+ and npm.
- Environment variables in a local `.env` for Hardhat:
  - `PRIVATE_KEY` (used for deployment; no mnemonic support).
  - `INFURA_API_KEY` for Sepolia RPC (or set `SEPOLIA_RPC_URL` directly).
  - Optional `ETHERSCAN_API_KEY` for verification.
- Zama relayer access (Sepolia config is included via `SepoliaConfig`).

## Setup and core scripts
```bash
# Install backend dependencies
npm install

# Compile contracts and generate TypeChain types
npm run compile

# Run tests on the FHEVM-enabled Hardhat network
npm test

# Optional quality checks
npm run lint
npm run coverage
```

### Local development
- Start an FHE-enabled local node: `npm run chain`.
- Deploy locally: `npm run deploy:localhost`.
- Interact through tasks (examples below) or the dapp after pointing it at the local deployment.

### Sepolia deployment
```bash
# Ensure .env has PRIVATE_KEY and INFURA_API_KEY (or SEPOLIA_RPC_URL)
npm run deploy:sepolia

# Optional verification (constructor is parameterless)
npm run verify:sepolia -- <deployed_registry_address>
```
- The generated ABI and address are stored at `deployments/sepolia/EncryptedDatabaseRegistry.json`. Copy that ABI into the frontend config when updating builds.

### Hardhat tasks
```bash
# Show deployed address (per network)
npx hardhat task:address --network sepolia

# Create a database (secret is the decrypted database address)
npx hardhat task:create-database --name "Research Vault" --secret 0xAbc... --network sepolia

# Store an encrypted value
npx hardhat task:store-value --database 1 --secret 0xAbc... --value 42 --network sepolia

# List databases owned by the first signer
npx hardhat task:list-databases --network sepolia
```

## Frontend dapp (`frontend/`)
- Install deps: `cd frontend && npm install`.
- Configure:
  - Set the deployed contract address in `frontend/src/config/contracts.ts` (`CONTRACT_ADDRESS`).
  - Keep the ABI in `frontend/src/config/contracts.ts` in sync with `deployments/sepolia/EncryptedDatabaseRegistry.json` from the contracts build.
  - Set your WalletConnect project id in `frontend/src/config/wagmi.ts`.
- Run locally against Sepolia: `npm run dev`.
- Build and preview: `npm run build && npm run preview`.
- UX flow: connect wallet (RainbowKit), create a database (random key generated client-side), decrypt the database key, encrypt and store numbers, decrypt stored values, and share decrypt permissions with other addresses.
- Notes: the dapp avoids env vars and localstorage, reads via viem, writes via ethers, and expects a live Sepolia deployment (no localhost RPC in UI).

## Future roadmap
- Add revocation and key rotation mechanics for decryptors.
- Support additional encrypted data types and batched writes.
- Indexer/subgraph for cross-wallet discovery and analytics of encrypted databases.
- Gas and UX optimizations (batch ACL updates, optimistic UI states).
- Harden monitoring: alerting on failed commitments or unusual ACL changes; add more integration tests on Sepolia.

## References
- Internal docs: `docs/zama_llm.md` for contract-side FHE guidance, `docs/zama_doc_relayer.md` for relayer usage.
- Zama protocol docs: https://docs.zama.ai for deeper architecture and ACL details.
