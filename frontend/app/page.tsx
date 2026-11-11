import Link from "next/link";
import { WaterChart } from "../components/water-chart";
import "./marketing.css";

const SOURCE = "https://github.com/stingingend/CodeAtlas";
const demo = process.env.NEXT_PUBLIC_DEMO === "1";

const features = [
  [
    "Search",
    "Search definitions by name, signature, or file path, then jump to the source.",
  ],
  [
    "Dependencies",
    "Browse imports and includes in a dependency graph, and inspect possible function calls.",
  ],
  [
    "Questions",
    "Search with a description of what the code does. Questions return matching source excerpts and links to GitHub.",
  ],
  [
    "Changes",
    "Check dependent files, import cycles, and changed definitions in public pull requests.",
  ],
];

const steps = [
  [
    "Connect",
    "Paste a public GitHub repository URL. CodeAtlas collects its supported source without running it.",
  ],
  [
    "Map",
    "Index definitions and relationships, then explore files in a connected workspace.",
  ],
  [
    "Investigate",
    "Search symbols, trace dependencies, or build a semantic index for source-cited questions.",
  ],
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-bar">
        <Link href="/" className="landing-mark" prefetch={false}>
          CodeAtlas<i>.</i>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#features">What it does</a>
          <a href="#workflow">How it works</a>
          <a href={SOURCE} target="_blank" rel="noreferrer">
            Source <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <WaterChart />
          <div className="landing-copy">
            <p className="landing-eyebrow">
              <span aria-hidden="true" /> SOURCE BROWSER FOR PUBLIC REPOSITORIES
            </p>
            <h1>
              Find your way through a codebase<i>.</i>
            </h1>
            <p className="landing-lead">
              Give CodeAtlas a public GitHub repository. Browse its files, find
              definitions, and see which parts depend on each other.
            </p>
            <div className="landing-actions">
              <Link className="landing-go" href="/workspace" prefetch={false}>
                {demo ? "Open the demo" : "Open the workspace"}{" "}
                <span aria-hidden="true">→</span>
              </Link>
              <a className="landing-link" href={SOURCE} target="_blank" rel="noreferrer">
                Source on GitHub <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="landing-note">
              PYTHON · JAVASCRIPT · TYPESCRIPT · C · C++
            </p>
          </div>
          <p className="landing-caption" aria-hidden="true">
            ILLUSTRATION / MOVE ACROSS THE WATER
          </p>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-heading">
            <h2>
              What it does <sup>04</sup>
            </h2>
            <p>Indexing and search run on your own server.</p>
          </div>
          <ol className="landing-rows">
            {features.map(([title, text], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className="landing-footnote">
            Call matches and change-impact reports are approximate. They help
            you find code to check; they don’t prove what will run or break.
          </p>
        </section>

        <section className="landing-section" id="workflow">
          <div className="landing-heading">
            <h2>
              How it works <sup>03</sup>
            </h2>
            <p>Source links always point at the commit that was indexed.</p>
          </div>
          <ol className="landing-steps">
            {steps.map(([title, text], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-close">
          <div>
            <p className="landing-eyebrow">
              <span aria-hidden="true" /> {demo ? "READ-ONLY DEMO" : "YOUR WORKSPACE"}
            </p>
            <h2>
              {demo
                ? "Two repositories are indexed and ready to browse."
                : "Index a repository and start exploring."}
            </h2>
          </div>
          <Link className="landing-go" href="/workspace" prefetch={false}>
            {demo ? "Open the demo" : "Open the workspace"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <footer className="landing-foot">
        <Link href="/" className="landing-mark" prefetch={false}>
          CodeAtlas<i>.</i>
        </Link>
        <a href={SOURCE} target="_blank" rel="noreferrer">
          Source on GitHub ↗
        </a>
      </footer>
    </div>
  );
}
