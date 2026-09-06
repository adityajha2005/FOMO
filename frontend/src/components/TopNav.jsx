import { useEffect, useRef, useState } from "react";
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

  return (
    <header className="top-nav">
      <div className="top-nav__left">
        <a
          className="logo"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          FOMO<span className="logo__suffix">Terminal</span>
        </a>

        <div className="search-bar-wrap" ref={searchRef}>
          <form
            className="search-bar"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}
          >
            <span className="search-bar__label">Search</span>
            <input
              placeholder="Symbol, trader, or contract"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => results.length > 0 && setSearchOpen(true)}
            />
            <button type="submit" className="search-bar__submit">
              Go
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
      </div>

      <div className="top-nav__right">
        <div className="wallet-stat">
          <span className="wallet-stat__label">Available</span>
          <strong className="num">${cashUsd.toFixed(2)}</strong>
        </div>
        <div className="wallet-stat">
          <span className="wallet-stat__label">Portfolio</span>
          <strong className="num">${portfolioUsd.toFixed(2)}</strong>
        </div>
        <a className="ghost-btn" href={BINANCE_DEPOSIT_URL} target="_blank" rel="noreferrer">
          Deposit
        </a>
        <a className="avatar avatar--nav" href={FOMO_APP_URL} target="_blank" rel="noreferrer" aria-label="Account">
          AC
        </a>
      </div>
    </header>
  );
}
