import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace · CodeAtlas",
  robots: { index: false, follow: false },
};
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return children;
  return (
    <>
      <p className="demo-notice" role="note">
        <strong>Read-only demo.</strong> Browse the indexed repositories, search
        definitions, and follow the dependency graph. Indexing your own
        repository, semantic search, and pull requests need a running server.{" "}
        <a href="https://github.com/stingingend/CodeAtlas#run-with-docker">
          Run it yourself
        </a>
      </p>
      {children}
    </>
  );
}
