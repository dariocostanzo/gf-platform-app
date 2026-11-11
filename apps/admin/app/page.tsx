import { safetyInformationSources } from "@glutenfree/shared";

export default function HomePage() {
  return (
    <main className="page">
      <p className="eyebrow">Platform foundation</p>
      <h1>Gluten-Free Platform</h1>
      <p>
        The administration app is ready for future, permission-protected
        workflows. Restaurant safety information will retain its source rather
        than being inferred from ratings.
      </p>
      <p className="sources">
        Safety information source categories: {safetyInformationSources.length}
      </p>
    </main>
  );
}
