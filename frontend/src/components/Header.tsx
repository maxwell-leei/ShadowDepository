import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <p className="eyebrow">Fully homomorphic data</p>
            <h1 className="header-title">Shadow Depository</h1>
            <p className="header-description">
              Register encrypted databases, decrypt Zama-protected keys, and collaborate securely on
              shared numeric data.
            </p>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
