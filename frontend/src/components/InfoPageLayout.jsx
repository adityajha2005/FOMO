import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TopNav from "./TopNav.jsx";

export default function InfoPageLayout({
  title,
  subtitle,
  meta,
  toc = [],
  related = [],
  children,
  footer,
}) {
  const [activeId, setActiveId] = useState(toc[0]?.id ?? "");

  useEffect(() => {
    if (!toc.length) {
      return undefined;
    }

    const sections = toc
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);

    if (!sections.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [toc]);

  return (
    <div className="dashboard-shell theme-light theme-docs">
      <TopNav />
      <main className="docs">
        <header className="docs-header">
          <nav className="docs-crumb" aria-label="Breadcrumb">
            <Link to="/">Dashboard</Link>
            <span aria-hidden="true">/</span>
            <span>{title}</span>
          </nav>
          <div className="docs-header__main">
            <div>
              <h1 className="docs-header__title">{title}</h1>
              {subtitle ? <p className="docs-header__subtitle">{subtitle}</p> : null}
            </div>
            {meta ? <div className="docs-header__meta">{meta}</div> : null}
          </div>
        </header>

        <div className="docs-body">
          {toc.length ? (
            <aside className="docs-nav">
              <p className="docs-nav__label">Contents</p>
              <nav className="docs-nav__list">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={activeId === item.id ? "is-active" : undefined}
                    onClick={() => setActiveId(item.id)}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              {related.length ? (
                <div className="docs-nav__related">
                  <p className="docs-nav__label">See also</p>
                  {related.map((link) =>
                    link.external ? (
                      <a key={link.label} href={link.to} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.label} to={link.to}>
                        {link.label}
                      </Link>
                    ),
                  )}
                </div>
              ) : null}
            </aside>
          ) : null}

          <article className="docs-content">{children}</article>
        </div>

        {footer ? <footer className="docs-footer">{footer}</footer> : null}
      </main>
    </div>
  );
}

export function DocSection({ id, title, kicker, children }) {
  return (
    <section id={id} className="doc-section">
      {kicker ? <p className="doc-section__kicker">{kicker}</p> : null}
      <h2 className="doc-section__title">{title}</h2>
      <div className="doc-section__body">{children}</div>
    </section>
  );
}

export function CodeBlock({ children }) {
  return (
    <pre className="doc-pre">
      <code>{children}</code>
    </pre>
  );
}

export function Note({ children, variant = "default" }) {
  return <aside className={`doc-note doc-note--${variant}`}>{children}</aside>;
}
