// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    FHE,
    eaddress,
    euint32,
    externalEaddress,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Shadowepository
/// @notice Registers encrypted database addresses and manages encrypted records plus ACL sharing.
contract Shadowepository is ZamaEthereumConfig {
    struct Database {
        string name;
        address owner;
        uint64 createdAt;
        eaddress encryptedDatabaseAddress;
        bytes32 addressCommitment;
        address[] decryptors;
        euint32[] encryptedValues;
        mapping(address => bool) isDecryptor;
    }

    struct DatabaseInfo {
        string name;
        address owner;
        uint64 createdAt;
        eaddress encryptedDatabaseAddress;
        bytes32 addressCommitment;
        uint256 encryptedValueCount;
    }

    uint256 private _databaseCounter;
    mapping(uint256 => Database) private _databases;
    mapping(address => uint256[]) private _ownedDatabaseIds;

    event DatabaseCreated(uint256 indexed databaseId, address indexed owner, string name, bytes32 commitment);
    event EncryptedValueStored(uint256 indexed databaseId, address indexed owner, uint256 valueIndex);
    event DecryptorGranted(uint256 indexed databaseId, address indexed account);

    error EmptyName();
    error CommitmentRequired();
    error DatabaseNotFound(uint256 databaseId);
    error NotDatabaseOwner(uint256 databaseId, address caller);
    error InvalidCommitment();
    error ZeroAddress();
    error AddressAlreadyAuthorized(uint256 databaseId, address account);

    /// @notice Creates a new encrypted database entry.
    /// @param name Human-readable label for the database.
    /// @param addressCommitment Commitment hash of the decrypted database address.
    /// @param encryptedAddress Encrypted database address handle.
    /// @param inputProof Relayer proof for the encrypted address.
    /// @return databaseId Identifier for the created database.
    function createDatabase(
        string calldata name,
        bytes32 addressCommitment,
        externalEaddress encryptedAddress,
        bytes calldata inputProof
    ) external returns (uint256 databaseId) {
        if (bytes(name).length == 0) revert EmptyName();
        if (addressCommitment == bytes32(0)) revert CommitmentRequired();

        eaddress storedAddress = FHE.fromExternal(encryptedAddress, inputProof);

        databaseId = ++_databaseCounter;
        Database storage db = _databases[databaseId];
        db.name = name;
        db.owner = msg.sender;
        db.createdAt = uint64(block.timestamp);
        db.encryptedDatabaseAddress = storedAddress;
        db.addressCommitment = addressCommitment;

        db.decryptors.push(msg.sender);
        db.isDecryptor[msg.sender] = true;

        FHE.allowThis(storedAddress);
        FHE.allow(storedAddress, msg.sender);

        _ownedDatabaseIds[msg.sender].push(databaseId);

        emit DatabaseCreated(databaseId, msg.sender, name, addressCommitment);
    }

    /// @notice Stores an encrypted numeric value inside a database.
    /// @param databaseId The target database id.
    /// @param addressCommitment Commitment derived from the decrypted database address.
    /// @param value Encrypted euint32 handle for the value to store.
    /// @param inputProof Relayer proof for the encrypted value.
    function storeEncryptedValue(
        uint256 databaseId,
        bytes32 addressCommitment,
        externalEuint32 value,
        bytes calldata inputProof
    ) external {
        Database storage db = _getOwnedDatabase(databaseId);
        if (db.addressCommitment != addressCommitment) revert InvalidCommitment();

        euint32 storedValue = FHE.fromExternal(value, inputProof);
        db.encryptedValues.push(storedValue);

        uint256 newIndex = db.encryptedValues.length - 1;

        FHE.allowThis(storedValue);
        _allowValueForDecryptors(db, storedValue);

        emit EncryptedValueStored(databaseId, msg.sender, newIndex);
    }

    /// @notice Grants another address permission to decrypt the database address and stored values.
    /// @param databaseId Target database.
    /// @param account Address that should gain decrypt permissions.
    function grantDecryptPermission(uint256 databaseId, address account) external {
        if (account == address(0)) revert ZeroAddress();
        Database storage db = _getOwnedDatabase(databaseId);

        if (db.isDecryptor[account]) {
            revert AddressAlreadyAuthorized(databaseId, account);
        }

        db.isDecryptor[account] = true;
        db.decryptors.push(account);

        FHE.allow(db.encryptedDatabaseAddress, account);
        _allowExistingValues(db, account);

        emit DecryptorGranted(databaseId, account);
    }

    /// @notice Returns summary information about a database.
    function getDatabase(uint256 databaseId) external view returns (DatabaseInfo memory info) {
        Database storage db = _getDatabase(databaseId);
        info = DatabaseInfo({
            name: db.name,
            owner: db.owner,
            createdAt: db.createdAt,
            encryptedDatabaseAddress: db.encryptedDatabaseAddress,
            addressCommitment: db.addressCommitment,
            encryptedValueCount: db.encryptedValues.length
        });
    }

    /// @notice Lists all encrypted value handles for a database.
    function getDatabaseValues(uint256 databaseId) external view returns (euint32[] memory values) {
        Database storage db = _getDatabase(databaseId);
        uint256 length = db.encryptedValues.length;
        values = new euint32[](length);
        for (uint256 i = 0; i < length; ) {
            values[i] = db.encryptedValues[i];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Lists addresses with decrypt permissions for a database.
    function getDatabaseDecryptors(uint256 databaseId) external view returns (address[] memory addresses) {
        Database storage db = _getDatabase(databaseId);
        uint256 length = db.decryptors.length;
        addresses = new address[](length);
        for (uint256 i = 0; i < length; ) {
            addresses[i] = db.decryptors[i];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Returns the ids for databases owned by a wallet.
    function getOwnedDatabases(address owner) external view returns (uint256[] memory databaseIds) {
        uint256 length = _ownedDatabaseIds[owner].length;
        databaseIds = new uint256[](length);
        for (uint256 i = 0; i < length; ) {
            databaseIds[i] = _ownedDatabaseIds[owner][i];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Returns the total amount of created databases.
    function totalDatabases() external view returns (uint256) {
        return _databaseCounter;
    }

    function _getDatabase(uint256 databaseId) private view returns (Database storage db) {
        db = _databases[databaseId];
        if (db.owner == address(0)) {
            revert DatabaseNotFound(databaseId);
        }
    }

    function _getOwnedDatabase(uint256 databaseId) private view returns (Database storage db) {
        db = _getDatabase(databaseId);
        if (db.owner != msg.sender) {
            revert NotDatabaseOwner(databaseId, msg.sender);
        }
    }

    function _allowValueForDecryptors(Database storage db, euint32 encryptedValue) private {
        uint256 length = db.decryptors.length;
        for (uint256 i = 0; i < length; ) {
            FHE.allow(encryptedValue, db.decryptors[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _allowExistingValues(Database storage db, address account) private {
        uint256 length = db.encryptedValues.length;
        for (uint256 i = 0; i < length; ) {
            FHE.allow(db.encryptedValues[i], account);
            unchecked {
                ++i;
            }
        }
    }
}
