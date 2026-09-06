export default function TopNav({ portfolioUsd = 0, cashUsd = 0 }) {
  return (
    <header className="top-nav">
      <div className="top-nav__left">
        <div className="logo">fomo</div>
        <div className="search-bar">
          <span className="search-bar__icon">⌕</span>
          <input placeholder="Search for tokens or traders..." />
          <span className="search-bar__hint">/</span>
        </div>
      </div>

      <div className="top-nav__right">
        <div className="wallet-stat">
          <span className="wallet-stat__label">cash</span>
          <strong>${cashUsd.toFixed(2)}</strong>
        </div>
        <div className="wallet-stat">
          <span className="wallet-stat__label">portfolio</span>
          <strong>${portfolioUsd.toFixed(2)}</strong>
        </div>
        <button type="button" className="ghost-btn">Deposit more</button>
        <div className="avatar avatar--nav">A</div>
      </div>
    </header>
  );
}
