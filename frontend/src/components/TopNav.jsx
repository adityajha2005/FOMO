import { useEffect, useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  BINANCE_DEPOSIT_URL,
  FOMO_APP_URL,
  fomoSearchUrl,
  fomoTraderUrl,
  openExternal,
} from "../utils/links.js";
import { searchUnified } from "../services/fomoApi.js";
import { formatUsd } from "../utils/format.js";
import { LIVE_API_ENABLED } from "../config/api.js";

export default function TopNav({ portfolioUsd = 0, cashUsd = 0 }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function runSearch(searchQuery = query) {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    if (!LIVE_API_ENABLED) {
      openExternal(fomoSearchUrl(trimmed));
      return;
    }

    setSearchLoading(true);
    setSearchOpen(true);

    try {
      const items = await searchUnified(trimmed, { limit: 8 });
      setResults(items);

      if (items.length === 0) {
        openExternal(fomoSearchUrl(trimmed));
      }
    } catch {
      openExternal(fomoSearchUrl(trimmed));
      setSearchOpen(false);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleResultClick(item) {
    if (item.type === "token") {
      openExternal(`https://fomo.family/token/${encodeURIComponent(item.symbol)}`);
    } else {
      openExternal(fomoTraderUrl(item.handle || item.displayName || item.name));
    }

    setSearchOpen(false);
    setQuery("");
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQuery(text.trim());
      }
    } catch {
      // clipboard unavailable
    }
  }

  const cash = cashUsd || 0;
  const portfolio = portfolioUsd || 0;

  return (
    <header className="top-nav">
      <Link className="logo" to="/">
        fomo
      </Link>

      <nav className="top-nav__links" aria-label="Main">
        <NavLink to="/app" className={({ isActive }) => (isActive ? "active" : undefined)}>
          FOMO App
        </NavLink>
        <NavLink to="/docs" className={({ isActive }) => (isActive ? "active" : undefined)}>
          Docs
        </NavLink>
        <NavLink to="/formulas" className={({ isActive }) => (isActive ? "active" : undefined)}>
          Formulas
        </NavLink>
      </nav>

      <div className="search-bar-wrap" ref={searchRef}>
        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <input
            placeholder="Search for tokens or traders..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => results.length > 0 && setSearchOpen(true)}
          />
          <button type="button" className="search-bar__paste" onClick={handlePaste}>
            Paste
          </button>
        </form>

        {searchOpen ? (
          <div className="search-results">
            {searchLoading ? <p className="sidebar-status">Searching...</p> : null}
            {!searchLoading && results.length === 0 ? (
              <p className="sidebar-status">No results. Press Enter to search on fomo.family.</p>
            ) : null}
            {!searchLoading
              ? results.map((item) => (
                  <button
                    key={`${item.type}-${item.handle || item.symbol || item.address}`}
                    type="button"
                    className="search-results__item"
                    onClick={() => handleResultClick(item)}
                  >
                    <strong>{item.type === "token" ? item.symbol : item.displayName || item.handle}</strong>
                    <span>{item.type === "token" ? item.name : `@${item.handle}`}</span>
                    {item.type === "token" && item.marketCapUsd != null ? (
                      <span className="num">{formatUsd(item.marketCapUsd, { compact: true })} mcap</span>
                    ) : null}
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>

      <div className="top-nav__right">
        <div className="wallet-block">
          <div className="wallet-block__cash">
            <strong className="num">${cash.toFixed(2)}</strong> cash{" "}
            <a className="wallet-block__deposit" href={BINANCE_DEPOSIT_URL} target="_blank" rel="noreferrer">
              Deposit more
            </a>
          </div>
          <div className="wallet-block__secondary num">${portfolio.toFixed(2)} —</div>
        </div>
        <a className="avatar avatar--nav" href={FOMO_APP_URL} target="_blank" rel="noreferrer" aria-label="Account">
          <span style={{ fontSize: "0.7rem" }}>●</span>
        </a>
      </div>
    </header>
  );
}
